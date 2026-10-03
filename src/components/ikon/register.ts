/**
 * Ikonregisteret fra Claude Design-handoffen «OUSFAR Atlas».
 *
 * Hvert ikon er data: en liste deler tegnet i et 24-rutenett (UI) eller et
 * 48-rutenett (seksjon, konsept og kinetikk). En del har en rolle — flate
 * (`f1` svak, `f2` sterkere), linje (`l`), stiplet linje (`d`) eller hel
 * fylt flekk (`h`) — og en semantisk farge. Utseendet for rollene og fargene
 * ligger i `ikon.css`, så samme geometri fungerer i lyst og mørkt tema.
 *
 * Geometrien er overført uendret fra handoffen (`design-system/components/
 * icons/Icon.jsx`). Nye ikoner tegnes i samme stil og legges til her.
 */

/** Semantiske farger. Verdien er tokenet i `tokens.css` fargen tegnes med. */
export const IKONFARGER = {
  accent: 'aksent',
  accent2: 'aksent-2',
  ok: 'referanse',
  warn: 'toksisk',
  danger: 'alvorlig',
  blood: 'blod',
  under: 'under',
  info: 'info',
  glass: 'glass',
  paper: 'papir',
  'i-ink': 'ikon-blekk',
  'i-line': 'ikon-linje',
  /** Systemet målproteinet hører til: settes av kortet rundt ikonet (`--system-farge`), ellers nøytral. */
  system: 'system',
  /** Virkningen på målet, som et trafikklys (se `docs/farmakodynamikk-ikoner.md`). */
  okt: 'virkning-okt',
  delvis: 'virkning-delvis',
  redusert: 'virkning-redusert',
  noytral: 'virkning-noytral',
} as const

export type Ikonfarge = keyof typeof IKONFARGER
/**
 * `f1`/`f2`: gjennomskinnelig flate, `o1`/`o2`: ugjennomsiktig flate (svak og
 * sterkere), `l`: linje, `d`: stiplet linje, `h`: fylt flekk.
 */
export type Rolle = 'f1' | 'f2' | 'o1' | 'o2' | 'l' | 'd' | 'h'
/** Animasjonene i `ikon.css`. Spilles én gang, aldri kontinuerlig. */
export type Ikonanimasjon =
  | 'spin45'
  | 'spinm60'
  | 'spin240'
  | 'spinback'
  | 'spin360'
  | 'rayL'
  | 'rayS'
  | 'wink'
  | 'pop'
  | 'drop'
  | 'bumpR'
  | 'bumpL'
  | 'flash'
  | 'draw'
  | 'tick'
  | 'fill'
  | 'shake'
  | 'pulse'
  | 'glidR'
  | 'glidL'

interface Ekstra {
  /** Tynnere strek (80 %), til kurvene i miniplottene. */
  w?: 0.8
  /** `pathLength="1"`, så en stipling kan oppgis i andeler av linja. */
  pl?: 1
  /** Fast stipling, i andeler av linja (krever `pl`). */
  s?: { strokeDasharray: string }
}

export type Ikondel =
  | ({
      t: 'path' | 'circle' | 'rect'
      a: Record<string, number | string>
      role: Rolle
      col?: Ikonfarge | null
      anim?: Ikonanimasjon
    } & Ekstra)
  | { t: 'g'; kids: Ikondel[]; anim?: Ikonanimasjon }

export interface Ikondefinisjon {
  /** Rutenettet: 24 for UI, 48 for seksjon, konsept og kinetikk. */
  vb: 24 | 48
  parts: Ikondel[]
  /** Transformasjon for hele tegningen (f.eks. en skråstilt pipette). */
  rot?: string
  /** Animasjon for hele ikonet. */
  ga?: Ikonanimasjon
  /** Deler som står utenfor `rot`. */
  free?: Ikondel[]
}

const P = (d: string, role: Rolle, col?: Ikonfarge | null, anim?: Ikonanimasjon, x?: Ekstra): Ikondel => ({
  t: 'path',
  a: { d },
  role,
  col,
  anim,
  ...x,
})
const C = (cx: number, cy: number, r: number, role: Rolle, col?: Ikonfarge | null, anim?: Ikonanimasjon): Ikondel => ({
  t: 'circle',
  a: { cx, cy, r },
  role,
  col,
  anim,
})
const R = (
  x: number,
  y: number,
  width: number,
  height: number,
  rx: number,
  role: Rolle,
  col?: Ikonfarge | null,
  anim?: Ikonanimasjon,
): Ikondel => ({ t: 'rect', a: { x, y, width, height, rx }, role, col, anim })
const G = (kids: Ikondel[], anim?: Ikonanimasjon): Ikondel => ({ t: 'g', kids, anim })
const gear = (cx: number, cy: number, ro: number, ri: number, n: number) => {
  const s = Math.PI / n
  let d = ''
  for (let i = 0; i < n; i++) {
    const a = i * 2 * s - Math.PI / 2
    ;(
      [
        [ri, a - 0.55 * s],
        [ro, a - 0.3 * s],
        [ro, a + 0.3 * s],
        [ri, a + 0.55 * s],
      ] as const
    ).forEach(([r, an], j) => {
      d +=
        (i === 0 && j === 0 ? 'M' : 'L') + (cx + r * Math.cos(an)).toFixed(2) + ' ' + (cy + r * Math.sin(an)).toFixed(2)
    })
  }
  return d + 'Z'
}
let hl = ''
for (let t = 0; t <= 36; t++) hl += (t ? 'L' : 'M') + (7 + t) + ' ' + (41 - 32 * Math.pow(2, -t / 10)).toFixed(2)
const doses: number[] = [0, 7, 14, 21, 28]
const cAt = (t: number, incl: boolean) =>
  doses.reduce((c, td) => c + (t > td || (t === td && incl) ? 12.5 * Math.pow(2, -(t - td) / 7) : 0), 0)
let ss = 'M7 41'
for (let t = 0; t <= 36; t += 0.5) {
  if (doses.includes(t)) ss += 'L' + (7 + t) + ' ' + (41 - cAt(t, false)).toFixed(2)
  ss += 'L' + (7 + t) + ' ' + (41 - cAt(t, true)).toFixed(2)
}
const rays: Ikondel[] = []
for (let i = 0; i < 8; i++) {
  const a = (i * Math.PI) / 4,
    c = Math.cos(a),
    s = Math.sin(a)
  const long = i % 2 === 0
  rays.push(
    P(
      `M${(12 + 6.6 * c).toFixed(2)} ${(12 + 6.6 * s).toFixed(2)}L${(12 + 10.6 * c).toFixed(2)} ${(12 + 10.6 * s).toFixed(2)}`,
      'l',
      'i-ink',
      long ? 'rayL' : 'rayS',
      { pl: 1, s: long ? { strokeDasharray: '1 1' } : { strokeDasharray: '.42 1' } },
    ),
  )
}
const sat = [90, 210, 330].map((d): [number, number, number] => {
  const a = (d * Math.PI) / 180
  return [24 + 16 * Math.cos(a), 24 + 16 * Math.sin(a), a]
})
const axes = P('M7 5v36h37', 'l', 'i-ink')

/*
 * Mekanismeikonene i farmakodynamikken. Prinsippene, og hvordan et nytt ikon
 * tegnes, står i `docs/farmakodynamikk-ikoner.md`. Kort fortalt:
 *
 * - Målproteinet har fargen til systemet det hører til (`system`), som kortet
 *   rundt setter. Det er ugjennomsiktig, så membranen ikke synes gjennom.
 * - Stoffet er en halvsirkel med flatsiden mot målet, i trafikklysfargen for
 *   virkningen: grønt øker aktiviteten, gult øker den litt, rødt reduserer
 *   eller snur den, grått er ingen eller ukjent effekt.
 * - En utstikker fra flatsiden fyller bindingssetet (poren, det aktive
 *   setet): stoffet både binder og «virker». Uten utstikker binder stoffet
 *   uten å fylle setet.
 */
const membran = R(2, 31, 44, 7, 2, 'f1', 'glass')
/** Reseptoren i membranen, med bindingssetet øverst mellom x 20 og 28. */
const reseptor = P('M14 42a2 2 0 0 1-2-2V19a2 2 0 0 1 2-2h6v9h8v-9h6a2 2 0 0 1 2 2v21a2 2 0 0 1-2 2z', 'o1', 'system')
/**
 * Stoffet: en halvsirkel med radius `r` og flatsiden ned mot `y`, med
 * utstikkeren ned i setet når `fyller`. Faller på plass når ikonet spilles.
 */
const stoff = (farge: Ikonfarge, fyller: boolean, cx = 24, y = 17, r = 8, anim: Ikonanimasjon = 'drop'): Ikondel => {
  const b = +(r * 0.31).toFixed(2)
  const dybde = +(r * 0.75).toFixed(2)
  const utstikker = fyller ? `h${-(r - b)}v${dybde}a${b} ${b} 0 0 1 ${-2 * b} 0v${-dybde}z` : 'z'
  return G([P(`M${cx - r} ${y}a${r} ${r} 0 0 1 ${2 * r} 0${utstikker}`, 'o2', farge)], anim)
}
/** Ionekanalen: to underenheter med poren mellom dem; `apning` er bredden på poren. */
const kanal = (apning = 6): [Ikondel, Ikondel] => [
  R(14 - apning / 2, 17, 10, 25, 3, 'o1', 'system'),
  R(24 + apning / 2, 17, 10, 25, 3, 'o1', 'system'),
]
/** En allosterisk modulator: et stoff som binder på siden av kanalen (flatsiden mot `x`), ikke i poren. */
const modulator = (farge: Ikonfarge, x: number): Ikondel =>
  G([P(`M${x} 17a6 6 0 0 0 0 12z`, 'o2', farge)], 'bumpR')
/** Transportøren: en avrundet kropp gjennom membranen, med inngangen øverst og veien gjennom stiplet. */
const transportor = [
  P('M18 16h2v5a4 4 0 0 0 8 0v-5h2a6 6 0 0 1 6 6v16a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6V22a6 6 0 0 1 6-6z', 'o1', 'system'),
  P('M24 29v11', 'd', 'system'),
]
/** Molekylet målet ellers binder eller frakter (signalstoffet, substratet). */
const substrat = (cx: number, cy: number, anim?: Ikonanimasjon) => C(cx, cy, 2.4, 'f2', 'system', anim)
/** Enzymet: et løst protein uten membran, med det aktive setet øverst. */
const enzym = P('M20 17v5a4 4 0 0 0 8 0v-5c7 1 13 7 13 14 0 8-7 13-17 13S7 39 7 31c0-7 6-13 13-14z', 'o1', 'system')
/** Aksjonspotensialer: en kanal som blokkeres mer jo oftere den åpnes. */
const fyring = P('M2 7h6l2-5 2.5 7 1.5-2h6l2-5 2.5 7 1.5-2h6l2-5 2.5 7 1.5-2h6', 'l', 'glass', 'draw', { w: 0.8 })

