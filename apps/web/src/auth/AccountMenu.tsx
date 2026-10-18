import { useI18n } from '../i18n/I18nProvider'
import { useRef, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { useAuth } from './AuthProvider'

export function AccountMenu() {
  const { t } = useI18n()
  const auth = useAuth()
  const dialog = useRef<HTMLDialogElement>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (await auth.signIn(email.trim(), password)) { setPassword(''); dialog.current?.close() }
  }
  function close() { setPassword(''); dialog.current?.close() }
  return <>
    <div className="account-controls">{auth.actor && <span className="account-role">{auth.actor.role}</span>}
      {auth.session ? <button className="account-button" onClick={() => { void auth.signOut() }}>{t("Sign out")}</button>
        : <button className="account-button" onClick={() => dialog.current?.showModal()}>{t("Sign in")}</button>}</div>
    <dialog ref={dialog} className="login-dialog" aria-labelledby="login-title" onCancel={() => setPassword('')}>
      <button className="dialog-close" aria-label={t("Close sign in")} onClick={close}><X size={20} /></button>
      <span className="eyebrow">{t("YOUR PRIVATE WORKSPACE")}</span><h2 id="login-title">{t("Welcome back.")}</h2>
      <p>{t("Use the account provided by your coordinator.")}</p>
      {auth.configured ? <form onSubmit={event => { void submit(event) }}>
        <label htmlFor="login-email">{t("Email")}</label><input id="login-email" type="email" autoComplete="username" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} />
        <label htmlFor="login-password">{t("Password")}</label><input id="login-password" type="password" autoComplete="current-password" required maxLength={256} value={password} onChange={event => setPassword(event.target.value)} />
        {auth.message && <p className="auth-message" role="alert">{auth.message}</p>}
        <button className="primary-link" type="submit" disabled={auth.loading}>{auth.loading ? t("Signing in…") : t("Sign in to workspace")}</button>
      </form> : <p role="status">{t("Sign-in is being set up. Your coordinator will share access when the workspace is ready.")}</p>}
      <p className="recovery-note">{t("Need access or a password reset? Contact your coordinator.")}</p>
    </dialog>
  </>
}
