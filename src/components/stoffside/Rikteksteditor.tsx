import { Node, mergeAttributes, type Editor } from '@tiptap/core'
import Heading from '@tiptap/extension-heading'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import {
  EditorContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditor,
  useEditorState,
  type NodeViewProps,
} from '@tiptap/react'
import { NodeSelection } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import { Fragment, useId, useRef, useState, type MouseEvent, type ReactNode, type Ref } from 'react'
import { useAutoerstattregler } from '../../autoerstatt/Autoerstattkilde'
import { Autoerstatt } from '../../autoerstatt/editor'
import {
  finnKonsentrasjoner,
  KONSENTRASJONSENHETER,
  lesKonsentrasjonsenhet,
  lesKonsentrasjonstall,
  visKonsentrasjon,
  type Tekstkonsentrasjon,
} from '../../enheter/konsentrasjon'
import { useMaleenhet } from '../../enheter/Maleenhet'
import { kortnavn } from '../../faginnhold/referanser'
import { FORBINDELSER } from '../../kjemi/forbindelser'
import {
  MERKER,
  NODER,
  OVERSKRIFTSATTRIBUTT,
  OVERSKRIFTSNIVAER,
  erTrygLenke,
  konsentrasjonstekst,
  overskriftselement,
  overskriftsniva,
  rensDokument,
  type Riktekstdokument,
} from '../../faginnhold/riktekst'
import { Button } from '../Button'
import { Direktelenkepanel } from '../direktelenker/Direktelenkepanel'
import { Lenkebrikkevisning } from '../direktelenker/Lenkebrikke'
import { Ikon } from '../ikon/Ikon'
import { lesKonsentrasjonsattrs, useKonsentrasjonskilde } from './Konsentrasjon'
import { useOverskriftsniva } from '../Overskriftsniva'
import { Referansevelger } from './Referansevelger'
import { Tegnmeny } from './Tegnmeny'
import { useRedigering } from './Redigeringskontekst'

/**
 * Den begrensede rikteksteditoren for faginnholdet.
 *
 * Bygget på TipTap (ProseMirror), som i Slaids. Bare formateringen planen
 * nevner, er slått på: fet, kursiv, understreking, senket og hevet skrift,
 * kode, overskrifter i to nivåer, sitater, punktlister, nummererte lister,
 * skillelinjer, lenker, spesialtegn, referanser, direktelenker og
 * konsentrasjoner. Kodeblokker, farger,
 * fontstørrelse og justering finnes ikke, så teksten alltid ser lik ut.
 *
 * Referansene settes inn som siteringsnoder med referanse-ID-ene — aldri med
 * numre. I editoren vises de med forfatter og år; numrene regnes ut når siden
 * vises. Konsentrasjonene står som i kilden; i lesemodus vises de i
 * måleenheten leseren har valgt.
 *
 * Tastene er de vanlige: Ctrl + B, I og U for fet, kursiv og understreket,
 * Ctrl + , og Ctrl + . for senket og hevet skrift, Ctrl + E for kode,
 * Ctrl + Alt + 1 og 2 for overskriftene, Ctrl + Shift + B for sitat, og
 * Tab/Shift + Tab for å rykke inn i lister.
 *
 * Autoerstatt-reglene (som « - » til « – ») gjelder mens det skrives, men
 * ikke i kode; se `src/autoerstatt/`.
 */

/**
 * Overskriftene, vist som i lesemodus: under den nærmeste overskriften rundt
 * editoren (`over`), med nivået i `data-niva`. En overskrift som kopieres fra
 * appen, beholder derfor nivået sitt når den limes inn; en `h1` fra et annet
 * sted blir nivå 1, og de andre blir nivå 2.
 */
function lagOverskrift(over: number) {
  return Heading.extend({
    parseHTML() {
      return [
        {
          tag: 'h1, h2, h3, h4, h5, h6',
          getAttrs: (element: HTMLElement) => {
            const lagret = element.getAttribute(OVERSKRIFTSATTRIBUTT)
            return { level: overskriftsniva({ level: lagret ?? (element.tagName === 'H1' ? 1 : 2) }) }
          },
        },
      ]
    },
    renderHTML({ node, HTMLAttributes }) {
      const niva = overskriftsniva(node.attrs)
      return [overskriftselement(over, niva), mergeAttributes(HTMLAttributes, { [OVERSKRIFTSATTRIBUTT]: niva }), 0]
    },
  }).configure({ levels: [...OVERSKRIFTSNIVAER] })
}

