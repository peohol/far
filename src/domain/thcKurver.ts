/**
 * Utskillelseskurvene for THC-syre: hvordan en kurve regnes, hvor en prøve
 * ligger på den, hva kurven forventer etter et antall døgn — og beviset for
 * at kurvene står i rekkefølge.
 *
 * En kurve er bi-eksponentiell, C(t) = a1·e^(−k1·t) + a2·e^(−k2·t), med t i
 * døgn og amplitudene i IRCAK-enheter.
 *
 * **Rekkefølgen.** Konklusjonen forutsetter at grønn kurve alltid forventer
 * minst like stor nedgang som gul, og gul minst like stor som rød — for
 * enhver forrige prøve og ethvert tidsrom motoren godtar (IRCAK > 0, døgn
 * ≥ 0). Det avgjøres her eksakt, ikke ved å prøve utvalgte punkter:
 *
 * Et fall fra konsentrasjon x til y tar ∫ dz / (z·λ(z)) døgn, der λ(z) er
 * kurvens utskillelsesrate (−C′/C) i det øyeblikket den står på z. Kurve A
 * forventer derfor minst like stor nedgang som kurve B fra enhver x over
 * ethvert tidsrom hvis og bare hvis λ_A(z) ≥ λ_B(z) for alle z > 0.
 *
 * For en bi-eksponentiell kurve med rask rate kf, langsom rate ks og
 * amplitudene A (rask) og B (langsom) er λ(z) = ks + (kf − ks)·r/(1 + r),
 * der r er løsningen av r·(1 + r)^p = K·z^p, med p = (kf − ks)/ks og
 * K = A·B^−(1+p). λ stiger fra ks (z → 0) mot kf (z → ∞). Det gir:
 *
 * - Samme rater: λ_A ≥ λ_B overalt hvis og bare hvis K_A ≥ K_B.
 * - Ellers må ks_A > ks_B og kf_A > kf_B (med like rater i bare den ene
 *   enden krysser kurvene alltid et sted, se {@link sammenlign}). Da finnes
 *   en z0 der λ_B(z0) = ks_A, og en z1 der λ_A(z1) = kf_B, begge på lukket
 *   form. Under z0 og over z1 holder ulikheten av seg selv. Mellom dem
 *   deles intervallet opp: siden begge λ stiger med z, holder
 *   λ_A(zᵢ) ≥ λ_B(zᵢ₊₁) ulikheten på hele [zᵢ, zᵢ₊₁].
 *
 * Kontrollen er dermed et bevis for hele domenet, bortsett fra
 * flyttallsavrundingen, som kan gi opp mot {@link RATETOLERANSE} i λ.
 */

/** En kurve med amplitudene i IRCAK-enheter. */
export interface Kurve {
  a1: number
  k1: number
  a2: number
  k2: number
}

/** Kurvens verdi etter `t` døgn. Definert også for negative `t`. */
export function verdiPaaKurve(t: number, k: Kurve): number {
  return k.a1 * Math.exp(-k.k1 * t) + k.a2 * Math.exp(-k.k2 * t)
}

/** Grensen for hvor langt søket etter tidspunktet utvides, i døgn. */
const LENGSTE_SOK = 1e7

/**
 * Tidspunktet der kurven passerer `verdi`. Kurven er strengt fallende, så
 * svaret er entydig; binærsøket lander på regnearkets Newton-løsning med
 * maskinpresisjon. Verdier over kurvens startpunkt gir negativ tid — kurven
 * forlenges da bakover, akkurat som i regnearket.
 *
 * Søket begynner i ±1000 døgn og utvides bare når tidspunktet ligger
 * utenfor — for IRCAK langt under det laboratoriet kan måle. Innenfor gir
 * det nøyaktig samme svar som før utvidelsen fantes.
 */
