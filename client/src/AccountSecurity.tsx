import { useState, type FormEvent } from "react";
import { LogOut, KeyRound, Loader2 } from "lucide-react";
import { useWorkspace } from "./workspace";
import { api } from "./api";
import { changePasswordSchema } from "../../shared/input-rules";
export default function AccountSecurity() {
  const w = useWorkspace();
  const [currentPassword, setCurrentPassword] = useState(""),
    [newPassword, setNewPassword] = useState(""),
    [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function change(event: FormEvent) {
    event.preventDefault();
    setError("");
    const result = changePasswordSchema.safeParse({
      currentPassword,
      newPassword,
    });
    if (!result.success) {
      setError(
        [...new Set(result.error.issues.map((i) => i.message))].join(" "),
      );
      return;
    }
    if (newPassword !== confirmation) {
      setError("The new passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await api("/auth/password", {
        method: "POST",
        body: JSON.stringify(result.data),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      w.endSession(
        "Your password was updated. Sign in with your new password.",
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Password could not be changed.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel account-security">
      <div className="panel-heading">
        <div>
          <h2>Account security</h2>
          <p>Manage your password and signed-in sessions.</p>
        </div>
      </div>
      <div className="settings-body">
        <div className="session-actions">
          <p>
            Sign out of this browser, or revoke all sessions for your account
            across devices. Sessions expire after eight hours.
          </p>
          <div className="security-buttons">
            <button
              className="button secondary"
              disabled={w.signingOut || busy}
              onClick={() => void w.signOut().catch(() => {})}
            >
              <LogOut size={15} />
              Sign out of this browser
            </button>
            <button
              className="button secondary"
              disabled={w.signingOut || busy}
              onClick={() => void w.signOut(true).catch(() => {})}
            >
              <LogOut size={15} />
              Sign out all devices
            </button>
          </div>
        </div>
        <form onSubmit={change} className="password-change-form">
          <h3>
            <KeyRound size={16} /> Change password
          </h3>
          <p className="hint">
            Changing your password signs out all devices. You will need to sign
            in again.
          </p>
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          <label>
            Current password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </label>
          <label>
            New password
            <input
              type="password"
              autoComplete="new-password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </label>
          <label>
            Confirm new password
            <input
              type="password"
              autoComplete="new-password"
              required
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </label>
          <button className="button primary" disabled={busy || w.signingOut}>
            {busy ? (
              <Loader2 className="spin" size={15} />
            ) : (
              <KeyRound size={15} />
            )}{" "}
            Update password
          </button>
        </form>
      </div>
    </section>
  );
}
