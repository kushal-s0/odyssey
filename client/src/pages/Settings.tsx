import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Database,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useWorkspace } from "../workspace";
import { api } from "../api";
import { PageIntro, Notice } from "../components";
import { loginSchema, registrationSchema } from "../../../shared/input-rules";
import type { WorkspaceUser } from "../../../shared/types";
import AccountSecurity from "../AccountSecurity";
export default function Settings() {
  const w = useWorkspace(),
    navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [name, setName] = useState(""),
    [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const [cohortName, setCohortName] = useState("");
  const health = w.session?.health;
  const entrepreneur = w.session?.user?.role === "entrepreneur";
  const administration = !entrepreneur && mode !== "register";
  async function authenticate(event: FormEvent) {
    event.preventDefault();
    setError("");
    const parsed =
      mode === "register"
        ? registrationSchema.safeParse({ name, email, password })
        : loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(
        [...new Set(parsed.error.issues.map((issue) => issue.message))].join(
          " ",
        ),
      );
      return;
    }
    if (mode === "register" && confirmation !== password) {
      setError("The passwords do not match.");
      return;
    }
    setPending(true);
    try {
      const response = await api<{ user: WorkspaceUser }>(
        mode === "register" ? "/auth/register" : "/auth/login",
        { method: "POST", body: JSON.stringify(parsed.data) },
      );
      setPassword("");
      setConfirmation("");
      await w.sessionChanged();
      w.notify(
        mode === "register"
          ? "Entrepreneur account created. You can submit your first idea."
          : "Signed in to your workspace.",
      );
      navigate("/dashboard");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not access the account.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <PageIntro
        eyebrow="YOUR WORKSPACE"
        title="Connections & settings"
        description="Manage your account, sessions, and workspace connections."
        action={
          <button className="button secondary" onClick={() => void w.refresh()}>
            <RefreshCw size={14} />
            Refresh status
          </button>
        }
      />
      <div className="settings-grid">
        {w.session?.user && <AccountSecurity />}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Account access</h2>
              <p>
                Entrepreneurs see their own ideas. Assessors review programme
                submissions.
              </p>
            </div>
          </div>
          <div className="settings-body">
            {w.session?.user ? (
              <>
                <div className="signed-in">
                  <span className="user-avatar">
                    {entrepreneur ? "EN" : "AS"}
                  </span>
                  <div>
                    <strong>{w.session.user.name}</strong>
                    <p>{w.session.user.email}</p>
                    <span className="outline-label">
                      {entrepreneur ? "Entrepreneur" : "Assessor"}
                    </span>
                  </div>
                </div>
                <button
                  className="button primary full-width"
                  onClick={() => {
                    navigate("/dashboard");
                  }}
                >
                  Open live workspace <ArrowRight size={15} />
                </button>
                {entrepreneur && (
                  <p className="hint">
                    Your account owns the ideas you submit. Programme membership
                    and assessor permissions are managed by the programme.
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="segmented-control">
                  <button
                    type="button"
                    className={mode === "signin" ? "active" : ""}
                    onClick={() => {
                      setMode("signin");
                      setError("");
                    }}
                  >
                    Existing account
                  </button>
                  <button
                    type="button"
                    className={mode === "register" ? "active" : ""}
                    onClick={() => {
                      setMode("register");
                      setError("");
                    }}
                  >
                    Create entrepreneur account
                  </button>
                </div>
                <form onSubmit={authenticate}>
                  {!health?.database && (
                    <Notice>
                      The workspace is not connected yet. Read-only examples
                      remain available.
                    </Notice>
                  )}
                  {mode === "register" && (
                    <label>
                      Full name
                      <input
                        required
                        minLength={2}
                        maxLength={100}
                        autoComplete="name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                      />
                    </label>
                  )}
                  <label>
                    Email
                    <input
                      type="email"
                      required
                      maxLength={254}
                      autoComplete="username"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                    />
                  </label>
                  <label>
                    Password
                    <input
                      type="password"
                      required
                      minLength={mode === "register" ? 12 : 1}
                      maxLength={mode === "register" ? 72 : 256}
                      autoComplete={
                        mode === "register"
                          ? "new-password"
                          : "current-password"
                      }
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </label>
                  {mode === "register" && (
                    <>
                      <p className="hint">
                        Use a password of at least 12 characters.
                      </p>
                      <label>
                        Confirm password
                        <input
                          type="password"
                          required
                          maxLength={72}
                          autoComplete="new-password"
                          value={confirmation}
                          onChange={(event) =>
                            setConfirmation(event.target.value)
                          }
                        />
                      </label>
                    </>
                  )}
                  {error && <Notice type="error">{error}</Notice>}
                  <button
                    className="button primary full-width"
                    disabled={
                      pending || !health?.database || !email || !password
                    }
                  >
                    {pending ? (
                      <Loader2 size={15} className="spin" />
                    ) : (
                      <ArrowRight size={15} />
                    )}
                    {mode === "register" ? "Create account" : "Sign in"}
                  </button>
                  <p className="hint">
                    {mode === "register"
                      ? "Public registration creates an entrepreneur account. Assessor access is provided by the programme."
                      : "Use the email and password for your entrepreneur or assessor account."}
                  </p>
                </form>
              </>
            )}
          </div>
        </section>
        {administration && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>
                  <Database size={17} />
                  Service connections
                </h2>
                <p>Connection status for the programme workspace.</p>
              </div>
            </div>
            <div className="connection-list">
              {[
                {
                  name: "MongoDB Atlas",
                  description: "Submissions, originals and account sessions",
                  key: "MONGODB_URI",
                  ready: health?.database,
                },
                {
                  name: "Gemini document & language API",
                  description: "Hosted extraction, translation and embeddings",
                  key: "GEMINI_API_KEY",
                  ready: health?.gemini,
                },
                {
                  name: "Groq fallback API",
                  description:
                    "Backup translation and fact extraction when Gemini is unavailable",
                  key: "GROQ_API_KEY",
                  ready: health?.groq,
                },
                {
                  name: "Sarvam speech API",
                  description: "Regional-language recording transcription",
                  key: "SARVAM_API_KEY",
                  ready: health?.sarvam,
                },
                {
                  name: "Trained relevance model",
                  description: "Optional remote inference endpoint",
                  key: "MODEL_SERVICE_URL",
                  ready: health?.classifier,
                },
              ].map((connection) => (
                <div className="connection-row" key={connection.key}>
                  <span
                    className={`connection-icon ${connection.ready ? "connected" : ""}`}
                  >
                    {connection.ready ? (
                      <Check size={16} />
                    ) : (
                      <KeyRound size={16} />
                    )}
                  </span>
                  <div>
                    <strong>{connection.name}</strong>
                    <p>{connection.description}</p>
                  </div>
                  <span className="outline-label">
                    {connection.ready
                      ? connection.key === "MONGODB_URI"
                        ? "Connected"
                        : "Configured"
                      : "Not configured"}
                  </span>
                </div>
              ))}
            </div>
            <div className="panel-footer">
              <ShieldCheck size={14} />
              API keys remain on the server. Configuration alone does not verify
              provider access or quota.
            </div>
          </section>
        )}
        {administration && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Programme cohorts</h2>
                <p>Membership is supplied by the programme.</p>
              </div>
            </div>
            <div className="settings-body">
              {w.cohorts.map((cohort) => (
                <div className="cohort-row" key={cohort.id}>
                  <span>{cohort.name}</span>
                  <span className="small-label">
                    {cohort.synthetic ? "DEMO" : "PROGRAMME"}
                  </span>
                </div>
              ))}
              {w.mode === "live" && w.session?.user?.role === "assessor" ? (
                <form
                  className="new-cohort"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    setPending(true);
                    setError("");
                    try {
                      await api("/cohorts", {
                        method: "POST",
                        body: JSON.stringify({ name: cohortName.trim() }),
                      });
                      setCohortName("");
                      await w.refresh();
                      w.notify("Programme cohort created.");
                    } catch (failure) {
                      setError(
                        failure instanceof Error
                          ? failure.message
                          : "Could not create cohort.",
                      );
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  <label>
                    New cohort name
                    <input
                      required
                      minLength={2}
                      maxLength={100}
                      value={cohortName}
                      onChange={(event) => setCohortName(event.target.value)}
                      placeholder="e.g. Pune, October 2026"
                    />
                  </label>
                  <button className="button secondary" disabled={pending}>
                    <Plus size={14} />
                    Create cohort
                  </button>
                </form>
              ) : (
                <p className="hint">
                  An assessor can create programme cohorts. Example cohorts are
                  synthetic.
                </p>
              )}
              {error && w.session?.user && (
                <Notice type="error">{error}</Notice>
              )}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