export function tidForVerdi(verdi: number, k: Kurve): number {
  let lav = -1000
  let hoy = 1000
  while (verdiPaaKurve(hoy, k) > verdi && hoy < LENGSTE_SOK) {
    lav = hoy
    hoy *= 2
  }
  while (!(verdiPaaKurve(lav, k) > verdi) && lav > -LENGSTE_SOK) {
    hoy = lav
    lav *= 2
  }
  for (let i = 0; i < 200; i++) {
    const midt = (lav + hoy) / 2
    if (verdiPaaKurve(midt, k) > verdi) {
      lav = midt
    } else {
      hoy = midt
    }
  }
  return (lav + hoy) / 2
}

/**
 * Forventet relativ endring fra forrige prøve etter `dager` døgn, om
 * utskillelsen følger kurven. −0,25 betyr 25 % nedgang.
 */
export function forventetEndring(forrige: number, dager: number, k: Kurve): number {
  const t0 = tidForVerdi(forrige, k)
  return verdiPaaKurve(t0 + dager, k) / forrige - 1
}

/* --- Rekkefølgen ---------------------------------------------------------- */

/**
 * Hvor mye flyttallsavrundingen får gi i utskillelsesraten, relativt til den
 * største raten. Grønn og gul kurve i dagens regelsett skiller seg med mange
 * størrelsesordener mer enn dette.
 */
export const RATETOLERANSE = 1e-12

/** Kurven slik raten leses: ett ledd, eller et raskt og et langsomt. */
type Rateform =
  | { enkel: true; k: number }
  | { enkel: false; kf: number; ks: number; p: number; lnK: number }

function rateform(k: Kurve): Rateform {
  if (k.k1 === k.k2) return { enkel: true, k: k.k1 }
  const [kf, a, ks, b] = k.k1 > k.k2 ? [k.k1, k.a1, k.k2, k.a2] : [k.k2, k.a2, k.k1, k.a1]
  const p = (kf - ks) / ks
  return { enkel: false, kf, ks, p, lnK: Math.log(a) - (1 + p) * Math.log(b) }
}

/** ln(1 + eᵘ) uten over- eller underflyt. */
function softplus(u: number): number {
  return u > 0 ? u + Math.log1p(Math.exp(-u)) : Math.log1p(Math.exp(u))
}

/** 1/(1 + e⁻ᵘ) uten over- eller underflyt. */
function logistisk(u: number): number {
  return u >= 0 ? 1 / (1 + Math.exp(-u)) : Math.exp(u) / (1 + Math.exp(u))
}

/** ln(q/(1 − q)). */
function logit(q: number): number {
  return Math.log(q) - Math.log1p(-q)
}

/**
 * u = ln r for konsentrasjonen e^lnz: løsningen av u + p·ln(1 + eᵘ) = c.
 * Venstresiden stiger strengt i u, så binærsøket finner den ene løsningen.
 */
function lnR(f: Extract<Rateform, { enkel: false }>, lnz: number): number {
  const c = f.lnK + f.p * lnz
  const start = c - f.p * Math.LN2
  let lav = start <= 0 ? start : start / (1 + f.p)
  let hoy = c
  for (let i = 0; i < 200; i++) {
    const midt = (lav + hoy) / 2
    if (midt + f.p * softplus(midt) < c) lav = midt
    else hoy = midt
  }
  return (lav + hoy) / 2
}

/** Utskillelsesraten λ når kurven står på konsentrasjonen e^lnz. */
function rate(f: Rateform, lnz: number): number {
  if (f.enkel) return f.k
  return f.ks + (f.kf - f.ks) * logistisk(lnR(f, lnz))
}

/** Utskillelsesraten λ = −C′/C, per døgn, når kurven står på konsentrasjonen `z`. */
export function utskillelsesrate(k: Kurve, z: number): number {
  return rate(rateform(k), Math.log(z))
}

