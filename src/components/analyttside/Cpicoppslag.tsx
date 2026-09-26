import { Fragment, useMemo, useState } from 'react'
import { ramsOpp } from '../../faginnhold/oppsummering'
import { dato } from '../../legemiddeldata/referanser'
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

/**
 * Oppslaget etter et kjent farmakogenetisk resultat i «Farmakogenetikk»:
 * legemiddel → gen → resultat → CPIC-anbefaling (`src/cpic/oppslag.ts`).
 *
 * Brukeren velger det allerede fortolkede resultatet for hvert gen, og kortet
 * viser anbefalingen CPIC har for nøyaktig den kombinasjonen, med styrken,
 * kilden, versjonen og hvorfor akkurat den ble valgt. Valgene står bare i
 * komponentens tilstand: de lagres ikke, sendes ikke noe sted og står ikke i
 * adressen.
 */
export function Cpicoppslag({ utvalg }: { utvalg: Cpicutvalg }) {
  const grunnlag = useMemo(() => oppslagsgrunnlag(utvalg), [utvalg])
  const [legemiddelId, setLegemiddelId] = useState<string | null>(null)
  const [valg, setValg] = useState<Valg>({})
  const g = grunnlag.find((x) => x.legemiddel.id === legemiddelId) ?? grunnlag[0]
  if (!g) return null

  const svar = slaOpp(g, valg)
  const retningslinjer = new Map(utvalg.retningslinjer.map((r) => [r.id, r]))
  const velg = (gen: string, v: Genvalg | null) =>
    setValg((forrige) => {
      const neste = { ...forrige }
      if (v) neste[gen] = v
      else delete neste[gen]
      return neste
    })
  const tomt = Object.keys(valg).length === 0

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
            svaret. Oppslaget viser bare en anbefaling CPIC har for nøyaktig den kombinasjonen, og fyller aldri inn et
            resultat som mangler. Valgene lagres ikke.
          </p>
          <form className="cpic-oppslag__valg" autoComplete="off" onSubmit={(e) => e.preventDefault()}>
            {grunnlag.length > 1 && (
              <Valgfelt
                merke="Legemiddel"
                verdi={g.legemiddel.id}
                valg={grunnlag.map((x) => ({ verdi: x.legemiddel.id, tekst: x.legemiddel.navn }))}
                onEndre={(id) => {
                  setLegemiddelId(id)
                  setValg({})
                }}
              />
            )}
            {g.gener.map((gen) => (
              <Genfelt key={`${g.legemiddel.id}-${gen.symbol}`} gen={gen} valgt={valg[gen.symbol]} onVelg={(v) => velg(gen.symbol, v)} />
            ))}
            <p className="preparatlenker">
              <Button variant="subtle" className="redigeringsknapp" disabled={tomt} onClick={() => setValg({})}>
                Nullstill valgene
              </Button>
            </p>
          </form>
          <div className="cpic-oppslag__svar" aria-live="polite">
            {tomt ? (
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

/** Resultatet for ett gen, og den eksakte verdien når CPIC har flere for resultatet. */
function Genfelt({ gen, valgt, onVelg }: { gen: Oppslagsgen; valgt: Genvalg | undefined; onVelg: (v: Genvalg | null) => void }) {
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
    </div>
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
  const valgt = `Valgt: ${resultattekst(b.gen, b.resultat)}${b.valgt.oppslagsverdi ? `, ${verdinavn(metode)} ${b.valgt.oppslagsverdi}` : ''}.`
  if (metode !== 'ACTIVITY_SCORE' || b.valgt.oppslagsverdi) return valgt
  return b.oppslagsverdier.length > 1
    ? `${valgt} CPIC har samme anbefaling for aktivitetsverdi ${oppramsing(b.oppslagsverdier)}.`
    : `${valgt} CPIC slår opp på aktivitetsverdi ${b.oppslagsverdier[0]}.`
}

function verdinavn(metode: Oppslagsmetode | null): string {
  return metode === 'ACTIVITY_SCORE' ? 'aktivitetsverdi' : 'verdi i CPIC'
}
