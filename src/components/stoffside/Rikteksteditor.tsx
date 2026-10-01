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
import StarterKit from '@tiptap/starter-kit'
import { Fragment, useId, useState, type ReactNode } from 'react'
import { kortnavn } from '../../faginnhold/referanser'
import {
  MERKER,
  NODER,
  OVERSKRIFTSELEMENT,
  OVERSKRIFTSNIVAER,
  erTrygLenke,
  overskriftsniva,
  rensDokument,
  type Riktekstdokument,
} from '../../faginnhold/riktekst'
import { Button } from '../Button'
import { Ikon } from '../ikon/Ikon'
import { Referansevelger } from './Referansevelger'
import { useRedigering } from './Redigeringskontekst'

/**
 * Den begrensede rikteksteditoren for faginnholdet.
 *
 * Bygget på TipTap (ProseMirror), som i Slaids. Bare formateringen planen
 * nevner, er slått på: fet, kursiv, understreking, senket og hevet skrift,
 * overskrifter i to nivåer, punktlister, nummererte lister, skillelinjer,
 * lenker, symboler og referanser. Sitater, kode, farger, fontstørrelse og
 * justering finnes ikke, så teksten alltid ser lik ut.
 *
 * Referansene settes inn som siteringsnoder med referanse-ID-ene — aldri med
 * numre. I editoren vises de med forfatter og år; numrene regnes ut når siden
 * vises.
 *
 * Tastene er de vanlige: Ctrl + B, I og U for fet, kursiv og understreket,
 * Ctrl + , og Ctrl + . for senket og hevet skrift, Ctrl + Alt + 1 og 2 for
 * overskriftene, og Tab/Shift + Tab for å rykke inn i lister.
 */

/** Tegnene som kan settes inn fra symbolmenyen. */
export const SYMBOLER = ['µ', '±', '≤', '≥', '≈', '×', '→', '↑', '↓', '°', 'α', 'β', 'γ', 'Δ', '½', '‰', '–']

/**
 * Overskriftene, med de samme elementene som i lesemodus (se
 * `OVERSKRIFTSELEMENT`), så en overskrift som kopieres fra appen, blir samme
 * nivå når den limes inn. Overskrifter limt inn fra andre steder som `h1` og
 * `h2`, blir nivå 1 og 2.
 */
const Overskrift = Heading.extend({
  parseHTML() {
    return OVERSKRIFTSNIVAER.flatMap((level) => [
      { tag: OVERSKRIFTSELEMENT[level], attrs: { level } },
      { tag: `h${level}`, attrs: { level } },
    ])
  },
  renderHTML({ node, HTMLAttributes }) {
    return [OVERSKRIFTSELEMENT[overskriftsniva(node.attrs)], mergeAttributes(HTMLAttributes), 0]
  },
}).configure({ levels: [...OVERSKRIFTSNIVAER] })

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

export interface RikteksteditorProps {
  dokument: Riktekstdokument
  onEndre: (dokument: Riktekstdokument) => void
  /** Navnet på feltet for skjermlesere, f.eks. «Farmakodynamikk». */
  etikett: string
  /**
   * Med referansesystemet (standard): siteringer kan settes inn. Uten, som i
   * idéene, er verktøyraden bare formateringen.
   */
  referanser?: boolean
  /** Markøren står i teksten når editoren åpnes. */
  autofokus?: boolean
  /** Lavere tekstfelt, til korte tekster som kommentarer. */
  kompakt?: boolean
  /**
   * Teksten er det skjemaet i et modalt lag handler om: den tar resten av
   * høyden og ruller selv, så verktøyraden, feltene over og knappene under
   * blir stående (se `.modallag__fyll`).
   */
  fyll?: boolean
}

type Verktoypanel = 'lenke' | 'symbol' | 'referanse' | null

export function Rikteksteditor({
  dokument,
  onEndre,
  etikett,
  referanser = true,
  autofokus = false,
  kompakt = false,
  fyll = false,
}: RikteksteditorProps) {
  const [panel, setPanel] = useState<Verktoypanel>(null)
  const editor = useEditor({
    autofocus: autofokus ? 'end' : false,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        code: false,
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
      Overskrift,
      Subscript,
      Superscript,
      ...(referanser ? [Sitering] : []),
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
      <Verktoylinje editor={editor} panel={panel} onPanel={setPanel} etikett={etikett} referanser={referanser} />
      {panel === 'lenke' && <Lenkepanel editor={editor} onLukk={() => setPanel(null)} />}
      {panel === 'symbol' && <Symbolpanel editor={editor} onLukk={() => setPanel(null)} />}
      {panel === 'referanse' && <Siteringspanel editor={editor} onLukk={() => setPanel(null)} />}
      <EditorContent editor={editor} className={fyll ? 'rikteksteditor__tekst modallag__fyll' : 'rikteksteditor__tekst'} />
    </div>
  )
}

interface Formatknapp {
  navn: string
  merke: string
  /** Merket vises med formateringen det setter, som «B» i fet. */
  stil?: 'fet' | 'kursiv' | 'understreket'
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
    { navn: 'Sett inn skillelinje', merke: '―', utfor: (e) => e.chain().focus().setHorizontalRule().run() },
  ],
]

const FORMATKNAPPER = FORMATGRUPPER.flat()

function Verktoylinje({
  editor,
  panel,
  onPanel,
  etikett,
  referanser,
}: {
  editor: Editor
  panel: Verktoypanel
  onPanel: (p: Verktoypanel) => void
  etikett: string
  referanser: boolean
}) {
  // Knappene viser hva som står på der markøren er, og tegnes på nytt når det endres.
  const aktive = useEditorState({
    editor,
    selector: ({ editor: e }) => FORMATKNAPPER.map((k) => k.aktiv?.(e)).concat(e.isActive(MERKER.lenke)),
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
      <Verktoyknapp navn="Sett inn symbol" apner={panel === 'symbol'} onClick={() => veksle('symbol')}>
        Ω
      </Verktoyknapp>
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
  onClick,
  children,
}: {
  navn: string
  tast?: string | undefined
  stil?: Formatknapp['stil'] | 'referanse' | undefined
  aktiv?: boolean | undefined
  /** Satt for knappene som åpner et panel under raden. */
  apner?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={stil ? `verktoyrad__knapp verktoyrad__knapp--${stil}` : 'verktoyrad__knapp'}
      aria-label={navn}
      title={navn}
      {...(aktiv !== undefined && { 'aria-pressed': aktiv })}
      {...(apner !== undefined && { 'aria-expanded': apner })}
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

function Symbolpanel({ editor, onLukk }: { editor: Editor; onLukk: () => void }) {
  return (
    <div className="verktoypanel symbolpanel" role="group" aria-label="Symboler">
      {SYMBOLER.map((symbol) => (
        <button
          key={symbol}
          type="button"
          className="verktoyrad__knapp"
          aria-label={`Sett inn ${symbol}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            editor.chain().focus().insertContent(symbol).run()
            onLukk()
          }}
        >
          {symbol}
        </button>
      ))}
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
