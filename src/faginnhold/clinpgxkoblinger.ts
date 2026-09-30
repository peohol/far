/**
 * Koblingene mellom stoffsider og kjemikalier i ClinPGx som legges inn med en
 * migrasjon, i stedet for én og én i redigeringen.
 *
 * En kobling er det samme kortet som redigeringen lager (`clinpgxkobling` i
 * panelet «Farmakogenetikk»): ClinPGx' ID for kjemikaliet og navnet ClinPGx
 * gir det (`docs/clinpgx.md`). En kobling er bare tatt med når navnet og minst
 * ett uavhengig kjennetegn til stemmer: ATC-koden, eller en identifikator i et
 * annet register som ClinPGx viser til (RxNorm, PubChem, ChEBI). Et navn alene
 * er aldri nok. Er siden koblet til et virkestoff i FEST, går koblingen via
 * det; ellers kommer den bare med sammen med kjennetegnene. Sidene som ikke
 * kobles, står med grunnen i dekningsoversikten (`clinpgxdekning.ts`).
 *
 * Modulen brukes av skriptet som lager migrasjonen og av testene, ikke av
 * appen.
 */
import { FARMAKOGENETIKKPANEL } from '../clinpgx/stoffside'
import { innlogging, lit } from './import'
import { ELEMENTTYPER } from './paneler'

/**
 * Hva som stemmer med navnet:
 * - `navn`: ClinPGx' navn er det engelske navnet på virkestoffet.
 * - `synonym`: det engelske navnet er et av ClinPGx' synonymer for kjemikaliet.
 * - `skrivemåte`: navnet er en annen skrivemåte eller et annet lands navn på
 *   det samme virkestoffet; `merknad` sier hvilket.
 */
export type Samsvar = 'navn' | 'synonym' | 'skrivemåte'

/**
 * Identifikatorer i andre registre som ClinPGx viser til for kjemikaliet, og
 * som registeret selv gir for virkestoffets navn: RxNorm (RxCUI for
 * virkestoffet), PubChem (CID) og ChEBI. `inchikey` er strukturen: nøkkelen
 * til InChI-en ClinPGx oppgir, som må være lik den PubChem gir for navnet —
 * med stereokjemien, så en enantiomer ikke kan forveksles med racematet.
 */
export interface Identifikatorer {
  rxnorm?: string
  pubchem?: string
  chebi?: string
  inchikey?: string
}

export interface Clinpgxkobling {
  /** Navnet på stoffsiden. Har siden flere virkestoff, står den én gang for hvert. */
  side: string
  /**
   * FESTs ID for virkestoffet siden er koblet til, eller `null` når siden ikke
   * er koblet til FEST. Da er navnene og ATC-koden fra virkestoffet med samme
   * norske navn i FEST, og koblingen hviler også på {@link identifikatorer}.
   */
  fest_id: string | null
  /** Det norske og engelske navnet på virkestoffet i FEST. */
  virkestoff: string
  engelsk: string
  /** ATC-koden stoffet har i FEST (eller hos WHO, se `merknad`) og ClinPGx, eller `null` når ClinPGx ikke har noen. */
  atc: string | null
  /** ATC-koden ClinPGx har, når den er en eldre kode WHO har byttet ut med {@link atc}. */
  atc_clinpgx?: string
  identifikatorer?: Identifikatorer
  /** ClinPGx' accession-ID og navn for kjemikaliet. */
  clinpgx_id: string
  navn: string
  samsvar: Samsvar
  merknad?: string
}

/**
 * De publiserte stoffsidene som er koblet til FEST, med kjemikaliet i ClinPGx,
 * kontrollert mot ClinPGx 26. september 2026.
 */