/** Et attributt på en node som står som `data-<navn>` i HTML-en editoren kopierer og limer inn. */
function dataattributt(navn: string, standard: string | null = null) {
  return {
    default: standard,
    parseHTML: (element: HTMLElement) => element.getAttribute(`data-${navn}`) ?? standard,
    renderHTML: (attrs: Record<string, unknown>) => (attrs[navn] ? { [`data-${navn}`]: String(attrs[navn]) } : {}),
  }
}

/** Siteringsnoden, med samme navn og form som referansesystemet leter etter. */
const Sitering = Node.create({
  name: NODER.sitering,
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      referanser: {
        default: [],
        parseHTML: (element: HTMLElement) => {
          try {
            const verdi: unknown = JSON.parse(element.getAttribute('data-referanser') ?? '[]')
            return Array.isArray(verdi) ? verdi.filter((v) => typeof v === 'string') : []
          } catch {
            return []
          }
        },
        renderHTML: (attrs: { referanser: string[] }) => ({ 'data-referanser': JSON.stringify(attrs.referanser) }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-sitering]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-sitering': '' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(Siteringsmerke)
  },
})

/** Siteringen slik den vises i editoren: forfatter og år for hver kilde. */
function Siteringsmerke({ node, selected }: NodeViewProps) {
  const { referansebase } = useRedigering()
  const ider = (node.attrs.referanser as string[]) ?? []
  const navn = ider.map((id) => {
    const referanse = referansebase.find((r) => r.id === id)
    return referanse ? kortnavn(referanse) : 'ukjent kilde'
  })
  return (
    <NodeViewWrapper
      as="span"
      className={`siteringsmerke${selected ? ' siteringsmerke--valgt' : ''}`}
      aria-label={`Referanse: ${navn.join('; ')}`}
    >
      {navn.join('; ')}
    </NodeViewWrapper>
  )
}

/**
 * En direktelenke i teksten, som en brikke (se `src/direktelenker/`): målet
 * (`slag`, `id`, `kommentar`) og navnet den fikk da den ble satt inn. Noden
 * står i alle editorene, så en brikke aldri forsvinner fra en tekst som
 * endres; knappen som setter den inn, bare der `direktelenker` er slått på.
 */
const Direktelenkenode = Node.create({
  name: NODER.direktelenke,
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      slag: dataattributt('slag'),
      id: dataattributt('id'),
      kommentar: dataattributt('kommentar'),
      etikett: dataattributt('etikett', ''),
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-direktelenke]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-direktelenke': '' }), String(node.attrs.etikett ?? '')]
  },

  renderText({ node }) {
    return String(node.attrs.etikett ?? '')
  },

  addNodeView() {
    return ReactNodeViewRenderer(Direktelenkemerke)
  },
})

function Direktelenkemerke({ node, selected }: NodeViewProps) {
  return (
    <NodeViewWrapper as="span" className="lenkebrikke-node">
      <Lenkebrikkevisning attrs={node.attrs} valgt={selected} />
    </NodeViewWrapper>
  )
}

/**
 * En konsentrasjon i teksten (`src/enheter/konsentrasjon.ts`): tallet og
 * enheten som i kilden, og forbindelsen som er målt. Står i alle editorene,
 * som direktelenkene; knappen som merker en, bare der referansene er slått på.
 */
const Konsentrasjonsnode = Node.create({
  name: NODER.konsentrasjon,
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return { verdi: dataattributt('verdi', ''), enhet: dataattributt('enhet', ''), forbindelse: dataattributt('forbindelse') }
  },

  parseHTML() {
    return [{ tag: 'span[data-konsentrasjon]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-konsentrasjon': '' }), konsentrasjonstekst(node.attrs)]
  },

  renderText({ node }) {
    return konsentrasjonstekst(node.attrs)
  },

  addNodeView() {
    return ReactNodeViewRenderer(Konsentrasjonsmerke)
  },
})

/** Navnet på forbindelsen med nøkkelen, eller nøkkelen når registeret ikke har den. */
function forbindelsesnavn(nokkel: string): string {
  return FORBINDELSER.finn(nokkel)?.navn ?? nokkel
}

