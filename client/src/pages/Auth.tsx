// localized-ui
import { t, useLanguage, LanguageControl } from "../i18n";
import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Loader2, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { useWorkspace } from "../workspace";
import { api } from "../api";
import { Busy } from "../components";
import { loginSchema, registrationSchema } from "../../../shared/input-rules";
export default function Auth({ register = false }: { register?: boolean }) {
  useLanguage();
  const w = useWorkspace(),
    navigate = useNavigate(),
    [params] = useSearchParams();
  const assessor = params.get("role") === "assessor";
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false),
    [checking, setChecking] = useState(false),
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
      await w.sessionChanged();
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
          {t("STRIVE")}
          <span>{t("IDEA ASSESSMENT")}</span>
        </Link>
        <div>
          <span className="eyebrow">{t("YOUR NEXT CHAPTER")}</span>
          <h1>
            {t("A clearer idea.")}
            <br />
            {t("A stronger start.")}
          </h1>
          <p>
            {t(
              "A private place to share your business, understand the gaps, and build on useful feedback.",
            )}
          </p>
        </div>
        <p className="auth-assurance">
          <ShieldCheck size={19} />{" "}
          {t("Your account keeps your submissions and progress together.")}
        </p>
      </aside>
      <main className="auth-main">
        <LanguageControl />
        <Link className="auth-home" to="/">
          {t("← Back to home")}
        </Link>
        <div className="auth-form-wrap">
          <span className="eyebrow">
            {register
              ? t("ENTREPRENEUR ACCOUNT")
              : assessor
                ? t("ASSESSOR WORKSPACE")
                : t("WELCOME BACK")}
          </span>
          <h1>
            {register
              ? t("Make room for your idea.")
              : t("Sign in to your workspace.")}
          </h1>
          <p>
            {register
              ? t(
                  "Create your account to submit an idea and track your own progress.",
                )
              : t(
                  "Entrepreneurs and assessors sign in with their own account. Your access is set by the programme.",
                )}
          </p>
          {error && (
            <div className="notice error" role="alert">
              {t(error)}
            </div>
          )}
          {w.authNotice && (
            <div className="notice" role="status">
              {t(w.authNotice)}
            </div>
          )}
          {(w.serviceUnavailable || !w.session?.health.database) && (
            <div className="notice auth-connection-notice" role="status">
              <p>
                {w.serviceUnavailable || !w.session ? (
                  "The workspace service is temporarily unavailable. Rechecking automatically."
                ) : (
                  <>
                    {t(
                      "The workspace database is currently unavailable. Sign-in and registration will be available when it reconnects. Availability is checked automatically.",
                    )}
                  </>
                )}
              </p>
              <button
                type="button"
                className="button secondary small"
                disabled={checking}
                onClick={async () => {
                  setChecking(true);
                  try {
                    await w.refresh();
                  } finally {
                    setChecking(false);
                  }
                }}
              >
                {checking ? t("Checking connection…") : t("Check connection")}
              </button>
            </div>
          )}
          <form onSubmit={submit} className="auth-form">
            {register && (
              <label>
                {t("Full name")}
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
              {t("Email")}
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
              {t("Password")}
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
                  aria-label={visible ? t("Hide password") : t("Show password")}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
            {register && (
              <>
                <small className="hint">
                  {t("Use at least 12 characters.")}
                </small>
                <label>
                  {t("Confirm password")}
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
              disabled={
                busy || w.serviceUnavailable || !w.session?.health.database
              }
            >
              {busy ? (
                <Loader2 size={16} className="spin" />
              ) : (
                <ArrowRight size={16} />
              )}{" "}
              {register ? t("Create account") : t("Sign in")}
            </button>
          </form>
          <p className="auth-switch">
            {register ? t("Already have an account? ") : t("New to STRIVE? ")}
            <Link to={register ? "/login" : "/register"}>
              {register ? t("Sign in") : t("Create entrepreneur account")}
            </Link>
          </p>
          <p className="hint">
            {t(
              "Assessor accounts are provided by the programme. Public registration creates an entrepreneur account.",
            )}
          </p>
        </div>
      </main>
    </div>
  );
}
