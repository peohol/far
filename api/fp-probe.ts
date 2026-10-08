// Midlertidig utforskning av Farmakologiportalen fra arn1 (grenen slettes, slås aldri sammen).
// Bare verten www.farmakologiportalen.no; én side per kall.
export async function GET(request: Request): Promise<Response> {
  const sti = new URL(request.url).searchParams.get('sti') ?? '/'
  const url = new URL(sti, 'https://www.farmakologiportalen.no')
  if (url.hostname !== 'www.farmakologiportalen.no') return new Response('nei', { status: 400 })
  const r = await fetch(url, {
    headers: { 'user-agent': 'OUSFAR-datasynk/1.0 (+https://github.com/peohol/far)', accept: request.headers.get('x-accept') ?? '*/*' },
    redirect: 'manual',
  })
  const tekst = await r.text()
  return Response.json({ status: r.status, headers: Object.fromEntries(r.headers), tekst })
}
