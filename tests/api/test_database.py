from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from pathlib import Path
from threading import Barrier
from uuid import uuid4

import psycopg
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.repositories.stages import StageRepository
from app.main import create_app

ROOT = Path(__file__).resolve().parents[2]


@contextmanager
def seeded(database):
    people = [uuid4() for _ in range(4)]
    cohorts = [uuid4(), uuid4()]
    submissions, revisions = [uuid4(), uuid4()], [uuid4(), uuid4()]
    attachment, stage, job = uuid4(), uuid4(), uuid4()
    with database.transaction() as c:
        for i, person in enumerate(people):
            c.execute("INSERT INTO auth.users(id) VALUES(%s)", (person,))
            c.execute("INSERT INTO public.profiles(id,role) VALUES(%s,%s)", (person,"applicant" if i<2 else "assessor"))
        for i, cohort in enumerate(cohorts):
            c.execute("INSERT INTO public.cohorts(id,name,synthetic) VALUES(%s,%s,true)", (cohort,"Synthetic test cohort"))
            c.execute("INSERT INTO public.cohort_memberships(user_id,cohort_id,role) VALUES(%s,%s,'applicant'),(%s,%s,'assessor')",
                      (people[i],cohort,people[i+2],cohort))
            c.execute("INSERT INTO public.submissions(id,owner_id,cohort_id,synthetic) VALUES(%s,%s,%s,true)",
                      (submissions[i],people[i],cohort))
            c.execute("INSERT INTO public.submission_versions(id,submission_id,revision_number,input_kind,source_text,input_hash,preferred_language,created_by) VALUES(%s,%s,1,'text','Synthetic DB test',%s,'en',%s)",
                      (revisions[i],submissions[i],"a"*64,people[i]))
            c.execute("UPDATE public.submissions SET current_revision_id=%s WHERE id=%s", (revisions[i],submissions[i]))
        object_path = f"{people[0]}/{attachment}.pdf"
        c.execute("INSERT INTO public.attachments(id,owner_id,submission_id,input_revision_id,object_path,filename_display,media_type,bytes,status) VALUES(%s,%s,%s,%s,%s,'synthetic.pdf','application/pdf',100,'attached')",
                  (attachment,people[0],submissions[0],revisions[0],object_path))
        c.execute("INSERT INTO storage.objects(bucket_id,name) VALUES('originals',%s)", (object_path,))
        c.execute("INSERT INTO public.processing_jobs(id,submission_id,input_revision_id,pipeline_version,backend) VALUES(%s,%s,%s,'synthetic-test','owned_worker')", (job,submissions[0],revisions[0]))
        c.execute("INSERT INTO public.job_stages(id,job_id,stage_key,stage_order,input_hash) VALUES(%s,%s,'extract:text',0,%s)", (stage,job,"a"*64))
    try:
        yield dict(people=people, cohorts=cohorts, submissions=submissions, revisions=revisions,
                   attachment=attachment, stage=stage, job=job, object_path=object_path)
    finally:
        with database.transaction() as c:
            c.execute("DELETE FROM storage.objects WHERE name=%s", (object_path,))
            c.execute("DELETE FROM public.submissions WHERE id=ANY(%s)", (submissions,))
            c.execute("DELETE FROM public.cohorts WHERE id=ANY(%s)", (cohorts,))
            c.execute("DELETE FROM auth.users WHERE id=ANY(%s)", (people,))


def test_real_postgres_migrations_are_repeatable(database):
    with database.transaction() as c:
        for path in sorted((ROOT / "supabase/migrations").glob("*.sql")):
            c.execute(path.read_text())
        assert c.execute("SELECT count(*) AS n FROM public.schema_migrations").fetchone()["n"] == len(list((ROOT/'supabase/migrations').glob('*.sql')))
        assert c.execute("SELECT extversion FROM pg_extension WHERE extname='vector'").fetchone()
        assert c.execute("SELECT public FROM storage.buckets WHERE id='originals'").fetchone()["public"] is False