export const STOFFSIDE_CLINPGXKOBLINGER: readonly Clinpgxkobling[] = [
  { side: 'Amfetamin', fest_id: 'ID_94B3D11A-B6E3-4139-8F0E-8FE9B5B12D62', virkestoff: 'Deksamfetamin', engelsk: 'Dexamfetamine', atc: 'N06BA02', clinpgx_id: 'PA449269', navn: 'dextroamphetamine', samsvar: 'synonym' },
  { side: 'Amfetamin', fest_id: 'ID_90176257-5082-40EB-9F18-687F7AC07352', virkestoff: 'Lisdeksamfetamin', engelsk: 'Lisdexamfetamine', atc: 'N06BA12', clinpgx_id: 'PA164748975', navn: 'lisdexamfetamine', samsvar: 'navn' },
  { side: 'Amisulprid', fest_id: 'ID_23A8F342-84DC-41FF-B835-B9A45B2F6394', virkestoff: 'Amisulprid', engelsk: 'Amisulpride', atc: 'N05AL05', clinpgx_id: 'PA162565877', navn: 'amisulpride', samsvar: 'navn' },
  { side: 'Amitriptylin', fest_id: 'ID_0A1B24EF-A7F8-488B-97B8-8023193E976D', virkestoff: 'Amitriptylin', engelsk: 'Amitriptyline', atc: 'N06AA09', clinpgx_id: 'PA448385', navn: 'amitriptyline', samsvar: 'navn' },
  { side: 'Aripiprazol', fest_id: 'ID_4596EE8B-CD03-43E0-AEA8-CDB60778EA43', virkestoff: 'Aripiprazol', engelsk: 'Aripiprazole', atc: 'N05AX12', clinpgx_id: 'PA10026', navn: 'aripiprazole', samsvar: 'navn' },
  { side: 'Atomoksetin', fest_id: 'ID_C6B0601C-B7F9-49F5-B977-01717103A917', virkestoff: 'Atomoksetin', engelsk: 'Atomoxetine', atc: 'N06BA09', clinpgx_id: 'PA134688071', navn: 'atomoxetine', samsvar: 'navn' },
  { side: 'Brekspiprazol', fest_id: 'ID_68DCFD07-0824-4962-AA56-FD6ED472D9B8', virkestoff: 'Brekspiprazol', engelsk: 'Brexpiprazole', atc: 'N05AX16', clinpgx_id: 'PA166160053', navn: 'brexpiprazole', samsvar: 'navn' },
  { side: 'Citalopram', fest_id: 'ID_E2B9E074-0D21-4E5E-9867-BC70B8FC2654', virkestoff: 'Citalopram', engelsk: 'Citalopram', atc: 'N06AB04', clinpgx_id: 'PA449015', navn: 'citalopram', samsvar: 'navn' },
  { side: 'Doksepin', fest_id: 'ID_AF1D3EF5-E7BA-45E4-8C6F-EB410DB3C4AF', virkestoff: 'Doksepin', engelsk: 'Doxepin', atc: 'N06AA12', clinpgx_id: 'PA449409', navn: 'doxepin', samsvar: 'navn' },
  { side: 'Duloksetin', fest_id: 'ID_D27A3210-135D-42C9-9DB3-8AB8CBEA77E6', virkestoff: 'Duloksetin', engelsk: 'Duloxetine', atc: 'N06AX21', clinpgx_id: 'PA10066', navn: 'duloxetine', samsvar: 'navn' },
  { side: 'Escitalopram', fest_id: 'ID_13E05918-25C1-4DAA-A0F5-1266DEC3A75F', virkestoff: 'Escitalopram', engelsk: 'Escitalopram', atc: 'N06AB10', clinpgx_id: 'PA10074', navn: 'escitalopram', samsvar: 'navn' },
  { side: 'Fenobarbital', fest_id: 'ID_B5FF582C-3B3D-4EE0-95E5-27C784AF90E4', virkestoff: 'Fenobarbital', engelsk: 'Phenobarbital', atc: 'N03AA02', clinpgx_id: 'PA450911', navn: 'phenobarbital', samsvar: 'navn' },
  { side: 'Fenytoin', fest_id: 'ID_009F9FE6-F548-46A5-89EB-26B4D3CBDF23', virkestoff: 'Fenytoin', engelsk: 'Phenytoin', atc: 'N03AB02', clinpgx_id: 'PA450947', navn: 'phenytoin', samsvar: 'navn' },
  { side: 'Flunitrazepam', fest_id: 'ID_101A6BCA-98AF-4D0A-B9EF-1917D86B7227', virkestoff: 'Flunitrazepam', engelsk: 'Flunitrazepam', atc: 'N05CD03', clinpgx_id: 'PA164781320', navn: 'flunitrazepam', samsvar: 'navn' },
  { side: 'Fluoksetin', fest_id: 'ID_D473FE91-133D-494A-A2B0-C644A8372A8B', virkestoff: 'Fluoksetin', engelsk: 'Fluoxetine', atc: 'N06AB03', clinpgx_id: 'PA449673', navn: 'fluoxetine', samsvar: 'navn' },
  { side: 'Flupentiksol', fest_id: 'ID_9E8C912B-84DB-4AFF-BE91-DB21F945B83E', virkestoff: 'Flupentiksol', engelsk: 'Flupentixol', atc: 'N05AF01', clinpgx_id: 'PA10268', navn: 'flupenthixol', samsvar: 'skrivemåte', merknad: 'ClinPGx skriver flupenthixol.' },
  { side: 'Fluvoksamin', fest_id: 'ID_A39218DE-5973-4473-A005-FBA8B4E86C62', virkestoff: 'Fluvoksamin', engelsk: 'Fluvoxamine', atc: 'N06AB08', clinpgx_id: 'PA449690', navn: 'fluvoxamine', samsvar: 'navn' },
  { side: 'Haloperidol', fest_id: 'ID_667FA975-A8EC-4CF8-A89E-96F97808E3AD', virkestoff: 'Haloperidol', engelsk: 'Haloperidol', atc: 'N05AD01', clinpgx_id: 'PA449841', navn: 'haloperidol', samsvar: 'navn' },
  { side: 'Hydroksyrisperidon', fest_id: 'ID_82CAEDDE-7CB1-4302-9C30-6A2010DB6D85', virkestoff: 'Paliperidon', engelsk: 'Paliperidone', atc: 'N05AX13', clinpgx_id: 'PA163518919', navn: 'paliperidone', samsvar: 'navn' },
  { side: 'Karbamazepin', fest_id: 'ID_8418C9B9-33E9-4757-9224-7D3A76E776B6', virkestoff: 'Karbamazepin', engelsk: 'Carbamazepine', atc: 'N03AF01', clinpgx_id: 'PA448785', navn: 'carbamazepine', samsvar: 'navn' },
  { side: 'Kariprazin', fest_id: 'ID_966A0E9E-10AF-40C1-BA48-3E2E6ECF49C2', virkestoff: 'Kariprazin', engelsk: 'Cariprazine', atc: 'N05AX15', clinpgx_id: 'PA166177476', navn: 'cariprazine', samsvar: 'navn' },
  { side: 'Klomipramin', fest_id: 'ID_40E4710B-8115-40CA-986D-E98AE4C2D6B0', virkestoff: 'Klomipramin', engelsk: 'Clomipramine', atc: 'N06AA04', clinpgx_id: 'PA449048', navn: 'clomipramine', samsvar: 'navn' },
  { side: 'Klorprotiksen', fest_id: 'ID_9672824E-CE48-45EB-B232-E41DC928D08B', virkestoff: 'Klorprotiksen', engelsk: 'Chlorprothixene', atc: 'N05AF03', clinpgx_id: 'PA164781400', navn: 'chlorprothixene', samsvar: 'navn' },
  { side: 'Klozapin', fest_id: 'ID_41137AC7-7E5B-47BA-BF41-4CE0672EF755', virkestoff: 'Klozapin', engelsk: 'Clozapine', atc: 'N05AH02', clinpgx_id: 'PA449061', navn: 'clozapine', samsvar: 'navn' },
  { side: 'Kvetiapin', fest_id: 'ID_61E766DA-E71D-4381-B4DE-2A06C51A2BD8', virkestoff: 'Kvetiapin', engelsk: 'Quetiapine', atc: 'N05AH04', clinpgx_id: 'PA451201', navn: 'quetiapine', samsvar: 'navn' },
  { side: 'Lamotrigin', fest_id: 'ID_F456CD11-3821-4C60-B36F-DE0C9D51ED22', virkestoff: 'Lamotrigin', engelsk: 'Lamotrigine', atc: 'N03AX09', clinpgx_id: 'PA450164', navn: 'lamotrigine', samsvar: 'navn' },
  { side: 'Levetiracetam', fest_id: 'ID_C0B8977C-98C2-4BAC-8133-49CF59934213', virkestoff: 'Levetiracetam', engelsk: 'Levetiracetam', atc: 'N03AX14', clinpgx_id: 'PA450206', navn: 'levetiracetam', samsvar: 'navn' },
  { side: 'Litium', fest_id: 'ID_36AEA22F-E6BC-4CF0-9A3F-2E9341A7B5F6', virkestoff: 'Litiumion', engelsk: 'Lithium ion', atc: 'N05AN01', clinpgx_id: 'PA450243', navn: 'lithium', samsvar: 'skrivemåte', merknad: 'ClinPGx kaller virkestoffet lithium, FEST litiumion.' },
  { side: 'Lurasidon', fest_id: 'ID_3B369762-A4B8-49DB-931D-6AC9D901ABAC', virkestoff: 'Lurasidon', engelsk: 'Lurasidone', atc: 'N05AE05', clinpgx_id: 'PA166129557', navn: 'lurasidone', samsvar: 'navn' },
  { side: 'Metylfenidat', fest_id: 'ID_6CACB000-6973-4B2F-9C99-4C1A3DD58F25', virkestoff: 'Metylfenidat', engelsk: 'Methylphenidate', atc: 'N06BA04', clinpgx_id: 'PA450464', navn: 'methylphenidate', samsvar: 'navn' },
  { side: 'Mianserin', fest_id: 'ID_09537B03-BA99-4CE5-B1E3-7AE975842EB6', virkestoff: 'Mianserin', engelsk: 'Mianserin', atc: 'N06AX03', clinpgx_id: 'PA134687937', navn: 'mianserin', samsvar: 'navn' },
  { side: 'Mirtazapin', fest_id: 'ID_0AFFD596-9932-44A7-86E8-F35BBDB1FCAD', virkestoff: 'Mirtazapin', engelsk: 'Mirtazapine', atc: 'N06AX11', clinpgx_id: 'PA450522', navn: 'mirtazapine', samsvar: 'navn' },
  { side: 'Nortriptylin', fest_id: 'ID_829694BA-B839-4173-BE1A-37CD35C17700', virkestoff: 'Nortriptylin', engelsk: 'Nortriptyline', atc: 'N06AA10', clinpgx_id: 'PA450657', navn: 'nortriptyline', samsvar: 'navn' },
  { side: 'Okskarbazepin', fest_id: 'ID_4F71C73E-B25D-404B-9835-3C3DF9D89231', virkestoff: 'Okskarbazepin', engelsk: 'Oxcarbazepine', atc: 'N03AF02', clinpgx_id: 'PA450732', navn: 'oxcarbazepine', samsvar: 'navn' },
  { side: 'Olanzapin', fest_id: 'ID_A86FC555-41CA-4E80-A188-ED521EEC5903', virkestoff: 'Olanzapin', engelsk: 'Olanzapine', atc: 'N05AH03', clinpgx_id: 'PA450688', navn: 'olanzapine', samsvar: 'navn' },
  { side: 'Paliperidon (hydroksyrisperidon)', fest_id: 'ID_82CAEDDE-7CB1-4302-9C30-6A2010DB6D85', virkestoff: 'Paliperidon', engelsk: 'Paliperidone', atc: 'N05AX13', clinpgx_id: 'PA163518919', navn: 'paliperidone', samsvar: 'navn' },
  { side: 'Paroksetin', fest_id: 'ID_0F9E3AC0-1950-4CF5-8F4F-4008696E85B8', virkestoff: 'Paroksetin', engelsk: 'Paroxetine', atc: 'N06AB05', clinpgx_id: 'PA450801', navn: 'paroxetine', samsvar: 'navn' },
  { side: 'Perfenazin', fest_id: 'ID_57F9D9AC-707C-4172-8A52-2C2D944B5FF5', virkestoff: 'Perfenazin', engelsk: 'Perphenazine', atc: 'N05AB03', clinpgx_id: 'PA450882', navn: 'perphenazine', samsvar: 'navn' },
  { side: 'Petidin', fest_id: 'ID_512D22D6-CA39-4D2B-B6FC-012A0241529A', virkestoff: 'Petidin', engelsk: 'Pethidine', atc: 'N02AB02', clinpgx_id: 'PA450369', navn: 'meperidine', samsvar: 'skrivemåte', merknad: 'ClinPGx bruker det amerikanske navnet meperidine.' },
  { side: 'Risperidon', fest_id: 'ID_852F4AC9-FF5C-4C97-999E-03FE3C144223', virkestoff: 'Risperidon', engelsk: 'Risperidone', atc: 'N05AX08', clinpgx_id: 'PA451257', navn: 'risperidone', samsvar: 'navn' },
  { side: 'Sertindol', fest_id: 'ID_79EE8CA6-168F-444A-9C83-2F6110A42CF0', virkestoff: 'Sertindol', engelsk: 'Sertindole', atc: 'N05AE03', clinpgx_id: 'PA164784002', navn: 'sertindole', samsvar: 'navn' },
  { side: 'Sertralin', fest_id: 'ID_1C2C9254-987B-4A37-AC48-6349BB671F07', virkestoff: 'Sertralin', engelsk: 'Sertraline', atc: 'N06AB06', clinpgx_id: 'PA451333', navn: 'sertraline', samsvar: 'navn' },
  { side: 'Topiramat', fest_id: 'ID_A8E3BC2D-A60C-4AA6-B069-5D09BC84ADE0', virkestoff: 'Topiramat', engelsk: 'Topiramate', atc: 'N03AX11', clinpgx_id: 'PA451728', navn: 'topiramate', samsvar: 'navn' },
  { side: 'Trimipramin', fest_id: 'ID_958415F9-1F66-4665-AB6C-5E8EB61E346A', virkestoff: 'Trimipramin', engelsk: 'Trimipramine', atc: 'N06AA06', clinpgx_id: 'PA451791', navn: 'trimipramine', samsvar: 'navn' },
  { side: 'Valproat', fest_id: 'ID_A61E2EDC-D6B4-4E52-89F4-3D10F0E03E38', virkestoff: 'Valproinsyre', engelsk: 'Valproic acid', atc: 'N03AG01', clinpgx_id: 'PA451846', navn: 'valproic acid', samsvar: 'navn' },
  { side: 'Venlafaksin', fest_id: 'ID_289921F8-A934-43E2-8F86-DB736FA198DF', virkestoff: 'Venlafaksin', engelsk: 'Venlafaxine', atc: 'N06AX16', clinpgx_id: 'PA451866', navn: 'venlafaxine', samsvar: 'navn' },
  { side: 'Vortioksetin', fest_id: 'ID_328991B3-C34B-4D78-AD5C-7D7DDA7B2DCA', virkestoff: 'Vortioksetin', engelsk: 'Vortioxetine', atc: 'N06AX26', clinpgx_id: 'PA166122595', navn: 'vortioxetine', samsvar: 'navn' },
  { side: 'Ziprasidon', fest_id: 'ID_97EEA6F8-10CB-44CC-B37D-9B3DC81A6398', virkestoff: 'Ziprasidon', engelsk: 'Ziprasidone', atc: 'N05AE04', clinpgx_id: 'PA451974', navn: 'ziprasidone', samsvar: 'navn' },
  { side: 'Zuklopentiksol', fest_id: 'ID_31472D31-DAB7-49DF-AB66-A7CDA5A8222B', virkestoff: 'Zuklopentiksol', engelsk: 'Zuclopenthixol', atc: 'N05AF05', clinpgx_id: 'PA452629', navn: 'zuclopenthixol', samsvar: 'navn' },
]

