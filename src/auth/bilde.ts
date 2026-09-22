/**
 * Profilbildet, gjort ferdig i nettleseren før det lastes opp.
 *
 * Brukeren flytter, zoomer og roterer; her settes resultatet sammen til én
 * kvadratisk WebP-fil på 512 × 512. At det skjer lokalt betyr at det aldri
 * lastes opp et større originalbilde enn det som faktisk skal lagres.
 */
import { AVATAR_STORRELSE } from '@delt/profil'

/** Utsnittet `react-easy-crop` gir, i piksler i det roterte bildet. */
export interface Beskjaering {
  x: number
  y: number
  width: number
  height: number
}

/** Kompresjon. Høyt nok til at ansikter holder seg skarpe i en liten sirkel. */
const KVALITET = 0.85

function lastBilde(kilde: string): Promise<HTMLImageElement> {
  return new Promise((løs, avvis) => {
    const bilde = new Image()
    bilde.addEventListener('load', () => løs(bilde))
    bilde.addEventListener('error', () => avvis(new Error('Bildet kunne ikke leses.')))
    bilde.src = kilde
  })
}

function lerret(bredde: number, høyde: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const flate = document.createElement('canvas')
  flate.width = Math.max(1, Math.round(bredde))
  flate.height = Math.max(1, Math.round(høyde))
  const tegner = flate.getContext('2d')
  if (!tegner) throw new Error('Nettleseren kunne ikke behandle bildet.')
  return [flate, tegner]
}

/**
 * Setter sammen det ferdige profilbildet.
 *
 * Bildet tegnes først rotert på en flate stor nok til å romme det skråstilte
 * bildet, slik at hjørnene ikke blir klippet bort. Deretter hentes utsnittet
 * ut og skaleres ned til den størrelsen vi lagrer.
 */
export async function lagAvatar(
  kilde: string,
  omraade: Beskjaering,
  rotasjon: number,
): Promise<Blob> {
  const bilde = await lastBilde(kilde)
  const radianer = (rotasjon * Math.PI) / 180
  const rotertBredde =
    Math.abs(Math.cos(radianer) * bilde.width) + Math.abs(Math.sin(radianer) * bilde.height)
  const rotertHøyde =
    Math.abs(Math.sin(radianer) * bilde.width) + Math.abs(Math.cos(radianer) * bilde.height)

  const [rotert, rotertTegner] = lerret(rotertBredde, rotertHøyde)
  rotertTegner.translate(rotert.width / 2, rotert.height / 2)
  rotertTegner.rotate(radianer)
  rotertTegner.drawImage(bilde, -bilde.width / 2, -bilde.height / 2)

  const [ferdig, ferdigTegner] = lerret(AVATAR_STORRELSE, AVATAR_STORRELSE)
  ferdigTegner.imageSmoothingQuality = 'high'
  ferdigTegner.drawImage(
    rotert,
    omraade.x,
    omraade.y,
    omraade.width,
    omraade.height,
    0,
    0,
    AVATAR_STORRELSE,
    AVATAR_STORRELSE,
  )

  return new Promise((løs, avvis) => {
    ferdig.toBlob(
      (blob) => (blob ? løs(blob) : avvis(new Error('Bildet kunne ikke lagres.'))),
      'image/webp',
      KVALITET,
    )
  })
}
