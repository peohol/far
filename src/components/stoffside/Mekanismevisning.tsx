import { mekanismeFor, subtypedeler, systemFor, virkningFor } from '../../faginnhold/mekanismer'
import type { Mekanismekortdata } from '../../faginnhold/paneler'
import { Merke } from '../Merke'
import { SenketTekst } from '../SenketTekst'
import { Uthev } from '../Uthev'

/**
 * Det mekanismekortene i farmakodynamikken viser, delt mellom kortet og
 * redigeringsvinduet. Prinsippene står i `docs/farmakodynamikk-ikoner.md`.
 */

/**
 * Klassene på et mekanismekort: virkningen gir aksentfargen langs kanten, og
 * systemet målet hører til gir fargen på målproteinet i ikonet.
 */
export function mekanismeklasse(kort: Pick<Mekanismekortdata, 'maal' | 'mekanisme'>): string {
  const system = systemFor(kort.maal)
  return ['mekanismekort', `mekanismekort--${virkningFor(kort.mekanisme).nokkel}`, system && `system-${system}`]
    .filter(Boolean)
    .join(' ')
}

/** Navnet på målet, med subtypen senket: D₁, AT₁, 5-HT₂C. */
export function Maalnavn({ maal }: { maal: string }) {
  return <SenketTekst deler={subtypedeler(maal)} />
}

/**
 * Effekten på målet som en pille i trafikklysfargen for virkningen. Teksten
 * sier alltid det samme som fargen.
 */
export function Effektpille({ mekanisme }: { mekanisme: Mekanismekortdata['mekanisme'] }) {
  return (
    <Merke tone={virkningFor(mekanisme).merketone}>
      <Uthev tekst={mekanismeFor(mekanisme)?.effekt ?? 'Effekt ikke angitt'} />
    </Merke>
  )
}
