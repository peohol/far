/**
 * Koblingene mellom stoffsider og virkestoff i FEST som legges inn med en
 * migrasjon, i stedet for én og én i redigeringen.
 *
 * En kobling er det samme kortet som redigeringen lager (`legemiddelkobling`
 * i panelet «Preparater»): FESTs ID for virkestoffet, og navnet FEST gir det.
 * Den gir siden preparatene, interaksjonene og det andre fra
 * legemiddeldataene (`docs/legemiddeldata.md`). Koblingene er valgt for hånd
 * og kontrollert mot FEST-kopien, aldri av navnelikhet alene; navnet hentes
 * fra FEST når migrasjonen kjøres.
 *
 * Modulen brukes av skriptet som lager migrasjonen og av testene, ikke av
 * appen.
 */
import { ELEMENTTYPER } from './paneler'
import { PREPARATPANEL } from '../legemiddeldata/stoffside'
import { innlogging, lit } from './import'

export interface Festkobling {
  /** Navnet på stoffsiden. Har siden flere virkestoff, står den én gang for hvert. */
  side: string
  /** FESTs ID for virkestoffet. Saltene følger med av seg selv. */
  fest_id: string
  /** Hvorfor dette virkestoffet, når det ikke har samme navn som siden. */
  merknad?: string
}

/**
 * Stoffsidene uten analyttkode fra kildene om serumkonsentrasjoner
 * (`supabase/import/stoffsider/`).
 */
export const STOFFSIDE_FESTKOBLINGER: readonly Festkobling[] = [
  { side: 'Atomoksetin', fest_id: 'ID_C6B0601C-B7F9-49F5-B977-01717103A917' },
  { side: 'Fenobarbital', fest_id: 'ID_B5FF582C-3B3D-4EE0-95E5-27C784AF90E4' },
  { side: 'Fenytoin', fest_id: 'ID_009F9FE6-F548-46A5-89EB-26B4D3CBDF23' },
  { side: 'Flunitrazepam', fest_id: 'ID_101A6BCA-98AF-4D0A-B9EF-1917D86B7227' },
  { side: 'Gabapentin', fest_id: 'ID_A46CFA9C-F01A-4F03-AF5C-28A5579898DB' },
  { side: 'Karbamazepin', fest_id: 'ID_8418C9B9-33E9-4757-9224-7D3A76E776B6' },
  { side: 'Ketobemidon', fest_id: 'ID_0BFAF9DC-D8E2-4779-AB7E-2EF0473E4099' },
  { side: 'Levetiracetam', fest_id: 'ID_C0B8977C-98C2-4BAC-8133-49CF59934213' },
  {
    side: 'Litium',
    fest_id: 'ID_36AEA22F-E6BC-4CF0-9A3F-2E9341A7B5F6',
    merknad: 'Litiumion, som litiumsaltene i preparatene er salter av. «Litium» i FEST har ingen preparater.',
  },
  { side: 'Metylfenidat', fest_id: 'ID_6CACB000-6973-4B2F-9C99-4C1A3DD58F25' },
  { side: 'Okskarbazepin', fest_id: 'ID_4F71C73E-B25D-404B-9835-3C3DF9D89231' },
  { side: 'Petidin', fest_id: 'ID_512D22D6-CA39-4D2B-B6FC-012A0241529A' },
  { side: 'Sertindol', fest_id: 'ID_79EE8CA6-168F-444A-9C83-2F6110A42CF0' },
  { side: 'Topiramat', fest_id: 'ID_A8E3BC2D-A60C-4AA6-B069-5D09BC84ADE0' },
  {
    side: 'Valproat',
    fest_id: 'ID_A61E2EDC-D6B4-4E52-89F4-3D10F0E03E38',
    merknad: 'Valproinsyre, som natriumvalproat og divalproeksnatrium er salter av.',
  },
]

/**
 * Amfetaminsiden (AMF1): referanseområdet gjelder deksamfetamin og
 * lisdeksamfetamin, ikke racemisk amfetamin (`supabase/import/tdm/AMF1.json`).
 */
export const AMFETAMIN_FESTKOBLINGER: readonly Festkobling[] = [
  {
    side: 'Amfetamin',
    fest_id: 'ID_94B3D11A-B6E3-4139-8F0E-8FE9B5B12D62',
    merknad: 'Deksamfetamin, med saltene i Attentin, Dexatin og Dexfarm.',
  },
  {
    side: 'Amfetamin',
    fest_id: 'ID_90176257-5082-40EB-9F18-687F7AC07352',
    merknad: 'Lisdeksamfetamin, med saltene i Elvanse og generika.',
  },
]

