// localized-ui
import { t, useLanguage } from "./i18n";
import React from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import { WorkspaceProvider, useWorkspace } from "./workspace";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import { Busy } from "./components";
import App from "./App";
import Dashboard from "./pages/Dashboard";
import Submissions from "./pages/Submissions";
import Submit from "./pages/Submit";
import Detail from "./pages/Detail";
import Comparisons from "./pages/Comparisons";
import Settings from "./pages/Settings";
import ModelLab from "./pages/ModelLab";
import "./styles.css";
import "./experience.css";
import "./assessment-workspace.css";
import "./friendly.css";
function RequireAccount() {
  useLanguage();
  const w = useWorkspace(),
    location = useLocation();
  if (w.loading) return <Busy />;
  return w.session?.user ? (
    <Outlet />
  ) : (
    <Navigate
      to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
      replace
    />
  );
}
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="fatal-error">
        <h1>{t("The workspace could not be displayed.")}</h1>
        <p>
          {t(
            "Reload the page to try again. Your saved submissions remain in Atlas.",
          )}
        </p>
        <button onClick={() => window.location.reload()}>
          {t("Reload workspace")}
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <WorkspaceProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Auth />} />
            <Route path="/register" element={<Auth register />} />
            <Route element={<RequireAccount />}>
              <Route element={<App />}>
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="submissions" element={<Submissions />} />
                <Route path="submissions/:id" element={<Detail />} />
                <Route path="submit" element={<Submit />} />
                <Route path="comparisons" element={<Comparisons />} />
                <Route path="model" element={<ModelLab />} />
                <Route path="settings" element={<Settings />} />
                <Route
                  path="*"
                  element={
                    <div className="empty">
                      <h1>{t("Page not found")}</h1>
                      <Link to="/">{t("Return to overview")}</Link>
                    </div>
                  }
                />
              </Route>
            </Route>
          </Routes>
        </WorkspaceProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
