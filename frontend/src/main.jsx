import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css';
import './index.css'
import App from './App.jsx'
import { MobileReporter } from './components/MobileReporter.jsx'

const isReporterRoute = window.location.pathname === '/report';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isReporterRoute ? <MobileReporter /> : <App />}
  </StrictMode>,
)