/**
 * Stoffsidene som ble koblet da dekningen ble gjennomgått for alle publiserte
 * sider, kontrollert mot ClinPGx, WHOs ATC-register, RxNorm, PubChem og ChEBI
 * 26. september 2026. Først de fire sidene med FEST-kobling der navnet alene
 * stemte i første runde, så sidene uten FEST-kobling.
 */
export const DEKNINGSKOBLINGER: readonly Clinpgxkobling[] = [
  {
    side: 'Gabapentin', fest_id: 'ID_A46CFA9C-F01A-4F03-AF5C-28A5579898DB', virkestoff: 'Gabapentin', engelsk: 'Gabapentin',
    atc: 'N02BF01', atc_clinpgx: 'N03AX12', identifikatorer: { rxnorm: '25480' }, clinpgx_id: 'PA449720', navn: 'gabapentin', samsvar: 'navn',
    merknad: 'WHO flyttet gabapentin fra N03AX12 til N02BF01 i 2023; ClinPGx har fortsatt den gamle koden.',
  },
  {
    side: 'Ketobemidon', fest_id: 'ID_0BFAF9DC-D8E2-4779-AB7E-2EF0473E4099', virkestoff: 'Ketobemidon', engelsk: 'Ketobemidone',
    atc: null, identifikatorer: { pubchem: '10101', chebi: 'CHEBI:6125' }, clinpgx_id: 'PA166211241', navn: 'ketobemidone', samsvar: 'navn',
    merknad: 'Verken FEST eller ClinPGx har ATC-kode for stoffet, og det er ikke i RxNorm.',
  },
  {
    side: 'Levomepromazin', fest_id: 'ID_B2FB1ECD-1329-4551-9A12-8C145BD12318', virkestoff: 'Levomepromazin', engelsk: 'Levomepromazine',
    atc: 'N05AA02', identifikatorer: { rxnorm: '6852' }, clinpgx_id: 'PA164743234', navn: 'methotrimeprazine', samsvar: 'skrivemåte',
    merknad: 'ClinPGx bruker det amerikanske navnet methotrimeprazine. ClinPGx har også «levomepromazine» (PA134687942), uten ATC-kode og med RxNorm for maleatsaltet (160372); det er ikke valgt.',
  },
  {
    side: 'O-desmetylvenlafaksin', fest_id: 'ID_DF83C642-14F8-4ACD-84EA-E5C6ED7BC162', virkestoff: 'Desvenlafaksin', engelsk: 'Desvenlafaxine',
    atc: 'N06AX23', identifikatorer: { rxnorm: '734064' }, clinpgx_id: 'PA165958374', navn: 'desvenlafaxine', samsvar: 'navn',
    merknad: 'FEST har ingen preparater med stoffet; ATC-koden er WHOs. O-desmethylvenlafaxine er synonym i ClinPGx.',
  },
  { side: 'Alprazolam', fest_id: null, virkestoff: 'Alprazolam', engelsk: 'Alprazolam', atc: 'N05BA12', identifikatorer: { rxnorm: '596' }, clinpgx_id: 'PA448333', navn: 'alprazolam', samsvar: 'navn' },
  { side: 'Buprenorfin', fest_id: null, virkestoff: 'Buprenorfin', engelsk: 'Buprenorphine', atc: 'N02AE01', identifikatorer: { rxnorm: '1819' }, clinpgx_id: 'PA448685', navn: 'buprenorphine', samsvar: 'navn' },
  { side: 'Diazepam', fest_id: null, virkestoff: 'Diazepam', engelsk: 'Diazepam', atc: 'N05BA01', identifikatorer: { rxnorm: '3322' }, clinpgx_id: 'PA449283', navn: 'diazepam', samsvar: 'navn' },
  { side: 'Fentanyl', fest_id: null, virkestoff: 'Fentanyl', engelsk: 'Fentanyl', atc: 'N02AB03', identifikatorer: { rxnorm: '4337' }, clinpgx_id: 'PA449599', navn: 'fentanyl', samsvar: 'navn' },
  { side: 'Klonazepam', fest_id: null, virkestoff: 'Klonazepam', engelsk: 'Clonazepam', atc: 'N03AE01', identifikatorer: { rxnorm: '2598' }, clinpgx_id: 'PA449050', navn: 'clonazepam', samsvar: 'navn' },
  { side: 'Kodein', fest_id: null, virkestoff: 'Kodein', engelsk: 'Codeine', atc: 'R05DA04', identifikatorer: { rxnorm: '2670' }, clinpgx_id: 'PA449088', navn: 'codeine', samsvar: 'navn' },
  { side: 'Metadon', fest_id: null, virkestoff: 'Metadon', engelsk: 'Methadone', atc: 'N07BC02', identifikatorer: { rxnorm: '6813' }, clinpgx_id: 'PA450401', navn: 'methadone', samsvar: 'navn' },
  { side: 'Morfin', fest_id: null, virkestoff: 'Morfin', engelsk: 'Morphine', atc: 'N02AA01', identifikatorer: { rxnorm: '7052' }, clinpgx_id: 'PA450550', navn: 'morphine', samsvar: 'navn' },
  { side: 'Nitrazepam', fest_id: null, virkestoff: 'Nitrazepam', engelsk: 'Nitrazepam', atc: 'N05CD02', identifikatorer: { rxnorm: '7440' }, clinpgx_id: 'PA10242', navn: 'nitrazepam', samsvar: 'navn' },
  { side: 'Oksazepam', fest_id: null, virkestoff: 'Oksazepam', engelsk: 'Oxazepam', atc: 'N05BA04', identifikatorer: { rxnorm: '7781' }, clinpgx_id: 'PA450731', navn: 'oxazepam', samsvar: 'navn' },
  { side: 'Oksykodon', fest_id: null, virkestoff: 'Oksykodon', engelsk: 'Oxycodone', atc: 'N02AA05', identifikatorer: { rxnorm: '7804' }, clinpgx_id: 'PA450741', navn: 'oxycodone', samsvar: 'navn' },
  { side: 'Tramadol', fest_id: null, virkestoff: 'Tramadol', engelsk: 'Tramadol', atc: 'N02AX02', identifikatorer: { rxnorm: '10689' }, clinpgx_id: 'PA451735', navn: 'tramadol', samsvar: 'navn' },
  { side: 'Zolpidem', fest_id: null, virkestoff: 'Zolpidem', engelsk: 'Zolpidem', atc: 'N05CF02', identifikatorer: { rxnorm: '39993' }, clinpgx_id: 'PA451976', navn: 'zolpidem', samsvar: 'navn' },
  { side: 'Zopiklon', fest_id: null, virkestoff: 'Zopiklon', engelsk: 'Zopiclone', atc: 'N05CF01', identifikatorer: { rxnorm: '40001' }, clinpgx_id: 'PA10236', navn: 'zopiclone', samsvar: 'navn' },
]