/*
 * Stoffregisteret og kategoriene i det. Hver kategori i registeret peker på
 * ikonet sitt med navnet (`ikon` i `public.stoffkategorier`, se `docs/stoffregister.md`); en
 * kategori uten, eller med et navn som ikke står her, får `katPlassholder`
 * (se `kategoriikon`). Et nytt kategoriikon tegnes i samme stil, i
 * 24-rutenettet, og får navnet `kat<Kategori>`.
 */
/** Et punkt på avstanden `r` fra (`cx`, `cy`) i retningen `grader`, der 0 er rett opp og vinkelen øker med klokka. */
const polar = (cx: number, cy: number, r: number, grader: number): string => {
  const a = (grader * Math.PI) / 180
  return `${(cx + r * Math.sin(a)).toFixed(2)} ${(cy - r * Math.cos(a)).toFixed(2)}`
}
/** Strålene fra soloppgangen: korte streker over horisonten. */
const soloppgang = [-60, -30, 0, 30, 60].map((g) => P(`M${polar(12, 18, 8.6, g)}L${polar(12, 18, 11.4, g)}`, 'l', 'i-ink'))
/** Et blad i cannabisbladet: en spiss oval fra (12, 15) ut i retningen `grader`. */
const blad = (grader: number, lengde: number, bredde: number): Ikondel => {
  const tupp = polar(12, 15, lengde, grader)
  // Kontrollpunktene står midt på bladet, `bredde` ut til hver side.
  const avstand = Math.hypot(lengde * 0.5, bredde)
  const vinkel = (Math.atan2(bredde, lengde * 0.5) * 180) / Math.PI
  const midt = (side: number) => polar(12, 15, avstand, grader + side * vinkel)
  return P(`M12 15Q${midt(1)} ${tupp}Q${midt(-1)} 12 15z`, 'f1', 'ok')
}
/** En arkimedisk spiral innenfra og ut: `omdreininger` runder ut til radius `r`. */
const spiral = (r: number, omdreininger: number): string => {
  const steg = omdreininger * 36
  let d = ''
  for (let i = 0; i <= steg; i++) d += (i ? 'L' : 'M') + polar(12, 12, (r * i) / steg, (i / steg) * omdreininger * 360)
  return d
}

/*
 * Virkninger og bivirkninger: den samme skråstilte kapselen nede til venstre,
 * og det den gir, oppe til høyre — en gnist for virkningen, et varsel for
 * bivirkningen. Kapselen er tegnet loddrett om midten og dreies med `rot`;
 * merket står fritt, så det ikke dreies med.
 */
const kapsel: Ikondel[] = [
  P('M17.5 24v-8.5a6.5 6.5 0 0 1 13 0V24z', 'f2', 'accent'),
  P('M17.5 24h13v8.5a6.5 6.5 0 0 1-13 0z', 'f1', 'glass'),
]
const KAPSEL_SKRA = 'translate(-4 4) rotate(-45 24 24)'

/*
 * Avhengighet, toleranse og tilbakeslagseffekter: seksjonen og de faste kortene i den.
 */
/** Et kjedeledd: en pille med hull, tegnet som én flate (det indre går mot klokka). */
const kjedeledd = (x: number, y: number, b: number, h: number, t: number): string => {
  const r = h / 2
  const ri = r - t
  return (
    `M${x + r} ${y}h${b - h}a${r} ${r} 0 0 1 0 ${h}h${h - b}a${r} ${r} 0 0 1 0 ${-h}z` +
    `M${x + r} ${y + t}a${ri} ${ri} 0 0 0 0 ${h - 2 * t}h${b - h}a${ri} ${ri} 0 0 0 0 ${2 * t - h}z`
  )
}
/** En bit av en ring om (24, 32) fra vinkelen `fra` til `til` (0 er rett opp). */
const maalerfelt = (fra: number, til: number): string =>
  `M${polar(24, 32, 19, fra)}A19 19 0 0 1 ${polar(24, 32, 19, til)}L${polar(24, 32, 11, til)}A11 11 0 0 0 ${polar(24, 32, 11, fra)}z`
/** Pilen rundt i vanedannelsen: en sirkelbue om midten, med spissen pekende videre med klokka. */
const runde = (() => {
  const slutt = 330
  const a = (slutt * Math.PI) / 180
  const [x, y] = polar(24, 24, 15, slutt).split(' ').map(Number) as [number, number]
  // Retningen videre langs buen, og normalen på den.
  const [dx, dy] = [Math.cos(a), Math.sin(a)]
  const punkt = (bak: number, ut: number) => `${(x - bak * dx + ut * -dy).toFixed(2)} ${(y - bak * dy + ut * dx).toFixed(2)}`
  return `M${polar(24, 24, 15, 30)}A15 15 0 1 1 ${x.toFixed(2)} ${y.toFixed(2)}M${punkt(5, 4)}L${x.toFixed(2)} ${y.toFixed(2)}L${punkt(5, -4)}`
})()

/** Frekvensen i bivirkningene: fem prikker på rad, de `n` første fylt. */
function prikker(n: number): Ikondel[] {
  return [0, 1, 2, 3, 4].map((i) =>
    i < n ? C(3.2 + i * 4.4, 12, 1.9, 'h', 'accent', 'pop') : C(3.2 + i * 4.4, 12, 1.6, 'l', 'i-line'),
  )
}

