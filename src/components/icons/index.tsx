/**
 * De navngitte ikonene appen har brukt siden før Atlas.
 *
 * De fleste tegnes nå av Atlas-registeret (`src/components/ikon/`), så hele
 * appen får samme ikonspråk uten at hver komponent må skrives om. Ny kode
 * bruker `<Ikon navn="…" />` direkte. De få som ennå ikke har et Atlas-ikon,
 * står igjen som strekikoner i et 32×32-rutenett med `currentColor`.
 */
import { Ikon } from '../ikon/Ikon'
import type { Ikonnavn } from '../ikon/register'
import { Icon, type IconProps } from './Icon'

export { Icon }
export type { IconProps }

/** Et gammelt ikonnavn som tegnes av Atlas-registeret. */
function atlas(navn: Ikonnavn) {
  return function AtlasIkon({ size, ...rest }: IconProps) {
    return <Ikon navn={navn} storrelse={size} {...rest} />
  }
}

/** Under referanseområdet. */
export const ArrowDownIcon = atlas('bUnder')

/** Innenfor referanseområdet. */
export const CheckIcon = atlas('bInnenfor')

/** Over referanseområdet. */
export const ArrowUpIcon = atlas('bOver')

/** Cut-off. */
export const CutoffIcon = atlas('cutoff')

/** Ring rekvirenten. */
export const PhoneIcon = atlas('phone')

/** Nullstill. */
export const ResetIcon = atlas('reset')

/** Tilbake. */
export const BackIcon = atlas('back')

/** Kopier. */
export const CopyIcon = atlas('copy')

/** Lim inn. */
export const PasteIcon = atlas('paste')

/** Søk. */
export const SearchIcon = atlas('search')

/** Lyst tema. */
export const SunIcon = atlas('sun')

/** Mørkt tema. */
export const MoonIcon = atlas('moon')

/** Sidemenyen. */
export const MenuIcon = atlas('menu')

/** Lukk. */
export const CloseIcon = atlas('close')

/** Hurtigtaster. */
export const KeyboardIcon = atlas('keys')

/** Konto. */
export const UserIcon = atlas('user')

/** Logg ut. */
export const LogoutIcon = atlas('logout')

/** Administrator. */
export const ShieldIcon = atlas('shield')

/** Legg til. */
export const PlusIcon = atlas('plus')

/** Brukerlista: to personer, den ene bak den andre. */
export function UsersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="13" cy="11.5" r="5.5" />
      <path d="M3 27.5a10 10 0 0 1 20 0" />
      <path d="M22 6.5a5.5 5.5 0 0 1 0 10.5" opacity="0.6" />
      <path d="M25 18.5a10 10 0 0 1 4 9" opacity="0.6" />
    </Icon>
  )
}

/** Profilbilde: ramme med en sol og en fjellrygg. */
export function ImageIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="6" width="24" height="20" rx="3" />
      <circle cx="11.5" cy="13" r="2.5" opacity="0.7" />
      <path d="M5 22.5 12 16l5.5 5 3.5-3 6 5.5" />
    </Icon>
  )
}

/** Roter bildet en kvart omdreining med klokka. */
export function RotateIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M27.3 20a12 12 0 1 1-2.8-12.5L30.7 13.3" />
      <path d="M30.7 5.3v8h-8" />
    </Icon>
  )
}