/** Konsentrasjonen slik den står i editoren: som i kilden, merket som et tall som regnes om. */
function Konsentrasjonsmerke({ node, selected }: NodeViewProps) {
  const k = lesKonsentrasjonsattrs(node.attrs)
  const om = k.forbindelse ? forbindelsesnavn(k.forbindelse) : 'forbindelsen er ikke oppgitt'
  return (
    <NodeViewWrapper
      as="span"
      className={`konsentrasjon konsentrasjon--editor${selected ? ' konsentrasjon--valgt' : ''}`}
      // Omslaget setter `white-space: normal` på selve elementet; tallet og enheten skal ikke brytes.
      style={{ whiteSpace: 'nowrap' }}
      title={`Konsentrasjon (${om})`}
      aria-label={`Konsentrasjon: ${konsentrasjonstekst(node.attrs)} (${om})`}
    >
      {konsentrasjonstekst(node.attrs)}
    </NodeViewWrapper>
  )
}

export interface RikteksteditorProps {
  dokument: Riktekstdokument
  onEndre: (dokument: Riktekstdokument) => void
  /** Navnet på feltet for skjermlesere, f.eks. «Farmakodynamikk». */
  etikett: string
  /**
   * Med referansesystemet (standard): siteringer kan settes inn, og
   * konsentrasjoner merkes. Uten, som i idéene, er verktøyraden bare
   * formateringen.
   */
  referanser?: boolean
  /**
   * Knappen som setter inn en direktelenke til en diskusjon, en idé eller en
   * kommentar som en brikke, som i diskusjonene og idéene.
   */
  direktelenker?: boolean
  /** Markøren står i teksten når editoren åpnes. */
  autofokus?: boolean
  /** Lavere tekstfelt, til korte tekster som kommentarer. */
  kompakt?: boolean
}

type Verktoypanel = 'lenke' | 'referanse' | 'direktelenke' | 'konsentrasjon' | null

/** Tegnmenyen når den står åpen, og om den ble åpnet med tastaturet. */
type Tegnmenytilstand = { medTastatur: boolean } | null

export function Rikteksteditor({
  dokument,
  onEndre,
  etikett,
  referanser = true,
  direktelenker = false,
  autofokus = false,
  kompakt = false,
}: RikteksteditorProps) {
  const [panel, setPanel] = useState<Verktoypanel>(null)
  const [tegnmeny, setTegnmeny] = useState<Tegnmenytilstand>(null)
  const tegnknapp = useRef<HTMLButtonElement>(null)
  const over = useOverskriftsniva()
  const regler = useAutoerstattregler()
  const editor = useEditor({
    autofocus: autofokus ? 'end' : false,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        strike: false,
        trailingNode: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: 'https',
          isAllowedUri: (url) => erTrygLenke(url),
        },
      }),
      lagOverskrift(over),
      Subscript,
      Superscript,
      ...(referanser ? [Sitering] : []),
      Direktelenkenode,
      Konsentrasjonsnode,
      Autoerstatt.configure({ regler }),
    ],
    content: dokument,
    editorProps: {
      attributes: {
        class: kompakt ? 'riktekst riktekstfelt riktekstfelt--kompakt' : 'riktekst riktekstfelt',
        'aria-label': etikett,
        'aria-multiline': 'true',
        role: 'textbox',
      },
    },
    onUpdate: ({ editor: e }) => onEndre(rensDokument(e.getJSON())),
  })

  if (!editor) return null

  return (
    <div className="rikteksteditor">
      <Verktoylinje
        editor={editor}
        panel={panel}
        // Ett panel eller tegnmenyen av gangen.
        onPanel={(p) => {
          setTegnmeny(null)
          setPanel(p)
        }}
        tegnmenyApen={tegnmeny !== null}
        tegnknapp={tegnknapp}
        onTegnmeny={(medTastatur) => {
          setPanel(null)
          setTegnmeny(tegnmeny ? null : { medTastatur })
        }}
        etikett={etikett}
        referanser={referanser}
        direktelenker={direktelenker}
      />
      {tegnmeny && tegnknapp.current && (
        <Tegnmeny
          anker={tegnknapp.current}
          medTastatur={tegnmeny.medTastatur}
          onSett={(tegn, iTeksten) => (iTeksten ? editor.chain().focus() : editor.chain()).insertContent(tegn).run()}
          onLukk={(iMenyen) => {
            setTegnmeny(null)
            if (iMenyen) editor.commands.focus()
          }}
        />
      )}
      {panel === 'lenke' && <Lenkepanel editor={editor} onLukk={() => setPanel(null)} />}
      {panel === 'referanse' && <Siteringspanel editor={editor} onLukk={() => setPanel(null)} />}
      {panel === 'konsentrasjon' && <Konsentrasjonspanel editor={editor} onLukk={() => setPanel(null)} />}
      {panel === 'direktelenke' && (
        <Direktelenkepanel
          onLukk={() => {
            setPanel(null)
            editor.commands.focus()
          }}
          onSett={(maal, etikett) => {
            editor
              .chain()
              .focus()
              .insertContent([{ type: NODER.direktelenke, attrs: { ...maal.mal, etikett } }, { type: NODER.tekst, text: ' ' }])
              .run()
            setPanel(null)
          }}
        />
      )}
      <EditorContent editor={editor} className="rikteksteditor__tekst" />
    </div>
  )
}

