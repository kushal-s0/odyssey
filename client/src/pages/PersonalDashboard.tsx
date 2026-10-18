import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Plus,
  FileText,
  Clock,
  MessageSquare,
  CheckCheck,
} from "lucide-react";
import { t, useLanguage } from "../i18n";
import { useWorkspace } from "../workspace";
import { PageIntro, Status, Empty } from "../components";
import IdeaVisualizer from "../IdeaVisualizer";
import BusinessNextSteps from "../BusinessNextSteps";
export default function PersonalDashboard() {
  useLanguage();
  const w = useWorkspace(),
    stats = w.dashboard,
    navigate = useNavigate();
  const latest =
    w.submissions.find((s) => s.id === stats?.latestSubmissionId) ??
    w.submissions.find((s) => s.assessment) ??
    w.submissions[0];
  const assessed = latest?.assessment
    ? latest
    : w.submissions.find((s) => s.assessment);
  const answer = (field?: string) => {
    if (assessed)
      navigate(
        `/submissions/${assessed.id}?repair=1${field ? `&field=${encodeURIComponent(field)}` : ""}`,
      );
  };
  return (
    <div className="friendly-dashboard">
      <PageIntro
        eyebrow={t("YOUR PERSONAL WORKSPACE")}
        title={t("My dashboard")}
        description={t("Hello, {name}. Let's grow your idea.", {
          name: w.session?.user?.name.split(" ")[0] ?? "",
        })}
        action={
          <Link className="button primary" to="/submit">
            <Plus size={16} />
            {t("Submit an idea")}
          </Link>
        }
      />
      <div className="friendly-stat-strip">
        {[
          {
            label: "My ideas",
            value: stats?.total ?? w.submissions.length,
            icon: FileText,
          },
          {
            label: "Being checked",
            value: stats?.processing ?? 0,
            icon: Clock,
          },
          {
            label: "Need my answers",
            value:
              stats?.needsClarification ??
              w.submissions.filter((s) => s.assessment?.questions.length)
                .length,
            icon: MessageSquare,
          },
          {
            label: "Ideas checked",
            value:
              stats?.assessed ??
              w.submissions.filter((s) => s.assessment).length,
            icon: CheckCheck,
          },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label}>
            <span className="friendly-stat-icon">
              <Icon size={17} />
            </span>
            <strong>{value}</strong>
            <span>{t(label)}</span>
          </div>
        ))}
      </div>
      {latest && !latest.assessment && (
        <div className="friendly-processing panel">
          <Clock size={19} />
          <span>
            {t(
              latest.status === "failed"
                ? "Your latest idea needs a check."
                : "Your latest idea is being checked.",
            )}
          </span>
          <Link to={`/submissions/${latest.id}`} className="text-link">
            {t("View progress")}
            <ArrowRight size={14} />
          </Link>
        </div>
      )}
      {assessed ? (
        <>
          <div className="friendly-latest-title">
            <div>
              <span className="eyebrow">{t("MY LATEST IDEA")}</span>
              <h2>{assessed.title}</h2>
            </div>
            <Status status={assessed.status} />
          </div>
          <IdeaVisualizer
            key={assessed.id}
            record={assessed}
            onAnswer={answer}
            onDetails={() => navigate(`/submissions/${assessed.id}?view=full`)}
          />
          <BusinessNextSteps
            key={assessed.id + assessed.assessment!.version}
            record={assessed}
            onAnswer={answer}
          />
        </>
      ) : (
        <section className="friendly-first-idea panel">
          <span className="friendly-first-icon">
            <Plus size={28} />
          </span>
          <h2>{t("Start with one small idea.")}</h2>
          <p>{t("Write it, upload a PDF, or use your voice.")}</p>
          <Link className="button primary" to="/submit">
            {t("Submit my first idea")}
            <ArrowRight size={16} />
          </Link>
        </section>
      )}
      <section className="panel friendly-recent">
        <div className="panel-heading">
          <h2>{t("My recent ideas")}</h2>
          <Link className="text-link" to="/submissions">
            {t("View all")}
            <ArrowRight size={14} />
          </Link>
        </div>
        {w.submissions.length ? (
          <div className="personal-ideas">
            {w.submissions.slice(0, 4).map((s) => (
              <Link
                className="personal-idea"
                key={s.id}
                to={`/submissions/${s.id}`}
              >
                <div>
                  <strong>{s.title}</strong>
                  <small>{new Date(s.createdAt).toLocaleDateString()}</small>
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
            description={t("Only your own ideas appear here.")}
          />
        )}
      </section>
    </div>
  );
}