/** ln z der λ = ks + (kf − ks)·q, for 0 < q < 1. */
function lnzForAndel(f: Extract<Rateform, { enkel: false }>, q: number): number {
  const u = logit(q)
  return (u + f.p * softplus(u) - f.lnK) / f.p
}

/**
 * Hvor rekkefølgen brytes: ved en bestemt konsentrasjon, i en av endene
 * (svært lave konsentrasjoner, altså lang tid etter inntak, eller svært
 * høye), eller overalt.
 */
export type Rekkefolgebrudd =
  | { ved: 'lave' }
  | { ved: 'hoye' }
  | { ved: 'overalt' }
  | { ved: 'ircak'; ircak: number }

/** Antall deler intervallet mellom endene først deles i. */
const START_DELER = 256
/** Hvor mange ganger en del kan halveres før bruddet regnes som påvist. */
const DYPESTE_DELING = 60

/**
 * Om `raskere` forventer minst like stor nedgang som `tregere` fra enhver
 * forrige prøve over ethvert tidsrom. `null` når det holder; ellers hvor
 * det ikke gjør det. Se beviset øverst i fila.
 */
export function sammenlign(raskere: Kurve, tregere: Kurve): Rekkefolgebrudd | null {
  const a = rateform(raskere)
  const b = rateform(tregere)
  const toleranse = RATETOLERANSE * Math.max(a.enkel ? a.k : a.kf, b.enkel ? b.k : b.kf)

  // λ er konstant for et enkelt ledd, og ligger ellers strengt mellom ks og kf.
  if (a.enkel && b.enkel) return a.k >= b.k ? null : { ved: 'lave' }
  if (a.enkel) return a.k >= (b as Extract<Rateform, { enkel: false }>).kf ? null : { ved: 'hoye' }
  if (b.enkel) return a.ks >= b.k ? null : { ved: 'lave' }

  if (a.kf === b.kf && a.ks === b.ks) return a.lnK >= b.lnK ? null : { ved: 'overalt' }
  // Endene: λ går mot ks når z → 0 og mot kf når z → ∞. Er ratene like i
  // bare den ene enden, avgjør neste ledd, og det går alltid feil vei: med
  // lik ks faller λ − ks raskere mot 0 for kurven med størst kf, og med lik
  // kf nærmer λ seg kf langsommere for kurven med størst ks.
  if (!(a.ks > b.ks)) return { ved: 'lave' }
  if (!(a.kf > b.kf)) return { ved: 'hoye' }

  // Under z0 er λ_B ≤ ks_A < λ_A; over z1 er λ_A ≥ kf_B > λ_B.
  const qB = (a.ks - b.ks) / (b.kf - b.ks)
  if (qB >= 1) return null
  const lnz0 = lnzForAndel(b, qB)
  const lnz1 = lnzForAndel(a, (b.kf - a.ks) / (a.kf - a.ks))
  if (!(lnz0 < lnz1)) return null

  const holder = (fra: number, til: number) => rate(a, fra) >= rate(b, til) - toleranse
  const stabel: { fra: number; til: number; dybde: number }[] = []
  const steg = (lnz1 - lnz0) / START_DELER
  for (let i = 0; i < START_DELER; i++) {
    stabel.push({ fra: lnz0 + i * steg, til: i === START_DELER - 1 ? lnz1 : lnz0 + (i + 1) * steg, dybde: 0 })
  }
  while (stabel.length > 0) {
    const { fra, til, dybde } = stabel.pop()!
    if (holder(fra, til)) continue
    // Brytes ulikheten i selve punktet, er rekkefølgen brutt der.
    if (!holder(fra, fra) || dybde >= DYPESTE_DELING) return { ved: 'ircak', ircak: Math.exp(fra) }
    if (!holder(til, til)) return { ved: 'ircak', ircak: Math.exp(til) }
    const midt = (fra + til) / 2
    stabel.push({ fra, til: midt, dybde: dybde + 1 }, { fra: midt, til, dybde: dybde + 1 })
  }
  return null
}