/**
 * GHB- og ketaminsidene. GHB er det samme stoffet som natriumoksybat, som er
 * legemiddelet. Ketaminsiden viser både racemisk ketamin og esketamin.
 */
export const GHB_KETAMIN_FESTKOBLINGER: readonly Festkobling[] = [
  {
    side: 'GHB',
    fest_id: 'ID_E5DA647E-762B-47A9-AABF-1DF049027829',
    merknad: 'Natriumoksybat, natriumsaltet av GHB, i Xyrem og generika.',
  },
  { side: 'Ketamin', fest_id: 'ID_BE99AE1B-6C05-4E5F-A879-E7251B67947B', merknad: 'Racemisk ketamin (Ketalar, Ketamin Abcur).' },
  { side: 'Ketamin', fest_id: 'ID_6C27065E-76FB-4EEA-B045-DE70AB6D7A06', merknad: 'Esketamin (Ketanest, Spravato).' },
]

/**
 * THC-siden. FEST kaller THC (delta-9-tetrahydrocannabinol) dronabinol.
 * Cannabidiol kobles ikke: da ville siden også vist preparater med bare CBD.
 */
export const THC_FESTKOBLINGER: readonly Festkobling[] = [
  {
    side: 'THC',
    fest_id: 'ID_83377FF5-A0F5-4CB1-9BF3-0606A68958D7',
    merknad: 'Dronabinol, i Sativex (sammen med cannabidiol), Marinol og cannabispreparatene på godkjenningsfritak.',
  },
]

/**
 * Cannabidiolsiden (CBD). Viser Epidyolex, Sativex (sammen med THC) og
 * cannabispreparatene på godkjenningsfritak som inneholder CBD.
 */
export const CBD_FESTKOBLINGER: readonly Festkobling[] = [
  { side: 'Cannabidiol', fest_id: 'ID_FFF3536F-BE29-4191-A09A-ABC119C37984' },
]

/**
 * Rusmiddelkodene som er legemidler (se `RUSMIDLER_INDIKASJONER` i
 * `indikasjoner.ts`). Metadonsiden viser også levometadon, den virksomme
 * enantiomeren, og hydroksybupropion, som bare er en metabolitt, viser
 * preparatene med bupropion.
 */
export const RUSMIDLER_FESTKOBLINGER: readonly Festkobling[] = [
  { side: 'Alprazolam', fest_id: 'ID_0C2B08A1-B726-4C1C-988F-D1DDD0DAACEC' },
  { side: 'Buprenorfin', fest_id: 'ID_F5C79CF4-0293-448F-92E1-B8136F3A138F' },
  { side: 'Diazepam', fest_id: 'ID_30219EB4-5E5B-486A-BC91-3FFC69096ED5' },
  { side: 'Fentanyl', fest_id: 'ID_2EC14444-4ECE-442A-BCBA-40A2173750B3' },
  {
    side: 'Hydroksybupropion',
    fest_id: 'ID_4FE84EA2-FC1B-44A6-8D70-2A118B211697',
    merknad: 'Bupropion: hydroksybupropion er den aktive metabolitten og finnes ikke som legemiddel selv.',
  },
  { side: 'Klonazepam', fest_id: 'ID_76C0CD6C-AFB4-4346-8387-09573B2CDBDD' },
  { side: 'Kodein', fest_id: 'ID_82E89E1B-9C06-4E57-BB4D-AB3DA8B33FD4' },
  { side: 'Metadon', fest_id: 'ID_335943E0-9530-4E09-9A5C-116D9BA35468', merknad: 'Racemisk metadon.' },
  { side: 'Metadon', fest_id: 'ID_7A7394E3-2826-4CDE-8AB1-538BB8DB1AD5', merknad: 'Levometadon (Levopidon).' },
  { side: 'Morfin', fest_id: 'ID_3EAD2C2E-9707-44CF-99A0-1FB6BE599975' },
  { side: 'Nitrazepam', fest_id: 'ID_130EEA0C-93B8-41C6-8938-A7DC9AEDEBCF' },
  { side: 'Oksazepam', fest_id: 'ID_68C8AD1D-5261-42DE-9DBE-E8103D4D7E44' },
  { side: 'Oksykodon', fest_id: 'ID_A6032CF1-3E82-48B3-9D92-937838527447' },
  { side: 'Tapentadol', fest_id: 'ID_54B6DB98-E83E-43AB-A259-BCFE879BBC46' },
  { side: 'Tramadol', fest_id: 'ID_9A7618F7-90F5-44EE-89E8-29BF06A684EA' },
  { side: 'Zolpidem', fest_id: 'ID_9EAED86D-1D9F-458A-B626-DB9EEA5A7731' },
  { side: 'Zopiklon', fest_id: 'ID_8B254174-7197-4AF9-8A78-739A805012BE' },
]