interface Formatknapp {
  navn: string
  merke: string
  /** Merket vises med formateringen det setter, som «B» i fet. */
  stil?: 'fet' | 'kursiv' | 'understreket' | 'kode' | 'sitat'
  tast?: string
  /** Om formateringen står på der markøren er. Mangler for knapper som setter inn noe. */
  aktiv?: (e: Editor) => boolean
  utfor: (e: Editor) => void
}

/** Knappene i verktøyraden, i grupper med en skillestrek mellom. */
const FORMATGRUPPER: Formatknapp[][] = [
  [
    { navn: 'Fet', merke: 'B', stil: 'fet', tast: 'Control+B', aktiv: (e) => e.isActive(MERKER.fet), utfor: (e) => e.chain().focus().toggleBold().run() },
    { navn: 'Kursiv', merke: 'I', stil: 'kursiv', tast: 'Control+I', aktiv: (e) => e.isActive(MERKER.kursiv), utfor: (e) => e.chain().focus().toggleItalic().run() },
    { navn: 'Understreket', merke: 'U', stil: 'understreket', tast: 'Control+U', aktiv: (e) => e.isActive(MERKER.understreket), utfor: (e) => e.chain().focus().toggleUnderline().run() },
    { navn: 'Senket skrift', merke: 'x₂', tast: 'Control+,', aktiv: (e) => e.isActive(MERKER.senket), utfor: (e) => e.chain().focus().toggleSubscript().run() },
    { navn: 'Hevet skrift', merke: 'x²', tast: 'Control+.', aktiv: (e) => e.isActive(MERKER.hevet), utfor: (e) => e.chain().focus().toggleSuperscript().run() },
    { navn: 'Kode', merke: '</>', stil: 'kode', tast: 'Control+E', aktiv: (e) => e.isActive(MERKER.kode), utfor: (e) => e.chain().focus().toggleCode().run() },
  ],
  OVERSKRIFTSNIVAER.map((level) => ({
    navn: `Overskrift ${level}`,
    merke: `H${level}`,
    tast: `Control+Alt+${level}`,
    aktiv: (e: Editor) => e.isActive(NODER.overskrift, { level }),
    utfor: (e: Editor) => e.chain().focus().toggleHeading({ level }).run(),
  })),
  [
    { navn: 'Punktliste', merke: '•', aktiv: (e) => e.isActive(NODER.punktliste), utfor: (e) => e.chain().focus().toggleBulletList().run() },
    { navn: 'Nummerert liste', merke: '1.', aktiv: (e) => e.isActive(NODER.nummerertListe), utfor: (e) => e.chain().focus().toggleOrderedList().run() },
    { navn: 'Sitat', merke: '“', stil: 'sitat', tast: 'Control+Shift+B', aktiv: (e) => e.isActive(NODER.sitat), utfor: (e) => e.chain().focus().toggleBlockquote().run() },
    { navn: 'Sett inn skillelinje', merke: '―', utfor: (e) => e.chain().focus().setHorizontalRule().run() },
  ],
]

const FORMATKNAPPER = FORMATGRUPPER.flat()

