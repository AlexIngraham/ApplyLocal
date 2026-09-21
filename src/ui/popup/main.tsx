import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/ui/popup/App'
import '@/ui/popup/styles.css'

const root = document.getElementById('root')
if (root) createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