/**
 * Antihypertensivene (`supabase/import/antihypertensiver/`). Sidene heter som
 * stoffet i stoffregisteret.
 */
export const ANTIHYPERTENSIV_FESTKOBLINGER: readonly Festkobling[] = [
  { side: 'Amlodipin', fest_id: 'ID_7747F0C0-30CC-438E-B66F-68C2C14E710F' },
  { side: 'Atenolol', fest_id: 'ID_B7952198-5997-46EB-B182-785CBD0D7007' },
  {
    side: 'Bendroflumetiazid',
    fest_id: 'ID_02AE4CD3-BCA2-487C-974D-20E65AED89B2',
    merknad: 'Finnes i FEST bare sammen med kalium (Centyl med kaliumklorid).',
  },
  { side: 'Bisoprolol', fest_id: 'ID_BED4501F-4CD5-4EE4-98FA-2FB1096EAEF1' },
  { side: 'Bumetanid', fest_id: 'ID_987C2CCC-48D6-4DEB-A68B-0082BF25876A' },
  { side: 'Diltiazem', fest_id: 'ID_F337071D-AA12-4D72-9DA5-CB3AD91D2759' },
  { side: 'Doksazosin', fest_id: 'ID_42781DEA-BCA0-48B5-8DD8-1269B99F2910' },
  { side: 'Enalapril', fest_id: 'ID_5A4991C1-1D06-46A2-9B95-D7C72864CD0E' },
  { side: 'Eplerenon', fest_id: 'ID_D76A9CFA-D219-430B-AD5F-255A9BB6949A' },
  { side: 'Furosemid', fest_id: 'ID_966A96B7-BC79-4152-A555-4C76A2391920' },
  { side: 'Hydroklortiazid', fest_id: 'ID_605B1311-43E9-45BC-83D7-828D4F53C523' },
  { side: 'Irbesartan', fest_id: 'ID_BBC7FCDA-3571-4325-B576-645784F29DC1' },
  {
    side: 'Kandesartan',
    fest_id: 'ID_05B987BF-55BC-4935-9578-9A5AA725B430',
    merknad: 'Kandesartancileksetil, forløperen (prodrug) som omdannes til kandesartan.',
  },
  { side: 'Karvedilol', fest_id: 'ID_646B1EE5-9372-48A6-8E68-2B7C290289CD' },
  { side: 'Labetalol', fest_id: 'ID_1AAC4109-128E-4D4C-B251-23E462DD1B7D' },
  { side: 'Lerkanidipin', fest_id: 'ID_A164C4B8-7BD0-4408-97AE-16E10A14250C' },
  { side: 'Lisinopril', fest_id: 'ID_DCB94A58-2AD7-40B6-A515-7EE19E299F09' },
  { side: 'Losartan', fest_id: 'ID_A3ED2C34-50C9-46E7-9482-5E5B55E2BBC0' },
  { side: 'Metoprolol', fest_id: 'ID_F1A5819E-781F-4ADA-92F6-B009B48750A5' },
  { side: 'Nifedipin', fest_id: 'ID_D2B69C47-BEFE-4345-B4E7-D59049EF41DD' },
  { side: 'Ramipril', fest_id: 'ID_C9D2BF2D-A0F8-46EC-9861-FE58536C8A41' },
  { side: 'Spironolakton', fest_id: 'ID_6F33B108-8842-4D25-9746-6397759275CA' },
  { side: 'Telmisartan', fest_id: 'ID_D4F3353B-CA8D-442D-86DF-C3052BFB4C7F' },
  { side: 'Valsartan', fest_id: 'ID_90CC1E37-24DD-496F-A7F5-D9B8B816E900' },
  { side: 'Verapamil', fest_id: 'ID_DB91861C-E102-47D6-8ED7-F0C118195F67' },
]