function Verktoylinje({
  editor,
  panel,
  onPanel,
  tegnmenyApen,
  tegnknapp,
  onTegnmeny,
  etikett,
  referanser,
  direktelenker,
}: {
  editor: Editor
  panel: Verktoypanel
  onPanel: (p: Verktoypanel) => void
  tegnmenyApen: boolean
  tegnknapp: Ref<HTMLButtonElement>
  /** Åpner eller lukker tegnmenyen; `medTastatur` når knappen ble trykket med tastaturet. */
  onTegnmeny: (medTastatur: boolean) => void
  etikett: string
  referanser: boolean
  direktelenker: boolean
}) {
  // Knappene viser hva som står på der markøren er, og tegnes på nytt når det endres.
  const aktive = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      FORMATKNAPPER.map((k) => k.aktiv?.(e)).concat(e.isActive(MERKER.lenke), e.isActive(NODER.konsentrasjon)),
  })
  const veksle = (p: Exclude<Verktoypanel, null>) => onPanel(panel === p ? null : p)

  return (
    <div className="verktoyrad" role="toolbar" aria-label={`Formatering – ${etikett}`}>
      {FORMATGRUPPER.map((gruppe) => (
        <Fragment key={gruppe[0]?.navn}>
          {gruppe.map((knapp) => (
            <Verktoyknapp
              key={knapp.navn}
              navn={knapp.navn}
              tast={knapp.tast}
              stil={knapp.stil}
              aktiv={aktive[FORMATKNAPPER.indexOf(knapp)]}
              onClick={() => knapp.utfor(editor)}
            >
              {knapp.merke}
            </Verktoyknapp>
          ))}
          <span className="verktoyrad__skille" aria-hidden="true" />
        </Fragment>
      ))}
      <Verktoyknapp navn="Lenke" aktiv={aktive[FORMATKNAPPER.length] ?? false} apner={panel === 'lenke'} onClick={() => veksle('lenke')}>
        Lenke
      </Verktoyknapp>
      <Verktoyknapp
        navn="Sett inn spesialtegn"
        knappRef={tegnknapp}
        meny
        apner={tegnmenyApen}
        // Et tastetrykk gir et klikk uten detalj (0); da går fokus inn i menyen.
        onClick={(e) => onTegnmeny(e.detail === 0)}
      >
        Ω
      </Verktoyknapp>
      {direktelenker && (
        <Verktoyknapp
          navn="Sett inn direktelenke til en diskusjon, en idé eller en kommentar"
          stil="referanse"
          apner={panel === 'direktelenke'}
          onClick={() => veksle('direktelenke')}
        >
          <Ikon navn="lenke" storrelse="ui" />
          Direktelenke
        </Verktoyknapp>
      )}
      {referanser && (
        <Verktoyknapp
          navn="Merk en konsentrasjon som kan vises i andre enheter"
          stil="referanse"
          aktiv={aktive[FORMATKNAPPER.length + 1] ?? false}
          apner={panel === 'konsentrasjon'}
          onClick={() => veksle('konsentrasjon')}
        >
          <Ikon navn="serum" storrelse="ui" />
          Konsentrasjon
        </Verktoyknapp>
      )}
      {referanser && (
        <Verktoyknapp
          navn="Sett inn referanse"
          stil="referanse"
          apner={panel === 'referanse'}
          onClick={() => veksle('referanse')}
        >
          <Ikon navn="refs" storrelse="ui" />
          Referanse
        </Verktoyknapp>
      )}
    </div>
  )
}

