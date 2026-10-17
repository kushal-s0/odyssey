import React from 'react';
import ReactDOM from 'react-dom/client';
import {BrowserRouter,Routes,Route,Link} from 'react-router-dom';
import {WorkspaceProvider} from './workspace';
import App from './App';
import Dashboard from './pages/Dashboard';
import Submissions from './pages/Submissions';
import Submit from './pages/Submit';
import Detail from './pages/Detail';
import Comparisons from './pages/Comparisons';
import Settings from './pages/Settings';
import ModelLab from './pages/ModelLab';
import './styles.css';
class ErrorBoundary extends React.Component<{children:React.ReactNode},{error:boolean}>{state={error:false};static getDerivedStateFromError(){return {error:true};}render(){return this.state.error?<div className="fatal-error"><h1>The workspace could not be displayed.</h1><p>Reload the page to try again. Your saved submissions remain in Atlas.</p><button onClick={()=>window.location.reload()}>Reload workspace</button></div>:this.props.children;}}
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><BrowserRouter><WorkspaceProvider><Routes><Route element={<App/>}><Route index element={<Dashboard/>}/><Route path="submissions" element={<Submissions/>}/><Route path="submissions/:id" element={<Detail/>}/><Route path="submit" element={<Submit/>}/><Route path="comparisons" element={<Comparisons/>}/><Route path="model" element={<ModelLab/>}/><Route path="settings" element={<Settings/>}/><Route path="*" element={<div className="empty"><h1>Page not found</h1><Link to="/">Return to overview</Link></div>}/></Route></Routes></WorkspaceProvider></BrowserRouter></ErrorBoundary></React.StrictMode>);
