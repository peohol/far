import { formaterTall, konsentrasjonsniva, ordEndring, type ThcGrunnlag } from '../domain/thc'

/**
 * Grunnlaget for fortolkningen, i vanlig språk — til å lese for den som vil
 * forstå hvordan kommentaren ble til. Ligger som en sammenleggbar
 * «Forklaring» under visualiseringen, etter mønster fra det frittstående
 * THC-COOH-verktøyet, og gjelder derfor bare fortolkning mot forrige prøve.
 *
 * Teksten er delt i fire bolker med hver sin overskrift — hvor stor endringen
 * er, hvorfor den målte endringen ikke er den sanne, hva som var å vente uten
 * et nytt inntak, og konklusjonen — slik at leseren finner igjen leddene i
 * resonnementet uten å lese alt. Brødteksten rykkes inn under overskriften
 * sin, så det synes hva som hører sammen.
 */

/** «en nedgang på 74 %», «en økning på 5 %» eller «ingen endring». */
function endringsfrase(endring: number): string {
  const ord = ordEndring(endring)
  if (ord === 'ingen endring') return 'ingen endring'
  return `en ${ord} på ${Math.round(Math.abs(endring) * 100)} %`
}

/** Tall slik de skrives i løpende norsk tekst: komma som desimaltegn. */
function tall(verdi: number): string {
  return String(verdi).replace('.', ',')
}

export function ThcForklaring({ grunnlag, kategori }: { grunnlag: ThcGrunnlag; kategori: number }) {
  const { forrige, aktuell, dager, kronisk, maltEndring, korrigertEndring, forventet } = grunnlag

  // Grensene kommentaren faktisk bruker: ett trinn strengere uten kronisk
  // bruk, slik kategorien også telles.
  const hosFleste = Math.round(-(kronisk ? forventet.gul : forventet.gronn) * 100)
  const ovreGrense = Math.round(-(kronisk ? forventet.rod : forventet.gul) * 100)

  const dagene = dager === 1 ? '1 dag' : `${dager} dager`
  const niva = konsentrasjonsniva(aktuell)

  const vurdering =
    kategori >= 4
      ? 'Den usikkerhetskorrigerte endringen viser mindre nedgang enn det som anses mulig selv ved ' +
        'den tregeste dokumenterte utskillelsen. Kommentaren sier derfor at cannabis har vært ' +
        'inntatt etter forrige prøve.'
      : kategori === 3
        ? 'Den usikkerhetskorrigerte endringen viser mindre nedgang enn forventet, men er fortsatt ' +
          'mulig ved spesielt treg utskillelse. Kommentaren sier derfor at det er vanskelig å avgjøre ' +
          'hvorvidt cannabis har vært inntatt etter forrige prøve.'
        : 'Den usikkerhetskorrigerte endringen ligger innenfor det som er forventet. Kommentaren ' +
          'sier derfor at cannabis ikke nødvendigvis har vært inntatt etter forrige prøve.'

  return (
    <div className="thc-forklaring">
      <section className="thc-forklaring__bolk">
        <h3 className="thc-forklaring__tittel">Hvor stor er endringen mellom målingene?</h3>
        <div className="thc-forklaring__kropp">
          <p>
            IRCAK er målt til {tall(aktuell)} i denne prøven og {tall(forrige)} i forrige — et
            forholdstall på {formaterTall(maltEndring + 1)} ({tall(aktuell)}/{tall(forrige)}),
            altså {endringsfrase(maltEndring)}.
          </p>
        </div>
      </section>

      <section className="thc-forklaring__bolk">
        <h3 className="thc-forklaring__tittel">Målt endring ≠ sann endring</h3>
        <div className="thc-forklaring__kropp">
          <p>
            Målinger har usikkerhet, så det sanne forholdstallet kan være noe høyere eller lavere
            enn det målte. Korrigert for måleusikkerhet kan vi med 90 % sikkerhet si at det sanne
            forholdstallet er minst {formaterTall(korrigertEndring + 1)} — tilsvarende{' '}
            {endringsfrase(korrigertEndring)}. Det er dette tallet, med tvilen i personens favør,
            som sammenlignes med utskillelseskurvene.
          </p>
        </div>
      </section>

      <section className="thc-forklaring__bolk">
        <h3 className="thc-forklaring__tittel">
          Forventet nedgang når et nytt inntak <i>ikke</i> har skjedd
        </h3>
        <div className="thc-forklaring__kropp">
          <p>
            Det er {dagene} mellom prøvene. Forventet endring etter {dagene} ved{' '}
            {kronisk ? 'kronisk bruk' : 'et enkeltinntak'}, når IRCAK i forrige prøve er{' '}
            {tall(forrige)} og det <i>ikke</i> har skjedd et nytt inntak:
          </p>
          <ul>
            <li>
              Hos de aller fleste: <strong>minst {hosFleste} % nedgang</strong>
            </li>
            <li>
              Øvre grense for hva som anses mulig: <strong>{ovreGrense} % nedgang</strong>
            </li>
          </ul>
        </div>
      </section>

      <section className="thc-forklaring__bolk">
        <h3 className="thc-forklaring__tittel">Konklusjon</h3>
        <div className="thc-forklaring__kropp">
          <p>{vurdering}</p>
          <p>
            Kommentarens åpning følger konsentrasjonen i denne prøven: under 20 omtales som lav,
            20–40 som middels høy, og 40 eller mer som høy. {tall(aktuell)} regnes derfor som{' '}
            {niva} konsentrasjon.
          </p>
        </div>
      </section>
    </div>
  )
}
