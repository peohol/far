// Midlertidig tilgangsprobe (fjernes). Henter noen få offentlige sider én gang.
export async function GET(): Promise<Response> {
  const urler = [
    'https://www.farmakologiportalen.no/robots.txt',
    'https://www.farmakologiportalen.no/farma/basisarkforanalyse?archetypeId=648',
    'https://www.farmakologiportalen.no/farma/search/autocomplete?type=substances',
  ]
  const ut: unknown[] = []
  for (const url of urler) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'OUSFAR-datasynk/1.0 (+https://github.com/peohol/far)' } })
      const tekst = await r.text()
      ut.push({ url, status: r.status, lengde: tekst.length, start: tekst.slice(0, 1500) })
    } catch (e) {
      ut.push({ url, feil: String(e) })
    }
  }
  return Response.json({ region: process.env.VERCEL_REGION, ut })
}
