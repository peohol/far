// Midlertidig utforskning av Farmakologiportalen fra arn1 (grenen slettes, slås aldri sammen).
// Bare farmakologiportalen.no; høyst 12 sider per kall, én om gangen.
export async function GET(request: Request): Promise<Response> {
  const p = new URL(request.url).searchParams
  const stier = (p.get('stier') ?? '/').split('|').slice(0, 12)
  const maks = Number(p.get('maks') ?? 800)
  const ut: unknown[] = []
  for (const sti of stier) {
    const url = new URL(sti, 'https://www.farmakologiportalen.no')
    if (!(url.hostname === 'farmakologiportalen.no' || url.hostname.endsWith('.farmakologiportalen.no'))) continue
    try {
      const r = await fetch(url, {
        headers: {
          'user-agent': p.get('ua') ?? 'OUSFAR-datasynk/1.0 (+https://github.com/peohol/far)',
          accept: p.get('accept') ?? 'text/html,application/json;q=0.9,*/*;q=0.8',
          'accept-language': 'nb-NO,nb;q=0.9,no;q=0.8,en;q=0.5',
        },
        redirect: 'manual',
      })
      const tekst = await r.text()
      ut.push({ url: url.href, status: r.status, type: r.headers.get('content-type'), location: r.headers.get('location'), lengde: tekst.length, tekst: tekst.slice(0, maks) })
    } catch (e) {
      ut.push({ url: url.href, feil: String(e) })
    }
    await new Promise((l) => setTimeout(l, 400))
  }
  return Response.json(ut)
}
