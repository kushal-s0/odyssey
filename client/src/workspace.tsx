import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { api } from "./api";
import type { Session, Submission, Cohort, DashboardSummary } from "../../shared/types";
interface Workspace {
  loading: boolean; error: string | null; mode: "examples" | "live";
  session: Session | null; submissions: Submission[]; cohorts: Cohort[]; dashboard: DashboardSummary | null;
  refresh: () => Promise<void>; setMode: (mode: "examples" | "live") => void;
  signOut: () => Promise<void>; notify: (message: string) => void; toast: string | null;
}
const Context = createContext<Workspace | null>(null);
export function WorkspaceProvider({children}:{children:ReactNode}) {
  const [loading,setLoading]=useState(true), [error,setError]=useState<string|null>(null);
  const [session,setSession]=useState<Session|null>(null), [submissions,setSubmissions]=useState<Submission[]>([]);
  const [cohorts,setCohorts]=useState<Cohort[]>([]), [dashboard,setDashboard]=useState<DashboardSummary|null>(null);
  const [toast,setToast]=useState<string|null>(null);
  const requestId=useRef(0), accountId=useRef<string|null>(null);
  const notify=useCallback((message:string)=>setToast(message),[]);
  const clear=useCallback(()=>{accountId.current=null;setSession(current=>current?{...current,user:null}:null);setSubmissions([]);setCohorts([]);setDashboard(null);setLoading(false);},[]);
  const refresh=useCallback(async()=>{
    const revision=++requestId.current;
    try {
      const current=await api<Session>("/session");
      if(revision!==requestId.current)return;
      if(current.user?.id!==accountId.current){setSubmissions([]);setCohorts([]);setDashboard(null);}
      accountId.current=current.user?.id??null;setSession(current);
      if(!current.user){setSubmissions([]);setCohorts([]);setDashboard(null);setError(null);return;}
      const [records,groups,stats]=await Promise.all([
        api<{submissions:Submission[]}>("/submissions"),
        current.user.role==="assessor"?api<{cohorts:Cohort[]}>("/cohorts"):Promise.resolve({cohorts:[]}),
        api<{summary:DashboardSummary}>("/dashboard"),
      ]);
      if(revision!==requestId.current)return;
      setSubmissions(records.submissions);setCohorts(groups.cohorts);setDashboard(stats.summary??null);setError(null);
    }catch(e){if(revision===requestId.current)setError(e instanceof Error?e.message:"Could not load your dashboard.");}
    finally{if(revision===requestId.current)setLoading(false);}
  },[]);
  const signOut=useCallback(async()=>{await api("/auth/logout",{method:"POST"});requestId.current++;clear();setError(null);},[clear]);
  useEffect(()=>{void refresh();},[refresh]);
  useEffect(()=>{const expired=()=>{requestId.current++;clear();};window.addEventListener("strive:session-expired",expired);return()=>window.removeEventListener("strive:session-expired",expired);},[clear]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(null),5000);return()=>clearTimeout(timer);},[toast]);
  useEffect(()=>{
    if(!session?.user)return;
    const reload=()=>{if(document.visibilityState==="visible")void refresh();};
    const interval=setInterval(reload,submissions.some(s=>["queued","processing"].includes(s.status))?4000:20000);
    window.addEventListener("focus",reload);document.addEventListener("visibilitychange",reload);
    return()=>{clearInterval(interval);window.removeEventListener("focus",reload);document.removeEventListener("visibilitychange",reload);};
  },[session?.user?.id,submissions,refresh]);
  return <Context.Provider value={{loading,error,session,submissions,cohorts,dashboard,mode:session?.user?"live":"examples",setMode:()=>{},signOut,refresh,notify,toast}}>{children}</Context.Provider>;
}
export function useWorkspace(){const context=useContext(Context);if(!context)throw new Error("Workspace provider is missing.");return context;}
