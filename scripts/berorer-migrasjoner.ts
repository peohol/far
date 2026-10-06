/**
 * Avgjør om en PR berører migrasjonene, så CI bare kjører migrasjonskontrollen
 * når den er relevant (`src/faginnhold/migrasjonsavhengigheter.ts`).
 *
 *   npm run berorer:migrasjoner -- <gren eller commit>
 *
 * Sammenligner arbeidskopiens commit med grunnen, og skriver `trengs=true|false`
 * til stegets utdata i GitHub Actions. Kan endringene ikke leses, trengs
 * kontrollen: den hoppes bare over når det er sikkert at den ikke gjelder.
 */
import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { berorteAvhengigheter } from '../src/faginnhold/migrasjonsavhengigheter'

const [grunn] = process.argv.slice(2).filter((a) => a !== '--')
if (!grunn) {
  console.error('Oppgi grenen eller commiten endringene skal sammenlignes med.')
  process.exit(1)
}

const git = (...args: string[]) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })

function vis(fil: string, ref: string): string | undefined {
  try {
    return git('show', `${ref}:${fil}`)
  } catch {
    return undefined
  }
}

let grunner: string[]
try {
  // Uten omdøpinger: en fil flyttet ut av en avhengighet teller under begge navnene.
  const endrede = git('diff', '--name-only', '--no-renames', grunn, 'HEAD').split('\n').filter(Boolean)
  grunner = berorteAvhengigheter(endrede, (hvor, fil) => vis(fil, hvor === 'før' ? grunn : 'HEAD'))
} catch (feil) {
  grunner = [`endringene mot ${grunn} kunne ikke leses (${(feil as Error).message.split('\n')[0]})`]
}

const trengs = grunner.length > 0
console.log(
  trengs
    ? `Migrasjonskontrollen kjøres, fordi PR-en endrer:\n${grunner.map((g) => `- ${g}`).join('\n')}`
    : 'PR-en berører verken migrasjonene eller det de avhenger av; migrasjonskontrollen hoppes over.',
)
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `trengs=${trengs}\n`)
