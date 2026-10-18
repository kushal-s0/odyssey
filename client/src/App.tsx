// localized-ui
import { t, useLanguage, LanguageControl } from "./i18n";
import { useState } from "react";
import {
  NavLink,
  Outlet,
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  LayoutDashboard,
  Inbox,
  Plus,
  ChartNoAxesCombined,
  FlaskConical,
  Settings,
  ArrowUpRight,
  ChevronDown,
  Menu,
  X,
  LogOut,
  BookOpen,
  ArrowRight,
  Command,
  HelpCircle,
  ShieldCheck,
} from "lucide-react";
import { useWorkspace } from "./workspace";
import { api } from "./api";
import { Busy, Notice, Empty } from "./components";
const links = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/submissions", label: "All submissions", icon: Inbox },
  { to: "/submit", label: "Submit an idea", icon: Plus },
  { to: "/comparisons", label: "Comparisons", icon: ChartNoAxesCombined },
  { to: "/model", label: "Model & training", icon: FlaskConical },
];
export default function App() {
  useLanguage();
  const w = useWorkspace(),
    [menu, setMenu] = useState(false);
  const location = useLocation();
  const entrepreneur = w.session?.user?.role === "entrepreneur";
  const restricted =
    entrepreneur &&
    ["/model", "/comparisons"].some(
      (path) =>
        location.pathname === path || location.pathname.startsWith(path + "/"),
    );
  const current = links.find((l) =>
    l.to === "/dashboard"
      ? location.pathname === "/dashboard"
      : location.pathname.startsWith(l.to),
  );
  const name =
    entrepreneur && current?.to === "/dashboard"
      ? "My dashboard"
      : entrepreneur && current?.to === "/submissions"
        ? "My submissions"
        : (current?.label ??
          (location.pathname === "/settings"
            ? "Workspace settings"
            : "Assessment"));
  return (
    <div className="app-shell">
      <aside className={`sidebar ${menu ? "sidebar-open" : ""}`}>
        <Link className="brand" to="/dashboard" onClick={() => setMenu(false)}>
          <span className="brand-mark">
            <i />
            <i />
          </span>
          <span>
            {t("STRIVE")}
            <span className="brand-sub">{t("IDEA ASSESSMENT")}</span>
          </span>
        </Link>
        <button
          className="mobile-close icon-button"
          onClick={() => setMenu(false)}
          aria-label={t("Close navigation")}
        >
          <X size={20} />
        </button>
        <div className="workspace-switch">
          <span className="workspace-avatar">{t("TS")}</span>
          <span>
            <strong>{t("Tata STRIVE")}</strong>
            <small>{t("Entrepreneurship programme")}</small>
          </span>
          <ChevronDown size={14} />
        </div>
        <div className="nav-caption">{t("WORKSPACE")}</div>
        <nav>
          {links
            .filter(
              (link) =>
                !entrepreneur || !["/model", "/comparisons"].includes(link.to),
            )
            .map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/dashboard"}
                onClick={() => setMenu(false)}
                className={({ isActive }) =>
                  `nav-item ${isActive ? "active" : ""}`
                }
              >
                <Icon size={18} />
                <span>
                  {entrepreneur && to === "/submissions"
                    ? t("My submissions")
                    : entrepreneur && to === "/dashboard"
                      ? t("My dashboard")
                      : t(label)}
                </span>
                {to === "/submissions" && (
                  <span className="nav-count">{w.submissions.length}</span>
                )}
              </NavLink>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="evidence-note">
            <ShieldCheck size={19} />
            <strong>{t("Every idea deserves clarity.")}</strong>
            <p>
              {t("Grounded in evidence.")}
              <br />
              {t("Guided by people.")}
            </p>
          </div>
          <NavLink
            className="nav-item"
            to="/settings"
            onClick={() => setMenu(false)}
          >
            <Settings size={18} />
            {t("Workspace settings")}
          </NavLink>
          <div className="user-block">
            <span className="user-avatar">
              {w.session?.user ? (entrepreneur ? "EN" : "AS") : t("EX")}
            </span>
            <span>
              <strong>{w.session?.user?.name ?? "Example workspace"}</strong>
              <small>
                {w.session?.user
                  ? entrepreneur
                    ? t("Entrepreneur access")
                    : t("Assessor access")
                  : t("Read-only preview")}
              </small>
            </span>
          </div>
        </div>
      </aside>
      {menu && <div className="sidebar-scrim" onClick={() => setMenu(false)} />}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMenu(true)}
              aria-label={t("Open navigation")}
            >
              <Menu size={20} />
            </button>
            <span>{t("Workspace")}</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{t(name)}</strong>
          </div>
          <div className="topbar-actions">
            <LanguageControl />
            {w.mode === "examples" ? (
              <span className="workspace-tag">{t("EXAMPLE DATA")}</span>
            ) : (
              <span className="workspace-tag live-tag">
                <span />
                {t("LIVE WORKSPACE")}
              </span>
            )}
            <Link className="topbar-link" to="/settings">
              {w.session?.user && w.mode === "examples"
                ? t("Open live workspace")
                : w.session?.user
                  ? t("Settings")
                  : t("Connect workspace")}
              <ArrowUpRight size={14} />
            </Link>
            <button
              className="button secondary small signout-button"
              disabled={w.signingOut}
              onClick={() => void w.signOut().catch(() => {})}
            >
              <LogOut size={16} />
              <span>{w.signingOut ? t("Signing out…") : t("Sign out")}</span>
            </button>
          </div>
        </header>
        <main className="main-content">
          {w.error && (
            <Notice type="error">
              {w.error}{" "}
              <button className="text-button" onClick={() => void w.refresh()}>
                {t("Try again")}
              </button>
            </Notice>
          )}
          {w.loading ? (
            <Busy />
          ) : restricted ? (
            <Empty
              title={t("Assessor access required")}
              description={t(
                "Your entrepreneur account can access your own submissions and clarification requests.",
              )}
              action={
                <Link to="/submissions" className="button primary">
                  {t("My submissions")}
                </Link>
              }
            />
          ) : (
            <Outlet />
          )}
        </main>
        <footer className="app-footer">
          <span>{t("Built for better first conversations.")}</span>
          <span>
            <ShieldCheck size={12} />
            {t("Human review remains essential")}
          </span>
        </footer>
      </div>
      {w.toast && (
        <div className="toast" role="status">
          <ShieldCheck size={17} />
          {t(w.toast)}
        </div>
      )}
    </div>
  );
}