def test_database_and_storage_rls_are_independently_scoped(database):
    with seeded(database) as data:
        for index in range(4):
            with database.transaction(data["people"][index], read_scoped=True) as c:
                rows = c.execute("SELECT id FROM public.submissions WHERE id=ANY(%s)", (data["submissions"],)).fetchall()
                expected = data["submissions"][index if index<2 else index-2]
                assert [r["id"] for r in rows] == [expected]
                objects = c.execute("SELECT name FROM storage.objects WHERE name=%s", (data["object_path"],)).fetchall()
                assert bool(objects) == (index in {0,2})


def test_browser_cannot_self_promote_or_claim_a_worker_stage(database):
    with seeded(database) as data:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            with database.transaction(data["people"][0], read_scoped=True) as c:
                c.execute("UPDATE public.profiles SET role='admin' WHERE id=%s", (data["people"][0],))
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            with database.transaction(data["people"][0], read_scoped=True) as c:
                c.execute("SELECT * FROM public.claim_stage('attacker','owned_worker',180,3)")


def test_claim_is_exclusive_under_real_concurrent_connections(database):
    with seeded(database) as data:
        # Other tests clean their stages; this fixture contains one eligible stage.
        barrier = Barrier(2)
        def claim(worker):
            barrier.wait(timeout=10)
            return StageRepository(database).claim(worker)
        with ThreadPoolExecutor(max_workers=2) as workers:
            results = list(workers.map(claim, ["worker-one", "worker-two"]))
        chosen = [row for row in results if row]
        assert len(chosen) == 1 and chosen[0]["id"] == data["stage"]
        assert chosen[0]["lease_generation"] == 1


def test_expired_worker_is_fenced_and_duplicate_publication_is_idempotent(database):
    with seeded(database) as data:
        repository = StageRepository(database)
        first = repository.claim("worker-old")
        assert first and first["id"] == data["stage"]
        with database.transaction() as c:
            c.execute("UPDATE public.job_stages SET lease_until=clock_timestamp()-interval '1 second' WHERE id=%s", (data["stage"],))
        second = repository.claim("worker-new")
        assert second and second["lease_generation"] == 2
        assert not repository.heartbeat(data["stage"], "worker-old", 1)
        with pytest.raises(psycopg.errors.ObjectNotInPrerequisiteState):
            repository.publish(data["stage"], "worker-old", 1, "b"*64, {"synthetic": True})
        assert repository.publish(data["stage"], "worker-new", 2, "b"*64, {"synthetic": True})
        assert not repository.publish(data["stage"], "worker-new", 2, "b"*64, {"synthetic": True})
        with pytest.raises(psycopg.errors.UniqueViolation):
            repository.publish(data["stage"], "worker-new", 2, "b"*64, {"different": True})
        with database.transaction() as c:
            assert c.execute("SELECT count(*) AS n FROM public.stage_publications WHERE stage_id=%s", (data["stage"],)).fetchone()["n"] == 1


def test_cross_submission_attachment_revision_rejected(database):
    with seeded(database) as data:
        with pytest.raises(psycopg.errors.ForeignKeyViolation):
            with database.transaction() as c:
                c.execute("UPDATE public.attachments SET input_revision_id=%s WHERE id=%s", (data["revisions"][1],data["attachment"]))


def test_scoped_role_and_subject_do_not_leak_between_pool_connections(database):
    with seeded(database) as data:
        for person in [data["people"][0], data["people"][1], data["people"][0]]:
            with database.transaction(person, read_scoped=True) as c:
                rows = c.execute("SELECT owner_id FROM public.submissions WHERE id=ANY(%s)", (data["submissions"],)).fetchall()
                assert len(rows) == 1 and rows[0]["owner_id"] == person


def test_api_reports_real_database_readiness_without_claiming_models(database):
    settings = Settings(app_env="test", database_url=(ROOT / ".local/test-database-url").read_text().strip(), _env_file=None)
    with TestClient(create_app(settings)) as client:
        response = client.get("/health/ready")
        assert response.status_code == 503
        assert response.json()["checks"]["database"] == "ready"
        assert response.json()["checks"]["models"] == "not_verified"
        assert client.get('/health/workspace').status_code == 200
        assert client.get('/health/workspace').json() == {'database': 'ready'}