/**
 * GHB- og ketaminsidene, kontrollert mot ClinPGx, RxNorm og PubChem
 * 27. september 2026. ClinPGx har ATC-koden for natriumoksybat som
 * anestetikum (N01AX11); FEST har koden for Xyrem (N07XX04), og RxNorm
 * stemmer. Esketamin har ingen ATC-kode i ClinPGx, men samme PubChem-CID og
 * samme struktur, med stereokjemien.
 */
export const GHB_KETAMIN_CLINPGXKOBLINGER: readonly Clinpgxkobling[] = [
  {
    side: 'GHB', fest_id: 'ID_E5DA647E-762B-47A9-AABF-1DF049027829', virkestoff: 'Natriumoksybat', engelsk: 'Sodium Oxybate',
    atc: 'N07XX04', atc_clinpgx: 'N01AX11', identifikatorer: { rxnorm: '9899', pubchem: '23663870' }, clinpgx_id: 'PA166236501', navn: 'sodium oxybate', samsvar: 'navn',
    merknad: 'WHO har to ATC-koder for natriumoksybat: N07XX04 (Xyrem) og N01AX11 (anestetikum), som ClinPGx bruker.',
  },
  {
    side: 'Ketamin', fest_id: 'ID_BE99AE1B-6C05-4E5F-A879-E7251B67947B', virkestoff: 'Ketamin', engelsk: 'Ketamine',
    atc: 'N01AX03', identifikatorer: { rxnorm: '6130', pubchem: '3821' }, clinpgx_id: 'PA450144', navn: 'ketamine', samsvar: 'navn',
  },
  {
    side: 'Ketamin', fest_id: 'ID_6C27065E-76FB-4EEA-B045-DE70AB6D7A06', virkestoff: 'Esketamin', engelsk: 'Esketamine',
    atc: null, identifikatorer: { pubchem: '182137', inchikey: 'YQEZLKZALYSWHR-ZDUSSCGKSA-N' }, clinpgx_id: 'PA166364961', navn: 'esketamine', samsvar: 'navn',
    merknad: 'ClinPGx har ingen ATC-kode for esketamin (FEST har N01AX14 for Ketanest og N06AX27 for Spravato). InChI-en ClinPGx oppgir, er S-enantiomeren, lik PubChems for esketamin.',
  },
]

