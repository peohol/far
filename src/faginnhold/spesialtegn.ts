/**
 * Spesialtegnene i tegnmenyen i rikteksteditoren.
 *
 * Tegnene, navnene og gruppene er de samme som i spesialtegnmenyen i
 * mdeditz, i samme rekkefølge: den man leter i, med piler og matematikk øverst
 * og bokstavene sist. Alt er vanlig tekst, så tegnene lagres og søkes i som
 * resten av teksten.
 */

/** Et tegn og navnet det har i menyen og for skjermlesere. */
export type Spesialtegn = readonly [tegn: string, navn: string]

export interface Tegngruppe {
  id: string
  etikett: string
  tegn: readonly Spesialtegn[]
}

export const TEGNGRUPPER: readonly Tegngruppe[] = [
  {
    id: 'piler',
    etikett: 'Piler',
    tegn: [
      ['→', 'Pil høyre'],
      ['←', 'Pil venstre'],
      ['↑', 'Pil opp'],
      ['↓', 'Pil ned'],
      ['↔', 'Pil begge veier'],
      ['↕', 'Pil opp og ned'],
      ['↖', 'Pil opp mot venstre'],
      ['↗', 'Pil opp mot høyre'],
      ['↘', 'Pil ned mot høyre'],
      ['↙', 'Pil ned mot venstre'],
      ['⇐', 'Dobbel pil venstre'],
      ['⇒', 'Dobbel pil høyre'],
      ['⇑', 'Dobbel pil opp'],
      ['⇓', 'Dobbel pil ned'],
      ['⇔', 'Dobbel pil begge veier'],
      ['⟵', 'Lang pil venstre'],
      ['⟶', 'Lang pil høyre'],
      ['⟷', 'Lang pil begge veier'],
      ['↦', 'Avbildes til'],
      ['↩', 'Pil tilbake'],
      ['↪', 'Pil videre'],
      ['⤴', 'Pil opp og ut'],
      ['⤵', 'Pil ned og ut'],
      ['⇄', 'Fram og tilbake'],
      ['⇅', 'Opp og ned'],
      ['↻', 'Med klokka'],
      ['↺', 'Mot klokka'],
      ['➜', 'Tykk pil høyre'],
    ],
  },
  {
    id: 'matematikk',
    etikett: 'Matematikk',
    tegn: [
      ['±', 'Pluss/minus'],
      ['∓', 'Minus/pluss'],
      ['×', 'Ganget med'],
      ['÷', 'Delt på'],
      ['−', 'Minustegn'],
      ['⋅', 'Multiplikasjonsprikk'],
      ['≠', 'Ulik'],
      ['≈', 'Omtrent lik'],
      ['≡', 'Identisk lik'],
      ['≅', 'Kongruent med'],
      ['≤', 'Mindre enn eller lik'],
      ['≥', 'Større enn eller lik'],
      ['≪', 'Mye mindre enn'],
      ['≫', 'Mye større enn'],
      ['∝', 'Proporsjonal med'],
      ['∞', 'Uendelig'],
      ['√', 'Kvadratrot'],
      ['∛', 'Kubikkrot'],
      ['∑', 'Sum'],
      ['∏', 'Produkt'],
      ['∫', 'Integral'],
      ['∂', 'Partiell derivert'],
      ['∆', 'Differanse'],
      ['∇', 'Nabla'],
      ['∈', 'Element i'],
      ['∉', 'Ikke element i'],
      ['⊂', 'Ekte delmengde av'],
      ['⊆', 'Delmengde av'],
      ['⊃', 'Ekte overmengde av'],
      ['∪', 'Union'],
      ['∩', 'Snitt'],
      ['∅', 'Tomme mengden'],
      ['∀', 'For alle'],
      ['∃', 'Det finnes'],
      ['¬', 'Ikke'],
      ['∧', 'Og'],
      ['∨', 'Eller'],
      ['⊕', 'Eksklusiv eller'],
      ['∴', 'Altså'],
      ['∵', 'Fordi'],
      ['ℝ', 'Reelle tall'],
      ['ℕ', 'Naturlige tall'],
      ['ℤ', 'Hele tall'],
      ['ℚ', 'Rasjonale tall'],
      ['½', 'En halv'],
      ['⅓', 'En tredel'],
      ['¼', 'En firedel'],
      ['¾', 'Tre firedeler'],
      ['¹', 'Opphøyd 1'],
      ['²', 'Opphøyd 2'],
      ['³', 'Opphøyd 3'],
      ['ⁿ', 'Opphøyd n'],
      ['₁', 'Senket 1'],
      ['₂', 'Senket 2'],
      ['₃', 'Senket 3'],
      ['ₙ', 'Senket n'],
    ],
  },
  {
    id: 'gresk',
    etikett: 'Gresk',
    tegn: [
      ['α', 'Alfa'],
      ['β', 'Beta'],
      ['γ', 'Gamma'],
      ['δ', 'Delta'],
      ['ε', 'Epsilon'],
      ['ζ', 'Zeta'],
      ['η', 'Eta'],
      ['θ', 'Theta'],
      ['ι', 'Iota'],
      ['κ', 'Kappa'],
      ['λ', 'Lambda'],
      ['μ', 'My'],
      ['ν', 'Ny'],
      ['ξ', 'Ksi'],
      ['π', 'Pi'],
      ['ρ', 'Rho'],
      ['σ', 'Sigma'],
      ['ς', 'Sluttsigma'],
      ['τ', 'Tau'],
      ['υ', 'Ypsilon'],
      ['φ', 'Fi'],
      ['χ', 'Khi'],
      ['ψ', 'Psi'],
      ['ω', 'Omega'],
      ['Γ', 'Stor gamma'],
      ['Δ', 'Stor delta'],
      ['Θ', 'Stor theta'],
      ['Λ', 'Stor lambda'],
      ['Ξ', 'Stor ksi'],
      ['Π', 'Stor pi'],
      ['Σ', 'Stor sigma'],
      ['Υ', 'Stor ypsilon'],
      ['Φ', 'Stor fi'],
      ['Ψ', 'Stor psi'],
      ['Ω', 'Stor omega'],
    ],
  },
  {
    id: 'typografi',
    etikett: 'Typografi',
    tegn: [
      ['–', 'Tankestrek'],
      ['—', 'Lang tankestrek'],
      ['…', 'Utelatelsestegn'],
      ['·', 'Midtprikk'],
      ['•', 'Punktmerke'],
      ['◦', 'Åpent punktmerke'],
      ['«', 'Anførselstegn venstre'],
      ['»', 'Anførselstegn høyre'],
      ['“', 'Hermetegn åpne'],
      ['”', 'Hermetegn lukke'],
      ['‘', 'Enkelt hermetegn åpne'],
      ['’', 'Enkelt hermetegn lukke'],
      ['‹', 'Enkel vinkel venstre'],
      ['›', 'Enkel vinkel høyre'],
      ['†', 'Kors'],
      ['‡', 'Dobbeltkors'],
      ['§', 'Paragraf'],
      ['¶', 'Avsnittstegn'],
      ['№', 'Nummertegn'],
      ['°', 'Grader'],
      ['′', 'Minutt eller derivert'],
      ['″', 'Sekund'],
      ['‰', 'Promille'],
      ['©', 'Opphavsrett'],
      ['®', 'Registrert varemerke'],
      ['™', 'Varemerke'],
      ['¡', 'Omvendt utropstegn'],
      ['¿', 'Omvendt spørsmålstegn'],
    ],
  },
  {
    id: 'merker',
    etikett: 'Merker',
    tegn: [
      ['✓', 'Hake'],
      ['✔', 'Fet hake'],
      ['✗', 'Kryss'],
      ['✘', 'Fet kryss'],
      ['☐', 'Tom boks'],
      ['☑', 'Avkrysset boks'],
      ['☒', 'Boks med kryss'],
      ['★', 'Stjerne fylt'],
      ['☆', 'Stjerne åpen'],
      ['⚠', 'Varseltrekant'],
      ['⚑', 'Flagg'],
      ['●', 'Sirkel fylt'],
      ['○', 'Sirkel åpen'],
      ['◉', 'Sirkel med prikk'],
      ['◆', 'Rombe fylt'],
      ['◇', 'Rombe åpen'],
      ['■', 'Kvadrat fylt'],
      ['□', 'Kvadrat åpent'],
      ['▪', 'Lite kvadrat fylt'],
      ['▫', 'Lite kvadrat åpent'],
      ['▲', 'Trekant opp'],
      ['▼', 'Trekant ned'],
      ['►', 'Trekant høyre'],
      ['◄', 'Trekant venstre'],
    ],
  },
  {
    id: 'enheter',
    etikett: 'Valuta og enheter',
    tegn: [
      ['€', 'Euro'],
      ['£', 'Pund'],
      ['$', 'Dollar'],
      ['¥', 'Yen'],
      ['¢', 'Cent'],
      ['¤', 'Valutategn'],
      ['₿', 'Bitcoin'],
      ['₽', 'Rubel'],
      ['₹', 'Rupi'],
      ['₩', 'Won'],
      ['°', 'Grader'],
      ['℃', 'Grader celsius'],
      ['℉', 'Grader fahrenheit'],
      ['‰', 'Promille'],
      ['µ', 'Mikro'],
      ['Ω', 'Ohm'],
      ['Å', 'Ångström'],
      ['ℓ', 'Liter'],
    ],
  },
  {
    id: 'tastatur',
    etikett: 'Tastatur',
    // Tastene man skriver om når man forklarer en snarvei. Bare de som finnes
    // i skriftene folk faktisk har – en tom rute sier ingenting.
    tegn: [
      ['⌘', 'Kommandotast'],
      ['⌥', 'Tilvalgstast'],
      ['⌃', 'Kontrolltast'],
      ['⇧', 'Skift'],
      ['⇪', 'Caps Lock'],
      ['⏎', 'Enter'],
      ['↵', 'Linjeskift'],
      ['⌫', 'Slett bakover'],
      ['⌦', 'Slett framover'],
      ['⇥', 'Tabulator'],
      ['⇤', 'Tabulator tilbake'],
      ['⎋', 'Escape'],
      ['␣', 'Mellomrom'],
      ['⇞', 'Side opp'],
      ['⇟', 'Side ned'],
    ],
  },
  {
    id: 'bokstaver',
    etikett: 'Bokstaver',
    tegn: [
      ['á', 'a med akutt aksent'],
      ['à', 'a med grav aksent'],
      ['â', 'a med cirkumfleks'],
      ['ä', 'a med tøddel'],
      ['ã', 'a med tilde'],
      ['ā', 'a med strek'],
      ['ç', 'c med cedille'],
      ['č', 'c med hake'],
      ['é', 'e med akutt aksent'],
      ['è', 'e med grav aksent'],
      ['ê', 'e med cirkumfleks'],
      ['ë', 'e med tøddel'],
      ['ē', 'e med strek'],
      ['í', 'i med akutt aksent'],
      ['ì', 'i med grav aksent'],
      ['î', 'i med cirkumfleks'],
      ['ï', 'i med tøddel'],
      ['ñ', 'n med tilde'],
      ['ó', 'o med akutt aksent'],
      ['ò', 'o med grav aksent'],
      ['ô', 'o med cirkumfleks'],
      ['ö', 'o med tøddel'],
      ['õ', 'o med tilde'],
      ['ú', 'u med akutt aksent'],
      ['ù', 'u med grav aksent'],
      ['û', 'u med cirkumfleks'],
      ['ü', 'u med tøddel'],
      ['ý', 'y med akutt aksent'],
      ['ÿ', 'y med tøddel'],
      ['š', 's med hake'],
      ['ž', 'z med hake'],
      ['ł', 'l med strek'],
      ['ß', 'Skarpes s'],
      ['œ', 'oe-ligatur'],
      ['ð', 'Eth'],
      ['þ', 'Thorn'],
      ['É', 'E med akutt aksent'],
      ['Ä', 'A med tøddel'],
      ['Ö', 'O med tøddel'],
      ['Ü', 'U med tøddel'],
      ['Ñ', 'N med tilde'],
      ['Ç', 'C med cedille'],
    ],
  },
]

