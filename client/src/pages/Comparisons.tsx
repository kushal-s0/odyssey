import { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ChartNoAxesCombined,
  Info,
  Users,
} from "lucide-react";
import { PageIntro, Notice, Progress, Empty } from "../components";
import { useWorkspace } from "../workspace";
import { csvCell, download } from "../api";
import type { Submission } from "../../../shared/types";
const median = (a: number[]) => {
  if (!a.length) return null;
  const s = [...a].sort((a, b) => a - b);
  return s.length % 2
    ? s[Math.floor(s.length / 2)]!
    : Math.round(((s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) * 10) / 10;
};
export default function Comparisons() {
  const w = useWorkspace();
  const [groupBy, setGroupBy] = useState("cohort"),
    [cohort, setCohort] = useState(""),
    [language, setLanguage] = useState("");
  const items = w.submissions.filter(
    (s) =>
      (!cohort || s.cohortId === cohort) &&
      (!language || s.language === language),
  );
  const groups = useMemo(() => {
    const map = new Map<string, Submission[]>();
    for (const s of items) {
      const a = s.assessment;
      const grouping =
        groupBy === "cohort"
          ? (s.cohortName ?? "Unassigned cohort")
          : (a?.fields.find(
              (f) => f.key === (groupBy === "sector" ? "sector" : "trade"),
            )?.value ?? "Unassigned");
      const version = a?.rubricVersion ?? "not assessed";
      const key = `${grouping}|||${version}`;
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return [...map]
      .map(([key, records]) => {
        const [name, version] = key.split("|||");
        const comparable = records.filter(
          (s) => s.assessment?.score != null && s.assessment.coverage >= 70,
        );
        const dims = records[0]?.assessment?.dimensions ?? [];
        return {
          name: name!,
          version: version!,
          records,
          comparable,
          median: median(comparable.map((s) => s.assessment!.score!)),
          completeness: median(
            records.map((s) => s.assessment?.completeness ?? 0),
          ),
          dimensions: dims.map((d) => ({
            key: d.key,
            label: d.label,
            score: median(
              comparable
                .map(
                  (s) =>
                    s.assessment?.dimensions.find((x) => x.key === d.key)
                      ?.score,
                )
                .filter((n): n is number => n != null),
            ),
          })),
        };
      })
      .sort((a, b) => b.records.length - a.records.length);
  }, [items, groupBy]);
  function exportData() {
    download(
      `strive-${groupBy}-comparison.csv`,
      [
        [
          "Group",
          "Rubric",
          "Submissions",
          "Comparable",
          "Median assessment",
          "Median completeness",
        ],
        ...groups.map((g) => [
          g.name,
          g.version,
          g.records.length,
          g.comparable.length,
          g.median,
          g.completeness,
        ]),
      ]
        .map((r) => r.map(csvCell).join(","))
        .join("\r\n"),
      "text/csv",
    );
  }
  return (
    <>
      <PageIntro
        eyebrow="LOOK ACROSS THE PROGRAMME"
        title="Patterns worth a closer look."
        description="Compare the supporting information across sectors, trades, and cohorts."
        action={
          <button
            className="button secondary"
            disabled={!groups.length}
            onClick={exportData}
          >
            <ArrowDownToLine size={15} />
            Export comparison
          </button>
        }
      />
      {w.mode === "examples" && (
        <Notice>
          Example cohorts are synthetic. These charts illustrate the interface
          and do not describe Tata STRIVE programme outcomes.
        </Notice>
      )}
      <div className="comparison-controls">
        <div className="segmented-control">
          {[
            ["cohort", "Across cohorts"],
            ["trade", "By trade"],
            ["sector", "By domain / sector"],
          ].map(([key, label]) => (
            <button
              className={groupBy === key ? "active" : ""}
              key={key}
              onClick={() => setGroupBy(key!)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="toolbar-actions">
          <select
            value={cohort}
            onChange={(e) => setCohort(e.target.value)}
            aria-label="Filter cohort"
          >
            <option value="">All cohorts</option>
            {w.cohorts.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            aria-label="Filter language"
          >
            <option value="">All languages</option>
            {[...new Set(w.submissions.map((s) => s.language))].map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="comparison-summary">
        <div>
          <span className="comparison-stat">{items.length}</span>
          <span>submissions in view</span>
        </div>
        <div>
          <span className="comparison-stat">{groups.length}</span>
          <span>
            {groupBy === "cohort"
              ? "cohort"
              : groupBy === "trade"
                ? "trade"
                : "sector"}{" "}
            groups
          </span>
        </div>
        <div>
          <span className="comparison-stat">
            {items.filter((s) => s.assessment?.score != null).length}
          </span>
          <span>assessments with sufficient coverage</span>
        </div>
        <p>
          <Info size={16} />
          Small groups show descriptive values.
          <br />
          Percentile rankings require at least five comparable ideas.
        </p>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>
              {groupBy === "cohort"
                ? "Across-cohort comparison"
                : groupBy === "trade"
                  ? "Trade-wise comparison"
                  : "Domain-wise comparison"}
            </h2>
            <p>
              Records with incompatible rubric versions are displayed
              separately.
            </p>
          </div>
          <ChartNoAxesCombined size={20} />
        </div>
        {!groups.length ? (
          <Empty
            title="No comparison data yet"
            description="Assess submissions and assign programme metadata to see patterns here."
          />
        ) : (
          <div className="table-scroll">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>
                    {groupBy === "cohort"
                      ? "Cohort"
                      : groupBy === "trade"
                        ? "Trade"
                        : "Domain / sector"}
                  </th>
                  <th>Ideas</th>
                  <th>Comparable</th>
                  <th>Median assessment</th>
                  <th>Completeness</th>
                  <th>Interpretation</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={`${g.name}-${g.version}`}>
                    <td>
                      <strong>{g.name}</strong>
                      <div className="cell-secondary">{g.version}</div>
                    </td>
                    <td>{g.records.length}</td>
                    <td>{g.comparable.length}</td>
                    <td>
                      <span className="comparison-score">
                        {g.median ?? "—"}
                      </span>
                      {g.median != null && (
                        <span className="muted"> / 100</span>
                      )}
                    </td>
                    <td>
                      <div className="table-progress">
                        <span>{g.completeness ?? 0}%</span>
                        <Progress value={g.completeness ?? 0} />
                      </div>
                    </td>
                    <td>
                      <span className="outline-label">
                        {g.comparable.length >= 5
                          ? "Descriptive comparison"
                          : "Small sample"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="panel-footer">
          <Info size={14} />A higher assessment reflects more supporting
          information. It does not establish business viability.
        </div>
      </section>
      <div className="dimension-comparisons">
        {groups.map((g) => (
          <section key={g.name + g.version} className="panel">
            <div className="panel-heading">
              <div>
                <h3>{g.name}</h3>
                <p>
                  {g.comparable.length} comparable{" "}
                  {g.comparable.length === 1 ? "idea" : "ideas"} · dimension
                  medians
                </p>
              </div>
              <Users size={17} />
            </div>
            <div className="dimension-bars">
              {g.dimensions.length ? (
                g.dimensions.map((d) => (
                  <div key={d.key}>
                    <span>{d.label}</span>
                    <Progress value={(d.score ?? 0) * 25} />
                    <strong>
                      {d.score ?? "—"}
                      <small> / 4</small>
                    </strong>
                  </div>
                ))
              ) : (
                <p className="muted">No assessed dimensions yet.</p>
              )}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
