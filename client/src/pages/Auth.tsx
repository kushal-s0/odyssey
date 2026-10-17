import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Loader2, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { useWorkspace } from "../workspace";
import { api } from "../api";
import { Busy } from "../components";
import { loginSchema, registrationSchema } from "../../../shared/input-rules";
export default function Auth({ register = false }: { register?: boolean }) {
  const w = useWorkspace(),
    navigate = useNavigate(),
    [params] = useSearchParams();
  const assessor = params.get("role") === "assessor";
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [visible, setVisible] = useState(false);
  if (w.loading) return <Busy />;
  if (w.session?.user) return <Navigate to="/dashboard" replace />;
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const parsed = register
      ? registrationSchema.safeParse({ name, email, password })
      : loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(
        [...new Set(parsed.error.issues.map((i) => i.message))].join(" "),
      );
      return;
    }
    if (register && password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await api(register ? "/auth/register" : "/auth/login", {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      setPassword("");
      setConfirmation("");
      await w.refresh();
      const requested = params.get("next");
      navigate(
        requested?.startsWith("/") &&
          !requested.startsWith("//") &&
          !requested.includes("\\") &&
          !requested.startsWith("/login") &&
          !requested.startsWith("/register")
          ? requested
          : "/dashboard",
        { replace: true },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <aside className="auth-story">
        <Link className="public-brand" to="/">
          STRIVE<span>IDEA ASSESSMENT</span>
        </Link>
        <div>
          <span className="eyebrow">YOUR NEXT CHAPTER</span>
          <h1>
            A clearer idea.
            <br />A stronger start.
          </h1>
          <p>
            A private place to share your business, understand the gaps, and
            build on useful feedback.
          </p>
        </div>
        <p className="auth-assurance">
          <ShieldCheck size={19} /> Your account keeps your submissions and
          progress together.
        </p>
      </aside>
      <main className="auth-main">
        <Link className="auth-home" to="/">
          ← Back to home
        </Link>
        <div className="auth-form-wrap">
          <span className="eyebrow">
            {register
              ? "ENTREPRENEUR ACCOUNT"
              : assessor
                ? "ASSESSOR WORKSPACE"
                : "WELCOME BACK"}
          </span>
          <h1>
            {register
              ? "Make room for your idea."
              : "Sign in to your workspace."}
          </h1>
          <p>
            {register
              ? "Create your account to submit an idea and track your own progress."
              : "Entrepreneurs and assessors sign in with their own account. Your access is set by the programme."}
          </p>
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          {!w.session?.health.database && (
            <div className="notice">
              The workspace database is currently unavailable. Please try again
              when it reconnects.
            </div>
          )}
          <form onSubmit={submit} className="auth-form">
            {register && (
              <label>
                Full name
                <input
                  required
                  autoComplete="name"
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
            )}
            <label>
              Email
              <input
                required
                type="email"
                autoComplete="email"
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Password
              <div className="password-field">
                <input
                  required
                  type={visible ? "text" : "password"}
                  autoComplete={register ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={visible ? "Hide password" : "Show password"}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
            {register && (
              <>
                <small className="hint">Use at least 12 characters.</small>
                <label>
                  Confirm password
                  <input
                    required
                    type={visible ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                  />
                </label>
              </>
            )}
            <button
              className="button primary full-width"
              disabled={busy || !w.session?.health.database}
            >
              {busy ? (
                <Loader2 size={16} className="spin" />
              ) : (
                <ArrowRight size={16} />
              )}{" "}
              {register ? "Create account" : "Sign in"}
            </button>
          </form>
          <p className="auth-switch">
            {register ? "Already have an account? " : "New to STRIVE? "}
            <Link to={register ? "/login" : "/register"}>
              {register ? "Sign in" : "Create entrepreneur account"}
            </Link>
          </p>
          <p className="hint">
            Assessor accounts are provided by the programme. Public registration
            creates an entrepreneur account.
          </p>
        </div>
      </main>
    </div>
  );
}