function Verktoyknapp({
  navn,
  tast,
  stil,
  aktiv,
  apner,
  meny = false,
  knappRef,
  onClick,
  children,
}: {
  navn: string
  tast?: string | undefined
  stil?: Formatknapp['stil'] | 'referanse' | undefined
  aktiv?: boolean | undefined
  /** Satt for knappene som åpner et panel under raden. */
  apner?: boolean
  /** Knappen åpner en meny ved seg selv, ikke et panel under raden. */
  meny?: boolean
  knappRef?: Ref<HTMLButtonElement>
  onClick: (e: MouseEvent<HTMLButtonElement>) => void
  children: ReactNode
}) {
  return (
    <button
      ref={knappRef}
      type="button"
      className={stil ? `verktoyrad__knapp verktoyrad__knapp--${stil}` : 'verktoyrad__knapp'}
      aria-label={navn}
      title={navn}
      {...(aktiv !== undefined && { 'aria-pressed': aktiv })}
      {...(apner !== undefined && { 'aria-expanded': apner })}
      {...(meny && { 'aria-haspopup': 'dialog' as const })}
      {...(tast && { 'aria-keyshortcuts': tast })}
      // Markeringen i teksten skal ikke forsvinne av at knappen trykkes.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function Lenkepanel({ editor, onLukk }: { editor: Editor; onLukk: () => void }) {
  const id = useId()
  const [adresse, setAdresse] = useState<string>(() => String(editor.getAttributes(MERKER.lenke).href ?? ''))
  const [feil, setFeil] = useState<string | null>(null)

  const bruk = () => {
    const renset = adresse.trim()
    if (renset === '') {
      editor.chain().focus().extendMarkRange(MERKER.lenke).unsetLink().run()
      onLukk()
      return
    }
    if (!erTrygLenke(renset)) {
      setFeil('Lenken må være en nettadresse som begynner med http:// eller https://.')
      return
    }
    editor.chain().focus().extendMarkRange(MERKER.lenke).setLink({ href: renset }).run()
    onLukk()
  }

  return (
    <div className="verktoypanel" role="group" aria-label="Lenke">
      <label className="felt" htmlFor={id}>
        <span className="felt__merkelapp">Nettadresse (tom fjerner lenken)</span>
        <input
          id={id}
          className="felt__inndata"
          type="url"
          value={adresse}
          autoFocus
          placeholder="https://"
          onChange={(e) => setAdresse(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              bruk()
            }
          }}
        />
      </label>
      {feil && (
        <p className="skjemafeil" role="alert">
          {feil}
        </p>
      )}
      <div className="skjema__knapper">
        <Button variant="subtle" onClick={onLukk}>
          Avbryt
        </Button>
        <Button className="knapp--kompakt" onClick={bruk}>
          Bruk lenken
        </Button>
      </div>
    </div>
  )
}

function Siteringspanel({ editor, onLukk }: { editor: Editor; onLukk: () => void }) {
  const [ider, setIder] = useState<string[]>([])
  return (
    <div className="verktoypanel">
      <Referansevelger tittel="Referanser i teksten" valgte={ider} onEndre={setIder} />
      <div className="skjema__knapper">
        <Button variant="subtle" onClick={onLukk}>
          Avbryt
        </Button>
        <Button
          className="knapp--kompakt"
          disabled={ider.length === 0}
          onClick={() => {
            editor.chain().focus().insertContent({ type: NODER.sitering, attrs: { referanser: ider } }).run()
            onLukk()
          }}
        >
          Sett inn i teksten
        </Button>
      </div>
    </div>
  )
}

/** Skrivemåtene enhetsfeltet foreslår: OUSFARs og de vanligste per milliliter. */
const ENHETSFORSLAG = [...KONSENTRASJONSENHETER.map((d) => d.enhet), 'mg/mL', 'µg/mL', 'ng/mL']

/**
 * Konsentrasjonen som skal merkes: den valgte, når markøren står på en, eller
 * den markerte teksten når den er én konsentrasjon («50–200 nmol/L»).
 */
function konsentrasjonIUtvalget(editor: Editor): { attrs: Tekstkonsentrasjon; finnes: boolean } | null {
  const { selection, doc } = editor.state
  if (selection instanceof NodeSelection && selection.node.type.name === NODER.konsentrasjon) {
    return { attrs: lesKonsentrasjonsattrs(selection.node.attrs), finnes: true }
  }
  const tekst = doc.textBetween(selection.from, selection.to, ' ').trim()
  const [funn, ...flere] = finnKonsentrasjoner(tekst)
  if (!funn || flere.length > 0 || funn.start !== 0 || funn.slutt !== tekst.length) return null
  return { attrs: { verdi: funn.verdi, enhet: funn.enhet, forbindelse: null }, finnes: false }
}

/**
 * Merker en konsentrasjon: tallet og enheten nøyaktig som i kilden, og
 * forbindelsen som er målt, så tallet kan regnes om mellom masse og
 * stoffmengde. Forhåndsvisningen viser tallet i enheten brukeren har valgt.
 */
