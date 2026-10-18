"""Traceable task matrix for the user-requested implementation/performance report."""

import csv
import json
import re
from collections import Counter
from pathlib import Path
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "evals/reports/comprehensive"
DETAILS = {
    "T01": (
        "Source inventory and runtime feasibility",
        "scripts/inventory_dataset.py; models/manifest.json",
        "55 original files:42 PDFs/13 recordings,109 pages; historical multimodal runs; fresh runtime in this evaluation.",
        "No expert corpus labels; historical RTX5050 evidence must not be attributed to the current RTX3050.",
    ),
    "T02": (
        "React/Vite frontend, FastAPI API, config and launch scripts",
        "apps/web; apps/api; scripts/dev.py; start.cmd",
        "Last recorded frontend type/lint/build pass; current192-test API suite passes.",
        "Build/runtime success is not a hosted deployment or semantic model accuracy.",
    ),
    "T03": (
        "Typed evidence, business fields, null states and proposed rubric",
        "apps/api/app/contracts; apps/api/app/domain/scoring.py; docs/RUBRIC.md",
        "Strict schemas and exact Decimal arithmetic covered by current regression.",
        "Rubric is project-proposed, not an organizer-calibrated predictor of business success.",
    ),
    "T04": (
        "Supabase/Postgres persistence, RLS, private objects and durable leases",
        "supabase/migrations; apps/api/app/db; repositories",
        "Fresh local checks use migrations001-008; historical Supabase migration006 approved/applied.",
        "This evaluation changes only loopback test DB; hosted Free-plan/recovery and007/008 approval incomplete.",
    ),
    "T05": (
        "Supabase login, asymmetric JWT checks and trusted role/cohort access",
        "apps/api/app/auth; apps/web/src/auth",
        "Historical fresh-token fix:issuer1.102s ahead, bounded5s leeway; immediate live workspace200. Current signed fixture tests pass.",
        "Current evaluation Auth identity is explicitly a fixture; full hosted refresh/cohort matrix incomplete.",
    ),
    "T06": (
        "Private text/file admission, metadata, SHA256 and idempotent submission",
        "apps/api/app/routes/uploads.py; submissions.py; services/media.py",
        "Historical55 corpus and18 synthetic input admissions; hosted PDF original integrity measured.",
        "Hosted upload retry/recovery matrix incomplete; an upload is not a processed assessment.",
    ),
    "T07": (
        "Restricted outbound worker, per-stage checkpoints, fencing and recovery",
        "apps/api/app/worker; services/jobs.py; routes/internal_jobs.py",
        "Current process/lease regressions pass; historical model recovery and local5s idle polling.",
        "GPU concurrency one; secondary HF enqueue/quota/sleep remain unverified/deferred.",
    ),
    "T08": (
        "Applicant text/PDF/audio recording, guided interview and saved results",
        "apps/web/src/pages/ApplicantWorkspace.tsx; components/GuidedIdea.tsx",
        "Historical15 Edge journeys incl.navigation, drafts, token refresh, media cleanup; browser model/Auth outputs are fixtures.",
        "Reuses separately measured live provider/model results; browser fixture pass is not AI accuracy.",
    ),
    "T09": (
        "Language detection, translation, exact-quote facts and unknown/conflict guards",
        "providers/local_models.py; providers/translation.py; pipeline/text.py; explicit.py",
        "Fresh14-scenario challenge and13 language examples in this report; older3 judge cases passed.",
        "Original-corpus and regional semantic quality not independently reviewed.",
    ),
    "T09A": (
        "Frozen MiniLM features + experimental logistic relevance head; baseline serving",
        "training; models/relevance; docs/MODEL_CARD.md",
        "102 machine-labelled QA pairs from11 PDFs/5 coarse groups; fitted and reproducible; fresh16-pair challenge.",
        "Candidate rejected for serving; zero independent labels, one-class holdouts. No new training in this work.",
    ),
    "T10": (
        "PDF text layer and page-wise PaddleOCR with traceable uncertain evidence",
        "pipeline/pdf.py; providers/document_ocr.py",
        "Historical digital PDF70.453s;11-page Hindi scan extraction/recovery415.188s; fresh3 synthetic OCR references.",
        "Unreadable/capped scan pages; typed/script-font images cannot establish handwriting accuracy.",
    ),
    "T11": (
        "Whisper speech, Odia-specific weights, sample ranges and silent-chunk guard",
        "pipeline/audio.py; providers/speech.py",
        "Historical full Hindi/Telugu/Bengali/Odia processing/recovery; fresh English synthetic WER and Odia smoke.",
        "No independent regional transcripts; selected/declared language is not proven detection.",
    ),
    "T12": (
        "Six grounded domain judgments; server-derived potential/coverage/completeness",
        "pipeline/assess.py; assessment_rules.py; assessment_persistence.py; domain/scoring.py",
        "Fresh actual positive/weak/unknown/adversarial outcomes and exact totals in business.csv.",
        "No binary success classifier. Semantic grading can fail despite valid references; financial checks are separate.",
    ),
    "T13": (
        "Scoped assessor queue, original evidence, reviews and correction revisions",
        "apps/web/src/pages/AssessorWorkspace.tsx; routes/reviews.py",
        "API role/scope/stale/idempotency tests; historical browser review/correction/history journeys.",
        "All-format source and real model/browser acceptance remain incomplete.",
    ),
    "T14": (
        "Frozen384D embeddings, pgvector neighbours and authorized family/version filtering",
        "domain/similarity.py; routes/similar.py; providers/local_models.py",
        "Fresh curated4-query/10-idea Recall/MRR; API access and stale/family filtering covered.",
        "Curated local retrieval is not annotated real-submission Recall@5.",
    ),
    "T15": (
        "Confirmed-area OSM lookup, attributed dated snapshots and outage fallback",
        "routes/location_insights.py; providers/osm.py",
        "Historical bounded real lookup plus snapshot/outage UI; no public load test.",
        "OSM rural/informal coverage incomplete; absence is not evidence of no competition.",
    ),
    "T16": (
        "Domain/trade/cohort/across-cohort SQL comparisons and charts/CSV",
        "routes/analytics.py; components/ComparisonGraphs.tsx",
        "Historical graph/table/keyboard CSV browser checks and scoped aggregates.",
        "Samples/denominators/missing values matter; comparison charts do not validate the rubric.",
    ),
    "T17": (
        "Prioritized contextual gaps/conflicts, localized questions and linked text/audio revisions",
        "domain/questions.py; routes/clarifications.py; pipeline/inheritance.py",
        "Historical typed/audio follow-up inference and immutable history; current API contract tests.",
        "Localized question fluency and answer quality need human review.",
    ),
    "T18": (
        "Deterministic funding/revenue/surplus checks and separate what-if/stress planner",
        "domain/economics.py; routes/economics.py; components/ScenarioPlanner.tsx",
        "Fresh negative-surplus/conflicting-funding assertions; exact arithmetic tests.",
        "Unknown units/periods block arithmetic; estimates are not verified net profit. Checks do not automatically lower ratings.",
    ),
    "T19": (
        "Current/historical reports, printable HTML and evidence-linked plan exports",
        "routes/reports.py; apps/web/src/components",
        "Historical scoped export/print/PDF browser checks; secret-safe source/context tests.",
        "Exports reproduce model limitations; source/format readability not fully reviewed for all original media.",
    ),
    "T20": (
        "Dataset accounting, evaluation scripts,18 authored rehearsal inputs and this evaluation",
        "evals; input; scripts/evaluate_business_scenarios.py; scripts/evaluate_model_components.py",
        "Fresh actual model outputs with frozen source expectations and per-assertion denominators.",
        "Remains blocked on independently reviewed corpus labels, transcripts/retrieval/fairness outcomes.",
    ),
    "T21": (
        "Bounded auth/uploads, RLS/stale writes, privacy cleanup and dependency audit",
        "apps/api/app/auth; services; routes/deletion.py; evals/reports/*dependency-audit*",
        "Current192 regression plus historical dependency/private-value scans.",
        "No claim of exhaustive penetration testing, commercial security certification or all provider limits.",
    ),
    "T22": (
        "Two API replicas and local paced metadata workload/recovery experiment",
        "scripts/verify_scale.py; docs/SCALABILITY.md",
        "Historical4988 requests/303s,50 sessions,p5086.335ms,p95212.115ms,0 errors;20 synthetic jobs recovered.",
        "Synthetic tiny handlers, no LLM throughput. One-second diagnostic p951944.633ms; hosted scale not demonstrated.",
    ),
    "T23": (
        "Allowlisted release artifacts, API image and free-host deployment configuration",
        "scripts/package_release.py; docs/DEPLOYMENT.md; infra",
        "Historical105232638-byte non-root API image; liveness2.688s;512MiB limit; no model weights/private env.",
        "Container/image build and archive creation are not cloud deployment/account verification.",
    ),
    "T23A": (
        "Pinned owned-model runtime and manifest/provenance packaging",
        "models; docs/MODEL_DEPLOYMENT.md; worker adapter",
        "Actual owned inference and pinned artifact hashes; this evaluation provisions current-machine public weights.",
        "Secondary free HF provisioning, quota and publication not completed.",
    ),
    "T24": (
        "Public hosting configuration/preparation; no approved public release",
        "docs/DEPLOYMENT.md; infrastructure config",
        "No public application URL verified; local/Supabase-backed development only.",
        "No approved public host artifacts/destinations/Free-plan verification.",
    ),
    "T25": (
        "Deployment acceptance plan; local recovery evidence retained",
        "planning/task-reports/T25.md; local recovery harnesses",
        "No deployed release for a public journey/recovery run.",
        "Local recovery cannot substitute for public deployed acceptance.",
    ),
    "T26": (
        "Continuation/readiness notes, explanations and committee handover",
        "planning/SESSION_HANDOFF.md; explanations; this report",
        "Traceable local capability/blocker records and measured test artifacts.",
        "Final handover remains conditional on human evaluation and deployed release evidence.",
    ),
    "T27": (
        "Detailed free-configuration deployment walkthrough",
        "docs/DEPLOYMENT.md; docs/SETUP.md",
        "Document prepared with secrets, startup, recovery and limitations.",
        "No clean deployed reproduction; publication needs separate explicit approval.",
    ),
}


