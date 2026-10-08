import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useProfil } from './auth/okt'
import { iBakgrunnen } from './auth/aktivitet'
import { klient } from './auth/klient'
import { nettleserlager } from './auth/mellomlager'
import { Stoffside } from './components/stoffside/Stoffside'
import { FaginnholdskildeProvider, type Faginnholdskilde } from './components/stoffside/Faginnholdskilde'
import { SearchStep } from './components/SearchStep'
import { BandStep } from './components/BandStep'
import { EtgPasteStep } from './components/EtgPasteStep'
import { EtgStep } from './components/EtgStep'
import { KontrollStep } from './components/KontrollStep'
import { PasteStep } from './components/PasteStep'
import { RusStep } from './components/RusStep'
import { useHentScenarioregler } from './components/regler/Scenarioreglerkilde'
import { Fortolkningsredigering } from './components/regler/Fortolkningsredigering'
import { Sidemeny, sidemenyenErApen } from './components/Sidemeny'
import { ThcStep } from './components/ThcStep'
import { CopyFlash } from './components/CopyFlash'
import { ruteAv } from './components/Kopibevis'
import { Ideknapp } from './components/ideer/Ideknapp'
import { Adminmeny } from './components/konto/Adminmeny'
import { Kontomeny } from './components/konto/Kontomeny'
import { Varselknapp } from './components/varsler/Varselknapp'
import { Fagsok } from './components/sok/Fagsok'
import { Sokeside } from './components/sok/Sokeside'
import { Toppmeny } from './components/toppmeny/Toppmeny'
import { ToppmenyInnhold, ToppmenyKilde } from './components/toppmeny/Toppmenykilde'
import { Toppmenyknapp } from './components/toppmeny/Toppmenyknapp'
import { Ikonknapp } from './components/Ikonknapp'
import { Versjonspille } from './components/Versjonspille'
import { Diskusjonsmeny } from './components/diskusjoner/Diskusjonsmeny'
import { Direktelenkekilde } from './components/direktelenker/Direktelenkekilde'
import { Lenkemelding } from './components/direktelenker/Lenkemelding'
import { apneFraAdressen } from './components/direktelenker/navigasjon'
import { diskusjonssideFor, diskusjonssider, fortolkningssidenavn } from './diskusjoner/modell'
import { FavorittkildeProvider } from './favoritter/Favorittkilde'
import { AutoerstattProvider } from './autoerstatt/Autoerstattkilde'
import { lagAutoerstattlager } from './autoerstatt/lagring'
import { lagFavorittlager } from './favoritter/lagring'
import { ANALYSEMETODER, filtrertPool } from './domain/analysemetoder'
import { FORTOLKNINGSOPPFORINGER, byggKatalog } from './domain/analyttkatalog'
import { alternativFor, ETG_ALTERNATIVER, type EtgAlternativ } from './domain/etg'
import type { Rute } from './domain/flytting'
import { erRedigering, fortolkningsnokkel, fortolkningsrute, lesRute, redigeringsrute } from './domain/rute'
import { analytterForFortolkning, stoffbeskrivelse, stofferForFortolkning } from './domain/koblinger'
import { rusModulFor } from './domain/rus'
import { THC_KODE } from './domain/thc'
import { search } from './domain/search'
import {
  CUTOFF_NOKKEL,
  CUTOFF_SPORSMAL,
  cutoffvalg,
  regelsettvalg,
  type Kommentarvalg,
} from './domain/valg'
import { lagFaginnholdslager } from './faginnhold/lagring'
import { lagFaginnholdsleser } from './faginnhold/lesing'
import { lesScenarioregler, reglerForModul } from './faginnhold/scenarioregler'
import { thcReglerFra } from './faginnhold/thcregler'
import { lagSideleser, lagVersjonsleser, lesSokeindeks } from './faginnhold/globaltSok'
import { utenSider } from './faginnhold/sok'
import { lagRegisterlager } from './stoffregister/api'
import { StoffregisterkildeProvider, useLagStoffregisterkilde } from './stoffregister/Stoffregisterkilde'
import { Stoffregisterside } from './components/stoffregister/Stoffregisterside'
import { lagLegemiddelleser, lagLegemiddelsok } from './legemiddeldata/lesing'
import { lagFarmakogenetikkleser, lagFarmakogenetikksok } from './clinpgx/lesing'
import { lagCpicleser } from './cpic/lesing'
import { lagBivirkningsleser } from './bivirkninger/lesing'
import { useClipboard } from './hooks/useClipboard'
import { useCopyFlash } from './hooks/useCopyFlash'
import { useHenting } from './hooks/useHenting'
import { usePubliserteRegler } from './hooks/usePubliserteRegler'
import {
  digitToIndex,
  erBekreftelse,
  modaltLagLiggerOver,
  SKJULT_FORTOLKNING,
  VIST_FORTOLKNING,
  useKeyboard,
} from './hooks/useKeyboard'
import { useRute } from './hooks/useRute'
import { useNaarLedig } from './hooks/useNaarLedig'
import { useSokeindeks, type Sokeindekshenter } from './hooks/useSokeindeks'
import { useKontotema } from './hooks/useKontotema'
import { lesPubliserteRegelsett } from './regler/kommentarer'
import { slaOpp } from './regler/publiserte'
import { useBevart } from './oppdatering/Bevaring'
import { fortolkningsform, initialState, isIdle, reducer, stageOf, type Action, type Stage } from './state'
import type { Analyte } from './types'