const REGISTER = {
  menu: { vb: 24, parts: [P('M4 7h16M4 12h16M4 17h9', 'l', 'i-ink'), C(18, 17, 2, 'f2', 'accent', 'pop')] },
  search: { vb: 24, ga: 'pulse', parts: [C(10.5, 10.5, 6.5, 'f1', 'accent'), P('M15.5 15.5 20.5 20.5', 'l', 'i-ink')] },
  pagesearch: {
    vb: 24,
    parts: [
      R(3.5, 3, 12, 16, 2, 'f1', 'glass'),
      P('M6.5 7.5h6M6.5 11h3.5', 'l'),
      C(15.5, 15, 4.2, 'f2', 'accent', 'pop'),
      P('M18.6 18.2l2.6 2.6', 'l', 'i-ink'),
    ],
  },
  interp: {
    vb: 24,
    parts: [
      R(5, 4.5, 14, 16.5, 2.5, 'f1', 'accent'),
      R(9, 2.5, 6, 4, 1.2, 'f2', 'accent2'),
      P('M8.6 12.8l2.2 2.2 4.4-4.6', 'l', null, 'pop'),
      P('M9 18h6', 'l'),
    ],
  },
  edit: {
    vb: 24,
    ga: 'shake',
    parts: [
      P('M5 19l1-4L15.5 5.5a2.1 2.1 0 0 1 3 3L9 18z', 'f1', 'warn'),
      P('M13.6 7.4l3 3', 'l'),
      P('M5 19l1-4 3 3z', 'f2', 'warn'),
    ],
  },
  close: { vb: 24, ga: 'pulse', parts: [C(12, 12, 9, 'f1', 'glass'), P('M9 9l6 6M15 9l-6 6', 'l')] },
  keys: {
    vb: 24,
    parts: [
      R(2.5, 6, 19, 12.5, 2.5, 'f1', 'glass'),
      R(5.5, 9, 2.6, 2.4, 0.6, 'f2', 'glass'),
      R(10.7, 9, 2.6, 2.4, 0.6, 'f2', 'accent', 'pop'),
      R(15.9, 9, 2.6, 2.4, 0.6, 'f2', 'glass'),
      P('M8 15h8', 'l', 'accent'),
    ],
  },
  sun: { vb: 24, parts: [C(12, 12, 4.4, 'f1', 'warn'), ...rays] },
  moon: {
    vb: 24,
    parts: [P('M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z', 'f1', 'info'), C(17.5, 5.5, 1.3, 'f2', 'warn', 'pop')],
  },
  user: { vb: 24, parts: [C(12, 8.5, 4, 'f1', 'accent'), P('M4.5 20.5a7.5 7.5 0 0 1 15 0z', 'f2', 'accent')] },
  more: {
    vb: 24,
    parts: [C(6, 12, 1.8, 'h', 'i-ink'), C(12, 12, 1.8, 'h', 'i-ink', 'pop'), C(18, 12, 1.8, 'h', 'i-ink')],
  },
  chev: { vb: 24, parts: [P('M9 5.5l6.5 6.5L9 18.5', 'l', 'i-ink')] },
  back: {
    vb: 24,
    parts: [C(12, 12, 9, 'f1', 'glass'), G([P('M17 12H7.5M11.5 7.5 7 12l4.5 4.5', 'l', 'i-ink')], 'bumpL')],
  },
  reset: {
    vb: 24,
    ga: 'spinback',
    parts: [
      C(12, 12, 3, 'f2', 'accent'),
      P('M4.6 13.5A7.6 7.6 0 1 0 6.6 6.6L4 9.2', 'l', 'i-ink'),
      P('M4 4.8v4.4h4.4', 'l', 'i-ink'),
    ],
  },
  copy: {
    vb: 24,
    parts: [
      P('M15.5 6V5a2 2 0 0 0-2-2H5.5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h1', 'l', 'i-ink'),
      G([R(8.5, 8.5, 12, 12, 2.2, 'f1', 'accent'), P('M11.5 13h6M11.5 16h4', 'l')], 'pop'),
    ],
  },
  gears: {
    vb: 48,
    parts: [
      P(gear(19, 20, 14, 10.5, 8), 'f1', 'accent', 'spin45'),
      C(19, 20, 4, 'f2', 'paper'),
      P(gear(34.5, 34, 9.5, 7, 6), 'f2', 'accent2', 'spinm60'),
      C(34.5, 34, 2.6, 'f1', 'paper'),
    ],
  },
  indik: {
    vb: 48,
    parts: [
      P('M16 6h12v10h10v12H28v10H16V28H6V16h10z', 'f1', 'accent'),
      G([C(36, 36, 9, 'f2', 'ok'), P('M31.6 36.2l3.1 3.1 5.9-6.1', 'l')], 'pop'),
    ],
  },
  prep: {
    vb: 48,
    parts: [
      R(9, 3.5, 19, 6, 1.5, 'f1', 'glass'),
      P('M3.5 6.5h5.5M3.5 4v5M28 6.5h9', 'l', 'i-ink'),
      P('M14 3.5v3M18.5 3.5v3M23 3.5v3', 'l'),
      R(4, 14, 23, 29, 4, 'f1', 'info'),
      C(11.5, 21.5, 3.2, 'f2', 'info'),
      C(20, 21.5, 3.2, 'f2', 'info', 'pop'),
      C(11.5, 29, 3.2, 'f2', 'info'),
      C(20, 29, 3.2, 'f2', 'info'),
      C(11.5, 36.5, 3.2, 'f2', 'info'),
      C(20, 36.5, 3.2, 'f2', 'info', 'pop'),
      R(30, 21, 14, 22, 3, 'f1', 'warn'),
      R(31.5, 15.5, 11, 5.5, 1.2, 'f2', 'warn'),
      R(32.5, 28, 9, 7, 1, 'f2', 'paper'),
    ],
  },
  dose: {
    vb: 48,
    rot: 'rotate(-45 24 24)',
    parts: [
      R(19, 1.5, 10, 11, 5, 'f2', 'accent'),
      P('M20.5 12h7v18l-3.5 6-3.5-6z', 'f1', 'glass'),
      P('M20.5 23h7v7l-3.5 6-3.5-6z', 'f2', 'accent'),
      P('M20.5 16h3M20.5 20h3M20.5 24h3M20.5 28h3', 'l'),
    ],
    free: [P('M33.5 37.5c-2 2.4-3 3.9-3 4.9a3 3 0 0 0 6 0c0-1-1-2.5-3-4.9z', 'f1', 'accent', 'drop')],
  },
  pk: {
    vb: 48,
    parts: [
      P('M19 4c7.5 8.5 12 14.5 12 20a12 12 0 0 1-24 0c0-5.5 4.5-11.5 12-20z', 'f1', 'blood'),
      C(33, 33, 10, 'f2', 'info'),
      R(31, 20, 4, 3.2, 1, 'f2', 'info'),
      P('M33 33V26.5', 'l', null, 'tick'),
      C(33, 33, 1.4, 'h'),
    ],
  },
  inter: {
    vb: 48,
    parts: [
      C(15, 28, 10, 'f1', 'accent', 'bumpR'),
      C(33, 28, 10, 'f1', 'warn', 'bumpL'),
      P('M24 7v5M17 10.5l2.5 3.5M31 10.5l-2.5 3.5', 'l', 'i-ink', 'flash'),
    ],
  },
  serum: {
    vb: 48,
    rot: 'rotate(16 24 24)',
    parts: [
      P('M18 8h12v28a6 6 0 0 1-12 0z', 'f1', 'glass'),
      P('M18 21h12v15a6 6 0 0 1-12 0z', 'f2', 'blood', 'fill'),
      R(16, 3, 16, 6, 2, 'f2', 'accent2'),
      P('M22 13.5h4', 'l'),
    ],
  },
  refs: {
    vb: 48,
    parts: [
      G([R(7, 31, 34, 10, 2.5, 'f1', 'accent2'), P('M12 36h10', 'l')]),
      G([R(10, 20.5, 30, 10, 2.5, 'f1', 'info'), P('M15 25.5h8', 'l')]),
      G([R(6, 10, 32, 10, 2.5, 'f1', 'warn'), P('M11 15h9', 'l')], 'drop'),
    ],
  },
  cup: {
    vb: 48,
    parts: [
      P('M13 15h22l-2 26a3 3 0 0 1-3 2.8H18a3 3 0 0 1-3-2.8z', 'f1', 'glass'),
      P('M14.2 27h19.6l-1.1 14a3 3 0 0 1-3 2.8H18.3a3 3 0 0 1-3-2.8z', 'f2', 'warn', 'fill'),
      R(11, 8, 26, 7, 2, 'f1', 'accent2'),
      P('M19 20h5', 'l'),
    ],
  },
  ref: {
    vb: 48,
    parts: [
      C(24, 24, 19, 'f1', 'ok'),
      C(17.5, 21, 2.3, 'h'),
      C(30.5, 21, 2.3, 'h', null, 'wink'),
      P('M16 29.5c3.5 5 12.5 5 16 0', 'l'),
    ],
  },
  tox: {
    vb: 48,
    ga: 'shake',
    parts: [
      C(24, 24, 19, 'f1', 'warn'),
      P('M13.5 18.5l6 3-6 3M34.5 18.5l-6 3 6 3', 'l'),
      P('M16 33.5c2.7-2.6 5.3 2.6 8 0s5.3 2.6 8 0', 'l'),
    ],
  },
  sev: {
    vb: 48,
    ga: 'pulse',
    parts: [
      P(
        'M24 5C13.5 5 6.5 12 6.5 21.5c0 5.2 2.3 8.8 5.5 11v5.5a3 3 0 0 0 3 3h18a3 3 0 0 0 3-3v-5.5c3.2-2.2 5.5-5.8 5.5-11C41.5 12 34.5 5 24 5z',
        'f1',
        'danger',
      ),
      C(17, 22, 4.4, 'h'),
      C(31, 22, 4.4, 'h'),
      P('M24 27.5l-2.6 4.5h5.2z', 'h'),
      P('M19.5 35.5v5M24 35.5v5M28.5 35.5v5', 'l'),
    ],
  },
  hl: {
    vb: 48,
    parts: [
      axes,
      P('M7 25H17V41', 'd', 'i-ink'),
      P(hl, 'l', 'accent', 'draw', { w: 0.8 }),
      C(17, 25, 2.5, 'f2', 'accent', 'pop'),
      C(7, 9, 1.8, 'h', 'accent'),
    ],
  },
  ss: { vb: 48, parts: [axes, P(ss, 'l', 'accent', 'draw', { w: 0.8 })] },
  absorp: {
    vb: 48,
    parts: [
      G(
        [
          P('M11 25l11-11a6.4 6.4 0 0 1 9 9L20 34a6.4 6.4 0 0 1-9-9z', 'f1', 'accent'),
          P('M16.5 19.5l5.5-5.5a6.4 6.4 0 0 1 9 9l-5.5 5.5z', 'f2', 'accent'),
        ],
        'drop',
      ),
      P('M5 42h38', 'd', 'i-ink'),
      P('M37 29v9M34 35l3 3 3-3', 'l', 'i-ink'),
    ],
  },
  bio: { vb: 48, parts: [C(24, 24, 17, 'f1', 'glass'), P('M24 24V7a17 17 0 0 1 14.7 25.5z', 'f2', 'accent', 'pop')] },
  dist: {
    vb: 48,
    ga: 'spin240',
    parts: [
      ...sat.map(([, , a]) =>
        P(
          `M${(24 + 7.5 * Math.cos(a)).toFixed(2)} ${(24 + 7.5 * Math.sin(a)).toFixed(2)}L${(24 + 11.2 * Math.cos(a)).toFixed(2)} ${(24 + 11.2 * Math.sin(a)).toFixed(2)}`,
          'l',
          'i-ink',
        ),
      ),
      C(24, 24, 6.5, 'f2', 'blood'),
      ...sat.map(([x, y]) => C(+x.toFixed(2), +y.toFixed(2), 4.6, 'f1', 'info')),
    ],
  },
  protein: {
    vb: 48,
    parts: [
      P('M14 12c6-6 18-5 22 2s5 15-1 21-17 6-22-1-5-16 1-22z', 'f1', 'accent2'),
      C(11.5, 13.5, 3.2, 'f2', 'warn', 'pop'),
      C(38.5, 21, 3.2, 'f2', 'warn', 'pop'),
      C(20, 40, 3.2, 'f2', 'warn', 'pop'),
    ],
  },
  metab: {
    vb: 48,
    parts: [
      P('M24 5l16 9v18l-16 9-16-9V14z', 'f1', 'info'),
      C(18.5, 23, 4.2, 'f2', 'warn', 'bumpR'),
      C(30, 23, 4.2, 'f2', 'accent2', 'bumpL'),
      P('M22.7 23h3.1', 'l'),
    ],
  },
  elim: {
    vb: 48,
    parts: [
      P('M25 6c-9 0-15 8-15 18s6 18 15 18c5.5 0 8-4.5 5.5-9-2-3.5-2-6 0-9.5C33 19 31 6 25 6z', 'f1', 'warn'),
      P('M30.5 24h5c2 0 3 1 3 3v7', 'l', 'i-ink'),
      P('M38.5 37c-1.8 2.2-2.7 3.5-2.7 4.5a2.7 2.7 0 0 0 5.4 0c0-1-.9-2.3-2.7-4.5z', 'f2', 'info', 'drop'),
    ],
  },
  peak: {
    vb: 48,
    parts: [
      axes,
      P('M18 12V41', 'd', 'i-ink'),
      P('M7 40C12 40 13 12 18 12S28 30 44 36', 'l', 'accent', 'draw', { w: 0.8 }),
      C(18, 12, 2.5, 'f2', 'accent', 'pop'),
    ],
  },
  fallback: {
    vb: 48,
    parts: [
      R(10, 6, 28, 36, 5, 'f1', 'glass'),
      P('M16 16h16M16 23h16M16 30h10', 'l'),
      C(34, 36, 6, 'f2', 'accent', 'pop'),
    ],
  },
  depot: {
    vb: 48,
    rot: 'rotate(-22 24 24)',
    ga: 'pulse',
    parts: [
      R(7, 16, 34, 16, 8, 'f1', 'accent2'),
      R(11, 19.5, 26, 9, 4.5, 'f2', 'accent2'),
      P('M13 38.5c3 2 6 2 9 0s6-2 9 0', 'l', 'i-ink'),
    ],
  },
  tablet: {
    vb: 48,
    ga: 'pulse',
    parts: [C(24, 24, 15, 'f1', 'info'), C(24, 24, 10.5, 'f2', 'info'), P('M24 9v30', 'l')],
  },
  /* Legemiddelformene uten egen tegning i handoffen, i samme stil: sprøyte
     (injeksjon og depotinjeksjon), flaske (mikstur) og dråpeflaske (dråper). */
  syringe: {
    vb: 48,
    rot: 'rotate(-45 24 24)',
    parts: [
      R(13, 18, 20, 12, 3, 'f1', 'glass'),
      R(15, 20.5, 11, 7, 1.5, 'f2', 'info', 'fill'),
      P('M18 18v3.5M22 18v3.5M26 18v3.5', 'l'),
      G([P('M29 24h13M42 18.5v11', 'l', 'i-ink'), R(26, 20.5, 3, 7, 1, 'f2', 'accent2')], 'bumpL'),
      P('M33 14.5v19', 'l', 'i-ink'),
      P('M13 24H3.5', 'l', 'i-ink'),
    ],
  },
  bottle: {
    vb: 48,
    ga: 'pulse',
    parts: [
      P('M19.5 11h9v4.5c5 1.8 8 5.5 8 10.5v13a4 4 0 0 1-4 4H15.5a4 4 0 0 1-4-4V26c0-5 3-8.7 8-10.5z', 'f1', 'glass'),
      P('M11.5 29h25v10a4 4 0 0 1-4 4h-17a4 4 0 0 1-4-4z', 'f2', 'info', 'fill'),
      R(18, 4.5, 12, 6.5, 2, 'f2', 'accent2'),
      P('M17 23h6', 'l'),
    ],
  },
  dropper: {
    vb: 48,
    parts: [
      P('M21 13V9a3 3 0 0 1 6 0v4z', 'f2', 'accent2'),
      R(19, 13, 10, 5, 1.5, 'f1', 'accent2'),
      R(12, 18, 24, 25, 5, 'f1', 'glass'),
      P('M12 30h24v8a5 5 0 0 1-5 5H17a5 5 0 0 1-5-5z', 'f2', 'info', 'fill'),
      P('M17 24h6', 'l'),
    ],
    free: [P('M40.5 6.5c-1.8 2.2-2.7 3.5-2.7 4.5a2.7 2.7 0 0 0 5.4 0c0-1-.9-2.3-2.7-4.5z', 'f2', 'info', 'drop')],
  },
  /* Infusjonspose (infusjon og dialyse): opphenget, posen med væsken og porten. */
  infusion: {
    vb: 48,
    parts: [
      P('M20.5 8V5.5a3.5 3.5 0 0 1 7 0V8', 'l', 'i-ink'),
      P('M13 8h22a3 3 0 0 1 3 3v18c0 6-4 10-9 10H19c-5 0-9-4-9-10V11a3 3 0 0 1 3-3z', 'f1', 'glass'),
      P('M10 22h28v7c0 6-4 10-9 10H19c-5 0-9-4-9-10z', 'f2', 'info', 'fill'),
      P('M15 13.5h6M15 17.5h4', 'l'),
      R(20.5, 39, 7, 4.5, 1.2, 'f2', 'accent2'),
      P('M24 43.5V47', 'l', 'i-ink'),
    ],
  },
  /* Inhalator: beholderen trykkes ned i hylsen med munnstykket. */
  inhaler: {
    vb: 48,
    parts: [
      R(17, 3, 12, 22, 4, 'f2', 'accent2', 'drop'),
      P('M14 14h18v17h9a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3z', 'f1', 'info'),
      P('M38 35.5v5', 'l'),
      P('M18 20h6', 'l'),
    ],
  },
  /* Sprayflaske (nese-, munn- og hudspray, skum): pumpen og tåken. */
  spray: {
    vb: 48,
    parts: [
      P('M19.5 17V9l3.5-5 3.5 5v8z', 'f1', 'accent2'),
      R(15.5, 17, 15, 5, 1.5, 'f2', 'accent2'),
      R(13, 22, 20, 22, 4.5, 'f1', 'glass'),
      P('M13 32h20v7.5a4.5 4.5 0 0 1-4.5 4.5h-11a4.5 4.5 0 0 1-4.5-4.5z', 'f2', 'info', 'fill'),
      P('M17 27h6', 'l'),
      G([C(31, 7, 1.6, 'h', 'info'), C(36, 3.5, 1.6, 'h', 'info'), C(36.5, 10, 1.6, 'h', 'info'), C(41.5, 6.5, 1.6, 'h', 'info')], 'pop'),
    ],
  },
  /* Tube (krem, salve, gel og pasta): den flate enden, tuben og korken. */
  tube: {
    vb: 48,
    rot: 'rotate(-35 24 24)',
    ga: 'pulse',
    parts: [
      R(3.5, 16, 6, 16, 1.2, 'f2', 'accent2'),
      P('M9.5 16.5h21l6.5 5v5l-6.5 5h-21z', 'f1', 'glass'),
      R(37, 19.5, 8, 9, 2, 'f2', 'accent2'),
      P('M14 22h11M14 26h7', 'l'),
    ],
  },
  /* Plaster (depotplaster, plaster og kompress): puten og hjørnet som løsnes. */
  patch: {
    vb: 48,
    rot: 'rotate(-12 24 24)',
    parts: [
      P('M13 9h22a6 6 0 0 1 6 6v16l-8 8H13a6 6 0 0 1-6-6V15a6 6 0 0 1 6-6z', 'f1', 'accent2'),
      R(14, 16, 20, 16, 3, 'f2', 'info', 'pulse'),
      P('M41 31h-4a4 4 0 0 0-4 4v4z', 'f2', 'accent2', 'pop'),
    ],
  },
  /* Dosepose (granulat og pulver): den taggete kanten, rivestreken og kornene. */
  sachet: {
    vb: 48,
    parts: [
      P('M11 10h26v28a4 4 0 0 1-4 4H15a4 4 0 0 1-4-4z', 'f1', 'glass'),
      P('M11 10l2.6-3.5 2.6 3.5 2.6-3.5 2.6 3.5 2.6-3.5 2.6 3.5 2.6-3.5 2.6 3.5 2.6-3.5 2.6 3.5', 'l', 'i-ink'),
      P('M11 15h26', 'd', 'i-ink'),
      G(
        [
          C(18, 29, 2.2, 'f2', 'warn'),
          C(24.5, 25, 2.2, 'f2', 'warn'),
          C(30, 30, 2.2, 'f2', 'warn'),
          C(21, 35.5, 2.2, 'f2', 'warn'),
          C(27.5, 36, 2.2, 'f2', 'warn'),
        ],
        'drop',
      ),
    ],
  },
  /* Stikkpille og vagitorie. */
  suppository: {
    vb: 48,
    rot: 'rotate(-40 24 24)',
    ga: 'pulse',
    parts: [
      P('M10 16h16c8 0 13 4 16 8-3 4-8 8-16 8H10a3 3 0 0 1-3-3V19a3 3 0 0 1 3-3z', 'f1', 'accent'),
      P('M11 20h15c5 0 8.5 2 10.5 4-2 2-5.5 4-10.5 4H11z', 'f2', 'accent'),
    ],
  },
  /* Implantat, innlegg og lamell: staven under huden. */
  implant: {
    vb: 48,
    ga: 'pulse',
    parts: [
      P('M4 18h40', 'd', 'i-ink'),
      R(7, 25, 34, 9, 4.5, 'f1', 'accent2'),
      G([C(15, 29.5, 1.8, 'h', 'info'), C(21.5, 29.5, 1.8, 'h', 'info'), C(28, 29.5, 1.8, 'h', 'info'), C(34.5, 29.5, 1.8, 'h', 'info')], 'pop'),
    ],
  },
  /* Gassflaske (medisinsk gass): ventilen, fargebåndet og flasken. */
  gas: {
    vb: 48,
    parts: [
      P('M16 5h16M24 5v4', 'l', 'i-ink'),
      R(20, 9, 8, 6, 1.5, 'f2', 'accent2'),
      P('M14 24a10 9 0 0 1 20 0v16a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4z', 'f1', 'glass'),
      P('M14 26h20v7H14z', 'f2', 'info', 'fill'),
      P('M18 38h5', 'l'),
    ],
  },
  /* Farmakogenetikk: en dobbelspiral med basepar. */
  dna: {
    vb: 48,
    parts: [
      G([P('M16.5 8h15M17.5 19.5h13M17.5 28.5h13M16.5 40h15', 'l', 'i-line')], 'flash'),
      P('M14 4c0 10 20 10 20 20s-20 10-20 20', 'l', 'accent'),
      P('M34 4c0 10-20 10-20 20s20 10 20 20', 'l', 'accent2'),
    ],
  },
  /* Terapeutisk legemiddelmonitorering: blodprøverøret og klokken for prøvetakingen. */
  tdm: {
    vb: 48,
    parts: [
      P('M9 9h11v24a5.5 5.5 0 0 1-11 0z', 'f1', 'glass'),
      P('M9 21h11v12a5.5 5.5 0 0 1-11 0z', 'f2', 'blood', 'fill'),
      R(7.5, 4.5, 14, 5.5, 2, 'f2', 'accent2'),
      C(33, 33, 11, 'f1', 'accent'),
      P('M33 26.5V33l4.5 3', 'l', 'i-ink', 'tick'),
    ],
  },
  /* Virkninger: kapselen og en gnist for det stoffet gjør. */
  virkning: {
    vb: 48,
    rot: KAPSEL_SKRA,
    parts: kapsel,
    free: [
      P('M35 3.5Q36.6 11.4 44.5 13 36.6 14.6 35 22.5 33.4 14.6 25.5 13 33.4 11.4 35 3.5z', 'f2', 'ok', 'pop'),
      C(43, 24.5, 1.8, 'h', 'ok', 'pop'),
    ],
  },
  /* Bivirkninger: den samme kapselen med en varseltrekant. */
  bivirkning: {
    vb: 48,
    rot: KAPSEL_SKRA,
    parts: kapsel,
    free: [G([P('M35 4.5 44.5 21.5h-19z', 'f2', 'warn'), P('M35 10.5v5', 'l'), C(35, 18.6, 1.3, 'h')], 'pop')],
  },
  /* Avhengighet, toleranse og tilbakeslagseffekter: to kjedeledd som henger i hverandre. */
  avhengighet: {
    vb: 48,
    rot: 'rotate(-35 24 24)',
    parts: [P(kjedeledd(3, 17, 26, 14, 4.5), 'f1', 'accent'), G([P(kjedeledd(19, 17, 26, 14, 4.5), 'f2', 'warn')], 'bumpL')],
  },
  /* Misbrukspotensial: en måler med viseren i det røde feltet. */
  misbruk: {
    vb: 48,
    parts: [
      P(maalerfelt(-90, -32), 'f1', 'ok'),
      P(maalerfelt(-28, 28), 'f1', 'warn'),
      P(maalerfelt(32, 90), 'f2', 'danger'),
      G([P(`M24 32L${polar(24, 32, 16, 58)}`, 'l', 'i-ink')], 'pop'),
      C(24, 32, 2.8, 'h', 'i-ink'),
      P('M5 38h38', 'l', 'i-line'),
    ],
  },
  /* Lært mestringsavhengighet: en krykke, noe man har vent seg til å støtte seg på. */
  krykke: {
    vb: 48,
    rot: 'rotate(-22 24 24)',
    parts: [
      P('M18 9.5 24 31.5 30 9.5M24 31.5v9', 'l', 'i-ink'),
      R(13.5, 4.5, 21, 5, 2.5, 'f2', 'accent'),
      G([R(19, 18.5, 10, 4, 2, 'f2', 'warn')], 'pop'),
      R(21.5, 40, 5, 5, 1.5, 'f1', 'i-ink'),
    ],
  },
  /* Addiksjon (vanedannelse): kapselen fra virkningene midt i en pil som går rundt og rundt. */
  vane: {
    vb: 48,
    parts: [
      P('M24 19.5h-4.5a4.5 4.5 0 0 0 0 9H24z', 'f2', 'accent'),
      P('M24 19.5h4.5a4.5 4.5 0 0 1 0 9H24z', 'f1', 'glass'),
      G([P(runde, 'l', 'accent')], 'spin360'),
    ],
  },
  /* Toleranse: virkningskurven flyttes mot høyere doser. */
  toleranse: {
    vb: 48,
    parts: [
      axes,
      P('M7 38C14 38 13 12 21 12h7', 'd', 'i-ink'),
      P('M7 38h6C22 38 22 12 30 12h12', 'l', 'warn', 'draw', { pl: 1 }),
      G([P('M15 5h10M22 2l3 3-3 3', 'l', 'accent')], 'bumpR'),
    ],
  },
  /* Abstinens og tilbakeslagseffekter: virkningen faller under utgangspunktet før den kommer tilbake. */
  abstinens: {
    vb: 48,
    parts: [
      axes,
      P('M7 22h37', 'd', 'i-ink'),
      P('M23 22c2.5 6 4.5 12 8 12s5.5-7 9-12z', 'f1', 'danger'),
      P('M7 22c4 0 5-13 9-13s4.5 7 7 13c2.5 6 4.5 12 8 12s5.5-7 9-12h4', 'l', 'accent', 'draw', { pl: 1 }),
    ],
  },
  yes: { vb: 24, parts: [C(12, 12, 9, 'f1', 'ok'), P('M8 12.3l2.6 2.6L16 9.5', 'l', null, 'pop')] },
  no: { vb: 24, parts: [C(12, 12, 9, 'f1', 'danger'), P('M9 9l6 6M15 9l-6 6', 'l', null, 'pop')] },
  na: { vb: 24, parts: [C(12, 12, 9, 'f1', 'glass'), P('M8.5 12h7', 'l')] },
  ext: { vb: 24, parts: [R(4, 7, 13, 13, 2.5, 'f1', 'glass'), G([P('M11 13l9-9M14 4h6v6', 'l', 'i-ink')], 'bumpR')] },
  pack: {
    vb: 24,
    parts: [
      R(3.5, 7.5, 17, 12, 2, 'f1', 'warn'),
      P('M3.5 11.5h17M10 7.5v4', 'l'),
      R(12.5, 14, 5, 3, 0.8, 'f2', 'paper'),
    ],
  },
  split: { vb: 24, parts: [C(12, 12, 8, 'f1', 'info'), P('M12 2.5v19', 'l', 'i-ink', 'pop')] },
  crush: {
    vb: 24,
    parts: [
      P('M4 11h16l-2 7a2 2 0 0 1-2 1.5H8A2 2 0 0 1 6 18z', 'f1', 'glass'),
      P('M13.5 10.5l5-7', 'l', 'i-ink', 'shake'),
    ],
  },
  capsule: { vb: 24, parts: [R(2.5, 8.5, 19, 7, 3.5, 'f1', 'accent2'), P('M12 8.5v7', 'l', null, 'bumpR')] },
  info2: { vb: 24, parts: [C(12, 12, 9, 'f1', 'info'), P('M12 11v5.5', 'l'), C(12, 7.8, 1.1, 'h')] },
  bUnder: {
    vb: 24,
    parts: [
      P('M12 3.5v11', 'l', 'under', 'drop'),
      P('M7.5 10.5 12 15l4.5-4.5', 'l', 'under', 'drop'),
      P('M5 20h14', 'd', 'i-ink'),
    ],
  },
  bInnenfor: { vb: 24, parts: [C(12, 12, 8.5, 'f1', 'ok'), P('M8.2 12.3l2.6 2.6 5-5.4', 'l', null, 'pop')] },
  bOver: {
    vb: 24,
    parts: [
      P('M12 20.5v-11', 'l', 'danger', 'bumpR'),
      P('M7.5 13.5 12 9l4.5 4.5', 'l', 'danger'),
      P('M5 4h14', 'd', 'i-ink'),
    ],
  },
  phone: {
    vb: 24,
    ga: 'shake',
    parts: [
      P(
        'M6.5 4h3l1.5 3.8-1.9 1.5a11 11 0 0 0 5.6 5.6l1.5-1.9L20 14.5v3a1.9 1.9 0 0 1-2 1.9C11.6 19 5 12.4 4.6 6A1.9 1.9 0 0 1 6.5 4z',
        'f1',
        'danger',
      ),
      P('M15.5 3a6.5 6.5 0 0 1 5.5 5.5M15 6.5a3 3 0 0 1 2.5 2.5', 'l', 'i-ink', 'flash'),
    ],
  },
  cutoff: {
    vb: 24,
    parts: [
      P('M3 6.5h18', 'd', 'i-ink'),
      P('M12 10c2.8 3 4.2 5 4.2 6.6a4.2 4.2 0 0 1-8.4 0c0-1.6 1.4-3.6 4.2-6.6z', 'f1', 'glass', 'drop'),
    ],
  },
  paste: {
    vb: 24,
    parts: [
      R(4.5, 4.5, 15, 17, 2.5, 'f1', 'glass'),
      R(8.5, 2.5, 7, 4, 1.3, 'f2', 'accent'),
      G([P('M12 10v6.5M9.2 13.8 12 16.6l2.8-2.8', 'l', 'i-ink')], 'drop'),
    ],
  },
  done: { vb: 24, parts: [C(12, 12, 9, 'f1', 'accent'), P('M8 12.3l2.6 2.6L16 9.5', 'l', null, 'pop')] },
  lock: {
    vb: 24,
    parts: [
      R(5, 10.5, 14, 10, 2.5, 'f1', 'glass'),
      P('M8 10.5V8a4 4 0 0 1 8 0v2.5', 'l', 'i-ink'),
      C(12, 15.5, 1.6, 'h', null, 'pop'),
    ],
  },
  plus: { vb: 24, parts: [C(12, 12, 9, 'f1', 'accent'), P('M12 8v8M8 12h8', 'l', null, 'pop')] },
  logout: {
    vb: 24,
    parts: [R(3.5, 4, 10, 16, 2.5, 'f1', 'glass'), G([P('M10 12h10M16.5 8.5 20 12l-3.5 3.5', 'l', 'i-ink')], 'bumpR')],
  },
  shield: {
    vb: 24,
    parts: [
      P('M12 3l7.5 3v5.5c0 4.4-3.1 7.8-7.5 9.5-4.4-1.7-7.5-5.1-7.5-9.5V6z', 'f1', 'accent2'),
      P('M8.8 12.2l2.3 2.3 4.2-4.6', 'l', null, 'pop'),
    ],
  },
  history: { vb: 24, ga: 'spinback', parts: [C(12, 12, 8.5, 'f1', 'info'), P('M12 7.5V12l3 2', 'l')] },
  key: { vb: 24, parts: [C(8, 12, 4.5, 'f1', 'warn'), P('M12.5 12H21M17.5 12v3M20 12v2.5', 'l', 'i-ink', 'bumpR')] },
  publish: {
    vb: 24,
    parts: [R(4, 13, 16, 7.5, 2, 'f1', 'accent'), G([P('M12 15V4M8 7.5 12 3.5l4 4', 'l', 'i-ink')], 'drop')],
  },
  // Tegnet i OUSFAR for profilbildet, i samme stil som resten av registeret.
  image: {
    vb: 24,
    parts: [
      R(3.5, 5, 17, 14, 2.5, 'f1', 'info'),
      C(9, 10, 1.8, 'f2', 'warn', 'pop'),
      P('M4 17l5-4.5 4 3.5 2.5-2 4.5 4', 'l', 'i-ink'),
    ],
  },
  rotate: {
    vb: 24,
    // En hel runde: animasjonene holder ikke sluttvinkelen (se ikon.css), og
    // pila er ikke symmetrisk, så en kvart runde ville hoppet tilbake.
    ga: 'spin360',
    parts: [C(12, 12, 3, 'f2', 'accent'), P('M19.4 13.5A7.6 7.6 0 1 1 17.4 6.6L20 9.2', 'l', 'i-ink'), P('M20 4.8v4.4h-4.4', 'l', 'i-ink')],
  },
  // Tegnet i OUSFAR for idéene, i samme stil som resten av registeret.
  idea: {
    vb: 24,
    parts: [
      P('M12 2.8a6.2 6.2 0 0 0-3.7 11.2c.8.6 1.2 1.4 1.2 2.3v.7h5v-.7c0-.9.4-1.7 1.2-2.3A6.2 6.2 0 0 0 12 2.8z', 'f1', 'warn'),
      C(12, 9, 2.4, 'f2', 'warn', 'flash'),
      P('M9.7 19.6h4.6M10.6 21.6h2.8', 'l', 'i-ink'),
    ],
  },
  // Tegnet i OUSFAR for favorittene, i samme stil som hjertet.
  star: {
    vb: 24,
    ga: 'pop',
    parts: [P('M12 3.6l2.4 5.8 6.2.4-4.8 4 1.5 6.1-5.3-3.3-5.3 3.3 1.5-6.1-4.8-4 6.2-.4z', 'f1', 'warn')],
  },
  heart: {
    vb: 24,
    ga: 'pulse',
    parts: [P('M12 20.2s-7.8-4.7-7.8-10.3A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.8 2.6c0 5.6-7.8 10.3-7.8 10.3z', 'f1', 'danger')],
  },
  comment: {
    vb: 24,
    parts: [
      P('M6.5 4.5h11A2.5 2.5 0 0 1 20 7v6.5a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 3.8V16A2.5 2.5 0 0 1 4 13.5V7a2.5 2.5 0 0 1 2.5-2.5z', 'f1', 'info'),
      G([C(8.5, 10.3, 1, 'h', 'i-ink'), C(12, 10.3, 1, 'h', 'i-ink'), C(15.5, 10.3, 1, 'h', 'i-ink')], 'pop'),
    ],
  },
  reply: {
    vb: 24,
    parts: [
      C(12, 12, 9, 'f1', 'accent'),
      G([P('M10.5 8 6.5 12l4 4', 'l', 'i-ink'), P('M7 12h6.5a4 4 0 0 1 4 4v.5', 'l', 'i-ink')], 'bumpL'),
    ],
  },
  // Tegnet i OUSFAR for planlagte oppgaver og arkivet, i samme stil som resten av registeret.
  oppgaver: {
    vb: 24,
    parts: [
      R(4.5, 4.5, 15, 17, 2.5, 'f1', 'accent'),
      R(8.5, 2.8, 7, 3.6, 1.2, 'f2', 'paper'),
      P('M8 12l1.6 1.6L12.5 10.7', 'l', 'i-ink', 'pop'),
      P('M8 17h8M14.5 12h1.5', 'l', 'i-ink'),
    ],
  },
  // Idéer og planlagte oppgaver sammen: lyspæren fra `idea` oppe til venstre og
  // utklippstavla nede til høyre, begge litt mindre og med én strekbredde luft
  // mellom seg. Klips, hake og strek er midtstilt på tavla.
  ideoppgaver: {
    vb: 24,
    parts: [
      P('M5.87 1.5a4.37 4.37 0 0 0-2.61 7.9c.56.42.85.99.85 1.62v.49h3.53v-.49c0-.63.28-1.2.85-1.62A4.37 4.37 0 0 0 5.87 1.5z', 'f1', 'warn'),
      C(5.87, 5.87, 1.69, 'f2', 'warn', 'flash'),
      P('M4.25 13.61h3.24M4.88 15.41h1.97', 'l', 'i-ink'),
      R(11.2, 8.94, 11.3, 13.56, 2.2, 'f1', 'accent'),
      R(14.59, 7.44, 4.52, 3, 1, 'f2', 'paper'),
      P('M14.95 14.77l1.27 1.27 2.53-2.53', 'l', 'i-ink', 'pop'),
      P('M14.36 19.38h4.97', 'l', 'i-ink'),
    ],
  },
  // Tegnet i OUSFAR for varslene, i samme stil som resten av registeret.
  bell: {
    vb: 24,
    ga: 'shake',
    parts: [
      P('M12 3.2a6 6 0 0 0-6 6v3.4c0 1-.3 1.9-.9 2.7L4 16.8h16l-1.1-1.5c-.6-.8-.9-1.7-.9-2.7V9.2a6 6 0 0 0-6-6z', 'f1', 'warn'),
      G([P('M9.8 19.2a2.3 2.3 0 0 0 4.4 0', 'l', 'i-ink')], 'bumpR'),
      P('M4 16.8h16', 'l', 'i-ink'),
    ],
  },
  arkiv: {
    vb: 24,
    parts: [
      P('M5 9.5v8.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9.5z', 'f1', 'glass'),
      G([R(3.5, 4.5, 17, 5, 1.5, 'f2', 'glass')], 'pop'),
      P('M10 13.5h4', 'l', 'i-ink'),
    ],
  },
  trash: {
    vb: 24,
    ga: 'shake',
    parts: [
      P('M6.5 7.5l.9 11.2a2 2 0 0 0 2 1.8h5.2a2 2 0 0 0 2-1.8l.9-11.2z', 'f1', 'danger'),
      P('M4.5 7.5h15M9.5 7.5V5.3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2.2M10.3 11v5.5M13.7 11v5.5', 'l', 'i-ink'),
    ],
  },
  // Tegnet i OUSFAR for diskusjonene, i samme stil som resten av registeret.
  diskusjon: {
    vb: 24,
    parts: [
      P('M9.5 8.5h9A2.5 2.5 0 0 1 21 11v5a2.5 2.5 0 0 1-2.5 2.5H18v2.5l-3.5-2.5h-5A2.5 2.5 0 0 1 7 16v-5a2.5 2.5 0 0 1 2.5-2.5z', 'f1', 'accent'),
      G(
        [
          P('M5.5 3.5h8A2.5 2.5 0 0 1 16 6v2.5H9.5A2.5 2.5 0 0 0 7 11v2.2l-2 1.6V12.9A2.5 2.5 0 0 1 3 10.5V6a2.5 2.5 0 0 1 2.5-2.5z', 'f2', 'info'),
        ],
        'pop',
      ),
    ],
  },
  // Tegnet i OUSFAR for direktelenkene, i samme stil som resten av registeret.
  lenke: {
    vb: 24,
    parts: [
      C(12, 12, 9, 'f1', 'accent'),
      G(
        [
          P('M11 13.2a3 3 0 0 0 4.3.2l2.4-2.4a3 3 0 0 0-4.3-4.3l-1.1 1.1', 'l', 'i-ink'),
          P('M13 10.8a3 3 0 0 0-4.3-.2l-2.4 2.4a3 3 0 0 0 4.3 4.3l1.1-1.1', 'l', 'i-ink'),
        ],
        'pop',
      ),
    ],
  },
  feste: {
    vb: 24,
    parts: [
      G([P('M9 3.5h6l-.8 5.2 3.3 3.3v1.5h-11V12l3.3-3.3z', 'f1', 'accent')], 'pop'),
      P('M12 13.5v7', 'l', 'i-ink'),
    ],
  },
  skjul: {
    vb: 24,
    parts: [
      P('M2.8 12S6.2 5.8 12 5.8 21.2 12 21.2 12 17.8 18.2 12 18.2 2.8 12 2.8 12z', 'f1', 'glass'),
      C(12, 12, 2.6, 'h', 'i-ink'),
      P('M4.5 19.5 19.5 4.5', 'l', 'danger', 'pop'),
    ],
  },
  // --- Stoffregisteret og kategoriene (se over REGISTER) ---
  // Et register med faner i kanten.
  stoffregister: {
    vb: 24,
    parts: [
      R(4, 3.5, 13.5, 17, 2.5, 'f1', 'accent'),
      P('M7.5 3.5v17', 'l', 'i-ink'),
      P('M10.5 8.5h4M10.5 12h4', 'l', 'i-ink'),
      G([R(17.5, 5.5, 3, 3.5, 1, 'f2', 'warn'), R(17.5, 10.25, 3, 3.5, 1, 'f2', 'info'), R(17.5, 15, 3, 3.5, 1, 'f2', 'ok')], 'bumpL'),
    ],
  },
  // En kategori uten eget ikon: en kapsel i en stiplet ramme.
  katPlassholder: {
    vb: 24,
    parts: [
      R(3.5, 3.5, 17, 17, 4.5, 'd', 'i-line'),
      G([R(6.5, 9.5, 11, 5, 2.5, 'f1', 'glass'), P('M12 9.5v5', 'l')], 'pop'),
    ],
  },
  // Soloppgang: stemningsløft.
  katAntidepressiver: {
    vb: 24,
    parts: [P('M5 18a7 7 0 0 1 14 0z', 'f1', 'warn'), G(soloppgang, 'flash'), P('M2 18h20', 'l', 'i-ink')],
  },
  // En svingning som dempes til en rett linje.
  katStemningsstabiliserende: {
    vb: 24,
    parts: [
      C(12, 12, 9.5, 'f1', 'info'),
      P('M4 12C5 6 6.8 6 7.8 12C8.6 16.8 10.3 16.8 11.1 12C11.7 9.5 13 9.5 13.6 12H20', 'l', 'i-ink', 'draw'),
    ],
  },
  // En hjerne sett fra siden.
  katAntipsykotika: {
    vb: 24,
    parts: [
      P(
        'M12 4.6c-1-1-2.7-1.3-4-.6-1.2.6-1.9 1.8-1.9 3.1-1.6.4-2.6 1.8-2.6 3.4 0 .8.3 1.6.8 2.2-.6.6-.9 1.4-.9 2.2 0 1.8 1.4 3.3 3.2 3.4.5 1.4 1.8 2.3 3.3 2.3.8 0 1.5-.3 2.1-.7.6.4 1.3.7 2.1.7 1.5 0 2.8-.9 3.3-2.3 1.8-.1 3.2-1.6 3.2-3.4 0-.8-.3-1.6-.9-2.2.5-.6.8-1.4.8-2.2 0-1.6-1-3-2.6-3.4 0-1.3-.7-2.5-1.9-3.1-1.3-.7-3-.4-4 .6z',
        'f1',
        'accent2',
      ),
      P('M12 4.6v15.6', 'l', 'i-ink'),
      G([P('M9.2 8.3c-1.3 0-2.1.9-2.1 2M8.6 14.2c-1.2.2-2 1.1-2 2.2M14.8 8.3c1.3 0 2.1.9 2.1 2M15.4 14.2c1.2.2 2 1.1 2 2.2', 'l', 'i-ink')], 'pop'),
    ],
  },
  // Et skjold mot lynet: anfallet.
  katAntiepileptika: {
    vb: 24,
    parts: [
      P('M12 3l7.5 3v5.5c0 4.4-3.1 7.8-7.5 9.5-4.4-1.7-7.5-5.1-7.5-9.5V6z', 'f1', 'info'),
      P('M13.2 6.8 9.3 12.6h3.1l-1.3 4.6 4-6h-3.1z', 'f2', 'warn', 'flash'),
    ],
  },
  // Et vinglass.
  katAlkohol: {
    vb: 24,
    parts: [
      P('M7 3.5h10l-.4 4.5a4.6 4.6 0 0 1-9.2 0z', 'f1', 'glass'),
      P('M7.3 7h9.4l-.1 1a4.6 4.6 0 0 1-9.2 0z', 'f2', 'danger', 'fill'),
      P('M12 12.6v7.4M8.5 20.5h7', 'l', 'i-ink'),
    ],
  },
  // Månen og søvnen.
  katBenzodiazepiner: {
    vb: 24,
    parts: [
      P('M16.5 15.5A7.5 7.5 0 0 1 8 5a7.5 7.5 0 1 0 8.5 10.5z', 'f1', 'info'),
      G([P('M13.5 3.5h3.5l-3.5 4h3.5', 'l', 'i-ink'), P('M18 8.5h2.5L18 11.3h2.5', 'l', 'i-ink')], 'pop'),
    ],
  },
  // Valmuekapselen.
  katOpioider: {
    vb: 24,
    parts: [
      P('M12 15.5v6', 'l', 'i-ink'),
      P('M12 6c3.2 0 5.5 2.2 5.5 5s-2.3 4.8-5.5 4.8S6.5 13.8 6.5 11 8.8 6 12 6z', 'f1', 'ok'),
      P('M10 7c-.9 1.2-1.3 2.6-1.3 4s.4 2.8 1.3 4M14 7c.9 1.2 1.3 2.6 1.3 4s-.4 2.8-1.3 4', 'l', 'i-ink'),
      G([R(8.5, 3.6, 7, 2.6, 1.3, 'f2', 'accent2')], 'pop'),
    ],
  },
  // Et turtallsmåler med nåla langt oppe.
  katStimulanter: {
    vb: 24,
    ga: 'pulse',
    parts: [
      P(`M${polar(12, 13.5, 8.5, -135)}A8.5 8.5 0 1 1 ${polar(12, 13.5, 8.5, 135)}z`, 'f1', 'warn'),
      P([-90, -45, 0, 45, 90].map((g) => `M${polar(12, 13.5, 5.8, g)}L${polar(12, 13.5, 7.2, g)}`).join(''), 'l', 'i-ink'),
      G([P(`M12 13.5L${polar(12, 13.5, 6, 55)}`, 'l', 'danger')], 'bumpR'),
      C(12, 13.5, 1.5, 'h', 'i-ink'),
    ],
  },
  // Cannabisbladet.
  katCannabinoider: {
    vb: 24,
    ga: 'pulse',
    parts: [
      P('M12 15v6.5', 'l', 'i-ink'),
      ...(
        [
          [-100, 5, 1.6],
          [100, 5, 1.6],
          [-62, 8, 2.6],
          [62, 8, 2.6],
          [-30, 10.5, 3.2],
          [30, 10.5, 3.2],
          [0, 12, 3.6],
        ] as const
      ).map(([g, l, b]) => blad(g, l, b)),
    ],
  },
  // En spiral.
  katHallusinogener: {
    vb: 24,
    parts: [C(12, 12, 9.5, 'f1', 'accent2'), P(spiral(7, 2.25), 'l', 'i-ink', 'draw')],
  },
  // Hjertet med en pil ned: blodtrykket senkes.
  katAntihypertensiver: {
    vb: 24,
    parts: [
      P('M12 20.2s-7.8-4.7-7.8-10.3A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.8 2.6c0 5.6-7.8 10.3-7.8 10.3z', 'f1', 'danger'),
      G([P('M12 9.5v6.5M9.5 13.5 12 16l2.5-2.5', 'l', 'i-ink')], 'drop'),
    ],
  },
  // --- Mekanismene i farmakodynamikken (se over REGISTER) ---
  mekAgonisme: { vb: 48, parts: [membran, reseptor, stoff('okt', true)] },
  mekPartiellAgonisme: { vb: 48, parts: [membran, reseptor, stoff('delvis', true)] },
  mekAntagonisme: { vb: 48, parts: [membran, reseptor, stoff('redusert', false)] },
  mekKompetitivAntagonisme: {
    vb: 48,
    // Antagonisten tar plassen, og agonisten skyves bort.
    parts: [membran, reseptor, stoff('okt', true, 40, 11, 5, 'bumpR'), stoff('redusert', false)],
  },
  mekInversAgonisme: { vb: 48, parts: [membran, reseptor, stoff('redusert', true)] },
  mekPositivModulering: {
    vb: 48,
    // Modulatoren binder på siden, og kanalen åpnes mer enn normalt.
    parts: [
      membran,
      G([kanal(10)[0], modulator('okt', 9)], 'glidL'),
      G([kanal(10)[1]], 'glidR'),
      C(24, 23, 2.2, 'f2', 'info', 'drop'),
      C(24, 35, 2.2, 'f2', 'info', 'drop'),
    ],
  },
  mekNegativModulering: {
    vb: 48,
    // Modulatoren binder på siden, og kanalen lukker seg.
    parts: [membran, G([kanal(2)[0], modulator('redusert', 13)], 'glidR'), G([kanal(2)[1]], 'glidL'), C(24, 10, 2.2, 'f2', 'info')],
  },
  mekReseptor: { vb: 48, parts: [membran, reseptor, stoff('noytral', false)] },
  mekKanalblokkering: { vb: 48, parts: [membran, ...kanal(), stoff('redusert', true)] },
  mekBruksavhengigBlokkering: { vb: 48, parts: [membran, ...kanal(), fyring, stoff('redusert', true, 24, 17, 7)] },
  mekIonekanal: { vb: 48, parts: [membran, ...kanal(), stoff('noytral', false)] },
  mekReopptakshemming: {
    vb: 48,
    // Signalstoffet blir stående igjen utenfor cellen.
    parts: [
      membran,
      ...transportor,
      substrat(7, 22, 'pop'),
      substrat(41, 24, 'pop'),
      substrat(38, 11, 'pop'),
      stoff('redusert', true),
    ],
  },
  mekTransporterhemming: { vb: 48, parts: [membran, ...transportor, substrat(40, 22, 'pop'), stoff('redusert', true)] },
  mekKotransporterhemming: {
    vb: 48,
    parts: [membran, ...transportor, C(7, 22, 2.6, 'f2', 'info', 'pop'), R(37.5, 19.5, 5, 5, 1.2, 'f2', 'glass', 'pop'), stoff('redusert', true)],
  },
  mekTransportor: { vb: 48, parts: [membran, ...transportor, stoff('noytral', false)] },
  mekEnzymhemming: { vb: 48, parts: [enzym, substrat(40, 9, 'bumpR'), stoff('redusert', true)] },
  opp: { vb: 24, parts: [C(12, 12, 9, 'f1', 'glass'), P('M12 16.5V7.5M7.5 12 12 7.5l4.5 4.5', 'l', 'i-ink', 'pop')] },
  ned: { vb: 24, parts: [C(12, 12, 9, 'f1', 'glass'), P('M12 7.5v9M7.5 12l4.5 4.5 4.5-4.5', 'l', 'i-ink', 'pop')] },
  // --- Bivirkningene: frekvensene og organsystemene (se `src/components/stoffside/panelvisning.ts`) ---
  // Frekvensen som fem prikker der færre er fylt jo sjeldnere bivirkningen er.
  frekvens5: { vb: 24, parts: prikker(5) },
  frekvens4: { vb: 24, parts: prikker(4) },
  frekvens3: { vb: 24, parts: prikker(3) },
  frekvens2: { vb: 24, parts: prikker(2) },
  frekvens1: { vb: 24, parts: prikker(1) },
  // «Ikke kjent»: et spørsmålstegn, uten noe nivå.
  frekvensUkjent: {
    vb: 24,
    parts: [C(12, 12, 9, 'f1', 'glass'), P('M9.6 9.4a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1.1.9-1.1 1.6v.5', 'l', 'i-ink'), C(12, 16.6, 1.1, 'h', 'i-ink', 'pop')],
  },
  // Infeksjoner: et virus med pigger.
  orgInfeksjon: {
    vb: 24,
    ga: 'spin45',
    parts: [
      C(12, 12, 5.5, 'f1', 'ok'),
      P('M12 6.5v-3M12 17.5v3M6.5 12h-3M17.5 12h3M15.9 8.1 18 6M8.1 8.1 6 6M15.9 15.9 18 18M8.1 15.9 6 18', 'l', 'i-ink'),
      C(10.3, 11, 1.1, 'h', 'ok'),
      C(13.6, 13.2, 1.1, 'h', 'ok'),
    ],
  },
  // Svulster: celler som vokser i en klynge.
  orgSvulst: {
    vb: 24,
    parts: [
      C(9, 9.5, 5, 'f1', 'accent2'),
      G([C(15.5, 13, 5.5, 'f1', 'danger')], 'pop'),
      C(9.5, 17, 3.8, 'f1', 'accent2'),
      C(9, 9.5, 1.4, 'h', 'i-ink'),
      C(15.5, 13, 1.6, 'h', 'i-ink'),
      C(9.5, 17, 1.1, 'h', 'i-ink'),
    ],
  },
  // Blod og lymfatiske organer: en bloddråpe.
  orgBlod: {
    vb: 24,
    ga: 'drop',
    parts: [P('M12 3.5c-3 4-6 7.4-6 10.8a6 6 0 0 0 12 0c0-3.4-3-6.8-6-10.8z', 'f1', 'blood'), P('M9.3 14.6a2.7 2.7 0 0 0 2.3 2.6', 'l', 'i-ink')],
  },
  // Endokrine sykdommer: skjoldbruskkjertelen som en sommerfugl rundt luftrøret.
  orgEndokrin: {
    vb: 24,
    parts: [
      P('M12 3v18', 'l', 'i-line'),
      P('M11 12.5c0-3.6-1.6-7.5-4.2-7.5S3.5 9 3.5 13.2s2.2 6.3 4.6 6.3S11 16.4 11 12.5z', 'f1', 'accent'),
      P('M13 12.5c0-3.6 1.6-7.5 4.2-7.5s3.3 4 3.3 8.2-2.2 6.3-4.6 6.3S13 16.4 13 12.5z', 'f1', 'accent'),
      G([R(9.5, 11.5, 5, 3.6, 1.6, 'f2', 'accent')], 'pop'),
    ],
  },
  // Stoffskifte og ernæring: et eple.
  orgStoffskifte: {
    vb: 24,
    parts: [
      P('M12 8c-1.6-1.1-5.6-1.6-7 2-1.3 3.4-.3 7.6 2.6 9.9 1.3 1 2.8 1 4.4.3 1.6.7 3.1.7 4.4-.3 2.9-2.3 3.9-6.5 2.6-9.9-1.4-3.6-5.4-3.1-7-2z', 'f1', 'ok'),
      P('M12 8c0-1.9.6-3.4 2-4.5', 'l', 'i-ink'),
      G([P('M13 6c1.4-1.6 3.4-2 5-1.4-.6 1.6-2.4 2.8-5 1.4z', 'f2', 'ok')], 'wink'),
    ],
  },
  // Psykiatriske lidelser: et hode i profil med en bølgende tanke.
  orgPsykisk: {
    vb: 24,
    parts: [
      P('M15 21v-3h2.1a1.9 1.9 0 0 0 1.9-1.9v-2.3l1.6-.7-1.6-3A7.4 7.4 0 0 0 11.6 3a7.2 7.2 0 0 0-4.6 12.8V21z', 'f1', 'accent2'),
      G([P('M8.3 10.2c.9-1.3 2-1.3 2.9 0s2 1.3 2.9 0', 'l', 'i-ink')], 'glidR'),
    ],
  },
  // Nevrologiske sykdommer: hjernen sett ovenfra.
  orgHjerne: {
    vb: 24,
    parts: [
      P(
        'M12 5.2C10.8 4 8.6 4 7.5 5.3 5.8 5.2 4.4 6.6 4.5 8.3 3.1 9.1 2.6 10.9 3.4 12.3 2.4 13.6 2.8 15.6 4.2 16.3 4.4 18 6 19.2 7.7 18.9 8.7 20.2 10.7 20.3 12 19.3 13.3 20.3 15.3 20.2 16.3 18.9 18 19.2 19.6 18 19.8 16.3 21.2 15.6 21.6 13.6 20.6 12.3 21.4 10.9 20.9 9.1 19.5 8.3 19.6 6.6 18.2 5.2 16.5 5.3 15.4 4 13.2 4 12 5.2z',
        'f1',
        'accent',
      ),
      P('M12 5.2v14.1', 'l', 'i-ink'),
      G([P('M7.3 9.4c1.2.2 2.1 1 2.3 2.3M16.7 9.4c-1.2.2-2.1 1-2.3 2.3M6.9 15.2c1-.8 2.3-.8 3.1.2M17.1 15.2c-1-.8-2.3-.8-3.1.2', 'l', 'i-ink')], 'flash'),
    ],
  },
  // Øyesykdommer: et øye.
  orgOye: {
    vb: 24,
    parts: [
      P('M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z', 'f1', 'glass'),
      C(12, 12, 3.6, 'f2', 'info'),
      C(12, 12, 1.5, 'h', 'i-ink', 'wink'),
      P('M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z', 'l', 'i-ink'),
    ],
  },
  // Øre og labyrint: et øre med lydbølger.
  orgOre: {
    vb: 24,
    parts: [
      P('M6 9.5a5.5 5.5 0 0 1 11 0c0 2.8-1.6 4-2.9 5.2-1 .9-1.4 1.9-1.6 3.2-.3 2-1.7 3.6-3.8 3.6A3.4 3.4 0 0 1 5.3 19', 'f1', 'warn'),
      P('M8.8 9.8a2.7 2.7 0 0 1 5.4 0c0 1.5-1.3 2.2-2.2 2.8', 'l', 'i-ink'),
      G([P('M19.6 6.5a6 6 0 0 1 0 6M21.6 4.8a9 9 0 0 1 0 9.4', 'l', 'info')], 'rayS'),
    ],
  },
  // Karsykdommer: et blodkar med blodlegemer.
  orgKar: {
    vb: 24,
    parts: [
      R(2.5, 8, 19, 8, 4, 'f1', 'danger'),
      G([C(7.5, 12, 1.9, 'h', 'blood'), C(12.5, 12, 1.9, 'h', 'blood'), C(17.3, 12, 1.9, 'h', 'blood')], 'glidR'),
      P('M2.5 8h19M2.5 16h19', 'l', 'i-ink'),
    ],
  },
  // Respirasjonsorganer: lungene og luftrøret.
  orgLunger: {
    vb: 24,
    ga: 'pulse',
    parts: [
      P('M10 8.5C7.5 7 4.6 10 4 14.5c-.4 3.5 1 5.5 3 5.5 2.3 0 3-1.5 3-4z', 'f1', 'info'),
      P('M14 8.5c2.5-1.5 5.4 1.5 6 6 .4 3.5-1 5.5-3 5.5-2.3 0-3-1.5-3-4z', 'f1', 'info'),
      P('M12 3.5v7.5M12 11l-2.5 2.2M12 11l2.5 2.2', 'l', 'i-ink'),
    ],
  },
  // Gastrointestinale sykdommer: magesekken.
  orgMage: {
    vb: 24,
    parts: [
      P('M8 3.5h3v3.3c0 1.5 1 2.2 2.6 2.2 3.6 0 6.4 2.6 6.4 6.3 0 3.6-2.9 5.7-6.6 5.7-2.4 0-3.8-.9-5.4-.9-1.2 0-2 .4-2.8 1l-1-2.3c1-.8 2.4-1.3 3.8-1.3.9 0 1.3-.6 1.1-1.6L8 10.3z', 'f1', 'warn'),
      G([P('M12 15c1.5.9 3.5.9 5 0', 'l', 'i-ink')], 'wink'),
    ],
  },
  // Lever og galleveier: leveren med galleblæren.
  orgLever: {
    vb: 24,
    parts: [
      P('M3 9.6c0-2 1.6-3.5 3.6-3.4 3.4.2 8.5.4 12.4-.2 1.8-.3 2.9 1 2.4 2.6-1.1 3.6-4.6 7.2-9.6 8.8-2.3.7-4.4 1-5.9.2C3.9 16.3 3 13.1 3 9.6z', 'f1', 'blood'),
      P('M13 6.2c-.5 3-1.6 5.5-3.5 7.6', 'l', 'i-ink'),
      G([C(13.5, 15.6, 1.9, 'f2', 'ok')], 'pop'),
    ],
  },
  // Hud og underhud: hudlagene med hår.
  orgHud: {
    vb: 24,
    parts: [
      R(3, 10, 18, 10, 2, 'f1', 'warn'),
      P('M3 15h18', 'd', 'i-line'),
      P('M3 10c2-1.4 4-1.4 6 0s4 1.4 6 0 4-1.4 6 0', 'l', 'i-ink'),
      G([P('M8 9.6V5M15.5 9.6V6', 'l', 'i-ink')], 'wink'),
    ],
  },
  // Muskler, bindevev og skjelett: en knokkel.
  orgSkjelett: {
    vb: 24,
    rot: 'rotate(-40 12 12)',
    parts: [
      R(6.5, 10.3, 11, 3.4, 1, 'o1', 'glass'),
      C(5.6, 9.8, 2.4, 'o1', 'glass'),
      C(5.6, 14.2, 2.4, 'o1', 'glass'),
      C(18.4, 9.8, 2.4, 'o1', 'glass'),
      C(18.4, 14.2, 2.4, 'o1', 'glass'),
    ],
  },
  // Nyre og urinveier: en nyre med urinlederen.
  orgNyre: {
    vb: 24,
    parts: [
      P('M15.5 4c-3.8 0-7.5 3.5-7.5 8.5S11 20 14.5 20c2.4 0 3.2-1.8 3.2-3.5 0-1.6-1.4-2.4-1.4-4.5s1.6-2.6 1.6-4.4C17.9 5.6 17.3 4 15.5 4z', 'f1', 'danger'),
      G([P('M16.3 12h-3c-1.5 0-2.5 1-2.5 2.5V21', 'l', 'info')], 'drop'),
    ],
  },
  // Svangerskap og perinatalperioden: en gravid kvinne i profil.
  orgSvangerskap: {
    vb: 24,
    parts: [
      C(10.5, 4.8, 2.4, 'f2', 'accent2'),
      P('M8.5 8.2h4c.6 1.4 1 2.4 2.6 3.4 2.4 1.5 2.5 5.2-.1 6.4-.8.4-1.7.5-2.5.5v3H8.7v-4.1C7.6 16 7.3 14 7.7 12z', 'f1', 'accent2'),
      G([C(13.6, 14.8, 1.5, 'h', 'danger')], 'pulse'),
    ],
  },
  // Kjønnsorganer og bryst: kvinne- og mannssymbolet.
  orgKjonn: {
    vb: 24,
    parts: [
      C(9, 13.5, 4.2, 'f1', 'danger'),
      P('M9 17.7v3.8M6.8 19.7h4.4', 'l', 'i-ink'),
      C(15, 8.5, 4.2, 'f1', 'info'),
      G([P('M18 5.5l3-3M18.2 2.5H21v2.8', 'l', 'i-ink')], 'bumpR'),
    ],
  },
  // Generelle lidelser og reaksjoner på administrasjonsstedet: et termometer.
  orgGenerell: {
    vb: 24,
    parts: [
      P('M10 4.5a2 2 0 0 1 4 0v9.2a4 4 0 1 1-4 0z', 'f1', 'glass'),
      C(12, 16.8, 2.3, 'f2', 'danger'),
      G([P('M12 15V8.5', 'l', 'danger')], 'fill'),
      P('M14.5 7h1.6M14.5 10h1.6', 'l', 'i-line'),
    ],
  },
  // Skader, forgiftninger og komplikasjoner: et plaster.
  orgSkade: {
    vb: 24,
    rot: 'rotate(-45 12 12)',
    parts: [
      R(2.5, 8.5, 19, 7, 3.5, 'f1', 'warn'),
      R(9, 8.5, 6, 7, 1, 'f2', 'paper'),
      C(10.8, 10.8, 0.7, 'h', 'i-line'),
      C(13.2, 13.2, 0.7, 'h', 'i-line'),
      C(13.2, 10.8, 0.7, 'h', 'i-line'),
      C(10.8, 13.2, 0.7, 'h', 'i-line'),
    ],
  },
  // Kirurgiske og medisinske prosedyrer: en skalpell.
  orgProsedyre: {
    vb: 24,
    parts: [
      P('M3.5 20.5 12 12l2.2 2.2c-2.6 3.6-6.2 5.6-10.7 6.3z', 'f1', 'glass'),
      G([P('M13.4 10.6l6-6 2.2 2.2-6 6z', 'f2', 'accent2')], 'bumpR'),
      P('M3.5 20.5 12 12', 'l', 'i-ink'),
    ],
  },
  // Sosiale omstendigheter: to personer.
  orgSosial: {
    vb: 24,
    parts: [
      C(8.5, 8, 3, 'f1', 'accent'),
      P('M3 19.5a5.5 5.5 0 0 1 11 0z', 'f1', 'accent'),
      G([C(16, 9, 2.6, 'f1', 'accent2'), P('M11.5 19.5a4.5 4.5 0 0 1 9 0z', 'f1', 'accent2')], 'pop'),
    ],
  },
} satisfies Record<string, Ikondefinisjon>

export type Ikonnavn = keyof typeof REGISTER

/** Alle ikonene, i registerets rekkefølge. */
export const IKONNAVN = Object.keys(REGISTER) as Ikonnavn[]

export const IKONER: Readonly<Record<Ikonnavn, Ikondefinisjon>> = REGISTER

/** Ikonet en stoffkategori får når den ikke har noe eget. */
export const KATEGORIIKON_PLASSHOLDER: Ikonnavn = 'katPlassholder'

/**
 * Ikonet til en kategori i stoffregisteret, ut fra navnet kategorien peker på
 * (`ikon` i registeret). Mangler det, eller er det ikke et ikon her, blir det
 * plassholderen — så en ny kategori alltid har et ikon til den får sitt eget.
 */
export function kategoriikon(navn?: string | null): Ikonnavn {
  return navn && Object.hasOwn(REGISTER, navn) ? (navn as Ikonnavn) : KATEGORIIKON_PLASSHOLDER
}
