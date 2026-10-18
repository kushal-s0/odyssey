// localized-ui
import { t, useLanguage } from "../i18n";
import { Link } from "react-router-dom";
import { useState } from "react";
import {
  ArrowRight,
  Plus,
  ArrowUpRight,
  FileText,
  MessageSquare,
  Languages,
  ShieldCheck,
  ArrowDownToLine,
  CheckCheck,
  ScanLine,
  ChartNoAxesCombined,
} from "lucide-react";
import { useWorkspace } from "../workspace";
import {
  PageIntro,
  SubmissionsTable,
  Progress,
  Icon,
  Empty,
} from "../components";
import { csvCell, download } from "../api";
import PersonalDashboard from "./PersonalDashboard";
export default function Dashboard() {
  useLanguage();
  const w = useWorkspace(),
    [cohort, setCohort] = useState("");
  const items = w.submissions.filter((s) => !cohort || s.cohortId === cohort);
  const total = !cohort && w.dashboard ? w.dashboard.total : items.length;
  const assessable =
    !cohort && w.dashboard?.scored !== undefined
      ? w.dashboard.scored
      : items.filter((s) => s.assessment?.score != null).length;
  const repair =
    !cohort && w.dashboard
      ? w.dashboard.needsClarification
      : items.filter((s) => (s.assessment?.questions.length ?? 0) > 0).length;
  const completion =
    !cohort && w.dashboard?.meanCompleteness !== undefined
      ? w.dashboard.meanCompleteness
      : items.length
        ? Math.round(
            items.reduce((n, s) => n + (s.assessment?.completeness ?? 0), 0) /
              items.length,
          )
        : 0;
  const languages = new Set(items.map((s) => s.language)).size;
  const pending = items
    .filter((s) => (s.assessment?.questions.length ?? 0) > 0)
    .slice(0, 3);
  const latest = items.length
    ? Math.max(...items.map((s) => new Date(s.createdAt).getTime()))
    : Date.now();
  const activity = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(latest - (6 - i) * 86400000)
      .toISOString()
      .slice(0, 10);
    return {
      date,
      count: items.filter((s) => s.createdAt.startsWith(date)).length,
    };
  });
  function exportCsv() {
    download(
      "strive-assessment-overview.csv",
      [
        [
          "Idea",
          "Beneficiary",
          "Trade",
          "Cohort",
          "Language",
          "Status",
          "Information readiness",
          "Completeness",
        ],
        ...items.map((s) => [
          s.title,
          s.beneficiaryName,
          s.assessment?.fields.find((f) => f.key === "trade")?.value,
          s.cohortName,
          s.language,
          s.status,
          s.assessment?.score,
          s.assessment?.completeness,
        ]),
      ]
        .map((r) => r.map(csvCell).join(","))
        .join("\r\n"),
      "text/csv",
    );
  }
  if (w.session?.user?.role === "entrepreneur") return <PersonalDashboard />;
  return (
    <>
      <PageIntro
        eyebrow={t("YOUR ASSESSOR WORKSPACE")}
        title={t("A clearer view of every idea.")}
        description={t(
          "Understand proposals. Find the gaps. Help the next business take shape.",
        )}
        action={
          <Link to="/submit" className="button primary">
            <Plus size={16} />
            {t("Submit an idea")}
          </Link>
        }
      />
      <div className="dashboard-toolbar">
        <div className="section-tabs">
          <span className="section-tab active">{t("Programme overview")}</span>
          <Link className="section-tab" to="/comparisons">
            {t("Cohort insights")} <ArrowUpRight size={13} />
          </Link>
        </div>
        <div className="toolbar-actions">
          <select
            aria-label={t("Filter by cohort")}
            value={cohort}
            onChange={(e) => setCohort(e.target.value)}
          >
            <option value="">{t("All cohorts")}</option>
            {w.cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            className="button secondary small"
            onClick={exportCsv}
            disabled={!total}
          >
            <ArrowDownToLine size={14} />
            {t("Export")}
          </button>
        </div>
      </div>
      <div className="metric-grid">
        <Metric
          label={t("Ideas submitted")}
          value={String(total).padStart(2, "0")}
          icon={FileText}
          foot={`${new Set(items.map((s) => s.inputType)).size} submission formats`}
          visual={
            <div className="mini-bars">
              {activity.map((day) => (
                <span
                  key={day.date}
                  title={`${day.date}: ${day.count} submissions`}
                  style={{ height: day.count * 7 }}
                />
              ))}
            </div>
          }
        />
        <Metric
          label={t("Assessment available")}
          value={String(assessable).padStart(2, "0")}
          icon={CheckCheck}
          foot="Provisional · evidence-based"
          visual={
            <span className="metric-fraction">
              {total ? Math.round((assessable / total) * 100) : 0}%{" "}
              <ArrowUpRight size={13} />
            </span>
          }
        />
        <Metric
          label={t("Need clarification")}
          value={String(repair).padStart(2, "0")}
          icon={MessageSquare}
          foot="An opportunity for a better answer"
          visual={<span className="metric-pill">{t("Review queue")}</span>}
        />
        <Metric
          label={t("Information completeness")}
          value={`${completion}%`}
          icon={ScanLine}
          foot="Average across submissions"
          visual={
            <div className="metric-progress">
              <Progress value={completion} />
            </div>
          }
        />
      </div>
      <div className="dashboard-columns">
        <section className="panel recent-panel">
          <div className="panel-heading">
            <div>
              <h2>
                {t("Recent submissions")}{" "}
                <span className="count-pill">{total}</span>
              </h2>
              <p>
                {t("A first look at the ideas coming through your programme.")}
              </p>
            </div>
            <Link to="/submissions" className="text-link">
              {t("View all")} <ArrowRight size={14} />
            </Link>
          </div>
          <SubmissionsTable items={items.slice(0, 5)} compact />
          <div className="panel-footer">
            <ShieldCheck size={14} />
            {w.mode === "examples"
              ? t("Illustrative examples · synthetic profiles and cohorts")
              : t(
                  "Scores reflect available evidence and need assessor interpretation.",
                )}
          </div>
        </section>
        <aside className="insight-column">
          <section className="dark-card">
            <div className="dark-card-top">
              <span className="line-icon">
                <MessageSquare size={21} />
              </span>
              <span className="small-label">{t("EVIDENCE REPAIR LOOP")}</span>
            </div>
            <h2>
              {t("Good questions.")}
              <br />
              {t("Stronger proposals.")}
            </h2>
            <p>
              {t(
                "Turn missing information into a useful next conversation, in the beneficiary’s own language.",
              )}
            </p>
            <div className="dark-card-divider" />
            <div className="dark-card-bottom">
              <span>
                <strong>{repair}</strong> {t("ideas to clarify")}
              </span>
              <Link
                to={
                  pending[0]
                    ? `/submissions/${pending[0].id}?repair=1`
                    : "/submissions"
                }
                aria-label={t("Open clarification queue")}
                className="light-icon"
              >
                <ArrowUpRight size={20} />
              </Link>
            </div>
          </section>
          <section className="panel language-panel">
            <div className="panel-heading">
              <h3>{t("Ideas, in their own words.")}</h3>
              <Languages size={19} />
            </div>
            <div className="language-count">
              {languages.toString().padStart(2, "0")}
              <span>{t("languages represented")}</span>
            </div>
            <div className="language-tags">
              {[...new Set(items.map((s) => s.language))].map((l) => (
                <span key={l}>{l}</span>
              ))}
            </div>
            <p>
              {t("Language and writing style do not determine the assessment.")}
            </p>
          </section>
        </aside>
      </div>
      <section className="panel queue-panel">
        <div className="panel-heading">
          <div>
            <h2>{t("A little more clarity goes a long way.")}</h2>
            <p>
              {t(
                "These proposals have questions worth asking before the next step.",
              )}
            </p>
          </div>
          <span className="outline-label">{t("NEXT CONVERSATIONS")}</span>
        </div>
        {pending.length ? (
          <div className="repair-grid">
            {pending.map((s) => (
              <Link
                key={s.id}
                className="repair-card"
                to={`/submissions/${s.id}?repair=1`}
              >
                <div className="repair-card-top">
                  <span className="document-icon">
                    <Icon type={s.inputType} />
                  </span>
                  <ArrowUpRight size={16} />
                </div>
                <h3>{s.title}</h3>
                <p>
                  {s.assessment?.questions[0]?.question ??
                    "Review the original evidence and confirm unclear details."}
                </p>
                <span className="repair-card-footer">
                  {s.beneficiaryName}
                  <span>
                    {s.assessment?.questions.length ?? 0} {t("questions")}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <Empty
            title={t("No outstanding clarification")}
            description={t(
              "New questions will appear here when submissions need more detail.",
            )}
          />
        )}
      </section>
      <div className="principles-row">
        <span>
          <ShieldCheck size={16} />
          <strong>{t("Evidence first")}</strong>
          {t("Every fact has a reference")}
        </span>
        <span>
          <Languages size={16} />
          <strong>{t("Language inclusive")}</strong>
          {t("Originals stay available")}
        </span>
        <span>
          <ChartNoAxesCombined size={16} />
          <strong>{t("People decide")}</strong>
          {t("AI supports the first review")}
        </span>
      </div>
    </>
  );
}
function Metric({
  label,
  value,
  icon: Icon,
  foot,
  visual,
}: {
  label: string;
  value: string;
  icon: typeof FileText;
  foot: string;
  visual: React.ReactNode;
}) {
  useLanguage();
  return (
    <div className="metric-card">
      <div className="metric-top">
        <span>{t(label)}</span>
        <Icon size={17} />
      </div>
      <div className="metric-body">
        <strong>{value}</strong>
        {visual}
      </div>
      <div className="metric-foot">{foot}</div>
    </div>
  );
}
