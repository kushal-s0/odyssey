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
  const name = entrepreneur && current?.to === "/dashboard" ? "My dashboard" : entrepreneur && current?.to === "/submissions" ? "My submissions" :
    current?.label ??
    (location.pathname === "/settings" ? "Workspace settings" : "Assessment");
  return (
    <div className="app-shell">
      <aside className={`sidebar ${menu ? "sidebar-open" : ""}`}>
        <Link className="brand" to="/dashboard" onClick={() => setMenu(false)}>
          <span className="brand-mark">
            <i />
            <i />
          </span>
          <span>
            STRIVE<span className="brand-sub">IDEA ASSESSMENT</span>
          </span>
        </Link>
        <button
          className="mobile-close icon-button"
          onClick={() => setMenu(false)}
          aria-label="Close navigation"
        >
          <X size={20} />
        </button>
        <div className="workspace-switch">
          <span className="workspace-avatar">TS</span>
          <span>
            <strong>Tata STRIVE</strong>
            <small>Entrepreneurship programme</small>
          </span>
          <ChevronDown size={14} />
        </div>
        <div className="nav-caption">WORKSPACE</div>
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
                    ? "My submissions"
                    : entrepreneur && to === "/dashboard" ? "My dashboard" : label}
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
            <strong>Every idea deserves clarity.</strong>
            <p>
              Grounded in evidence.
              <br />
              Guided by people.
            </p>
          </div>
          <NavLink
            className="nav-item"
            to="/settings"
            onClick={() => setMenu(false)}
          >
            <Settings size={18} />
            Workspace settings
          </NavLink>
          <div className="user-block">
            <span className="user-avatar">
              {w.session?.user ? (entrepreneur ? "EN" : "AS") : "EX"}
            </span>
            <span>
              <strong>{w.session?.user?.name ?? "Example workspace"}</strong>
              <small>
                {w.session?.user
                  ? entrepreneur
                    ? "Entrepreneur access"
                    : "Assessor access"
                  : "Read-only preview"}
              </small>
            </span>
            {w.session?.user && (
              <button
                className="icon-button"
                aria-label="Sign out"
                onClick={async () => {
                  await w.signOut();
                }}
              >
                <LogOut size={16} />
              </button>
            )}
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
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{name}</strong>
          </div>
          <div className="topbar-actions">
            {w.mode === "examples" ? (
              <span className="workspace-tag">EXAMPLE DATA</span>
            ) : (
              <span className="workspace-tag live-tag">
                <span />
                LIVE WORKSPACE
              </span>
            )}
            <Link className="topbar-link" to="/settings">
              {w.session?.user && w.mode === "examples"
                ? "Open live workspace"
                : w.session?.user
                  ? "Settings"
                  : "Connect workspace"}
              <ArrowUpRight size={14} />
            </Link>
            <span className="top-avatar">TS</span>
          </div>
        </header>
        <main className="main-content">
          {w.error && (
            <Notice type="error">
              {w.error}{" "}
              <button className="text-button" onClick={() => void w.refresh()}>
                Try again
              </button>
            </Notice>
          )}
          {w.loading ? (
            <Busy />
          ) : restricted ? (
            <Empty
              title="Assessor access required"
              description="Your entrepreneur account can access your own submissions and clarification requests."
              action={
                <Link to="/submissions" className="button primary">
                  My submissions
                </Link>
              }
            />
          ) : (
            <Outlet />
          )}
        </main>
        <footer className="app-footer">
          <span>Built for better first conversations.</span>
          <span>
            <ShieldCheck size={12} />
            Human review remains essential
          </span>
        </footer>
      </div>
      {w.toast && (
        <div className="toast" role="status">
          <ShieldCheck size={17} />
          {w.toast}
        </div>
      )}
    </div>
  );
}
