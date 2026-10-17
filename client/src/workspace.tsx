import {createContext,useContext,useState,useEffect,useCallback,type ReactNode} from 'react';
import {api} from './api';
import type {Session,Submission,Cohort,Health} from '../../shared/types';
interface Workspace {loading:boolean;error:string|null;mode:'examples'|'live';session:Session|null;submissions:Submission[];cohorts:Cohort[];refresh:()=>Promise<void>;setMode:(mode:'examples'|'live')=>void;notify:(message:string)=>void;toast:string|null;}
const Context=createContext<Workspace|null>(null);
export function WorkspaceProvider({children}:{children:ReactNode}){
 const [loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null),[session,setSession]=useState<Session|null>(null),[mode,setMode]=useState<'examples'|'live'>('examples'),[submissions,setSubmissions]=useState<Submission[]>([]),[cohorts,setCohorts]=useState<Cohort[]>([]),[toast,setToast]=useState<string|null>(null);
 const notify=useCallback((message:string)=>setToast(message),[]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(null),5000);return()=>clearTimeout(t);},[toast]);
 const refresh=useCallback(async()=>{
  try{
   const current=await api<Session>('/session');setSession(current);
   const selected=mode==='live'&&current.user?'live':'examples';
   if(selected==='live'){
    const [records,groups]=await Promise.all([api<{submissions:Submission[]}>('/submissions'),api<{cohorts:Cohort[]}>('/cohorts')]);setSubmissions(records.submissions);setCohorts(groups.cohorts);
   }else if(current.health.examples){const data=await api<{submissions:Submission[];cohorts:Cohort[]}>('/examples');setSubmissions(data.submissions);setCohorts(data.cohorts);}else{setSubmissions([]);setCohorts([]);}
   setError(null);
  }catch(e){setError(e instanceof Error?e.message:'Could not load the workspace.');}finally{setLoading(false);}
 },[mode]);
 useEffect(()=>{void refresh();},[refresh]);
 useEffect(()=>{if(mode!=='live'||!submissions.some(s=>s.status==='queued'||s.status==='processing'))return;const t=setInterval(()=>void refresh(),4000);return()=>clearInterval(t);},[mode,submissions,refresh]);
 return <Context.Provider value={{loading,error,mode,session,submissions,cohorts,refresh,setMode,notify,toast}}>{children}</Context.Provider>;
}
export function useWorkspace(){const value=useContext(Context);if(!value)throw new Error('Workspace provider is missing.');return value;}
