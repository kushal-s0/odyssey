// localized-ui
import { questionText, t, useLanguage } from "../i18n";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Plus,
  FileText,
  Clock,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import { useWorkspace } from "../workspace";
import ScoreExplanation from "../ScoreExplanation";
import { PageIntro, Status, Empty, Progress } from "../components";
export default function PersonalDashboard() {
  useLanguage();
  const w = useWorkspace(),
    stats = w.dashboard;
  const latest =
    w.submissions.find((s) => s.id === stats?.latestSubmissionId) ??
    w.submissions.find((s) => s.assessment);
  const questions = w.submissions.filter((s) => s.assessment?.questions.length);
  return (
    <>
      <PageIntro
        eyebrow={t("YOUR PERSONAL WORKSPACE")}
        title={t("My dashboard")}
        description={t(
          "Welcome, {name}. Your ideas, progress, and next steps are here.",
          { name: w.session?.user?.name.split(" ")[0] ?? "—" },
        )}
        action={
          <Link className="button primary" to="/submit">
            <Plus size={16} /> {t("Submit an idea")}
          </Link>
        }
      />
      <div className="personal-metrics">
        <div className="metric-card">
          <FileText size={18} />
          <strong>{stats?.total ?? w.submissions.length}</strong>
          <span>{t("My submissions")}</span>
        </div>
        <div className="metric-card">
          <Clock size={18} />
          <strong>{stats?.processing ?? 0}</strong>
          <span>{t("Being processed")}</span>
        </div>
        <div className="metric-card">
          <MessageSquare size={18} />
          <strong>{stats?.needsClarification ?? questions.length}</strong>
          <span>{t("Need my answers")}</span>
        </div>
        <div className="metric-card">
          <ShieldCheck size={18} />
          <strong>
            {stats?.assessed ??
              w.submissions.filter((s) => s.assessment).length}
          </strong>
          <span>{t("Assessments received")}</span>
        </div>
      </div>
      <div className="personal-columns">
        <section className="panel personal-score">
          <span className="eyebrow">
            {t("MY LATEST INFORMATION READINESS")}
          </span>
          <h2>{latest?.title ?? "Your next step starts here."}</h2>
          {latest?.assessment ? (
            <>
              <div className="personal-score-number">
                {latest.assessment.score ?? "—"}
                <small>
                  {latest.assessment.score == null
                    ? t("More detail needed")
                    : "/ 100"}
                </small>
              </div>
              <p>
                {t(
                  "This score reflects the information you supplied, rather than a prediction of business success.",
                )}
              </p>
              <ScoreExplanation assessment={latest.assessment} compact />
              <div className="personal-progress">
                <span>
                  {t("Information completeness")}{" "}
                  <strong>{latest.assessment.completeness}%</strong>
                </span>
                <Progress value={latest.assessment.completeness} />
              </div>
              <Link
                className="button secondary"
                to={`/submissions/${latest.id}`}
              >
                {t("View my assessment")} <ArrowRight size={15} />
              </Link>
            </>
          ) : (
            <>
              <p>
                {t(
                  "Share your business idea to get a structured assessment and questions that help you develop it.",
                )}
              </p>
              <Link className="button secondary" to="/submit">
                {t("Submit my first idea")} <ArrowRight size={15} />
              </Link>
            </>
          )}
        </section>
        <section className="panel personal-next">
          <span className="eyebrow">{t("MY NEXT STEPS")}</span>
          <h2>{t("Keep your idea moving.")}</h2>
          {stats?.processing ? (
            <p className="notice">
              {t(
                "Your submission is being processed. This dashboard updates automatically.",
              )}
            </p>
          ) : null}
          {questions.length ? (
            questions.slice(0, 3).map((s) => (
              <Link
                className="personal-action"
                key={s.id}
                to={`/submissions/${s.id}?repair=1`}
              >
                <div>
                  <strong>{s.title}</strong>
                  <p>
                    {s.assessment?.questions[0] &&
                      questionText(s.assessment.questions[0])}
                  </p>
                  <small>
                    {s.assessment?.questions.length} {t("questions to clarify")}
                  </small>
                </div>
                <ArrowRight size={18} />
              </Link>
            ))
          ) : (
            <p>
              {t(
                "No clarification questions are waiting. Your assessor’s feedback will appear with your assessment.",
              )}
            </p>
          )}
          {w.submissions
            .filter((s) => s.review?.nextAction)
            .slice(0, 2)
            .map((s) => (
              <div className="personal-action" key={s.id}>
                <div>
                  <strong>
                    {t("Assessor feedback:")} {s.title}
                  </strong>
                  <p>{s.review?.nextAction}</p>
                  <Link to={`/submissions/${s.id}`}>{t("Read feedback")}</Link>
                </div>
              </div>
            ))}
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>{t("My recent ideas")}</h2>
            <p>{t("Only submissions linked to your account appear here.")}</p>
          </div>
          <Link className="text-link" to="/submissions">
            {t("View all")} <ArrowRight size={14} />
          </Link>
        </div>
        {w.submissions.length ? (
          <div className="personal-ideas">
            {w.submissions.slice(0, 6).map((s) => (
              <Link
                className="personal-idea"
                key={s.id}
                to={`/submissions/${s.id}`}
              >
                <div>
                  <strong>{s.title}</strong>
                  <small>
                    {new Date(s.createdAt).toLocaleDateString()} · {s.language}
                  </small>
                </div>
                <Status status={s.status} />
                <span className="personal-idea-score">
                  {s.assessment?.score == null
                    ? t("Score pending")
                    : `${s.assessment.score} / 100`}
                </span>
                <ArrowRight size={16} />
              </Link>
            ))}
          </div>
        ) : (
          <Empty
            title={t("Your first idea belongs here")}
            description={t(
              "Use text, a PDF, or your voice. Your original submission stays available to you.",
            )}
          />
        )}
      </section>
    </>
  );
}
