import { describe, expect, it } from 'vitest'
import { FORTOLKNING, adresse, kanoniskAdresse, lesRute, sammeRute, sokeside, stoffadresse } from '../rute'
import { byggStoffregister } from '../stoffregister'

describe('adressene til stoffsidene', () => {
  it('har stoffets nøkkel som den eneste identiteten', () => {
    expect(lesRute('#/stoff/bupropion')).toEqual({ side: 'stoff', stoff: 'bupropion' })
    expect(lesRute('#/stoff/venlafaksin')).toEqual({ side: 'stoff', stoff: 'venlafaksin' })
    expect(lesRute('#/stoff/amitriptylin')).toEqual({ side: 'stoff', stoff: 'amitriptylin' })
    expect(lesRute('#/stoff/nortriptylin')).toEqual({ side: 'stoff', stoff: 'nortriptylin' })
    expect(lesRute('#/stoff/paliperidon')).toEqual({ side: 'stoff', stoff: 'paliperidon' })
    expect(lesRute('#/stoff/etanol')).toEqual({ side: 'stoff', stoff: 'etanol' })
    expect(lesRute('#/stoff/thc')).toEqual({ side: 'stoff', stoff: 'thc' })
    expect(stoffadresse('bupropion')).toBe('#/stoff/bupropion')
  })

  it('leser og skriver et sted på siden: en seksjon og et detaljkort i den', () => {
    expect(lesRute('#/stoff/bupropion/farmakokinetikk')).toEqual({
      side: 'stoff',
      stoff: 'bupropion',
      sted: ['farmakokinetikk'],
    })
    const rute = { side: 'stoff', stoff: 'nortriptylin', sted: ['farmakokinetikk', 'kort 1/ø'] } as const
    expect(adresse(rute)).toBe('#/stoff/nortriptylin/farmakokinetikk/kort%201%2F%C3%B8')
    expect(lesRute(adresse(rute))).toEqual(rute)
    // Et annet sted er en annen adresse til den samme siden.
    expect(sammeRute(rute, { side: 'stoff', stoff: 'nortriptylin' })).toBe(false)
  })

  it('åpner siden uten sted når stedet ikke kan leses eller har for mange nivåer', () => {
    expect(lesRute('#/stoff/nortriptylin/a/b/c')).toEqual({ side: 'stoff', stoff: 'nortriptylin' })
    expect(lesRute('#/stoff/nortriptylin/%E0%A4%A')).toEqual({ side: 'stoff', stoff: 'nortriptylin' })
  })

  it('fører et navn eller et alias til stoffets nøkkel, men aldri til en analytt', () => {
    expect(lesRute('#/stoff/Valproat')).toEqual({ side: 'stoff', stoff: 'valproat' })
    expect(lesRute('#/stoff/%20Litium%20/')).toEqual({ side: 'stoff', stoff: 'litium' })
    expect(lesRute('#/stoff/Hydroksybupropion')).toEqual({ side: 'stoff', stoff: 'bupropion' })
    expect(lesRute('#/stoff/N-desmetyldiazepam/tdm')).toEqual({ side: 'stoff', stoff: 'diazepam', sted: ['tdm'] })
    expect(lesRute('#/stoff/THC-syre')).toEqual({ side: 'stoff', stoff: 'thc' })
    expect(lesRute('#/stoff/EtG')).toEqual({ side: 'stoff', stoff: 'etanol' })
    // En side registeret ikke kjenner (laget i databasen), står med nøkkelen sin.
    expect(lesRute('#/stoff/nytt-stoff')).toEqual({ side: 'stoff', stoff: 'nytt-stoff' })
    expect(lesRute('#/stoff/')).toEqual(FORTOLKNING)
    expect(lesRute('#/stoff/!!!')).toEqual(FORTOLKNING)
  })

  it('leser alt annet som fortolkningen', () => {
    for (const hash of ['', '#', '#/', '#/analytt/', '#/noe/annet', '#element-123', '#/analytt/%E0%A4%A']) {
      expect(lesRute(hash), hash).toEqual(FORTOLKNING)
    }
  })
})