function Konsentrasjonspanel({ editor, onLukk }: { editor: Editor; onLukk: () => void }) {
  const id = useId()
  const { sideforbindelser, molvekter } = useKonsentrasjonskilde()
  const { enhet: valgt } = useMaleenhet()
  const [start] = useState(() => konsentrasjonIUtvalget(editor))
  const [verdi, setVerdi] = useState(start?.attrs.verdi ?? '')
  const [enhet, setEnhet] = useState(start?.attrs.enhet ?? '')
  // Har siden bare én forbindelse, er det den tallet mest sannsynlig gjelder.
  const [forbindelse, setForbindelse] = useState(
    start ? (start.attrs.forbindelse ?? '') : sideforbindelser.length === 1 ? sideforbindelser[0]!.nokkel : '',
  )
  const andre = FORBINDELSER.alle
    .filter((f) => !sideforbindelser.some((s) => s.nokkel === f.nokkel))
    .sort((a, b) => a.navn.localeCompare(b.navn, 'nb'))

  const tallFeil = verdi.trim() !== '' && !lesKonsentrasjonstall(verdi)
  const enhetFeil = enhet.trim() !== '' && !lesKonsentrasjonsenhet(enhet)
  const gyldig = verdi.trim() !== '' && enhet.trim() !== '' && !tallFeil && !enhetFeil
  const attrs: Tekstkonsentrasjon = { verdi: verdi.trim(), enhet: enhet.trim(), forbindelse: forbindelse || null }
  const molvekt = attrs.forbindelse ? molvekter.get(attrs.forbindelse) : undefined
  const vist = gyldig ? visKonsentrasjon(attrs, valgt, molvekt ? Number(molvekt) : null) : null

  const bruk = () => {
    if (!gyldig) return
    editor.chain().focus().insertContent({ type: NODER.konsentrasjon, attrs }).run()
    onLukk()
  }

  return (
    <div className="verktoypanel" role="group" aria-label="Konsentrasjon">
      <div className="konsentrasjonspanel__felt">
        <label className="felt" htmlFor={`${id}-verdi`}>
          <span className="felt__merkelapp">Tall eller område, som i kilden</span>
          <input
            id={`${id}-verdi`}
            className="felt__inndata"
            value={verdi}
            autoFocus
            placeholder="50–200"
            aria-invalid={tallFeil || undefined}
            onChange={(e) => setVerdi(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                bruk()
              }
            }}
          />
        </label>
        <label className="felt" htmlFor={`${id}-enhet`}>
          <span className="felt__merkelapp">Enhet, som i kilden</span>
          <input
            id={`${id}-enhet`}
            className="felt__inndata"
            value={enhet}
            list={`${id}-enheter`}
            placeholder="nmol/L"
            aria-invalid={enhetFeil || undefined}
            onChange={(e) => setEnhet(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                bruk()
              }
            }}
          />
          <datalist id={`${id}-enheter`}>
            {ENHETSFORSLAG.map((e) => (
              <option key={e} value={e} />
            ))}
          </datalist>
        </label>
        <label className="felt" htmlFor={`${id}-forbindelse`}>
          <span className="felt__merkelapp">Forbindelsen som er målt</span>
          <select
            id={`${id}-forbindelse`}
            className="felt__inndata"
            value={forbindelse}
            onChange={(e) => setForbindelse(e.target.value)}
          >
            <option value="">Ikke oppgitt (regnes bare om innen masse eller stoffmengde)</option>
            {sideforbindelser.length > 0 && (
              <optgroup label="På denne siden">
                {sideforbindelser.map((f) => (
                  <option key={f.nokkel} value={f.nokkel}>
                    {f.navn}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Andre forbindelser">
              {andre.map((f) => (
                <option key={f.nokkel} value={f.nokkel}>
                  {f.navn}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
      </div>
      {(tallFeil || enhetFeil) && (
        <p className="skjemafeil" role="alert">
          {tallFeil
            ? 'Tallet må være ett tall eller et område, som «50», «0,5–1,2» eller «< 0,05».'
            : 'Enheten må være masse eller stoffmengde per liter eller milliliter, som «µg/L», «ng/mL» eller «nmol/L».'}
        </p>
      )}
      {vist && (
        <p className="felt__hjelp">
          Vises for deg som {vist.tekst} {vist.enhet}
          {vist.somIKilden && ' (som i kilden: omregningen mellom masse og stoffmengde trenger forbindelsens molekylvekt)'}.
        </p>
      )}
      <div className="skjema__knapper">
        <Button variant="subtle" onClick={onLukk}>
          Avbryt
        </Button>
        {start?.finnes && (
          <Button
            variant="subtle"
            onClick={() => {
              editor.chain().focus().insertContent(konsentrasjonstekst(start.attrs)).run()
              onLukk()
            }}
          >
            Fjern merkingen
          </Button>
        )}
        <Button className="knapp--kompakt" disabled={!gyldig} onClick={bruk}>
          {start?.finnes ? 'Bruk' : 'Merk i teksten'}
        </Button>
      </div>
    </div>
  )
}
