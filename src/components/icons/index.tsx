/**
 * Ikonene appen bruker, tegnet for hånd i et 32×32-rutenett.
 *
 * De vises i store størrelser, så de tåler — og bruker — flere detaljer enn et
 * typisk 16 px-ikonsett: piler har en grenselinje som viser hva de peker forbi,
 * og telefonen har ringebuer. Alle arver farge fra teksten via `currentColor`.
 */
import { Icon, type IconProps } from './Icon'

export { Icon }
export type { IconProps }

/** Under referanseområdet: pil som peker ned forbi den nedre grenselinjen. */
export function ArrowDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M16 4v17" />
      <path d="M9 14.5 16 21.5 23 14.5" />
      <path d="M6 27.5h20" opacity="0.55" />
    </Icon>
  )
}

/** Innenfor referanseområdet: hake i en ring. */
export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="16" cy="16" r="12" opacity="0.55" />
      <path d="M10 16.5 14.4 21 22.5 11.5" />
    </Icon>
  )
}

/** Over referanseområdet: pil som peker opp forbi den øvre grenselinjen. */
export function ArrowUpIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M16 28V11" />
      <path d="M9 17.5 16 10.5 23 17.5" />
      <path d="M6 4.5h20" opacity="0.55" />
    </Icon>
  )
}

/** Ringegrense: telefonrør med ringebuer. */
export function PhoneIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8.5 5h4.2l2.1 5.2-2.6 2.1a15.5 15.5 0 0 0 7.5 7.5l2.1-2.6 5.2 2.1v4.2a2.5 2.5 0 0 1-2.7 2.5C15.6 25.2 6.8 16.4 6 6.7A2.5 2.5 0 0 1 8.5 5Z" />
      <path d="M21 3.5a9 9 0 0 1 7.5 7.5" opacity="0.6" />
      <path d="M20 8.5a4.5 4.5 0 0 1 3.5 3.5" opacity="0.6" />
    </Icon>
  )
}

/** Nullstill: pil rundt i en sirkel, mot klokka. */
export function ResetIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.7 20a12 12 0 1 0 2.8-12.5L1.3 13.3" />
      <path d="M1.3 5.3v8h8" />
    </Icon>
  )
}

/** Tilbake: pil mot venstre. */
export function BackIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M27 16H6" />
      <path d="M15 25 6 16l9-9" />
    </Icon>
  )
}

/** Kopier: to ark som ligger delvis oppå hverandre. */
export function CopyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="12" y="12" width="17" height="17" rx="3" />
      <path d="M7 20H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3v1" />
    </Icon>
  )
}

/** Lim inn: utklippstavle med en pil som peker ned i den. */
export function PasteIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M11 5H8a2.5 2.5 0 0 0-2.5 2.5v18A2.5 2.5 0 0 0 8 28h16a2.5 2.5 0 0 0 2.5-2.5v-18A2.5 2.5 0 0 0 24 5h-3" />
      <rect x="11" y="2.5" width="10" height="5.5" rx="1.8" />
      <path d="M16 13.5v8" />
      <path d="M12.5 18 16 21.5 19.5 18" />
    </Icon>
  )
}

/** Ferdig: hake i en avrundet firkant. */
export function DoneIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="3.5" width="25" height="25" rx="7" opacity="0.55" />
      <path d="M10 16.5 14.4 21 22.5 11.5" />
    </Icon>
  )
}

/** Søk: forstørrelsesglass. */
export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="14" cy="14" r="9.5" />
      <path d="M21 21l7.5 7.5" />
    </Icon>
  )
}

/** Lyst tema. */
export function SunIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="16" cy="16" r="6.5" />
      <path d="M16 2v4M16 26v4M30 16h-4M6 16H2M25.9 6.1l-2.8 2.8M8.9 23.1l-2.8 2.8M25.9 25.9l-2.8-2.8M8.9 8.9 6.1 6.1" />
    </Icon>
  )
}

/** Mørkt tema. */
export function MoonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M27 19.5A12 12 0 0 1 12.5 5 12 12 0 1 0 27 19.5Z" />
    </Icon>
  )
}

/** Hurtigtaster: en tast med et tegn på. */
export function KeyboardIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="6.5" width="27" height="19" rx="3.5" />
      <path d="M8 12h.02M14 12h.02M20 12h.02M26 12h.02" />
      <path d="M8 17h.02M14 17h.02M20 17h.02M26 17h.02" />
      <path d="M10.5 21.5h11" />
    </Icon>
  )
}
