"""Keep task tracker/CSV synchronized after a real task report or start event."""
from __future__ import annotations

import argparse
import csv
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("task")
    parser.add_argument("state", choices=["pending", "in_progress", "blocked", "done"])
    parser.add_argument("--blocker", default="")
    args = parser.parse_args()
    report = ROOT / "planning/task-reports" / f"{args.task}.md"
    if args.state in {"done", "blocked"} and not report.exists():
        raise SystemExit("Write the actual task report before setting this state.")
    if args.state == "done" and "State: `done`" not in report.read_text(encoding="utf-8"):
        raise SystemExit("The report must explicitly record State: `done` with actual evidence.")
    path = ROOT / "planning/implementation-tasks.csv"
    with path.open(encoding="utf-8", newline="") as stream:
        reader = csv.DictReader(stream)
        fields, rows = list(reader.fieldnames), list(reader)
    row = next((r for r in rows if r["ID"] == args.task), None)
    if row is None:
        raise SystemExit("Unknown task")
    if args.state == "in_progress" and any(r["Status"] == "in_progress" and r is not row for r in rows):
        raise SystemExit("Only one active task is allowed. Report/block/finish the current task first.")
    row.update(Status=args.state, Blocker=args.blocker)
    tracker_path = ROOT / "planning/TASK_STATUS.md"
    tracker = tracker_path.read_text(encoding="utf-8")
    pattern = r"^\| " + re.escape(args.task) + r" \| (.*?) \| (.*?) \| (.*?) \| (.*?) \|$"
    tracker, count = re.subn(pattern, lambda m: f"| {args.task} | {m[1]} | {args.state} | {m[3]} | {args.blocker or 'None confirmed'} |", tracker, flags=re.M)
    if count != 1:
        raise SystemExit("Tracker row missing or duplicated")
    completed = sum(r["Status"] == "done" for r in rows)
    active = next((r["ID"] for r in rows if r["Status"] == "in_progress"), "none")
    tracker = re.sub(r"\*\*Progress:\*\* \d+ / \d+ tasks done\.", f"**Progress:** {completed} / {len(rows)} tasks done.", tracker)
    tracker = re.sub(r"\*\*Active application task:\*\* [^.]+\.", f"**Active application task:** {active}.", tracker)
    tracker_path.write_text(tracker, encoding="utf-8")
    with path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    print(f"{args.task}: {args.state}; progress {completed}/{len(rows)}; active {active}")


if __name__ == "__main__":
    main()
