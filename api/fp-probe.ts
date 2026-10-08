// Midlertidig utforskning av Farmakologiportalen fra arn1 (grenen slettes, slås aldri sammen).
// Bare verten www.farmakologiportalen.no; én side per kall.
export async function GET(request: Request): Promise<Response> {
  const sti = new URL(request.url).searchParams.get('sti') ?? '/'
  const url = new URL(sti, 'https://www.farmakologiportalen.no')
  const tillatt = url.hostname === 'farmakologiportalen.no' || url.hostname.endsWith('.farmakologiportalen.no')
  if (!tillatt) return new Response('nei', { status: 400 })
  const r = await fetch(url, {
    headers: {
      'user-agent': new URL(request.url).searchParams.get('ua') ?? 'OUSFAR-datasynk/1.0 (+https://github.com/peohol/far)',
      accept: new URL(request.url).searchParams.get('accept') ?? 'text/html,application/json;q=0.9,*/*;q=0.8',
      'accept-language': 'nb-NO,nb;q=0.9,no;q=0.8,en;q=0.5',
    },
    redirect: 'manual',
  })
  const tekst = await r.text()
  return Response.json({ status: r.status, headers: Object.fromEntries(r.headers), tekst })
}
