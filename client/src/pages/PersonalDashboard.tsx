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
import { PageIntro, Status, Empty, Progress } from "../components";
export default function PersonalDashboard() {
  const w = useWorkspace(),
    stats = w.dashboard;
  const latest =
    w.submissions.find((s) => s.id === stats?.latestSubmissionId) ??
    w.submissions.find((s) => s.assessment);
  const questions = w.submissions.filter((s) => s.assessment?.questions.length);
  return (
    <>
      <PageIntro
        eyebrow="YOUR PERSONAL WORKSPACE"
        title="My dashboard"
        description={`Welcome, ${w.session?.user?.name.split(" ")[0] ?? "there"}. Your ideas, progress, and next steps are here.`}
        action={
          <Link className="button primary" to="/submit">
            <Plus size={16} /> Submit an idea
          </Link>
        }
      />
      <div className="personal-metrics">
        <div className="metric-card">
          <FileText size={18} />
          <strong>{stats?.total ?? w.submissions.length}</strong>
          <span>My submissions</span>
        </div>
        <div className="metric-card">
          <Clock size={18} />
          <strong>{stats?.processing ?? 0}</strong>
          <span>Being processed</span>
        </div>
        <div className="metric-card">
          <MessageSquare size={18} />
          <strong>{stats?.needsClarification ?? questions.length}</strong>
          <span>Need my answers</span>
        </div>
        <div className="metric-card">
          <ShieldCheck size={18} />
          <strong>
            {stats?.assessed ??
              w.submissions.filter((s) => s.assessment).length}
          </strong>
          <span>Assessments received</span>
        </div>
      </div>
      <div className="personal-columns">
        <section className="panel personal-score">
          <span className="eyebrow">MY LATEST ASSESSMENT</span>
          <h2>{latest?.title ?? "Your next step starts here."}</h2>
          {latest?.assessment ? (
            <>
              <div className="personal-score-number">
                {latest.assessment.score ?? "—"}
                <small>
                  {latest.assessment.score == null
                    ? "More detail needed"
                    : "/ 100"}
                </small>
              </div>
              <p>
                This score reflects the information you supplied, rather than a
                prediction of business success.
              </p>
              <div className="personal-progress">
                <span>
                  Information completeness{" "}
                  <strong>{latest.assessment.completeness}%</strong>
                </span>
                <Progress value={latest.assessment.completeness} />
              </div>
              <Link
                className="button secondary"
                to={`/submissions/${latest.id}`}
              >
                View my assessment <ArrowRight size={15} />
              </Link>
            </>
          ) : (
            <>
              <p>
                Share your business idea to get a structured assessment and
                questions that help you develop it.
              </p>
              <Link className="button secondary" to="/submit">
                Submit my first idea <ArrowRight size={15} />
              </Link>
            </>
          )}
        </section>
        <section className="panel personal-next">
          <span className="eyebrow">MY NEXT STEPS</span>
          <h2>Keep your idea moving.</h2>
          {stats?.processing ? (
            <p className="notice">
              Your submission is being processed. This dashboard updates
              automatically.
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
                    {s.assessment?.questions[0]?.translatedQuestion ??
                      s.assessment?.questions[0]?.question}
                  </p>
                  <small>
                    {s.assessment?.questions.length} questions to clarify
                  </small>
                </div>
                <ArrowRight size={18} />
              </Link>
            ))
          ) : (
            <p>
              No clarification questions are waiting. Your assessor’s feedback
              will appear with your assessment.
            </p>
          )}
          {w.submissions
            .filter((s) => s.review?.nextAction)
            .slice(0, 2)
            .map((s) => (
              <div className="personal-action" key={s.id}>
                <div>
                  <strong>Assessor feedback: {s.title}</strong>
                  <p>{s.review?.nextAction}</p>
                  <Link to={`/submissions/${s.id}`}>Read feedback</Link>
                </div>
              </div>
            ))}
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>My recent ideas</h2>
            <p>Only submissions linked to your account appear here.</p>
          </div>
          <Link className="text-link" to="/submissions">
            View all <ArrowRight size={14} />
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
                    ? "Score pending"
                    : `${s.assessment.score} / 100`}
                </span>
                <ArrowRight size={16} />
              </Link>
            ))}
          </div>
        ) : (
          <Empty
            title="Your first idea belongs here"
            description="Use text, a PDF, or your voice. Your original submission stays available to you."
          />
        )}
      </section>
    </>
  );
}