const KOPIFEIL = 'Fikk ikke tilgang til utklippstavlen. Kopier teksten manuelt.'

/**
 * Kvitteringen for kopieringen, i millisekunder.
 *
 * `BLINK` er hele blinket. `STEGBYTTE` er hvor lenge båndknappene blir stående
 * etterpå, så blinket rekker å starte ved knappen som ble brukt før limsteget
 * overtar; resten av blinket går der. Begge er korte med vilje — kvitteringen
 * skal rekke å bli sett uten å legge seg i veien for neste svar.
 *
 * `STEGBYTTE` holder bare igjen bildet. Tilstanden går videre med én gang
 * kommentaren er kopiert, slik at et tastetrykk i mellomtiden gjør det samme
 * som ellers i limsteget i stedet for å falle på gulvet.
 */
/** Fortolkningen overlever en oppdatering av appen, med analytten lest tilbake etter koden. */
const FORTOLKNINGSFORM = fortolkningsform(FORTOLKNINGSOPPFORINGER)

/** Analyttene etter nøkkelen fortolkningssiden deres har i adressen. */
const ANALYTT_ETTER_NOKKEL = new Map(FORTOLKNINGSOPPFORINGER.map((a) => [fortolkningsnokkel(a.kode), a]))

const BLINK = 500
const STEGBYTTE = 130

/** Enter og mellomrom skal ikke både trykke en fokusert knapp og utløse stegets handling. */
function buttonHasFocus(): boolean {
  return document.activeElement?.tagName === 'BUTTON'
}

