import { Fragment, useId, useMemo, useState } from 'react'
import { ramsOpp } from '../../faginnhold/oppsummering'
import { dato } from '../../legemiddeldata/referanser'
import { kanOversettes, oversett, sokDiplotyper, valgFraOversettelse, type Diplotypeindeks, type Oversettelse } from '../../cpic/diplotype'
import type { Cpicutvalg } from '../../cpic/lesing'
import type { Oppslagsmetode } from '../../cpic/modell'
import { oppslagsgrunnlag, slaOpp, type Genvalg, type Oppslagsgen, type Oppslagstreff, type Valg } from '../../cpic/oppslag'
import { betingelsetekst, CPIC_OPPSLAG_KORT, cpicversjon, OPPSLAG_TITTEL, resultattekst } from '../../cpic/stoffside'
import { Button } from '../Button'
import { oppramsing, Valgfelt } from '../regler/Regelfelter'
import { Detaljkort } from '../seksjoner/Seksjon'
import { Uthev } from '../Uthev'
import { Kildelenke } from './Farmakogenetikkdeler'
import { elementAnker } from './Paneler'
import { useDiplotyper } from './useFarmakogenetikk'

/**
 * Oppslaget etter et kjent farmakogenetisk resultat i «Farmakogenetikk»:
 * legemiddel → gen → resultat → CPIC-anbefaling (`src/cpic/oppslag.ts`).
 *
 * Brukeren velger det allerede fortolkede resultatet for hvert gen, og kortet
 * viser anbefalingen CPIC har for nøyaktig den kombinasjonen, med styrken,
 * kilden, versjonen og hvorfor akkurat den ble valgt. Resultatet kan også
 * oversettes fra en diplotype med CPICs tabell (`src/cpic/diplotype.ts`); da
 * står oversettelsen ved genet, før anbefalingen. Valgene står bare i
 * komponentens tilstand: de lagres ikke, sendes ikke noe sted og står ikke i
 * adressen. For diplotypen hentes CPICs tabell for genet, og søket skjer i
 * nettleseren.
 */
