import { ArrowDownIcon, ArrowUpIcon, CheckIcon, PhoneIcon } from './icons'
import type { Band } from '../domain/bands'

const IKON = {
  under: ArrowDownIcon,
  innenfor: CheckIcon,
  over: ArrowUpIcon,
  ring: PhoneIcon,
} as const

/**
 * Ikonet båndet bæres av. Knappen i båndsteget og beviset over lim-inn-kortet
 * bruker det samme, så det går fram at det er den samme knappen som fulgte med
 * videre.
 */
export function bandIkon(band: Band) {
  return IKON[band.ring && band.niva !== 'over' ? 'ring' : band.tone]
}