/**
 * Antihypertensivsidene, som importen fra oversikten over antihypertensiver
 * lager, kontrollert mot ClinPGx 30. september 2026: navnet og ATC-koden
 * stemmer for alle.
 */
export const ANTIHYPERTENSIV_CLINPGXKOBLINGER: readonly Clinpgxkobling[] = [
  { side: 'Amlodipin', fest_id: 'ID_7747F0C0-30CC-438E-B66F-68C2C14E710F', virkestoff: 'Amlodipin', engelsk: 'Amlodipine', atc: 'C08CA01', clinpgx_id: 'PA448388', navn: 'amlodipine', samsvar: 'navn' },
  { side: 'Atenolol', fest_id: 'ID_B7952198-5997-46EB-B182-785CBD0D7007', virkestoff: 'Atenolol', engelsk: 'Atenolol', atc: 'C07AB03', clinpgx_id: 'PA448499', navn: 'atenolol', samsvar: 'navn' },
  { side: 'Bendroflumetiazid', fest_id: 'ID_02AE4CD3-BCA2-487C-974D-20E65AED89B2', virkestoff: 'Bendroflumetiazid', engelsk: 'Bendroflumethiazide', atc: 'C03AA01', identifikatorer: { rxnorm: '1369' }, clinpgx_id: 'PA448563', navn: 'bendroflumethiazide', samsvar: 'navn', merknad: 'FEST har bendroflumetiazid bare sammen med kalium (Centyl med kaliumklorid, C03AB01); ATC-koden er den WHO og ClinPGx har for virkestoffet alene.' },
  { side: 'Bisoprolol', fest_id: 'ID_BED4501F-4CD5-4EE4-98FA-2FB1096EAEF1', virkestoff: 'Bisoprolol', engelsk: 'Bisoprolol', atc: 'C07AB07', clinpgx_id: 'PA448641', navn: 'bisoprolol', samsvar: 'navn' },
  { side: 'Bumetanid', fest_id: 'ID_987C2CCC-48D6-4DEB-A68B-0082BF25876A', virkestoff: 'Bumetanid', engelsk: 'Bumetanide', atc: 'C03CA02', clinpgx_id: 'PA448682', navn: 'bumetanide', samsvar: 'navn' },
  { side: 'Diltiazem', fest_id: 'ID_F337071D-AA12-4D72-9DA5-CB3AD91D2759', virkestoff: 'Diltiazem', engelsk: 'Diltiazem', atc: 'C08DB01', clinpgx_id: 'PA449334', navn: 'diltiazem', samsvar: 'navn', merknad: 'ClinPGx har også C05AE03 (diltiazem i salve mot analfissur).' },
  { side: 'Doksazosin', fest_id: 'ID_42781DEA-BCA0-48B5-8DD8-1269B99F2910', virkestoff: 'Doksazosin', engelsk: 'Doxazosin', atc: 'C02CA04', clinpgx_id: 'PA449407', navn: 'doxazosin', samsvar: 'navn' },
  { side: 'Enalapril', fest_id: 'ID_5A4991C1-1D06-46A2-9B95-D7C72864CD0E', virkestoff: 'Enalapril', engelsk: 'Enalapril', atc: 'C09AA02', clinpgx_id: 'PA449456', navn: 'enalapril', samsvar: 'navn' },
  { side: 'Eplerenon', fest_id: 'ID_D76A9CFA-D219-430B-AD5F-255A9BB6949A', virkestoff: 'Eplerenon', engelsk: 'Eplerenone', atc: 'C03DA04', clinpgx_id: 'PA164749044', navn: 'eplerenone', samsvar: 'navn' },
  { side: 'Furosemid', fest_id: 'ID_966A96B7-BC79-4152-A555-4C76A2391920', virkestoff: 'Furosemid', engelsk: 'Furosemide', atc: 'C03CA01', clinpgx_id: 'PA449719', navn: 'furosemide', samsvar: 'navn' },
  { side: 'Hydroklortiazid', fest_id: 'ID_605B1311-43E9-45BC-83D7-828D4F53C523', virkestoff: 'Hydroklortiazid', engelsk: 'Hydrochlorothiazide', atc: 'C03AA03', clinpgx_id: 'PA449899', navn: 'hydrochlorothiazide', samsvar: 'navn' },
  { side: 'Irbesartan', fest_id: 'ID_BBC7FCDA-3571-4325-B576-645784F29DC1', virkestoff: 'Irbesartan', engelsk: 'Irbesartan', atc: 'C09CA04', clinpgx_id: 'PA450084', navn: 'irbesartan', samsvar: 'navn' },
  { side: 'Kandesartan', fest_id: 'ID_05B987BF-55BC-4935-9578-9A5AA725B430', virkestoff: 'Kandesartancileksetil', engelsk: 'Candesartan cilexetil', atc: 'C09CA06', identifikatorer: { rxnorm: '214354' }, clinpgx_id: 'PA448765', navn: 'candesartan', samsvar: 'synonym', merknad: 'FEST har forløperen kandesartancileksetil; «Candesartan cilexetil» er synonym for candesartan i ClinPGx.' },
  { side: 'Karvedilol', fest_id: 'ID_646B1EE5-9372-48A6-8E68-2B7C290289CD', virkestoff: 'Karvedilol', engelsk: 'Carvedilol', atc: 'C07AG02', clinpgx_id: 'PA448817', navn: 'carvedilol', samsvar: 'navn' },
  { side: 'Labetalol', fest_id: 'ID_1AAC4109-128E-4D4C-B251-23E462DD1B7D', virkestoff: 'Labetalol', engelsk: 'Labetalol', atc: 'C07AG01', clinpgx_id: 'PA164743150', navn: 'labetalol', samsvar: 'navn' },
  { side: 'Lerkanidipin', fest_id: 'ID_A164C4B8-7BD0-4408-97AE-16E10A14250C', virkestoff: 'Lerkanidipin', engelsk: 'Lercanidipine', atc: 'C08CA13', clinpgx_id: 'PA164769058', navn: 'lercanidipine', samsvar: 'navn' },
  { side: 'Lisinopril', fest_id: 'ID_DCB94A58-2AD7-40B6-A515-7EE19E299F09', virkestoff: 'Lisinopril', engelsk: 'Lisinopril', atc: 'C09AA03', clinpgx_id: 'PA450242', navn: 'lisinopril', samsvar: 'navn' },
  { side: 'Losartan', fest_id: 'ID_A3ED2C34-50C9-46E7-9482-5E5B55E2BBC0', virkestoff: 'Losartan', engelsk: 'Losartan', atc: 'C09CA01', clinpgx_id: 'PA450268', navn: 'losartan', samsvar: 'navn' },
  { side: 'Metoprolol', fest_id: 'ID_F1A5819E-781F-4ADA-92F6-B009B48750A5', virkestoff: 'Metoprolol', engelsk: 'Metoprolol', atc: 'C07AB02', clinpgx_id: 'PA450480', navn: 'metoprolol', samsvar: 'navn' },
  { side: 'Nifedipin', fest_id: 'ID_D2B69C47-BEFE-4345-B4E7-D59049EF41DD', virkestoff: 'Nifedipin', engelsk: 'Nifedipine', atc: 'C08CA05', clinpgx_id: 'PA450631', navn: 'nifedipine', samsvar: 'navn' },
  { side: 'Ramipril', fest_id: 'ID_C9D2BF2D-A0F8-46EC-9861-FE58536C8A41', virkestoff: 'Ramipril', engelsk: 'Ramipril', atc: 'C09AA05', clinpgx_id: 'PA451223', navn: 'ramipril', samsvar: 'navn' },
  { side: 'Spironolakton', fest_id: 'ID_6F33B108-8842-4D25-9746-6397759275CA', virkestoff: 'Spironolakton', engelsk: 'Spironolactone', atc: 'C03DA01', clinpgx_id: 'PA451483', navn: 'spironolactone', samsvar: 'navn' },
  { side: 'Telmisartan', fest_id: 'ID_D4F3353B-CA8D-442D-86DF-C3052BFB4C7F', virkestoff: 'Telmisartan', engelsk: 'Telmisartan', atc: 'C09CA07', clinpgx_id: 'PA451605', navn: 'telmisartan', samsvar: 'navn' },
  { side: 'Valsartan', fest_id: 'ID_90CC1E37-24DD-496F-A7F5-D9B8B816E900', virkestoff: 'Valsartan', engelsk: 'Valsartan', atc: 'C09CA03', clinpgx_id: 'PA451848', navn: 'valsartan', samsvar: 'navn' },
  { side: 'Verapamil', fest_id: 'ID_DB91861C-E102-47D6-8ED7-F0C118195F67', virkestoff: 'Verapamil', engelsk: 'Verapamil', atc: 'C08DA01', clinpgx_id: 'PA451868', navn: 'verapamil', samsvar: 'navn' },
]

