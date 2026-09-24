/**
 * Kontrollerer at innloggingsveggen faktisk står.
 *
 * Veggen virker bare så lenge det kliniske innholdet ligger i den pakken
 * kanten beskytter. Drar en fremtidig endring noe av det ut i den åpne delen
 * — for eksempel ved at innloggingssiden kommer til å importere en klinisk
 * modul — ville veggen stått igjen som en tom gest, uten at noe så feil ut.
 *
 * Kontrollen leser av kildekartene hvilke moduler som faktisk havnet i hver
 * pakke, og snur bevisbyrden: egen kode utenfor veggen må stå oppført her med
 * en grunn. Alt annet feiler. En ny modul er dermed beskyttet fra den blir
 * til, uansett hva den heter og hvor den ligger — det er bare veien ut som
 * krever et bevisst valg.
 *
 * Kjøres som siste ledd i `npm run build`, også på Vercel: blir delingen
 * feil, feiler byggingen i stedet for at appen legges ut åpen.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { KLINISK_PAKKE } from '../src/auth/vegg.ts'

/**
 * Egne moduler som har lov til å ligge utenfor veggen, med grunnen til det.
 * Dette er den eneste veien ut. En modul hører hjemme her bare hvis den
 * trengs før innlogging og ikke bærer klinisk innhold — altså ingen
 * analyttnavn, enheter, terskler, formler, fortolkningsregler eller
 * kommentartekster, verken direkte eller gjennom det den importerer.
 */
export const APNE_MODULER = new Map(
  Object.entries({
    'inngangen og økten, som avgjør om resten i det hele tatt lastes': [
      'src/main.tsx',
      'src/auth/klient.ts',
      'src/auth/api.ts',
      'src/auth/okt.tsx',
      'src/domain/tilgang.ts',
      'src/components/konto/Port.tsx',
    ],
    'skjermbildene en bruker møter før innlogging er fullført': [
      'src/components/konto/Innlogging.tsx',
      'src/components/konto/Forstegangsoppsett.tsx',
      'src/components/konto/Felt.tsx',
      'src/components/konto/Avatar.tsx',
      'src/components/konto/Logomerke.tsx',
      'src/components/konto/Bildevelgerlast.tsx',
      'src/components/konto/Bildevelger.tsx',
      'src/auth/bilde.ts',
    ],
    'felles grensesnittdeler uten faglig innhold': [
      'src/components/Button.tsx',
      'src/components/Tips.tsx',
      'src/components/Shortcut.tsx',
      'src/components/Ikonknapp.tsx',
      'src/components/ikon/Ikon.tsx',
      'src/components/ikon/register.ts',
      'src/components/toppmeny/Temaknapp.tsx',
      'src/domain/tipsplassering.ts',
      'src/hooks/useTheme.ts',
      'src/hooks/useShortcutVisibility.tsx',
    ],
    'reglene for brukernavn og passord, delt med Edge-funksjonene': [
      'supabase/functions/_delt/brukernavn.ts',
      'supabase/functions/_delt/passord.ts',
      'supabase/functions/_delt/profil.ts',
    ],
  }).flatMap(([grunn, stier]) => stier.map((sti) => [sti, grunn])),
)

/**
 * Tekstbiter som bare finnes i det kliniske innholdet. En ekstra skanse, i
 * tilfelle innhold skulle komme inn en vei kildekartene ikke viser.
 */
export const KLINISKE_SPOR = ['Referanseområde', 'ringegrense', 'Paroksetin', 'THC-syre']

/** `../../src/domain/valg.ts` → `src/domain/valg.ts`. */
export function ryddSti(kilde) {
  return kilde.replace(/^(\.\.\/)+/, '')
}

/** Alt som ikke er hentet inn utenfra, er vårt eget og skal bak veggen. */
function erEgenKode(sti) {
  return !sti.includes('node_modules/')
}

