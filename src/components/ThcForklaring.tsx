import { formaterTall, konsentrasjonsniva, ordEndring, type ThcGrunnlag } from '../domain/thc'

/**
 * Grunnlaget for fortolkningen, i vanlig språk — til å lese for den som vil
 * forstå hvordan kommentaren ble til. Ligger som en sammenleggbar
 * «Forklaring» under visualiseringen, etter mønster fra det frittstående
 * THC-COOH-verktøyet, og gjelder derfor bare fortolkning mot forrige prøve.
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
      ? 'Den korrigerte endringen viser mindre nedgang enn det som anses mulig selv ved den tregeste ' +
        'dokumenterte utskillelsen. Kommentaren sier derfor at cannabis har vært inntatt etter forrige prøve.'
      : kategori === 3
        ? 'Den korrigerte endringen viser mindre nedgang enn forventet uten nytt inntak, men er fortsatt ' +
          'mulig ved spesielt treg utskillelse. Kommentaren sier derfor at det er vanskelig å avgjøre ' +
          'hvorvidt cannabis har vært inntatt etter forrige prøve.'
        : 'Den korrigerte endringen ligger innenfor det som er forventet uten nytt inntak. Kommentaren ' +
          'sier derfor at cannabis ikke nødvendigvis har vært inntatt etter forrige prøve.'

  return (
    <div className="thc-forklaring">
      <p>
        Det er {dagene} mellom prøvene. IRCAK er målt til {tall(aktuell)} i denne prøven og{' '}
        {tall(forrige)} i forrige — et forholdstall på {formaterTall(maltEndring + 1)}, altså{' '}
        {endringsfrase(maltEndring)}.
      </p>
      <p>
        Målinger har usikkerhet, så det sanne forholdstallet kan være noe høyere eller lavere enn
        det målte. Korrigert for måleusikkerhet kan vi med 90 % sikkerhet si at det sanne
        forholdstallet er minst {formaterTall(korrigertEndring + 1)} — tilsvarende{' '}
        {endringsfrase(korrigertEndring)}. Det er dette tallet, med tvilen i personens favør, som
        sammenlignes med utskillelseskurvene.
      </p>
      <p>
        Forventet endring etter {dagene} ved {kronisk ? 'kronisk bruk' : 'et enkeltinntak'}, når
        IRCAK i forrige prøve er {tall(forrige)} og det <i>ikke</i> har skjedd et nytt inntak:
      </p>
      <ul>
        <li>hos de aller fleste: minst {hosFleste} % nedgang</li>
        <li>øvre grense for hva som anses mulig: {ovreGrense} % nedgang</li>
      </ul>
      <p>{vurdering}</p>
      <p>
        Kommentarens åpning følger konsentrasjonen i denne prøven: under 20 omtales som lav, 20–40
        som middels høy, og 40 eller mer som høy. {tall(aktuell)} regnes derfor som {niva}{' '}
        konsentrasjon.
      </p>
    </div>
  )
}