/**
 * Hver import av koblinger, i rekkefølge, med navnet migrasjonen fikk.
 * `festkrav` sier om migrasjonen krever at siden er koblet til virkestoffet i
 * FEST. Den andre gjør ikke det: FEST-koblingene til flere av sidene er ikke
 * laget med en migrasjon i repoet, og koblingene hviler på identifikatorer i
 * andre registre.
 */
export const CLINPGXKOBLINGSIMPORTER: readonly { migrasjon: string; koblinger: readonly Clinpgxkobling[]; festkrav: boolean }[] = [
  { migrasjon: 'stoffsider_clinpgx_kobling', koblinger: STOFFSIDE_CLINPGXKOBLINGER, festkrav: true },
  { migrasjon: 'stoffsider_clinpgx_dekning', koblinger: DEKNINGSKOBLINGER, festkrav: false },
  { migrasjon: 'ghb_ketamin_clinpgx_kobling', koblinger: GHB_KETAMIN_CLINPGXKOBLINGER, festkrav: true },
  { migrasjon: 'antihypertensiver_clinpgx_kobling', koblinger: ANTIHYPERTENSIV_CLINPGXKOBLINGER, festkrav: true },
]

/** Alle koblingene fra importene, i rekkefølge. */
export const ALLE_CLINPGXKOBLINGER: readonly Clinpgxkobling[] = CLINPGXKOBLINGSIMPORTER.flatMap((i) => i.koblinger)

