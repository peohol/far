import type { SVGProps } from 'react'

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  /** Størrelse i px. Ikonene er tegnet for å tåle store visninger. */
  size?: number | string
}

/**
 * Felles ramme for alle ikonene i appen.
 *
 * Alt tegnes i et 32×32-rutenett med `currentColor`, slik at ikonene arver
 * farge og kontrast fra teksten de står sammen med. Strekbredden er satt i
 * CSS-variabelen `--ikon-strek` så den kan justeres ett sted.
 */
export function Icon({ size = '1em', children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      className="ikon"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="var(--ikon-strek, 2)"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}
