/// <reference types="vite/client" />

/**
 * Innstillingene appen leses med i nettleseren. Begge er offentlige: URL-en
 * til Supabase-prosjektet og den publiserbare nøkkelen. Hemmelige nøkler skal
 * aldri ligge i `VITE_`-variabler — de ville blitt med i bygget.
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