/** Kilden revisjonene får i historikken. */
export const CLINPGXKOBLINGSKILDE = 'Koblet til kjemikaliet i ClinPGx'

const SAMSVARTEKST: Record<Samsvar, string> = {
  navn: 'Samme navn',
  synonym: 'Engelsk navn er synonym i ClinPGx',
  skrivemåte: 'Annen skrivemåte',
}

const IDENTIFIKATORNAVN: Record<keyof Identifikatorer, string> = { rxnorm: 'RxNorm', pubchem: 'PubChem', chebi: 'ChEBI', inchikey: 'InChIKey' }

/** De uavhengige kjennetegnene utenom navnet som stemmer: ATC-koden og identifikatorene. */
export function kjennetegn(k: Clinpgxkobling): string[] {
  const identifikatorer = Object.entries(k.identifikatorer ?? {}) as [keyof Identifikatorer, string][]
  return [...(k.atc ? [`ATC ${k.atc}`] : []), ...identifikatorer.map(([register, id]) => `${IDENTIFIKATORNAVN[register]} ${id}`)]
}

/** Hvorfor koblingen er trygg, i én linje: ATC-koden, identifikatorene og det andre som stemmer. */
export function koblingsgrunnlagstekst(k: Clinpgxkobling): string {
  const identifikatorer = kjennetegn(k).filter((t) => !t.startsWith('ATC '))
  return [
    ...(k.atc ? [k.atc_clinpgx ? `ATC-kode ${k.atc} i FEST, ${k.atc_clinpgx} i ClinPGx.` : `Samme ATC-kode (${k.atc}).`] : []),
    ...(identifikatorer.length ? [`Samme ${identifikatorer.join(' og ')}.`] : []),
    `${SAMSVARTEKST[k.samsvar]}${k.merknad ? `: ${k.merknad}` : '.'}`,
  ].join(' ')
}