export default function App() {
  const [state, setState] = useBevart('fortolkning', initialState, FORTOLKNINGSFORM)
  const dispatch = useCallback((action: Action) => setState((forrige) => reducer(forrige, action)), [setState])
  const [failedCopy, setFailedCopy] = useState<string | null>(null)
  const profil = useProfil()
  const { theme, toggle } = useKontotema(profil.id)
  const copy = useClipboard()
  const { flash, show } = useCopyFlash(BLINK)
  /**
   * Steget bildet henger igjen i mens kvitteringen starter der knappen sto —
   * det steget kopieringen gikk ut fra. `null` når ingenting dveler. Se
   * `STEGBYTTE` og `vist`.
   */
  const [dveler, setDveler] = useState<Stage | null>(null)
  const stegbytte = useRef<number>()
  /** Ruten båndknappen sto i — beviset i limsteget flyter opp fra den. */
  const [bevisFra, setBevisFra] = useState<Rute | null>(null)

  const stage = stageOf(state)
  // Kopieringen svarer først etter en tur innom nettleseren, og skal legge
  // kvitteringen i det steget den gikk ut fra. Refen holder det steget uten å
  // binde `kopierOgGaaVidere` til en ny utgave for hver rendring.
  const staaende = useRef(stage)
  staaende.current = stage
  // Søket dekker alt appen kan fortolke — se `FORTOLKNINGSOPPFORINGER`.
  const alleAnalytter = FORTOLKNINGSOPPFORINGER
  // Filteret på hovedsiden smalner inn hva søket kan finne.
  const pool = useMemo(
    () => filtrertPool(alleAnalytter, state.metodefilter),
    [alleAnalytter, state.metodefilter],
  )
  // Laboratorieanalyttene: én per analyttkode i søkeoppføringene. Fagsidene er
  // stoffenes, i stoffregisteret; koblingene der er veien mellom de to.
  const katalog = useMemo(() => byggKatalog(alleAnalytter), [alleAnalytter])
  const [rute, gaaTil] = useRute(apneFraAdressen)
  const paaInfoside = rute.side === 'stoff'

  const faginnhold = useMemo<Faginnholdskilde>(
    () => ({
      leser: lagFaginnholdsleser(klient()),
      lager: lagFaginnholdslager(klient()),
      kanRedigere: profil.role === 'admin',
      legemidler: lagLegemiddelleser(klient()),
      farmakogenetikk: lagFarmakogenetikkleser(klient()),
      cpic: lagCpicleser(klient()),
      bivirkninger: lagBivirkningsleser(klient()),
    }),
    [profil.role],
  )
  // Redigeringen av reglene og kommentarene en fortolkning gir, for
  // administratorene, på en egen adresse under fortolkningen.
  const redigererFortolkning = erRedigering(rute) && faginnhold.kanRedigere && state.analyte !== null
  // Stoffsidene, søkesiden og redigeringen legger seg over fortolkningen, som står skjult bak.
  const fortolkningSkjult = rute.side !== 'fortolkning' || redigererFortolkning
  // Reglene rusmiddelmodulene fortolkes med, hentet én gang for hele appen.
  const scenarioregler = useHentScenarioregler(useCallback(() => lesScenarioregler(klient()), []))
  const hits = useMemo(() => search(state.query, pool), [state.query, pool])

  // Fortolkningsreglene er de publiserte regelsettene i databasen, hentet
  // når appen åpnes, sammen med referanseområdet stoffsidene har for
  // hver analytt. Steg 2 og tastene bruker det som gjelder analytten.
  const hentRegler = useCallback(async () => {
    const [regelsett, referanseomrader] = await Promise.all([
      lesPubliserteRegelsett(faginnhold.leser),
      faginnhold.leser.lesReferanseomrader('publisert'),
    ])
    return { regelsett, referanseomrader }
  }, [faginnhold.leser])
  const regler = usePubliserteRegler(hentRegler)

  // THC-syremodulen fortolker med regelsettet og tekstene som er publisert.
  const thc = useHenting(useCallback(() => faginnhold.leser.lesThcRegelsett('publisert'), [faginnhold.leser]))
  const { hentPaNytt: hentThcPaNytt } = thc
  const thcRegler = useMemo(() => thcReglerFra(thc.tilstand, hentThcPaNytt), [thc.tilstand, hentThcPaNytt])

  // Stoffregisteret: datafilen, med navnene fagsidene i databasen har og
  // sidene registeret ikke kjenner, og inndelingen, arkivet og papirkurven.
  // Redaktørene ser også sidene som ikke er publisert, og lager nye.
  const registerlager = useMemo(() => lagRegisterlager(klient()), [])
  const opprettSide = useCallback(
    async (navn: string, slug: string) => {
      await faginnhold.lager.opprettUtkast('infoside', { navn, slug })
    },
    [faginnhold.lager],
  )
  const stoffregister = useLagStoffregisterkilde({
    lager: registerlager,
    admin: faginnhold.kanRedigere,
    ...(faginnhold.kanRedigere && { opprettSide }),
  })
  const { register, hentPaNytt: hentStoffsiderPaNytt } = stoffregister
  // Favorittene står både på stoffsidene og i menyen, med stoffets egen
  // nøkkel også for en gammel adresse til det.
  const favorittlager = useMemo(() => lagFavorittlager(klient()), [])
  const autoerstattlager = useMemo(() => lagAutoerstattlager(klient()), [])
  const kanoniskStoff = useCallback((nokkel: string) => register.kanonisk(nokkel)?.slug ?? nokkel, [register])

  // Fagsøket: indeksen over alt publisert fagstoff, hentet når appen har tid
  // til overs etter at den er åpnet, eller første gang noen søker før det. De
  // andre navnene et stoff er kjent under, står i stoffregisteret, som både
  // fagsøket og analyttsøket bruker. Søket viser selv at det henter, så
  // hentingen står ikke i lasteindikatoren.
  const hentSokeindeks = useCallback<Sokeindekshenter>(
    (delvis) => {
      const stille = iBakgrunnen(klient())
      return lesSokeindeks(
        {
          sider: lagSideleser(stille),
          legemidler: lagLegemiddelsok(stille),
          farmakogenetikk: lagFarmakogenetikksok(stille),
          cpic: lagCpicleser(stille),
          versjoner: lagVersjonsleser(stille),
          mellomlager: nettleserlager,
        },
        { katalog },
        delvis,
      )
    },
    [katalog],
  )
  const sokeindeks = useSokeindeks(hentSokeindeks)
  useNaarLedig(sokeindeks.krev)
  // De arkiverte fagsidene og dem i papirkurven står ikke i søket.
  const sokbar = sokeindeks.tilstand
  const synligIndeks = useMemo(() => {
    if (sokbar.status !== 'klar') return sokbar
    const skjult = (stoff: string) => ['arkivert', 'papirkurv'].includes(register.status(stoff))
    return { ...sokbar, indeks: utenSider(sokbar.indeks, skjult) }
  }, [sokbar, register])
  const beskrivSide = useCallback((stoff: string) => stoffbeskrivelse(stoff, register, katalog), [register, katalog])
  const gaaTilAdresse = useCallback((adresse: string) => gaaTil(lesRute(adresse)), [gaaTil])
  const regeloppslag = useMemo(
    () => (state.analyte ? slaOpp(regler.tilstand, state.analyte.kode) : null),
    [regler.tilstand, state.analyte],
  )
  const regelsett = regeloppslag?.status === 'klar' ? regeloppslag.regelsett : null
  const valgene = useMemo(() => (regelsett ? regelsettvalg(regelsett) : []), [regelsett])

  // En administrator kan ha publisert et nytt referanseområde på en
  // stoffside. Det hentes når hen går tilbake til fortolkningen.
  const varPaInfoside = useRef(paaInfoside)
  // Det samme gjelder fagsøket, som henter indeksen på nytt neste gang det
  // brukes, eller med én gang når hen går rett til søkesiden: den har alt bedt
  // om indeksen før denne effekten kjører, og ber ikke igjen.
  const { hentPaNytt } = regler
  const { foreld: foreldSokeindeks } = sokeindeks
  const paaSokeside = rute.side === 'sok'
  useEffect(() => {
    if (varPaInfoside.current && !paaInfoside && faginnhold.kanRedigere) {
      hentPaNytt()
      hentStoffsiderPaNytt()
      foreldSokeindeks(paaSokeside)
    }
    varPaInfoside.current = paaInfoside
  }, [
    paaInfoside,
    paaSokeside,
    faginnhold.kanRedigere,
    hentPaNytt,
    hentStoffsiderPaNytt,
    foreldSokeindeks,
  ])

  // Etter en publisering i redigeringen bruker fortolkningen de nye reglene med en gang.
  const { provIgjen: hentScenarioreglerPaNytt } = scenarioregler
  const reglerPublisert = useCallback(() => {
    hentPaNytt()
    hentThcPaNytt()
    hentScenarioreglerPaNytt()
  }, [hentPaNytt, hentThcPaNytt, hentScenarioreglerPaNytt])

  // Redigeringen er bare for administratorene; for andre er adressen fortolkningen.
  useEffect(() => {
    if (erRedigering(rute) && !faginnhold.kanRedigere && rute.side === 'fortolkning') {
      gaaTil({ side: 'fortolkning', analytt: rute.analytt }, { erstatt: true })
    }
  }, [rute, faginnhold.kanRedigere, gaaTil])

  // Tilstandsmaskinen trenger alternativene det nye søket gir for å se om det
  // smalner inn til én analytt, så søket kjøres her og ikke først når steget
  // tegnes opp. Datasettet er lite nok til at det ikke merkes.
  const setQuery = useCallback(
    (value: string) => {
      const matches = search(value, pool).map((hit) => hit.analyte)
      dispatch({ type: 'sett-sok', value, matches })
    },
    [pool],
  )

  const slippBildet = useCallback(() => {
    window.clearTimeout(stegbytte.current)
    setDveler(null)
  }, [])

  /**
   * Kopierer kommentaren knappen bærer og går videre til limsteget.
   *
   * Knappen står i bildet bare så lenge steget foran vises, enten den ble
   * klikket eller valgt med et tastetrykk. Blinket legges der den står nå, og
   * ruten følger med til limsteget, der beviset flyter opp fra den. Veien er
   * den samme for konsentrasjonsbåndene, for cut-off-valget og for EtG og
   * EtS.
   */
  const kopierOgGaaVidere = useCallback(
    async (tekst: string, velger: string, videre: Action) => {
      if (!(await copy(tekst))) {
        setFailedCopy(tekst)
        return
      }
      setFailedCopy(null)
      const knapp = document.querySelector(velger)
      show(knapp)
      setBevisFra(ruteAv(knapp))
      dispatch(videre)
      setDveler(staaende.current)
      window.clearTimeout(stegbytte.current)
      stegbytte.current = window.setTimeout(() => setDveler(null), STEGBYTTE)
    },
    [copy, show],
  )

  const kopierValg = useCallback(
    (valg: Kommentarvalg) =>
      kopierOgGaaVidere(valg.kommentar, `[data-band="${valg.key}"]`, {
        type: 'velg-band',
        key: valg.key,
      }),
    [kopierOgGaaVidere],
  )

  /**
   * Et valg i steg 2. De fleste kopierer kommentaren med én gang; cut-off-valget
   * går innom kontrollspørsmålet først, siden funnet må være bekreftet av
   * laboratoriet før kommentaren gjelder.
   */
  const velgValg = useCallback(
    (valg: Kommentarvalg) => {
      if (valg.key === CUTOFF_NOKKEL) {
        dispatch({ type: 'spor', kontroll: 'cutoff' })
        return
      }
      void kopierValg(valg)
    },
    [kopierValg],
  )

  /** Hovedkommentaren for tilfellet kopieres straks; resten hører til limsteget. */
  const pickEtg = useCallback(
    (alternativ: EtgAlternativ) => {
      const forste = alternativ.plasseringer[0]
      if (!forste) return
      return kopierOgGaaVidere(forste.tekst, `[data-etg="${alternativ.id}"]`, {
        type: 'velg-etg',
        valg: alternativ.id,
      })
    },
    [kopierOgGaaVidere],
  )

  const back = useCallback(() => {
    slippBildet()
    setFailedCopy(null)
    dispatch({ type: 'tilbake' })
  }, [slippBildet])

  const velgAnalytt = useCallback(
    (analyte: Analyte) => {
      slippBildet()
      setFailedCopy(null)
      dispatch({ type: 'velg-analytt', analyte })
    },
    [slippBildet],
  )

  /**
   * «Åpne fortolkning» på en stoffside: modulen koden hører til, som
   * om den var valgt i søket. Var den alt åpen, står den som den sto.
   */
  const apneFortolkning = useCallback(
    (analyte: Analyte) => {
      if (state.analyte?.kode !== analyte.kode) velgAnalytt(analyte)
      gaaTil(fortolkningsrute(analyte.kode))
    },
    [state.analyte, velgAnalytt, gaaTil],
  )

  /** Tilbake til fortolkningen slik den sto. */
  const lukkInfoside = useCallback(() => gaaTil(fortolkningsrute(state.analyte?.kode)), [gaaTil, state.analyte])

  /**
   * Fortolkningen av en analytt har sin egen adresse (`#/fortolkning/<nøkkel>`),
   * og adressen og analytten følger hverandre. Velges en analytt i appen, går
   * adressen dit, så tilbakeknappen i nettleseren går til der man var. Endres
   * adressen utenfra — tilbake- og framknappen, et bokmerke, en lenke fra et
   * varsel — åpnes analytten den peker på, eller søket når den ikke peker på
   * noen. Ved oppstart vinner adressen når den har en analytt; ellers skrives
   * den om til analytten som alt er åpen (fortolkningen overlevde en
   * oppdatering av appen).
   */
  const analyttnokkel = state.analyte ? fortolkningsnokkel(state.analyte.kode) : undefined
  const forrigeAdresse = useRef<string | null>(null)
  const forrigeAnalytt = useRef(analyttnokkel)
  useEffect(() => {
    const oppstart = forrigeAdresse.current === null
    const adresseEndret = !oppstart && forrigeAdresse.current !== (rute.side === 'fortolkning' ? (rute.analytt ?? '') : null)
    const analyttEndret = analyttnokkel !== forrigeAnalytt.current
    forrigeAdresse.current = rute.side === 'fortolkning' ? (rute.analytt ?? '') : null
    forrigeAnalytt.current = analyttnokkel
    if (rute.side !== 'fortolkning' || rute.analytt === analyttnokkel) return
    if ((oppstart && rute.analytt) || (adresseEndret && !analyttEndret)) {
      const analytt = rute.analytt ? ANALYTT_ETTER_NOKKEL.get(rute.analytt) : undefined
      if (analytt) velgAnalytt(analytt)
      else if (rute.analytt) gaaTil(fortolkningsrute(state.analyte?.kode), { erstatt: true })
      else {
        slippBildet()
        setFailedCopy(null)
        dispatch({ type: 'forlat-analytt' })
      }
      return
    }
    gaaTil(fortolkningsrute(state.analyte?.kode), { erstatt: oppstart })
  }, [rute, analyttnokkel, state.analyte, velgAnalytt, gaaTil, slippBildet, dispatch])

  /**
   * Stoffsidene til modulen som fortolkes: toppmenyens «Åpne stoffside», eller
   * én knapp per stoff når kodene hører til flere (DIAZ · DMI · OXA). EtG og
   * EtS fører begge til etanol.
   */
  const fagsider = useMemo(() => (state.analyte ? stofferForFortolkning(state.analyte, register) : []), [state.analyte, register])

  /**
   * Fortolkningen har regler og kommentarer administratorene kan redigere: en
   * modul med scenarioregler, THC-syre, eller en kode med et publisert
   * regelsett. EtG og EtS har ingen.
   */
  const kanRedigeres = useMemo(() => {
    const analytt = state.analyte
    if (!faginnhold.kanRedigere || !analytt) return false
    if (rusModulFor(analytt) || analytt.kode === THC_KODE) return true
    const { tilstand } = regler
    return tilstand.status === 'klar' && analytterForFortolkning(analytt, katalog).some((a) => tilstand.etterKode.has(a.kode))
  }, [faginnhold.kanRedigere, state.analyte, regler, katalog])

  const settMetodefilter = useCallback((metode: string | null) => {
    dispatch({ type: 'sett-metodefilter', metode })
  }, [])

  const reset = useCallback(() => {
    slippBildet()
    setFailedCopy(null)
    dispatch({ type: 'nullstill' })
  }, [slippBildet])

  useEffect(() => () => window.clearTimeout(stegbytte.current), [])

  /**
   * Valget kontrollsteget spør om. Det leses av regelsettet og ikke av
   * spørsmålet som står, så bildet kan bli stående det korte øyeblikket etter
   * at spørsmålet er besvart — se `dveler`.
   */
  const kontrollvalg = useMemo(() => (regelsett ? cutoffvalg(regelsett) : null), [regelsett])

  /** Ja: kommentaren kopieres, og flyten går videre som ellers. */
  const bekreftKontroll = useCallback(() => {
    if (!state.kontroll || !kontrollvalg) return
    void kopierValg(kontrollvalg)
  }, [state.kontroll, kontrollvalg, kopierValg])

  /**
   * Alt + 1, Alt + 2 osv. setter filteret på hver sin analysemetode, i den
   * rekkefølgen filterraden viser dem. Alt + 0 velger «Alle»: null hører ikke
   * til noen metode, og står derfor for «ingen av dem».
   *
   * Snarveien ligger utenom `useKeyboard`, som med vilje slipper alle
   * modifikatorkombinasjoner gjennom til nettleseren. Den leser `event.code`
   * og ikke `event.key`, siden Alt gjør om tegnet på flere tastaturoppsett —
   * det er den fysiske talltasten som gjelder.
   *
   * Endringsloggen fanger tastaturet for seg, og sidemenyen —
   * stoffregisteret — filtrerer ikke søket.
   */
  useEffect(() => {
    function paaTast(event: KeyboardEvent) {
      if (!event.altKey || event.ctrlKey || event.metaKey) return
      const truffet = /^Digit(\d)$/.exec(event.code)
      if (!truffet?.[1]) return
      const tall = Number(truffet[1])
      if (tall > ANALYSEMETODER.length || modaltLagLiggerOver() || sidemenyenErApen()) return
      event.preventDefault()
      dispatch({
        type: 'sett-metodefilter',
        metode: tall === 0 ? null : (ANALYSEMETODER[tall - 1]?.kode ?? null),
      })
    }
    window.addEventListener('keydown', paaTast)
    return () => window.removeEventListener('keydown', paaTast)
  }, [])

  // Enter og mellomrom bekrefter det samme, overalt i appen.
  const confirm = useCallback(
    (event: KeyboardEvent) => {
      if (buttonHasFocus()) return
      if (stage === 'search') {
        // Bare når det ikke er noe å velge mellom. Ellers får mellomrom
        // skrives inn i søkefeltet som vanlig. Det ene alternativet velger som
        // regel seg selv i det søket smalner inn til det; her står det igjen
        // fordi brukeren nettopp kom tilbake fra den analytten.
        if (hits.length !== 1 || !hits[0]) return
        event.preventDefault()
        dispatch({ type: 'velg-analytt', analyte: hits[0].analyte })
      } else if (stage === 'paste') {
        // Mellomrom skal ikke avslutte fra et sted der tasten alt har en jobb
        // — som feltet for manuell kopiering, der teksten skal kunne markeres
        // og kopieres i fred.
        if (!erBekreftelse(event)) return
        event.preventDefault()
        reset()
      }
    },
    [stage, hits, reset],
  )

  useKeyboard({
    Escape: (e) => {
      e.preventDefault()
      back()
    },
    Enter: confirm,
    ' ': confirm,

    ...Object.fromEntries(
      '0123456789'.split('').map((digit) => [
        digit,
        (e: KeyboardEvent) => {
          const index = digitToIndex(digit)
          if (index === null) return

          if (stage === 'search' && state.query !== '') {
            const hit = hits[index]
            if (!hit) return
            e.preventDefault()
            dispatch({ type: 'velg-analytt', analyte: hit.analyte })
          } else if (stage === 'band') {
            const valg = valgene[index]
            if (!valg) return
            e.preventDefault()
            velgValg(valg)
          } else if (stage === 'kontroll') {
            // 1 er ja, 2 er nei — i den rekkefølgen knappene står.
            const svar = [bekreftKontroll, back][index]
            if (!svar) return
            e.preventDefault()
            svar()
          } else if (stage === 'etg') {
            const alternativ = ETG_ALTERNATIVER[index]
            if (!alternativ) return
            e.preventDefault()
            void pickEtg(alternativ)
          } else if (stage === 'paste') {
            // Alle sifre avslutter, slik at man kan bruke samme talltast som i
            // forrige bilde for å komme raskt videre.
            e.preventDefault()
            reset()
          }
        },
      ]),
    ),
  })

  const valgtValg = state.bandKey ? valgene.find((v) => v.key === state.bandKey) : undefined
  const rusModul = state.analyte ? rusModulFor(state.analyte) : undefined
  const etgAlternativ = state.etgValg ? alternativFor(state.etgValg) : undefined

  /**
   * Steget som vises. Det henger etter `stage` i det korte øyeblikket knappene
   * i steget foran blir stående, så kvitteringen rekker å starte der knappen
   * sto. Tastene følger `stage` og venter ikke på bildet.
   */
  const vist = dveler ?? stage

  // Diskusjonene hører til siden som står åpen: en fagside, eller
  // fortolkningen av én analytt. Forsiden har ingen.
  const diskusjonsside = diskusjonssideFor(rute)
  const sidenavn =
    rute.side === 'stoff'
      ? (register.menystoff(rute.stoff)?.navn ?? rute.stoff)
      : rute.side === 'stoffregister'
        ? 'Stoffregisteret'
        : state.analyte
        ? fortolkningssidenavn(state.analyte)
        : 'Fortolkningen'
  // Sidene en tråd kan flyttes til.
  const sider = useMemo(() => diskusjonssider(register.stoffer, FORTOLKNINGSOPPFORINGER), [register])

  return (
    <ToppmenyKilde>
      <StoffregisterkildeProvider kilde={stoffregister}>
        <FavorittkildeProvider lager={favorittlager} brukerId={profil.id} kanonisk={kanoniskStoff}>
          <AutoerstattProvider lager={autoerstattlager} brukerId={profil.id}>
            <Direktelenkekilde sider={sider}>
              <div
                className="app"
                data-steg={vist}
                data-tomt={isIdle(state) && !fortolkningSkjult ? 'ja' : 'nei'}
                data-side={redigererFortolkning ? 'fortolkningsredigering' : rute.side}
              >
                <Toppmeny
                  meny={
                    <Sidemeny register={register} />
                  }
                  sok={
                    <Fagsok
                      indeks={synligIndeks}
                      onKrev={sokeindeks.krev}
                      onProvIgjen={sokeindeks.provIgjen}
                      sporring={rute.side === 'sok' ? rute.q : undefined}
                      beskrivSide={beskrivSide}
                      onGaaTil={gaaTilAdresse}
                    />
                  }
                  verktoy={
                    <>
                      <Ideknapp />
                      <Adminmeny />
                      <Varselknapp />
                    </>
                  }
                  konto={<Kontomeny theme={theme} onToggleTheme={toggle} />}
                />

                {/* Fortolkningens handlinger i toppmenyen (i dokken på smale
                    flater). Stoffsiden, søkesiden og redigeringen har sine
                    egne mens de vises. */}
                {!fortolkningSkjult && (fagsider.length > 0 || kanRedigeres) && (
                  <ToppmenyInnhold spor="handlinger">
                    {fagsider.map((stoff) => (
                      <Toppmenyknapp
                        key={stoff.slug}
                        ikon="indik"
                        variant="primar"
                        {...(fagsider.length > 1 && { 'aria-label': `Åpne fagsiden for ${stoff.navn}` })}
                        onClick={() => gaaTil({ side: 'stoff', stoff: stoff.slug })}
                      >
                        {fagsider.length > 1 ? stoff.navn : 'Åpne fagside'}
                      </Toppmenyknapp>
                    ))}
                    {kanRedigeres && state.analyte && (
                      <Ikonknapp
                        ikon="edit"
                        etikett="Rediger fortolkningen"
                        onClick={() => state.analyte && gaaTil(redigeringsrute(state.analyte.kode))}
                      />
                    )}
                  </ToppmenyInnhold>
                )}

                {redigererFortolkning && state.analyte && (
                  <main className="scene scene--infoside">
                    <FaginnholdskildeProvider kilde={faginnhold}>
                      <Fortolkningsredigering
                        key={state.analyte.kode}
                        fortolkning={state.analyte}
                        sted={rute.side === 'fortolkning' ? rute.sted : undefined}
                        katalog={katalog}
                        onPublisert={reglerPublisert}
                        onAvslutt={lukkInfoside}
                      />
                    </FaginnholdskildeProvider>
                  </main>
                )}

                {rute.side === 'stoff' && (
                  <main className="scene scene--infoside">
                    <FaginnholdskildeProvider kilde={faginnhold}>
                      <Stoffside
                        stoff={rute.stoff}
                        sted={rute.sted}
                        register={register}
                        katalog={katalog}
                        onApneFortolkning={apneFortolkning}
                        onLukk={lukkInfoside}
                      />
                    </FaginnholdskildeProvider>
                  </main>
                )}

                {rute.side === 'stoffregister' && (
                  <main className="scene scene--stoffregister">
                    <Stoffregisterside katalog={katalog} onApneFortolkning={apneFortolkning} onLukk={lukkInfoside} />
                  </main>
                )}

                {rute.side === 'sok' && (
                  <main className="scene scene--sokeside">
                    <Sokeside
                      q={rute.q}
                      indeks={synligIndeks}
                      onKrev={sokeindeks.krev}
                      onProvIgjen={sokeindeks.provIgjen}
                      beskrivSide={beskrivSide}
                      onLukk={lukkInfoside}
                    />
                  </main>
                )}

                {/* Fortolkningen blir stående bak en åpen stoffside, så det
                    brukeren har fylt inn, er der når hen kommer tilbake. Tastene dens
                    gjelder bare mens den vises og fokus står i den eller ingen
                    steder — se `tastenGjelderFortolkningen`. */}
                <main
                  className="scene"
                  hidden={fortolkningSkjult}
                  data-fortolkning={fortolkningSkjult ? SKJULT_FORTOLKNING : VIST_FORTOLKNING}
                >
                  {vist === 'search' && (
                    <SearchStep
                      query={state.query}
                      hits={hits}
                      metodefilter={state.metodefilter}
                      onFilter={settMetodefilter}
                      onQueryChange={setQuery}
                      onSelect={velgAnalytt}
                      onReset={reset}
                    />
                  )}

                  {vist === 'band' && state.analyte && regeloppslag && (
                    <BandStep
                      analyte={state.analyte}
                      regler={regeloppslag}
                      valg={valgene}
                      onPick={velgValg}
                      onBack={back}
                      onProvIgjen={hentPaNytt}
                      failed={failedCopy ? { message: KOPIFEIL, comment: failedCopy } : null}
                    />
                  )}

                  {vist === 'kontroll' && kontrollvalg && (
                    <KontrollStep
                      valg={kontrollvalg}
                      sporsmal={CUTOFF_SPORSMAL}
                      onJa={bekreftKontroll}
                      onNei={back}
                      failed={failedCopy ? { message: KOPIFEIL, comment: failedCopy } : null}
                    />
                  )}

                  {vist === 'thc' && <ThcStep regler={thcRegler} onBack={back} copy={copy} flashAt={show} />}

                  {vist === 'rus' && rusModul && (
                    <RusStep
                      // Modulen holder sine egne valg. Bytter analytten, skal de nulles,
                      // og nøkkelen gir modulen en frisk tilstand i stedet for å måtte
                      // rydde i den fra utsiden.
                      key={rusModul.id}
                      modul={rusModul}
                      regler={reglerForModul(scenarioregler.tilstand, rusModul, scenarioregler.provIgjen)}
                      onBack={back}
                      onFinish={reset}
                      copy={copy}
                      flashAt={show}
                    />
                  )}

                  {vist === 'etg' && (
                    <EtgStep
                      onPick={(alternativ) => void pickEtg(alternativ)}
                      onBack={back}
                      failed={failedCopy ? { message: KOPIFEIL, comment: failedCopy } : null}
                    />
                  )}

                  {vist === 'etg-paste' && etgAlternativ && (
                    <EtgPasteStep
                      alternativ={etgAlternativ}
                      fra={bevisFra}
                      onBack={back}
                      onFinish={reset}
                      copy={copy}
                      flashAt={show}
                    />
                  )}

                  {vist === 'paste' && state.analyte && valgtValg && (
                    <PasteStep
                      analyte={state.analyte}
                      valg={valgtValg}
                      fra={bevisFra}
                      onBack={back}
                      onFinish={reset}
                    />
                  )}
                </main>

                {diskusjonsside && <Diskusjonsmeny side={diskusjonsside} sidenavn={sidenavn} sider={sider} />}

                {/* Versjonen og veien inn til endringsloggen, fast nederst i hjørnet. */}
                <Versjonspille />

                {/* Kvitteringen ligger utenfor stegene, så den overlever stegbyttet. */}
                {flash && <CopyFlash key={flash.id} flash={flash} varighet={BLINK} />}
                {/* Blinket er visuelt; dette er den samme beskjeden for skjermlesere. */}
                <p className="kun-skjermleser" role="status">
                  {flash ? 'Kommentaren er kopiert' : ''}
                </p>

                {/* Meldingen når en direktelenke ikke kunne åpnes. */}
                <Lenkemelding />
              </div>
            </Direktelenkekilde>
          </AutoerstattProvider>
        </FavorittkildeProvider>
      </StoffregisterkildeProvider>
    </ToppmenyKilde>
  )
}
