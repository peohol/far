import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { OktProvider } from './auth/okt'
import { Lasteindikator } from './components/Lasteindikator'
import { Port } from './components/konto/Port'
import { TipsLag } from './components/Tips'
import { ShortcutVisibilityProvider } from './hooks/useShortcutVisibility'
// Skriftene ligger i appen selv, så et klinisk verktøy ikke er avhengig av en
// ekstern skrifttjeneste. Newsreader med optisk størrelse, som i designet.
import '@fontsource-variable/newsreader/opsz.css'
import '@fontsource-variable/newsreader/opsz-italic.css'
import '@fontsource-variable/public-sans/wght.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/handlinger.css'
import './styles/flater.css'
import './styles/skjema.css'
import './styles/tips.css'
import './styles/fortolkning.css'
import './styles/thc.css'
import './styles/sidemeny.css'
import './styles/infoside.css'
import './styles/redigering.css'
import './styles/ikon.css'
import './styles/toppmeny.css'
import './styles/sok.css'
import './styles/endringslogg.css'
import './styles/konto.css'
import './styles/regler.css'

const root = document.getElementById('root')
if (!root) throw new Error('Fant ikke #root i index.html')

createRoot(root).render(
  <StrictMode>
    {/* Streken øverst mens appen henter noe, også før innloggingen. */}
    <Lasteindikator />
    {/* Tooltiplaget ligger ytterst, så boblen kan festes til vinduet uansett
        hvor i appen ankeret står. */}
    <TipsLag>
      <ShortcutVisibilityProvider>
        {/* Økten ligger ytterst av appens egne lag: både portvakten og
            verktøylinja leser den samme tilstanden. */}
        <OktProvider>
          <Port />
        </OktProvider>
      </ShortcutVisibilityProvider>
    </TipsLag>
  </StrictMode>,
)