/**
 * SQL-en som legger inn koblingene, som administratoren `admin`, publisert:
 * ett kort per side, med kjemikaliene i den rekkefølgen de står. Med
 * `festkrav` tas et kjemikalie bare med når den publiserte siden er koblet
 * til virkestoffet det hører til i FEST; uten tas alle med, fordi koblingene
 * alt er kontrollert mot identifikatorer i andre registre. Den hopper over — med en melding — en side som ikke
 * finnes, som alt har en ClinPGx-kobling (også i et utkast, så en redaksjonell
 * kobling aldri overskrives), eller som ikke har noen av virkestoffene, så den
 * kan kjøres igjen uten å gjøre noe. Uten administratoren gjør den ingenting,
 * som i testdatabasen.
 */
export function clinpgxkoblingSql(koblinger: readonly Clinpgxkobling[], admin: string, festkrav = true): string {
  const rader = koblinger
    .map((k, i) => `      (${lit(k.side)}, ${k.fest_id === null ? 'null' : lit(k.fest_id)}, ${lit(k.clinpgx_id)}, ${lit(k.navn)}, ${i})`)
    .join(',\n')
  const festvilkar = festkrav
    ? `
      where exists (
        select 1
        from public.innholdselementer e,
             jsonb_array_elements(case when jsonb_typeof(e.data -> 'virkestoff') = 'array' then e.data -> 'virkestoff' else '[]' end) v
        where e.infoside_id = side
          and e.tilstand = 'publisert'
          and e.elementtype = ${lit(ELEMENTTYPER.legemiddelkobling)}
          and e.panel <> 'fjernet'
          and v ->> 'fest_id' = c.kandidat ->> 'fest_id'
      )`
    : ''
  return `-- Stoffsidene kobles til kjemikaliene i ClinPGx
do $kobling$
declare
  administrator uuid;
  k record;
  side uuid;
  kjemikalier jsonb;
  status public.objektstatus;
begin
${innlogging(admin, 'hopp over')}
  perform set_config('far.revisjonskilde', ${lit(CLINPGXKOBLINGSKILDE)}, true);

  for k in
    select t.side,
           jsonb_agg(jsonb_build_object('fest_id', t.fest_id, 'clinpgx_id', t.clinpgx_id, 'navn', t.navn) order by t.nr) as kandidater
    from (values
${rader}
    ) as t(side, fest_id, clinpgx_id, navn, nr)
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
      where e.infoside_id = side and e.elementtype = ${lit(ELEMENTTYPER.clinpgxkobling)} and e.panel <> 'fjernet'
    ) then
      raise notice '% er alt koblet til ClinPGx, så den hoppes over.', k.side;
      continue;
    end if;
    kjemikalier := (
      select jsonb_agg(jsonb_build_object('clinpgx_id', c.kandidat ->> 'clinpgx_id', 'navn', c.kandidat ->> 'navn') order by c.nr)
      from jsonb_array_elements(k.kandidater) with ordinality as c(kandidat, nr)${festvilkar}
    );
    if coalesce(jsonb_array_length(kjemikalier), 0) < jsonb_array_length(k.kandidater) then
      raise notice '% er ikke koblet til alle virkestoffene % i FEST.', k.side, k.kandidater;
    end if;
    if kjemikalier is null then
      raise notice '% er ikke koblet til noen av virkestoffene i FEST, så den hoppes over.', k.side;
      continue;
    end if;

    status := public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side,
      'panel', ${lit(FARMAKOGENETIKKPANEL)},
      'posisjon', 0,
      'elementtype', ${lit(ELEMENTTYPER.clinpgxkobling)},
      'data', jsonb_build_object('kjemikalier', kjemikalier)
    ));
    perform public.publiser_utkast(status.id, status.revisjon);
  end loop;
end
$kobling$;`
}
