"""Run frozen positive/weak/missing/adversarial cases through real local HTTP/PG/models."""

# ruff: noqa: E402
from __future__ import annotations

import argparse
import csv
import hashlib
import importlib.metadata
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from urllib.parse import urlsplit
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "apps/api"), str(ROOT / "tests/api")]
from app.config import Settings
from app.db.pool import Database
from app.worker.manifest import MANIFEST_HASH
from test_submissions import submit
from test_worker_http import BOOTSTRAP, worker_workspace
from test_worker_process import http_server
from stop_child import stop_child

OUTPUT = ROOT / "evals/reports/comprehensive"
DATA = ROOT / "evals/benchmarks/comprehensive-business-cases.json"


def assertion(spec, value, economics):
    kind, field, expected = spec["kind"], spec.get("field"), spec.get("expected")
    business = value["business"]
    scores = value["scores"]
    if kind == "money":
        actual = business[field]["value"]
        passed = bool(
            actual
            and actual.get("currency") == "INR"
            and Decimal(actual["amount"]) == Decimal(expected)
        )
    elif kind == "missing":
        actual = {
            "value": business[field]["value"],
            "status": business[field]["status"],
        }
        passed = actual["value"] is None and actual["status"] == "missing"
    elif kind == "present":
        actual = business[field]["status"]
        passed = actual == "present"
    elif kind == "status":
        actual = business[field]["status"]
        passed = actual == expected
    elif kind == "economic_status":
        actual = next(
            (r["status"] for r in economics.get("checks", []) if r["kind"] == field),
            None,
        )
        passed = actual == expected
    elif kind == "surplus":
        actual = next(
            (
                r.get("calculated_amount")
                for r in economics.get("checks", [])
                if r["kind"] == "profit"
            ),
            None,
        )
        passed = actual is not None and Decimal(actual) == Decimal(expected)
    elif kind == "low_domain":
        actual = next(r["rating"] for r in value["domains"] if r["domain"] == field)
        passed = actual is None or actual <= expected
    elif kind == "score_min":
        actual = scores["provisional_potential"]
        passed = actual is not None and Decimal(actual) >= Decimal(expected)
    elif kind == "score_none":
        actual = scores["provisional_potential"]
        passed = actual is None
    elif kind == "headline_null":
        actual = scores["headline_potential"]
        passed = actual is None
    elif kind == "ranking_false":
        actual = scores["ranking_eligible"]
        passed = actual is False
    elif kind == "all_ratings_max":
        actual = [r["rating"] for r in value["domains"]]
        passed = all(r is None or r <= expected for r in actual)
    elif kind == "identity_absent":
        actual = expected in json.dumps(
            {"business": business, "domains": value["domains"]}
        )
        passed = not actual
    else:
        raise ValueError("Unknown frozen assertion")
    return {
        **spec,
        "observed": actual,
        "passed": passed,
        "abstained": kind == "low_domain" and actual is None,
    }


def save(report):
    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / "business.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    with (OUTPUT / "business.csv").open("w", encoding="utf-8-sig", newline="") as file:
        fields = [
            "case",
            "perspective",
            "status",
            "seconds",
            "passed_checks",
            "total_checks",
            "provisional",
            "headline",
            "coverage",
            "completeness",
            "withheld_reason",
            "clarity",
            "customer_need",
            "market_potential",
            "feasibility",
            "competition",
            "differentiation",
            "failed_checks",
        ]
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        for row in report["cases"]:
            checks = row.get("checks", [])
            scores = row.get("scores", {})
            writer.writerow(
                {
                    "case": row["case"],
                    "perspective": row["perspective"],
                    "status": row["status"],
                    "seconds": row["seconds"],
                    "passed_checks": sum(c["passed"] for c in checks),
                    "total_checks": len(checks),
                    "provisional": scores.get("provisional_potential"),
                    "headline": scores.get("headline_potential"),
                    "coverage": scores.get("evidence_coverage"),
                    "completeness": scores.get("completeness_percent"),
                    "withheld_reason": scores.get("withheld_reason"),
                    **{d["domain"]: d["rating"] for d in row.get("domains", [])},
                    "failed_checks": "; ".join(
                        c["kind"] + (":" + c["field"] if c.get("field") else "")
                        for c in checks
                        if not c["passed"]
                    ),
                }
            )


