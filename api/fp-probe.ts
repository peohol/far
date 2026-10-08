// Midlertidig utforskning av Farmakologiportalen fra arn1 (grenen slettes, slås aldri sammen).
// Bare farmakologiportalen.no; høyst 12 sider per kall, én om gangen.
// vis=lenker: unike href/src; vis=tekst: teksten uten merking; grep=<regex>: utdrag rundt treff.
export async function GET(request: Request): Promise<Response> {
  const p = new URL(request.url).searchParams
  const stier = (p.get('stier') ?? '/').split('|').slice(0, 12)
  const maks = Number(p.get('maks') ?? 800)
  const fra = Number(p.get('fra') ?? 0)
  const vis = p.get('vis') ?? 'raa'
  const grep = p.get('grep')
  const ut: unknown[] = []
  for (const sti of stier) {
    const url = new URL(sti, 'https://farmakologiportalen.no')
    if (!(url.hostname === 'farmakologiportalen.no' || url.hostname.endsWith('.farmakologiportalen.no'))) continue
    try {
      const r = await fetch(url, {
        method: p.get('metode') ?? 'GET',
        headers: {
          'user-agent': 'OUSFAR-datasynk/1.0 (+https://github.com/peohol/far)',
          accept: p.get('accept') ?? 'text/html,application/json;q=0.9,*/*;q=0.8',
          'accept-language': 'nb-NO,nb;q=0.9,no;q=0.8,en;q=0.5',
          ...(p.get('ctype') ? { 'content-type': p.get('ctype')! } : {}),
        },
        body: p.get('body') ?? undefined,
        redirect: p.get('folg') ? 'follow' : 'manual',
      })
      const raa = await r.text()
      let tekst: unknown
      if (vis === 'lenker') {
        tekst = [...new Set([...raa.matchAll(/(?:href|src|action|data-[a-z-]+)=["']([^"']+)["']/g)].map((m) => m[1]))]
      } else if (vis === 'tekst') {
        tekst = raa
          .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<(\/?(?:tr|p|div|h\d|li|br|table|section))[^>]*>/gi, '\n')
          .replace(/<[^>]+>/g, ' ')
          .replace(/[ \t]+/g, ' ')
          .replace(/\n\s*\n+/g, '\n')
          .slice(fra, fra + maks)
      } else {
        tekst = raa.slice(fra, fra + maks)
      }
      const treff = grep
        ? [...raa.matchAll(new RegExp(grep, 'gi'))].slice(0, 40).map((m) => raa.slice(Math.max(0, m.index! - 200), m.index! + 300))
        : undefined
      ut.push({ url: url.href, status: r.status, type: r.headers.get('content-type'), location: r.headers.get('location'), lengde: raa.length, tekst, treff })
    } catch (e) {
      ut.push({ url: url.href, feil: String(e) })
    }
    await new Promise((l) => setTimeout(l, 500))
  }
  return Response.json(ut)
}