describe('gamle adresser', () => {
  it('sender en gammel analyttadresse til stoffsiden koden primært er koblet til', () => {
    expect(lesRute('#/analytt/HBUP')).toEqual({ side: 'stoff', stoff: 'bupropion' })
    expect(lesRute('#/analytt/hbup/farmakokinetikk')).toEqual({ side: 'stoff', stoff: 'bupropion', sted: ['farmakokinetikk'] })
    expect(lesRute('#/analytt/VENSUM')).toEqual({ side: 'stoff', stoff: 'venlafaksin' })
    expect(lesRute('#/analytt/AMTNORSUM')).toEqual({ side: 'stoff', stoff: 'amitriptylin' })
    expect(lesRute('#/analytt/NOR')).toEqual({ side: 'stoff', stoff: 'nortriptylin' })
    expect(lesRute('#/analytt/PALI')).toEqual({ side: 'stoff', stoff: 'paliperidon' })
    expect(lesRute('#/analytt/DMI')).toEqual({ side: 'stoff', stoff: 'diazepam' })
    expect(lesRute('#/analytt/OTRAM')).toEqual({ side: 'stoff', stoff: 'tramadol' })
    expect(lesRute('#/analytt/UETS')).toEqual({ side: 'stoff', stoff: 'etanol' })
  })

  it('sender seksjonen med reglene til seksjonen for koden på stoffsiden', () => {
    expect(lesRute('#/analytt/IRCAK/fortolkning')).toEqual({ side: 'stoff', stoff: 'thc', sted: ['fortolkning-ircak'] })
    expect(lesRute('#/analytt/THC/fortolkning/simulator')).toEqual({
      side: 'stoff',
      stoff: 'thc',
      sted: ['fortolkning', 'simulator'],
    })
  })

  it('later ikke som om en fagside finnes når koden ikke har noe primært stoff', () => {
    expect(lesRute('#/analytt/FINNESIKKE')).toEqual(FORTOLKNING)
    const utenKobling = byggStoffregister([], { stoffer: [], analyttkoblinger: [], kategorier: [] })
    expect(lesRute('#/analytt/HBUP', utenKobling)).toEqual(FORTOLKNING)
    expect(kanoniskAdresse('#/analytt/HBUP', utenKobling)).toBeNull()
  })

  it('skriver adressefeltet om til den kanoniske adressen, og lar den kanoniske stå', () => {
    expect(kanoniskAdresse('#/analytt/HBUP')).toBe('#/stoff/bupropion')
    expect(kanoniskAdresse('#/analytt/HBUP/farmakokinetikk')).toBe('#/stoff/bupropion/farmakokinetikk')
    expect(kanoniskAdresse('#/analytt/IRCAK/fortolkning')).toBe('#/stoff/thc/fortolkning-ircak')
    expect(kanoniskAdresse('#/stoff/Hydroksybupropion')).toBe('#/stoff/bupropion')
    expect(kanoniskAdresse('#/stoff/Valproat')).toBe('#/stoff/valproat')
    expect(kanoniskAdresse('#/stoff/bupropion')).toBeNull()
    expect(kanoniskAdresse('#/stoff/bupropion/')).toBeNull()
    expect(kanoniskAdresse('#/sok?q=hbup')).toBeNull()
    expect(kanoniskAdresse('#/')).toBeNull()
  })
})

describe('søkesiden', () => {
  it('leser og skriver søkesiden, med søket i adressen', () => {
    expect(lesRute('#/sok?q=kvetiapin')).toEqual({ side: 'sok', q: 'kvetiapin' })
    expect(lesRute('#/sok')).toEqual({ side: 'sok', q: '' })
    expect(lesRute('#/sok?q=')).toEqual({ side: 'sok', q: '' })
    const rute = { side: 'sok', q: 'sertralin metabolisme & ø' } as const
    expect(adresse(rute)).toBe(sokeside(rute.q))
    expect(lesRute(adresse(rute))).toEqual(rute)
    expect(sammeRute(rute, { side: 'sok', q: 'noe annet' })).toBe(false)
    expect(adresse({ side: 'sok', q: '' })).toBe('#/sok')
    expect(adresse(FORTOLKNING)).toBe('#/')
  })
})
