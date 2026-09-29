import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { KLINISK_PAKKE } from './src/auth/vegg'
import { ENDRINGSLOGG } from './src/data/endringslogg'
import { nyesteVersjon } from './src/domain/versjon'
import { VERSJONSFIL, type Byggopplysninger } from './src/oppdatering/versjon'

/**
 * Identiteten til bygget, i appen som `__BYGG__` og i `versjon.json` ved siden
 * av `index.html`. Appen som kjører, spør etter fila og sier fra når et annet
 * bygg er lagt ut (`src/oppdatering/versjon.ts`). På Vercel er det commiten
 * bygget kommer fra; ellers tidspunktet, så hvert lokale bygg er nytt.
 */
function versjonsfil(): Plugin {
  const opplysninger: Byggopplysninger = {
    bygg: process.env.VERCEL_GIT_COMMIT_SHA || Date.now().toString(36),
    versjon: nyesteVersjon(ENDRINGSLOGG),
  }
  return {
    name: 'ousfar-versjonsfil',
    config: () => ({ define: { __BYGG__: JSON.stringify(opplysninger.bygg) } }),
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: VERSJONSFIL, source: JSON.stringify(opplysninger) })
    },
  }
}

export default defineConfig({
  plugins: [react(), versjonsfil()],
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        /**
         * Den kliniske delen av appen får et fast navn, slik at
         * innloggingsveggen på kanten kjenner den igjen. Hvilke moduler som
         * havner der, avgjør Rollup selv: alt som bare `App` trenger, følger
         * med den, mens det innloggingssiden også bruker, blir liggende igjen
         * utenfor veggen. `npm run build` kontrollerer at delingen ble riktig.
         */
        chunkFileNames: (pakke) =>
          pakke.facadeModuleId?.endsWith('/src/App.tsx')
            ? `assets/${KLINISK_PAKKE}-[hash].js`
            : 'assets/[name]-[hash].js',
        /**
         * Rikteksteditoren (TipTap og ProseMirror) er et stort bibliotek uten
         * noe faglig innhold, og får sin egen pakke i stedet for å gjøre den
         * kliniske tung. Det er bare kode fra `node_modules` her; kontrollen
         * av veggen slår ut om noe av vårt eget havner i den.
         */
        manualChunks: (id) =>
          /\/node_modules\/(@tiptap\/(?!react)|prosemirror-|orderedmap|rope-sequence|w3c-keyname|linkifyjs)/.test(id)
            ? 'riktekstbibliotek'
            : undefined,
      },
    },
  },
  resolve: {
    alias: {
      // Reglene for brukernavn, passord og profilfelter deles med
      // Edge-funksjonene. Kilden ligger hos funksjonene, som importerer den
      // med relativ sti; appen når den gjennom dette navnet.
      '@delt': fileURLToPath(new URL('./supabase/functions/_delt', import.meta.url)),
    },
  },
})
