import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { api, invalidateAuthRequests } from "./api";
import { publishAuthEvent, subscribeAuthEvents } from "./auth-sync";
import type {
  Session,
  Submission,
  Cohort,
  DashboardSummary,
} from "../../shared/types";
interface Workspace {
  loading: boolean;
  error: string | null;
  serviceUnavailable: boolean;
  mode: "examples" | "live";
  session: Session | null;
  submissions: Submission[];
  cohorts: Cohort[];
  dashboard: DashboardSummary | null;
  refresh: () => Promise<void>;
  signingOut: boolean;
  authNotice: string | null;
  signOut: (allDevices?: boolean) => Promise<void>;
  sessionChanged: () => Promise<void>;
  endSession: (notice?: string) => void;
  notify: (message: string) => void;
  toast: string | null;
}
const Context = createContext<Workspace | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null),
    [submissions, setSubmissions] = useState<Submission[]>([]);
  const [serviceUnavailable, setServiceUnavailable] = useState(false);
  const [cohorts, setCohorts] = useState<Cohort[]>([]),
    [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false),
    [authNotice, setAuthNotice] = useState<string | null>(null);
  const authLock = useRef(false);
  const requestId = useRef(0),
    accountId = useRef<string | null>(null);
  const notify = useCallback((message: string) => setToast(message), []);
  const clear = useCallback(() => {
    invalidateAuthRequests();
    accountId.current = null;
    setSession((current) => (current ? { ...current, user: null } : null));
    setSubmissions([]);
    setCohorts([]);
    setDashboard(null);
    setToast(null);
    setLoading(false);
  }, []);
  const refresh = useCallback(async () => {
    if (authLock.current) return;
    const revision = ++requestId.current;
    let receivedSession = false;
    try {
      const current = await api<Session>("/session");
      if (revision !== requestId.current) return;
      receivedSession = true;
      setServiceUnavailable(false);
      if (current.user?.id !== accountId.current) {
        setSubmissions([]);
        setCohorts([]);
        setDashboard(null);
      }
      accountId.current = current.user?.id ?? null;
      setSession(current);
      if (!current.user) {
        setSubmissions([]);
        setCohorts([]);
        setDashboard(null);
        setError(null);
        return;
      }
      const [records, groups, stats] = await Promise.all([
        api<{ submissions: Submission[] }>("/submissions"),
        current.user.role === "assessor"
          ? api<{ cohorts: Cohort[] }>("/cohorts")
          : Promise.resolve({ cohorts: [] }),
        api<{ summary: DashboardSummary }>("/dashboard"),
      ]);
      if (revision !== requestId.current) return;
      setSubmissions(records.submissions);
      setCohorts(groups.cohorts);
      setDashboard(stats.summary ?? null);
      setError(null);
    } catch (e) {
      if (revision === requestId.current) {
        if (!receivedSession) setServiceUnavailable(true);
        setError(
          e instanceof Error ? e.message : "Could not load your dashboard.",
        );
      }
    } finally {
      if (revision === requestId.current) setLoading(false);
    }
  }, []);
  const endSession = useCallback(
    (notice = "You have been signed out.") => {
      requestId.current++;
      clear();
      setError(null);
      setAuthNotice(notice);
      publishAuthEvent("signed-out");
    },
    [clear],
  );
  const signOut = useCallback(
    async (allDevices = false) => {
      if (authLock.current) return;
      authLock.current = true;
      setSigningOut(true);
      requestId.current++;
      invalidateAuthRequests();
      try {
        await api(allDevices ? "/auth/logout-all" : "/auth/logout", {
          method: "POST",
        });
        endSession(
          allDevices
            ? "You have been signed out on all devices."
            : "You have been signed out.",
        );
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Sign-out could not be confirmed. Please retry.",
        );
        throw e;
      } finally {
        authLock.current = false;
        setSigningOut(false);
      }
    },
    [endSession],
  );
  const sessionChanged = useCallback(async () => {
    requestId.current++;
    clear();
    setAuthNotice(null);
    setLoading(true);
    await refresh();
    publishAuthEvent("account-changed");
  }, [clear, refresh]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const expired = () => {
      requestId.current++;
      clear();
      setError(null);
      setAuthNotice(
        "Your session expired or was revoked. Please sign in again.",
      );
    };
    window.addEventListener("strive:session-expired", expired);
    return () => window.removeEventListener("strive:session-expired", expired);
  }, [clear]);
  useEffect(
    () =>
      subscribeAuthEvents((type) => {
        requestId.current++;
        clear();
        setError(null);
        if (type === "signed-out")
          setAuthNotice(
            "You have been signed out in another tab or on all devices.",
          );
        else {
          setAuthNotice(null);
          void refresh();
        }
      }),
    [clear, refresh],
  );
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (
      session &&
      !session.user &&
      session.health.database &&
      !serviceUnavailable
    )
      return;
    const reload = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const interval = setInterval(
      reload,
      !session || serviceUnavailable || !session.health.database
        ? 10000
        : submissions.some((s) => ["queued", "processing"].includes(s.status))
          ? 4000
          : 20000,
    );
    window.addEventListener("focus", reload);
    document.addEventListener("visibilitychange", reload);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", reload);
      document.removeEventListener("visibilitychange", reload);
    };
  }, [
    session?.user?.id,
    session?.health.database,
    serviceUnavailable,
    submissions,
    refresh,
  ]);
  return (
    <Context.Provider
      value={{
        loading,
        error,
        serviceUnavailable,
        session,
        submissions,
        cohorts,
        dashboard,
        mode: session?.user ? "live" : "examples",
        signOut,
        signingOut,
        authNotice,
        sessionChanged,
        endSession,
        refresh,
        notify,
        toast,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useWorkspace() {
  const context = useContext(Context);
  if (!context) throw new Error("Workspace provider is missing.");
  return context;
}