/** Gruppa med de sist brukte tegnene, som står først når den har noe i seg. */
export const NYLIG = 'nylig'

/** To rader med de sist brukte: nok til å ha dem framme, kort nok til å lese på et blikk. */
export const NYLIG_MAKS = 16

/**
 * Navnet på hvert tegn. Står det samme tegnet i to grupper – «°» hører hjemme
 * både i typografien og blant enhetene – gjelder navnet det fikk først.
 */
export const TEGNNAVN: ReadonlyMap<string, string> = new Map(
  [...TEGNGRUPPER].reverse().flatMap((gruppe) => [...gruppe.tegn].reverse()),
)

/** De sist brukte tegnene fra lagringen, uten noe som ikke lenger står i en gruppe. */
export function nyligeTegn(lagret: unknown): string[] {
  if (!Array.isArray(lagret)) return []
  return lagret.filter((tegn): tegn is string => typeof tegn === 'string' && TEGNNAVN.has(tegn)).slice(0, NYLIG_MAKS)
}

/** Lista over de sist brukte etter at `tegn` er brukt: først, og bare én gang. */
export function medBruktTegn(nylige: readonly string[], tegn: string): string[] {
  return [tegn, ...nylige.filter((annet) => annet !== tegn)].slice(0, NYLIG_MAKS)
}

/** Gruppene i menyen: «Nylig» først når noe er brukt, så de faste. */
export function tegngrupper(nylige: readonly string[]): Tegngruppe[] {
  if (nylige.length === 0) return [...TEGNGRUPPER]
  const nylig: Tegngruppe = { id: NYLIG, etikett: 'Nylig', tegn: nylige.map((tegn) => [tegn, TEGNNAVN.get(tegn) ?? tegn]) }
  return [nylig, ...TEGNGRUPPER]
}
