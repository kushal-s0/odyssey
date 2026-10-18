import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import './studio.css'
import { AuthProvider } from './auth/AuthProvider'
import { I18nProvider } from './i18n/I18nProvider'

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><I18nProvider><AuthProvider><App /></AuthProvider></I18nProvider></React.StrictMode>)