/** Hver import av koblinger, i rekkefølge, med navnet migrasjonen fikk. */
export const FESTKOBLINGSIMPORTER: readonly { migrasjon: string; koblinger: readonly Festkobling[] }[] = [
  { migrasjon: 'stoffsider_fest_kobling', koblinger: STOFFSIDE_FESTKOBLINGER },
  { migrasjon: 'amfetamin_fest_kobling', koblinger: AMFETAMIN_FESTKOBLINGER },
  { migrasjon: 'ghb_ketamin_fest_kobling', koblinger: GHB_KETAMIN_FESTKOBLINGER },
  { migrasjon: 'thc_fest_kobling', koblinger: THC_FESTKOBLINGER },
  { migrasjon: 'cbd_fest_kobling', koblinger: CBD_FESTKOBLINGER },
  { migrasjon: 'rusmidler_fest_kobling', koblinger: RUSMIDLER_FESTKOBLINGER },
  { migrasjon: 'antihypertensiver_fest_kobling', koblinger: ANTIHYPERTENSIV_FESTKOBLINGER },
]

/** Kilden revisjonene får i historikken. */
export const FESTKOBLINGSKILDE = 'Koblet til virkestoffet i FEST'

/**
 * SQL-en som legger inn koblingene, som administratoren `admin`, publisert:
 * ett kort per side, med virkestoffene i den rekkefølgen de står. Den hopper
 * over — med en melding — en side som ikke finnes eller alt er koblet, og et
 * virkestoff som ikke finnes i FEST-kopien eller er utgått (har siden ingen
 * igjen, hoppes den over), så den kan kjøres igjen uten å gjøre noe. Uten
 * administratoren gjør den ingenting, som i testdatabasen.
 *
 * Migrasjonen `stoffsider_fest_kobling` ble laget med en tidligere utgave, med
 * ett virkestoff per side; den står som den ble kjørt.
 */
export function festkoblingSql(koblinger: readonly Festkobling[], admin: string): string {
  const rader = koblinger.map((k, i) => `      (${lit(k.side)}, ${lit(k.fest_id)}, ${i})`).join(',\n')
  return `-- Stoffsidene kobles til virkestoffene i FEST
do $kobling$
declare
  administrator uuid;
  k record;
  side uuid;
  virkestoff jsonb;
  status public.objektstatus;
begin
${innlogging(admin, 'hopp over')}
  perform set_config('far.revisjonskilde', ${lit(FESTKOBLINGSKILDE)}, true);

  for k in
    select t.side, array_agg(t.fest_id order by t.nr) as fest_ider
    from (values
${rader}
    ) as t(side, fest_id, nr)
    group by t.side
    order by min(t.nr)
  loop
    side := (select i.objekt_id from public.infosider i where i.tilstand = 'publisert' and i.navn = k.side);
    if side is null then
      raise notice 'Fant ingen publisert side %, så den hoppes over.', k.side;
      continue;
    end if;
    if exists (
      select 1 from public.innholdselementer e
      where e.infoside_id = side and e.elementtype = ${lit(ELEMENTTYPER.legemiddelkobling)} and e.panel <> 'fjernet'
    ) then
      raise notice '% er alt koblet til legemiddeldataene, så den hoppes over.', k.side;
      continue;
    end if;
    virkestoff := (
      select jsonb_agg(jsonb_build_object('fest_id', v.fest_id, 'navn', v.navn) order by array_position(k.fest_ider, v.fest_id))
      from legemiddeldata.virkestoff v where v.fest_id = any(k.fest_ider) and v.utgatt_kl is null
    );
    if coalesce(jsonb_array_length(virkestoff), 0) < cardinality(k.fest_ider) then
      raise notice 'Noen av virkestoffene % for % finnes ikke i FEST.', k.fest_ider, k.side;
    end if;
    if virkestoff is null then
      raise notice 'Ingen av virkestoffene for % finnes i FEST, så siden hoppes over.', k.side;
      continue;
    end if;

    status := public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side,
      'panel', ${lit(PREPARATPANEL)},
      'posisjon', 0,
      'elementtype', ${lit(ELEMENTTYPER.legemiddelkobling)},
      'data', jsonb_build_object('virkestoff', virkestoff)
    ));
    perform public.publiser_utkast(status.id, status.revisjon);
  end loop;
end
$kobling$;`
}
