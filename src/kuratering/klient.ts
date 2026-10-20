/**
 * Kurateringsgrenene og sideversjonene, lest og styrt fra appen.
 *
 * Administratorene når grenene gjennom `kuratering_admin`; alle innloggede
 * leser versjonene av fagsidene og statusen til kurateringene. Meldingene fra
 * databasen i disse funksjonene er skrevet for å vises, også ved en konflikt
 * (`PT409`), som her betyr at siden eller grenen er endret siden den ble lest.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { lesBivirkningsdata } from '../bivirkninger/lesing'
import { tilFeil, type Databasefeil } from '../faginnhold/lagring'
import { TOM_STOFFSIDE, type Stoffsidedata } from '../faginnhold/lesing'
import type { Sideutgave } from '../faginnhold/sidesammenligning'
import type { Agentinfo, Anker, Grendetaljer, Grensammendrag, Grenstatusdata, Sideversjonsdata, Versjonsinfo } from './modell'
import type { Kurateringsrad } from './sidestatus'

/** Svaret på en publisering: `ok: false` når den stoppet, og grenen er blokkert med grunnen. */
export interface Publiseringssvar {
  ok: boolean
  status: string
  versjon?: number
  feil?: string
}

/** En utgave av siden klar til visning: siden i samme form som stoffsidene leses, og bivirkningene. */
export type Sideutgavedata = Required<Sideutgave>

export interface Kurateringsklient {
  oversikt(valg?: { stoff?: string; alle?: boolean }): Promise<Grensammendrag[]>
  les(gren: string, revisjon?: number): Promise<Grendetaljer>
  /** Den lille statusen, til å se om noe er nytt. */
  status(gren: string): Promise<Grenstatusdata>
  /** `runde` er kontrollrunden som er vurdert, så vurderingen aldri lander i en senere runde. */
  vurder(gren: string, revisjon: number, runde: number, beslutning: 'godkjent' | 'endringer', begrunnelse: string): Promise<Grensammendrag>
  publiser(gren: string, revisjon: number): Promise<Publiseringssvar>
  stans(gren: string, grunn?: string): Promise<Grensammendrag>
  gjenoppta(gren: string): Promise<Grensammendrag>
  forkast(gren: string, grunn?: string): Promise<Grensammendrag>
  gjenopprettVersjon(stoff: string, nr: number, grunn?: string): Promise<Grendetaljer>
  /** En ny tråd, eller et svar i en (`svarPa`). */
  kommenter(gren: string, kommentar: { tekst: string; art?: 'merknad' | 'sperrende'; anker?: Anker; svarPa?: string }): Promise<unknown>
  lukkKommentar(gren: string, kommentar: string, tekst?: string): Promise<unknown>
  gjenapneKommentar(gren: string, kommentar: string, tekst: string): Promise<unknown>
  agenter(): Promise<Agentinfo[]>
  /** En ny nøkkel til agenten; den gamle slutter å virke. Nøkkelen gis bare her, og lagres bare som SHA-256. */
  nyAgentnokkel(agent: string): Promise<{ agent: string; nokkel: string }>
  /** Versjonene av fagsiden, nyeste først. */
  versjoner(stoff: string): Promise<Versjonsinfo[]>
  /** Én versjon av fagsiden, eller `null` når den ikke finnes. */
  versjon(stoff: string, nr: number): Promise<{ versjon: Versjonsinfo; utgave: Sideutgavedata } | null>
  /** Kurateringene av alle fagsidene, uten noe annet enn status og tidspunkter. For alle innloggede. */
  kurateringer(): Promise<Kurateringsrad[]>
}

/** Feilen fra databasen som noe som kan vises. */
function feilFra(feil: Databasefeil): Error {
  return feil.code === 'PT409' && feil.message ? new Error(feil.message) : tilFeil(feil)
}

/** Siden i en versjon eller en forhåndsvisning, i formen stoffsidene leses i. */
export function somStoffside(data: Partial<Stoffsidedata> | null | undefined): Stoffsidedata {
  return {
    stoff: data?.stoff ?? TOM_STOFFSIDE.stoff,
    infoside: data?.infoside ?? TOM_STOFFSIDE.infoside,
    elementer: data?.elementer ?? TOM_STOFFSIDE.elementer,
    referanser: data?.referanser ?? TOM_STOFFSIDE.referanser,
  }
}

/** Forhåndsvisningen av revisjonen som vises i en gren: siden og bivirkningene slik de blir publisert. */
export function forhandsvisningen(gren: Grendetaljer): Sideutgavedata | null {
  const visning = gren.grenrevisjon?.forhandsvisning
  return visning ? { side: somStoffside(visning.stoff), bivirkninger: lesBivirkningsdata(visning.bivirkninger) } : null
}

export function lagKurateringsklient(klient: SupabaseClient): Kurateringsklient {
  async function kall<T>(funksjon: string, argumenter: Record<string, unknown>): Promise<T> {
    const { data, error } = await klient.rpc(funksjon, argumenter)
    if (error) throw feilFra(error)
    return data as T
  }
  const admin = <T>(handling: string, data: Record<string, unknown> = {}) =>
    kall<T>('kuratering_admin', { handling, data })

  return {
    oversikt: (valg = {}) => admin<Grensammendrag[]>('oversikt', valg).then((r) => r ?? []),
    les: (gren, revisjon) => admin('les', revisjon === undefined ? { gren } : { gren, revisjon }),
    status: (gren) => admin('status', { gren }),
    vurder: (gren, revisjon, runde, beslutning, begrunnelse) => admin('vurder', { gren, revisjon, runde, beslutning, begrunnelse }),
    publiser: (gren, revisjon) => admin('publiser', { gren, revisjon }),
    stans: (gren, grunn) => admin('stans', { gren, ...(grunn && { grunn }) }),
    gjenoppta: (gren) => admin('gjenoppta', { gren }),
    forkast: (gren, grunn) => admin('forkast', { gren, ...(grunn && { grunn }) }),
    gjenopprettVersjon: (stoff, nr, grunn) => admin('gjenopprett_versjon', { stoff, nr, ...(grunn && { grunn }) }),
    kommenter: (gren, { tekst, art, anker, svarPa }) =>
      admin('kommenter', { gren, tekst, ...(svarPa ? { svar_pa: svarPa } : { art: art ?? 'merknad', ...(anker && { anker }) }) }),
    lukkKommentar: (gren, kommentar, tekst) => admin('lukk_kommentar', { gren, kommentar, ...(tekst && { tekst }) }),
    gjenapneKommentar: (gren, kommentar, tekst) => admin('gjenapne_kommentar', { gren, kommentar, tekst }),
    agenter: () => admin<Agentinfo[]>('agenter').then((r) => r ?? []),
    nyAgentnokkel: (agent) => admin('ny_agentnokkel', { agent }),
    versjoner: (stoff) => kall<Versjonsinfo[]>('les_sideversjoner', { stoff }).then((r) => r ?? []),
    kurateringer: () => kall<Kurateringsrad[]>('les_kurateringer', {}).then((r) => r ?? []),
    versjon: async (stoff, nr) => {
      const [data, bivirkninger] = await Promise.all([
        kall<Sideversjonsdata | null>('les_sideversjon', { stoff, nr }),
        kall<unknown>('les_sideversjon_bivirkninger', { stoff, nr }),
      ])
      if (!data) return null
      return { versjon: data.versjon, utgave: { side: somStoffside(data), bivirkninger: lesBivirkningsdata(bivirkninger) } }
    },
  }
}