export function Cpicoppslag({ utvalg }: { utvalg: Cpicutvalg }) {
  const grunnlag = useMemo(() => oppslagsgrunnlag(utvalg), [utvalg])
  const [legemiddelId, setLegemiddelId] = useState<string | null>(null)
  const [valg, setValg] = useState<Valg>({})
  // Diplotypen som er oversatt for hvert gen, også når anbefalingene ikke har resultatet den gir.
  const [diplotyper, setDiplotyper] = useState<Readonly<Record<string, string>>>({})
  const g = grunnlag.find((x) => x.legemiddel.id === legemiddelId) ?? grunnlag[0]
  if (!g) return null

  const svar = slaOpp(g, valg)
  const retningslinjer = new Map(utvalg.retningslinjer.map((r) => [r.id, r]))
  const settGen = <T,>(forrige: Readonly<Record<string, T>>, gen: string, verdi: T | null | undefined) => {
    const neste = { ...forrige }
    if (verdi) neste[gen] = verdi
    else delete neste[gen]
    return neste
  }
  // Et resultat valgt for hånd erstatter diplotypen; en oversatt diplotype gir resultatet, eller ingenting.
  const velg = (gen: string, v: Genvalg | null, diplotype: string | null = null) => {
    setValg((forrige) => settGen(forrige, gen, v))
    setDiplotyper((forrige) => settGen(forrige, gen, diplotype))
  }
  const nullstill = () => {
    setValg({})
    setDiplotyper({})
  }
  const tomt = Object.keys(valg).length === 0 && Object.keys(diplotyper).length === 0

  return (
    <li>
      <Detaljkort
        id={CPIC_OPPSLAG_KORT}
        ikon="search"
        tittel={<Uthev tekst={OPPSLAG_TITTEL} />}
        oppsummering={ramsOpp([
          grunnlag.length > 1 ? grunnlag.map((x) => x.legemiddel.navn).join(', ') : g.legemiddel.navn,
          [...new Set(grunnlag.flatMap((x) => x.gener.map((y) => y.symbol)))].join(', '),
        ])}
      >
        <div className="interaksjon cpic-oppslag" id={elementAnker(CPIC_OPPSLAG_KORT)}>
          <p className="farmakogenetikk__ingress">
            For et farmakogenetisk resultat som allerede er kjent og fortolket. Velg resultatet for hvert gen slik det står i
            svaret, eller oversett diplotypen med CPICs tabell. Oppslaget viser bare en anbefaling CPIC har for nøyaktig den
            kombinasjonen, og fyller aldri inn et resultat som mangler. Valgene lagres ikke, og diplotypen sendes ikke noe
            sted.
          </p>
          <form className="cpic-oppslag__valg" autoComplete="off" onSubmit={(e) => e.preventDefault()}>
            {grunnlag.length > 1 && (
              <Valgfelt
                merke="Legemiddel"
                verdi={g.legemiddel.id}
                valg={grunnlag.map((x) => ({ verdi: x.legemiddel.id, tekst: x.legemiddel.navn }))}
                onEndre={(id) => {
                  setLegemiddelId(id)
                  nullstill()
                }}
              />
            )}
            {g.gener.map((gen) => (
              <Genfelt
                key={`${g.legemiddel.id}-${gen.symbol}`}
                gen={gen}
                legemiddel={g.legemiddel.navn}
                valgt={valg[gen.symbol]}
                diplotype={diplotyper[gen.symbol] ?? null}
                onVelg={(v, diplotype) => velg(gen.symbol, v, diplotype)}
              />
            ))}
            <p className="preparatlenker">
              <Button variant="subtle" className="redigeringsknapp" disabled={tomt} onClick={nullstill}>
                Nullstill valgene
              </Button>
            </p>
          </form>
          <div className="cpic-oppslag__svar" aria-live="polite">
            {Object.keys(valg).length === 0 ? (
              <p className="preparater__melding">
                Velg resultatet for {oppramsing(g.gener.map((x) => x.symbol))} for å se anbefalingen for {g.legemiddel.navn}.
              </p>
            ) : (
              <>
                {svar.treff.map((t) => (
                  <Treff
                    key={`${t.retningslinje_id}-${t.gruppe.id}`}
                    treff={t}
                    retningslinje={retningslinjer.get(t.retningslinje_id)}
                    visPopulasjon={g.populasjoner.length > 1}
                    versjon={cpicversjon(utvalg.kilde, dato)}
                    metoder={g.metoder}
                  />
                ))}
                {svar.uavklart.map((u) => (
                  <p key={`${u.populasjon}-${u.gen}`} className="interaksjoner__ikke-vurdert" role="note">
                    {g.populasjoner.length > 1 && u.populasjon ? `Populasjon ${u.populasjon}: ` : ''}
                    {u.uten_anbefaling.length > 0
                      ? `CPIC har ingen anbefaling for ${resultattekst(u.gen, u.resultat)} med ${verdinavn(g.metoder.get(u.gen) ?? null)} ${oppramsing(u.uten_anbefaling)} og disse valgene.`
                      : `CPIC har ulike anbefalinger for ${resultattekst(u.gen, u.resultat)} avhengig av ${verdinavn(g.metoder.get(u.gen) ?? null)} (${oppramsing(u.oppslagsverdier)}).`}{' '}
                    Velg {verdinavn(g.metoder.get(u.gen) ?? null)} for å se anbefalingen.
                  </p>
                ))}
                {svar.mangler.length > 0 && (
                  <p className="preparater__melding">
                    {svar.treff.length > 0 ? 'Flere anbefalinger bygger også på' : 'Anbefalingene bygger også på'}{' '}
                    {oppramsing(svar.mangler)}. Velg resultatet for {svar.mangler.length > 1 ? 'dem' : 'det'} for å se
                    {svar.treff.length > 0 ? ' dem' : ' anbefalingen'}.
                  </p>
                )}
                {svar.ingen && (
                  <p className="interaksjoner__ikke-vurdert" role="note">
                    CPIC har ingen anbefaling for {g.legemiddel.navn} med denne kombinasjonen av resultater. OUSFAR viser
                    ingen anbefaling for den.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </Detaljkort>
    </li>
  )
}

/**
 * Resultatet for ett gen, og den eksakte verdien når CPIC har flere for
 * resultatet. For gener CPIC slår opp på fenotype eller aktivitetsverdi kan
 * resultatet også oversettes fra diplotypen.
 */
function Genfelt({
  gen,
  legemiddel,
  valgt,
  diplotype,
  onVelg,
}: {
  gen: Oppslagsgen
  legemiddel: string
  valgt: Genvalg | undefined
  diplotype: string | null
  onVelg: (v: Genvalg | null, diplotype?: string | null) => void
}) {
  const alternativ = gen.alternativer.find((a) => a.resultat === valgt?.resultat)
  return (
    <div className="cpic-oppslag__gen">
      <Valgfelt
        merke={`${gen.symbol}, resultat`}
        verdi={valgt?.resultat ?? ''}
        valg={[{ verdi: '', tekst: 'Ikke valgt' }, ...gen.alternativer.map((a) => ({ verdi: a.resultat, tekst: a.resultat }))]}
        onEndre={(resultat) => onVelg(resultat ? { resultat } : null)}
      />
      {alternativ && alternativ.oppslagsverdier.length > 1 && (
        <Valgfelt
          merke={`${gen.symbol}, ${verdinavn(gen.metode)}`}
          verdi={valgt?.oppslagsverdi ?? ''}
          valg={[{ verdi: '', tekst: 'Ikke kjent' }, ...alternativ.oppslagsverdier.map((v) => ({ verdi: v, tekst: v }))]}
          onEndre={(v) => onVelg({ resultat: alternativ.resultat, ...(v ? { oppslagsverdi: v } : {}) })}
        />
      )}
      {kanOversettes(gen.metode) && (
        <Diplotypefelt gen={gen} legemiddel={legemiddel} diplotype={diplotype} onVelg={onVelg} />
      )}
    </div>
  )
}

/** Flest diplotyper søket viser om gangen. */
const MAKS_DIPLOTYPETREFF = 8

/**
 * Oversettelsen fra diplotype for ett gen: søket i CPICs tabell for genet,
 * og oversettelsen av diplotypen som er valgt, før anbefalingen. Tabellen
 * hentes først når brukeren ber om det.
 */
function Diplotypefelt({
  gen,
  legemiddel,
  diplotype,
  onVelg,
}: {
  gen: Oppslagsgen
  legemiddel: string
  diplotype: string | null
  onVelg: (v: Genvalg | null, diplotype: string | null) => void
}) {
  const [apen, setApen] = useState(false)
  const [sok, setSok] = useState('')
  const tilstand = useDiplotyper(apen || diplotype ? gen.symbol : null)
  const id = useId()

  if (!apen && !diplotype) {
    return (
      <p className="cpic-diplotype__apne">
        <Button variant="subtle" className="redigeringsknapp" onClick={() => setApen(true)}>
          Oversett fra diplotype
        </Button>
      </p>
    )
  }

  const indeks = tilstand.status === 'klar' ? tilstand.indeks : null
  const velgDiplotype = (d: string) => {
    if (!indeks) return
    const svar = oversett(indeks, d)
    const valg = svar.status === 'oversatt' ? valgFraOversettelse(gen, svar.oversettelse) : null
    onVelg(valg?.status === 'valgt' ? valg.valg : null, d)
    setSok('')
  }
  const funnet = indeks && sok ? sokDiplotyper(indeks, sok, MAKS_DIPLOTYPETREFF) : null
  const antall = indeks?.oppforinger.length ?? 0

  return (
    <div className="cpic-diplotype">
      {tilstand.status === 'laster' && <p className="felt__hjelp">Henter CPICs diplotyper for {gen.symbol} …</p>}
      {tilstand.status === 'feil' && (
        <p className="interaksjoner__ikke-vurdert" role="note">
          Kunne ikke hente CPICs diplotyper for {gen.symbol}: {tilstand.feil}
        </p>
      )}
      {indeks && antall === 0 && (
        <p className="preparater__melding">CPIC har ingen diplotyper for {gen.symbol}. Velg resultatet slik det står i svaret.</p>
      )}
      {indeks && antall > 0 && (
        <div className="felt">
          <label className="felt__merkelapp" htmlFor={id}>
            {gen.symbol}, diplotype
          </label>
          <input
            id={id}
            className="felt__inndata"
            type="search"
            value={sok}
            placeholder={indeks.oppforinger[0] ? `f.eks. ${indeks.oppforinger[0].diplotype}` : undefined}
            aria-describedby={`${id}-hjelp`}
            onChange={(e) => setSok(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && funnet?.eksakt) {
                e.preventDefault()
                velgDiplotype(funnet.eksakt.diplotype)
              }
            }}
          />
          <span id={`${id}-hjelp`} className="felt__hjelp">
            Søk i CPICs tabell ({antall.toLocaleString('nb-NO')} diplotyper) og velg diplotypen. Bare diplotyper CPIC har,
            oversettes.
          </span>
        </div>
      )}
      {indeks && funnet && (
        <>
          {funnet.treff.length > 0 && (
            <ul className="cpic-diplotype__treff" aria-label={`Diplotyper for ${gen.symbol} i CPIC`}>
              {funnet.treff.map((o) => {
                const svar = oversett(indeks, o.diplotype)
                return (
                  <li key={o.diplotype}>
                    <Button variant="kant" onClick={() => velgDiplotype(o.diplotype)}>
                      {o.diplotype}
                    </Button>{' '}
                    <span className="felt__hjelp">
                      {svar.status === 'oversatt' ? resultatMedVerdi(svar.oversettelse) : 'kan ikke oversettes'}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
          <p className="felt__hjelp" aria-live="polite">
            {funnet.antall === 0
              ? `CPIC har ingen diplotype for ${gen.symbol} som passer «${sok}». Den oversettes ikke; velg resultatet slik det står i svaret.`
              : funnet.antall > funnet.treff.length
                ? `Viser ${funnet.treff.length} av ${funnet.antall} diplotyper som passer.`
                : ''}
          </p>
        </>
      )}
      {indeks && diplotype && <Diplotypeoversettelse indeks={indeks} gen={gen} legemiddel={legemiddel} diplotype={diplotype} />}
      {indeks?.grunnlag.gen?.merknad_diplotyper && (
        <p className="felt__hjelp">CPICs merknad om diplotypene: {indeks.grunnlag.gen.merknad_diplotyper}</p>
      )}
      <p className="cpic-diplotype__apne">
        <Button
          variant="subtle"
          className="redigeringsknapp"
          onClick={() => {
            if (diplotype) onVelg(null, null)
            setSok('')
            setApen(false)
          }}
        >
          {diplotype ? 'Fjern diplotypen' : 'Lukk'}
        </Button>
      </p>
    </div>
  )
}

/** «Intermediate Metabolizer, aktivitetsverdi 1.0», eller bare resultatet for gener CPIC slår opp på fenotype. */
function resultatMedVerdi(o: Oversettelse): string {
  return o.oppslagsverdi !== o.genresultat.resultat && aktuelt(o.oppslagsverdi)
    ? `${o.genresultat.resultat}, aktivitetsverdi ${o.oppslagsverdi}`
    : o.genresultat.resultat
}

/** CPICs «n/a» vises ikke som innhold. */
function aktuelt(verdi: string | null | undefined): string | null {
  const v = verdi?.trim()
  return v && v.toLowerCase() !== 'n/a' ? v : null
}

/**
 * Oversettelsen av den valgte diplotypen, trinn for trinn, slik CPICs tabell
 * gjør den: allelene og funksjonen deres, kombinasjonen og resultatet. Så om
 * anbefalingene for legemiddelet har resultatet.
 */
function Diplotypeoversettelse({
  indeks,
  gen,
  legemiddel,
  diplotype,
}: {
  indeks: Diplotypeindeks
  gen: Oppslagsgen
  legemiddel: string
  diplotype: string
}) {
  const svar = oversett(indeks, diplotype)
  if (svar.status !== 'oversatt') {
    return (
      <p className="interaksjoner__ikke-vurdert" role="note">
        {gen.symbol} {diplotype}:{' '}
        {svar.status === 'ukjent'
          ? 'CPIC har ikke denne diplotypen i tabellen for genet lenger. Den oversettes ikke.'
          : 'CPICs tabell gir ikke ett entydig resultat for diplotypen. Den oversettes ikke.'}
      </p>
    )
  }
  const o = svar.oversettelse
  const valg = valgFraOversettelse(gen, o)
  const funksjoner = [o.oppslag.funksjon1, o.oppslag.funksjon2].map(aktuelt).filter((f): f is string => f !== null)
  const verdier = [o.oppslag.aktivitetsverdi1, o.oppslag.aktivitetsverdi2].map(aktuelt).filter((v): v is string => v !== null)
  const total = aktuelt(o.oppslag.total_aktivitetsverdi)
  return (
    <section className="cpic-diplotype__oversettelse" aria-label={`Oversettelsen av ${gen.symbol} ${diplotype}`}>
      <p>
        <strong>
          {gen.symbol} {o.diplotype}
        </strong>{' '}
        oversatt med CPICs tabell:
      </p>
      <dl className="interaksjon__felter">
        {o.alleler.length > 0 && (
          <>
            <dt>Allelene</dt>
            <dd>
              {o.alleler
                .map((a) => {
                  const funksjon = aktuelt(a.klinisk_funksjon) ?? aktuelt(a.funksjon) ?? 'funksjon ikke oppgitt'
                  const verdi = aktuelt(a.aktivitetsverdi)
                  return `${a.navn}: ${funksjon}${verdi ? `, aktivitetsverdi ${verdi}` : ''}`
                })
                .join('; ')}
            </dd>
          </>
        )}
        {(funksjoner.length > 0 || o.oppslag.beskrivelse) && (
          <>
            <dt>Kombinasjonen</dt>
            <dd>
              {oppramsing(funksjoner)}
              {verdier.length > 0 ? ` (aktivitetsverdi ${verdier.join(' + ')}${total ? ` = ${total}` : ''})` : ''}
              {o.oppslag.beskrivelse ? `${funksjoner.length > 0 ? '. ' : ''}${o.oppslag.beskrivelse}` : ''}
            </dd>
          </>
        )}
        <dt>Resultat i CPIC</dt>
        <dd>{resultatMedVerdi(o)}</dd>
      </dl>
      {valg.status === 'valgt' ? (
        <p className="felt__hjelp">Resultatet er valgt for {gen.symbol} i oppslaget.</p>
      ) : (
        <p className="interaksjoner__ikke-vurdert" role="note">
          CPIC har ingen anbefaling for {legemiddel} ved {resultattekst(gen.symbol, o.genresultat.resultat)}
          {o.oppslagsverdi !== o.genresultat.resultat && aktuelt(o.oppslagsverdi) ? ` med aktivitetsverdi ${o.oppslagsverdi}` : ''}. OUSFAR viser ingen
          anbefaling for det.
        </p>
      )}
    </section>
  )
}

/**
 * En anbefaling som passer valgene: styrken og anbefalingen, implikasjonene
 * og kommentarene, kilden og versjonen, og hvorfor den ble valgt — hva
 * brukeren valgte for hvert gen, og hvilke verdier i CPIC det svarer til.
 */
function Treff({
  treff: t,
  retningslinje,
  visPopulasjon,
  versjon,
  metoder,
}: {
  treff: Oppslagstreff
  metoder: ReadonlyMap<string, Oppslagsmetode | null>
  retningslinje: { navn: string; url: string | null } | undefined
  visPopulasjon: boolean
  versjon: string
}) {
  const g = t.gruppe
  const implikasjoner = g.betingelser.filter((b) => b.implikasjon)
  return (
    <section className="cpic-oppslag__treff" aria-label="Anbefaling fra CPIC">
      <p className="cpic__betingelser">
        {g.betingelser.map((b) => (
          <span key={b.gen} className="cpic__betingelse">
            {betingelsetekst(b)}
          </span>
        ))}
        {visPopulasjon && t.populasjon && <span className="cpic__populasjon">Populasjon: {t.populasjon}</span>}
      </p>
      <p className="cpic__anbefalingstekst">
        <span className="farmakogenetikk__niva">Styrke: {g.klassifisering ?? 'ikke oppgitt'}</span>{' '}
        {g.anbefaling ?? 'CPIC har ingen anbefalingstekst for denne kombinasjonen.'}
      </p>
      <dl className="interaksjon__felter">
        {implikasjoner.map((b) => (
          <Fragment key={b.gen}>
            <dt>Implikasjon, {b.gen}</dt>
            <dd>{b.implikasjon}</dd>
          </Fragment>
        ))}
        {g.kommentarer && (
          <>
            <dt>Kommentarer</dt>
            <dd>{g.kommentarer}</dd>
          </>
        )}
        {g.populasjon && (
          <>
            <dt>Populasjon</dt>
            <dd>{g.populasjon}</dd>
          </>
        )}
        <dt>Hvorfor denne anbefalingen</dt>
        <dd>
          {t.begrunnelser.map((b) => (
            <p key={b.gen}>{begrunnelsetekst(b, metoder.get(b.gen) ?? null)}</p>
          ))}
          {t.ubrukte.length > 0 && <p>Anbefalingen bygger ikke på {oppramsing(t.ubrukte)}.</p>}
          <p>
            {g.anbefalinger.length === 1 ? 'Anbefaling' : 'Anbefalinger'} {g.anbefalinger.join(', ')} i CPIC
            {retningslinje ? `, retningslinjen «${retningslinje.navn}»; alle anbefalingene står i kortet for den` : ''}.
          </p>
        </dd>
        <dt>Kilde</dt>
        <dd>
          {versjon}. Gjelder bruk av et allerede kjent resultat, ikke hvem som bør testes.
        </dd>
      </dl>
      {retningslinje?.url && (
        <p className="preparatlenker">
          <Kildelenke lenke={retningslinje.url}>Les retningslinjen</Kildelenke>
        </p>
      )}
    </section>
  )
}

/**
 * «Valgt: CYP2D6 Intermediate Metabolizer. CPIC har samme anbefaling for
 * aktivitetsverdi 0.25, 0.5, 0.75 og 1.0.» For andre gener er verdien CPIC
 * slår opp på, den samme som resultatet, og nevnes bare når den er valgt.
 */
function begrunnelsetekst(b: Oppslagstreff['begrunnelser'][number], metode: Oppslagsmetode | null): string {
  if (b.valgt.diplotype) {
    const verdi = metode === 'ACTIVITY_SCORE' && aktuelt(b.valgt.oppslagsverdi) ? `, aktivitetsverdi ${b.valgt.oppslagsverdi}` : ''
    return `Valgt: ${b.gen} ${b.valgt.diplotype}, som CPICs tabell oversetter til ${b.resultat}${verdi}.`
  }
  const valgt = `Valgt: ${resultattekst(b.gen, b.resultat)}${b.valgt.oppslagsverdi ? `, ${verdinavn(metode)} ${b.valgt.oppslagsverdi}` : ''}.`
  if (metode !== 'ACTIVITY_SCORE' || b.valgt.oppslagsverdi) return valgt
  return b.oppslagsverdier.length > 1
    ? `${valgt} CPIC har samme anbefaling for aktivitetsverdi ${oppramsing(b.oppslagsverdier)}.`
    : `${valgt} CPIC slår opp på aktivitetsverdi ${b.oppslagsverdier[0]}.`
}

function verdinavn(metode: Oppslagsmetode | null): string {
  return metode === 'ACTIVITY_SCORE' ? 'aktivitetsverdi' : 'verdi i CPIC'
}
