import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { KLINISK_PAKKE } from './src/auth/vegg'

export default defineConfig({
  plugins: [react()],
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