/**
 * Selve regelen, skilt fra lesingen av `dist/` så den kan prøves ut.
 *
 * `beskyttede` er navnene på de kliniske pakkene, `apne` resten. For hver åpen
 * pakke oppgis modulene den er satt sammen av og teksten som utleveres;
 * `kilder: null` betyr at kildekartet manglet, og da vet vi ingenting.
 */
export function kontroller({ beskyttede, apne }) {
  const feil = []
  const brukteUnntak = new Set()

  if (beskyttede.length !== 1) {
    feil.push(
      `Fant ${beskyttede.length} kliniske pakker (ventet nøyaktig én som begynner med «${KLINISK_PAKKE}-»).`,
    )
  }

  for (const { navn, kilder, innhold } of apne) {
    // Uten kildekart vet vi ikke hva pakken består av, og kan ikke si at
    // veggen står. Da skal kontrollen feile, ikke gå stille gjennom.
    if (!kilder) {
      feil.push(`Mangler kildekart for ${navn}; kan ikke kontrollere hva pakken inneholder.`)
      continue
    }

    for (const kilde of kilder) {
      const sti = ryddSti(kilde)
      if (!erEgenKode(sti)) continue
      if (APNE_MODULER.has(sti)) {
        brukteUnntak.add(sti)
        continue
      }
      feil.push(`${sti} ligger i ${navn}, som utleveres uten innlogging.`)
    }

    for (const spor of KLINISKE_SPOR) {
      if (innhold?.includes(spor)) {
        feil.push(`«${spor}» står i ${navn}, som utleveres uten innlogging.`)
      }
    }
  }

  // En oppføring som ikke lenger trengs, skal bort igjen. Ellers vokser hullet
  // i veggen av seg selv, og en modul kan havne utenfor uten at noen tok
  // stilling. Bare verdt å si fra om når resten stemmer.
  if (feil.length === 0) {
    for (const sti of APNE_MODULER.keys()) {
      if (!brukteUnntak.has(sti)) {
        feil.push(`${sti} står oppført som åpen, men ligger ikke utenfor veggen. Fjern oppføringen.`)
      }
    }
  }

  return { feil: [...new Set(feil)], brukteUnntak }
}

/** Leser pakkene byggingen la igjen, slik `kontroller` vil ha dem. */
function lesBygget(mappe) {
  const filer = readdirSync(mappe).filter((navn) => navn.endsWith('.js'))
  return {
    beskyttede: filer.filter((navn) => navn.startsWith(`${KLINISK_PAKKE}-`)),
    apne: filer
      .filter((navn) => !navn.startsWith(`${KLINISK_PAKKE}-`))
      .map((navn) => ({
        navn,
        kilder: existsSync(`${mappe}/${navn}.map`)
          ? (JSON.parse(readFileSync(`${mappe}/${navn}.map`, 'utf8')).sources ?? [])
          : null,
        innhold: readFileSync(`${mappe}/${navn}`, 'utf8'),
      })),
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const bygget = lesBygget(fileURLToPath(new URL('../dist/assets', import.meta.url)))
  const { feil, brukteUnntak } = kontroller(bygget)

  if (feil.length > 0) {
    console.error('\nInnloggingsveggen holder ikke:\n')
    for (const linje of feil) console.error(`  • ${linje}`)
    console.error(
      '\nEgen kode utenfor veggen må stå oppført i APNE_MODULER i dette' +
        '\nskriptet, med en grunn. Trengs modulen ikke før innlogging, hører den' +
        '\nhjemme bak veggen i stedet. Se src/auth/vegg.ts.\n',
    )
    process.exit(1)
  }

  console.log(
    `Innloggingsveggen står: ${bygget.beskyttede[0]} er beskyttet, og de ${bygget.apne.length}` +
      ` åpne pakkene inneholder bare de ${brukteUnntak.size} modulene som er ført opp som åpne.`,
  )
}