def main():
    global OUTPUT
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cases", nargs="*")
    parser.add_argument("--output-dir", type=Path, default=OUTPUT)
    args = parser.parse_args()
    OUTPUT = args.output_dir.resolve()
    if not OUTPUT.is_relative_to(ROOT.resolve()):
        raise SystemExit("Evaluation artifacts must stay inside this workspace")
    raw = DATA.read_bytes()
    frozen = json.loads(raw)
    cases = [c for c in frozen["cases"] if not args.cases or c["id"] in args.cases]
    dsn = (ROOT / ".local/test-database-url").read_text().strip()
    if urlsplit(dsn).hostname not in {"127.0.0.1", "localhost"}:
        raise SystemExit("Evaluation is restricted to loopback PostgreSQL")
    directory = ROOT / ".local" / ("comprehensive-business-" + uuid4().hex)
    directory.mkdir(parents=True)
    database = Database(Settings(_env_file=None, app_env="test", database_url=dsn))
    database.open()
    report = {
        "scope": "Actual pinned model + local HTTP/API/PostgreSQL on frozen authored synthetic scenarios; operator identity is a test fixture",
        "started_utc": datetime.now(timezone.utc).isoformat(),
        "manifest_hash": MANIFEST_HASH,
        "data_sha256": hashlib.sha256(raw).hexdigest(),
        "human_quality_validated": False,
        "deployed": False,
        "runtime": {
            p: importlib.metadata.version(p)
            for p in ("torch", "transformers", "numpy", "fastapi")
        },
        "cases": [],
    }
    if (OUTPUT / "business.json").exists() and args.cases:
        previous = json.loads((OUTPUT / "business.json").read_text(encoding="utf-8"))
        if (
            previous.get("data_sha256") != report["data_sha256"]
            or previous.get("manifest_hash") != MANIFEST_HASH
        ):
            raise SystemExit(
                "Do not mix incompatible runs; archive or use a new output directory"
            )
        report["cases"] = [
            row
            for row in previous["cases"]
            if row["case"] not in {c["id"] for c in cases}
        ]
    worker = None
    try:
        with worker_workspace(
            database,
            directory / "storage",
            lease_seconds=90,
            max_active_jobs_per_user=3,
        ) as (client, data, app, identity):
            (directory / "cleanup.private.json").write_text(
                json.dumps(
                    {
                        "people": [str(v) for v in data["people"]],
                        "cohorts": [str(v) for v in data["cohorts"]],
                    }
                ),
                encoding="utf-8",
            )
            with (
                http_server(app.state.settings) as origin,
                (directory / "worker.private.log").open("wb") as log,
            ):
                environment = {
                    k: v
                    for k, v in os.environ.items()
                    if k.upper()
                    in {
                        "SYSTEMROOT",
                        "WINDIR",
                        "PATH",
                        "TEMP",
                        "TMP",
                        "USERPROFILE",
                        "LOCALAPPDATA",
                        "CUDA_PATH",
                    }
                }
                environment.update(
                    WORKER_CREDENTIAL=BOOTSTRAP,
                    PYTHONIOENCODING="utf-8",
                    PYTHONPATH=str(ROOT / "apps/api"),
                )
                worker = subprocess.Popen(
                    [
                        sys.executable,
                        "-B",
                        "-m",
                        "app.worker",
                        "--api",
                        origin,
                        "--allow-loopback",
                        "--worker-id",
                        identity,
                        "--handler",
                        "app.pipeline.run:handler",
                        "--stages",
                        "extract:text",
                        "translate",
                        "structure",
                        "assess",
                        "--continuous",
                        "--stage-seconds",
                        "600",
                        "--local-poll-seconds",
                        "1",
                    ],
                    env=environment,
                    stdout=log,
                    stderr=subprocess.STDOUT,
                    creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
                )
                for case in cases:
                    began = time.perf_counter()
                    response = submit(
                        client,
                        {
                            "text": case["source"],
                            "preferred_language": case["language"],
                            "synthetic": True,
                            "scenario_family": "comprehensive-" + case["family"],
                        },
                    )
                    if response.status_code != 202:
                        raise RuntimeError(
                            "Local scenario admission failed: "
                            + str(response.status_code)
                        )
                    accepted = response.json()
                    state = {"status": "queued"}
                    while time.perf_counter() - began < 720:
                        state = client.get("/v1/jobs/" + accepted["job_id"]).json()
                        if state["status"] in {
                            "completed",
                            "partial",
                            "failed",
                            "needs_review",
                            "cancelled",
                        }:
                            break
                        if worker.poll() is not None:
                            raise RuntimeError(
                                "Owned evaluation worker stopped; inspect ignored diagnostic"
                            )
                        time.sleep(0.5)
                    row = {
                        "case": case["id"],
                        "perspective": case["perspective"],
                        "expected_interpretation": case["expected_interpretation"],
                        "source": case["source"],
                        "language": case["language"],
                        "status": state["status"],
                        "seconds": round(time.perf_counter() - began, 3),
                        "error_code": (state.get("error") or {}).get("code"),
                        "checks": [],
                        "measurements": [],
                    }
                    answer = client.get(
                        "/v1/submissions/" + accepted["submission_id"] + "/assessment"
                    )
                    if answer.status_code == 200:
                        value = answer.json()
                        economic = client.get(
                            "/v1/submissions/"
                            + accepted["submission_id"]
                            + "/economics"
                        ).json()
                        row.update(
                            scores=value["scores"],
                            domains=value["domains"],
                            economics=economic,
                            business=value["business"],
                            checks=[
                                assertion(spec, value, economic)
                                for spec in case["checks"]
                            ],
                        )
                        (OUTPUT / "cases").mkdir(parents=True, exist_ok=True)
                        (OUTPUT / "cases" / (case["id"] + ".json")).write_text(
                            json.dumps(
                                {"assessment": value, "economics": economic},
                                ensure_ascii=False,
                                indent=2,
                            ),
                            encoding="utf-8",
                        )
                    else:
                        row["checks"] = [
                            {
                                **spec,
                                "passed": False,
                                "observed": "No completed assessment",
                                "abstained": False,
                            }
                            for spec in case["checks"]
                        ]
                    with database.transaction() as c:
                        for publication in c.execute(
                            """SELECT s.stage_key,s.status,s.error_code,s.attempts,p.payload FROM public.job_stages s
                            LEFT JOIN public.stage_publications p ON p.stage_id=s.id WHERE s.job_id=%s ORDER BY stage_order""",
                            (accepted["job_id"],),
                        ).fetchall():
                            row.setdefault("stage_states", []).append(
                                {
                                    key: publication[key]
                                    for key in (
                                        "stage_key",
                                        "status",
                                        "error_code",
                                        "attempts",
                                    )
                                }
                            )
                            row["measurements"].extend(
                                [
                                    {"stage": publication["stage_key"], **m}
                                    for m in (publication["payload"] or {}).get(
                                        "measurements", []
                                    )
                                ]
                            )
                    if state["status"] not in {
                        "completed",
                        "partial",
                        "failed",
                        "needs_review",
                        "cancelled",
                    }:
                        client.post("/v1/jobs/" + accepted["job_id"] + "/cancel")
                    row["passed"] = bool(row["checks"]) and all(
                        c["passed"] for c in row["checks"]
                    )
                    if answer.status_code != 200:
                        (OUTPUT / "cases").mkdir(parents=True, exist_ok=True)
                        (OUTPUT / "cases" / (case["id"] + ".json")).write_text(
                            json.dumps(
                                {"assessment": None, "result": row},
                                ensure_ascii=False,
                                indent=2,
                            ),
                            encoding="utf-8",
                        )
                    report["cases"].append(row)
                    save(report)
                    print(
                        json.dumps(
                            {
                                "case": row["case"],
                                "status": row["status"],
                                "seconds": row["seconds"],
                                "passed_checks": sum(
                                    c["passed"] for c in row["checks"]
                                ),
                                "total_checks": len(row["checks"]),
                                "provisional": row.get("scores", {}).get(
                                    "provisional_potential"
                                ),
                                "feasibility": next(
                                    (
                                        d["rating"]
                                        for d in row.get("domains", [])
                                        if d["domain"] == "feasibility"
                                    ),
                                    None,
                                ),
                            }
                        ),
                        flush=True,
                    )
    finally:
        if worker:
            stop_child(worker)
        database.close()
        report["finished_utc"] = datetime.now(timezone.utc).isoformat()
        save(report)
    # Quality failures are measured results, not a reason to discard the report.
    print(
        "Saved all measured outcomes, including failed expectations; no production behavior was tuned."
    )


if __name__ == "__main__":
    main()
