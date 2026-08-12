import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { TipsLag } from './components/Tips'
import { ShortcutVisibilityProvider } from './hooks/useShortcutVisibility'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'

const root = document.getElementById('root')
if (!root) throw new Error('Fant ikke #root i index.html')

createRoot(root).render(
  <StrictMode>
    {/* Tooltiplaget ligger ytterst, så boblen kan festes til vinduet uansett
        hvor i appen ankeret står. */}
    <TipsLag>
      <ShortcutVisibilityProvider>
        <App />
      </ShortcutVisibilityProvider>
    </TipsLag>
  </StrictMode>,
)