def main():
    text = (ROOT / "planning/TASK_STATUS.md").read_text(encoding="utf-8")
    rows = []
    for match in re.finditer(
        r"^\| (T\d+[A-Z]?) \| ([^|]+) \| (done|blocked|pending|in_progress) \| ([^|]+) \| ([^|]*) \|$",
        text,
        re.M,
    ):
        identity, name, status, report, blocker = match.groups()
        implemented, how, evidence, limits = DETAILS[identity]
        paths = [s.strip() for s in how.split(";")]
        verified = []
        for path in paths:
            candidates = [path, "apps/api/app/" + path]
            match = next((p for p in candidates if (ROOT / p).exists()), None)
            if match:
                verified.append(match)
        rows.append(
            {
                "id": identity,
                "task": name.strip(),
                "tracker_status": status,
                "implemented": implemented,
                "how": "; ".join(verified) or how,
                "evidence_performance": evidence,
                "limitations": limits,
                "tracker_blocker": blocker.strip(),
                "task_report": "planning/task-reports/" + identity + ".md",
                "exact_existing_paths": verified,
            }
        )
    if len(rows) != 29:
        raise ValueError("Task audit must account for all29 tracker IDs")
    xml = ROOT / ".local/comprehensive-api-tests.xml"
    tests = {}
    if xml.exists():
        root = ElementTree.parse(xml).getroot()
        cases = root.findall(".//testcase")
        grouped = Counter(c.attrib.get("classname", "unknown") for c in cases)
        tests = {
            "tests": len(cases),
            "failures": len(root.findall(".//failure")),
            "errors": len(root.findall(".//error")),
            "skipped": len(root.findall(".//skipped")),
            "test_case_seconds_sum": sum(
                float(c.attrib.get("time", "0")) for c in cases
            ),
            "groups": dict(grouped),
            "suite_seconds": sum(
                float(s.attrib.get("time", "0")) for s in root.findall(".//testsuite")
            ),
        }
    OUT.mkdir(parents=True, exist_ok=True)
    result = {
        "scope": "Current code/tracker audit plus explicitly dated/historical measurements; task done count is not product completion percent",
        "status_counts": dict(Counter(r["tracker_status"] for r in rows)),
        "tasks": rows,
        "fresh_api_regression": tests,
    }
    (OUT / "task-audit.json").write_text(
        json.dumps(result, indent=2) + "\n", encoding="utf-8"
    )
    with (OUT / "task-audit.csv").open("w", encoding="utf-8-sig", newline="") as output:
        fields = [
            "id",
            "task",
            "tracker_status",
            "implemented",
            "how",
            "evidence_performance",
            "limitations",
            "tracker_blocker",
            "task_report",
        ]
        writer = csv.DictWriter(output, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
    print(
        json.dumps(
            {
                "tasks": len(rows),
                "status_counts": result["status_counts"],
                "fresh_tests": tests.get("tests"),
            }
        )
    )


if __name__ == "__main__":
    main()
