"""Index-friendly trusted scope predicates; PostgreSQL RLS remains enforced."""
from .access import ActorView


def submission_scope(actor: ActorView) -> tuple[str, tuple[object,...]]:
    if actor.role=='admin':
        return 'TRUE',()
    cohorts=[cohort.id for cohort in actor.cohorts if actor.role=='assessor' and cohort.role=='assessor']
    if cohorts:
        return '(s.owner_id=%s OR s.cohort_id=ANY(%s::uuid[]))',(actor.id,cohorts)
    return 's.owner_id=%s',(actor.id,)
