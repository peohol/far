/**
 * Autoerstatt i rikteksteditoren (TipTap/ProseMirror).
 *
 * Når et skrevet tegn gjør at teksten foran markøren ender på en regels
 * `finn`, byttes det med `erstatt` i samme steg. Tilbaketasten rett etterpå
 * setter tilbake det som ble skrevet, som i tekstbehandlere — da står for
 * eksempel «--» når det var det som var ment.
 */
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { finnRegel, MAKS_LENGDE, type Autoerstattregel, type Erstatning } from './regler'

/** Holder den siste erstatningen til neste endring, så den kan angres. */
const NOKKEL = new PluginKey<Erstatning | null>('autoerstatt')

/** Står for noder som ikke er tekst (som en sitering), så de aldri passer i en regel. */
const IKKE_TEKST = '￼'

export interface AutoerstattValg {
  /** Reglene som gjelder nå. En funksjon, så regler som kommer senere, også brukes. */
  regler: () => readonly Autoerstattregel[]
}

export const Autoerstatt = Extension.create<AutoerstattValg>({
  name: 'autoerstatt',

  addOptions() {
    return { regler: () => [] }
  },

  addProseMirrorPlugins() {
    const { regler } = this.options
    return [
      new Plugin<Erstatning | null>({
        key: NOKKEL,
        state: {
          init: () => null,
          apply(tr, forrige) {
            const ny = tr.getMeta(NOKKEL) as Erstatning | null | undefined
            if (ny !== undefined) return ny
            return tr.docChanged || tr.selectionSet ? null : forrige
          },
        },
        props: {
          handleTextInput(view, fra, til, tekst) {
            if (view.composing) return false
            const $fra = view.state.doc.resolve(fra)
            // Kode skal stå nøyaktig slik den skrives.
            if (!$fra.parent.isTextblock || $fra.parent.type.spec.code) return false
            if ((view.state.storedMarks ?? $fra.marks()).some((m) => m.type.spec.code)) return false
            const foran = $fra.parent.textBetween(
              Math.max(0, $fra.parentOffset - MAKS_LENGDE),
              $fra.parentOffset,
              undefined,
              IKKE_TEKST,
            )
            const regel = finnRegel(foran + tekst, regler())
            if (!regel) return false
            // Det av `finn` som alt står foran markøren, byttes sammen med det som
            // skrives. Kommer flere tegn på én gang (som fra autokorrektur), blir
            // det foran `finn` stående.
            const start = fra - Math.max(0, regel.finn.length - tekst.length)
            const forst = tekst.slice(0, Math.max(0, tekst.length - regel.finn.length))
            const erstatning: Erstatning = {
              fra: start + forst.length,
              til: start + forst.length + regel.erstatt.length,
              original: view.state.doc.textBetween(start, fra) + tekst.slice(forst.length),
            }
            view.dispatch(view.state.tr.insertText(forst + regel.erstatt, start, til).setMeta(NOKKEL, erstatning))
            return true
          },
          handleKeyDown(view, hendelse) {
            if (hendelse.key !== 'Backspace' || hendelse.ctrlKey || hendelse.metaKey || hendelse.altKey || hendelse.shiftKey) return false
            const sist = NOKKEL.getState(view.state)
            const { selection } = view.state
            if (!sist || !selection.empty || selection.from !== sist.til) return false
            view.dispatch(view.state.tr.insertText(sist.original, sist.fra, sist.til).setMeta(NOKKEL, null))
            return true
          },
        },
      }),
    ]
  },
})
