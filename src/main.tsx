import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { ensureHashRoute } from './lib/lodgeHome'
import App from './App.tsx'

ensureHashRoute()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
