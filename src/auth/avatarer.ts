/**
 * Signerte lenker til profilbildene.
 *
 * Bøtta er privat, så et bilde kan ikke vises med en fast adresse. Lenkene
 * hentes for alle bildene som trengs på én gang, og på nytt når noen har
 * byttet bilde — `updated_at` er det som sier fra om det.
 */
import { useEffect, useState } from 'react'
import type { Profil } from '@delt/profil'
import { AVATARLENKE_LEVETID, signerteAvatarer } from './api'

/**
 * Når lenkene hentes på nytt. Godt innenfor levetiden, slik at et bilde aldri
 * blir stående brutt i en fane som har stått åpen lenge.
 */
const FORNYES_ETTER = AVATARLENKE_LEVETID * 0.75 * 1000

type Bildebærer = Pick<Profil, 'avatar_path' | 'updated_at'>

export function useAvatarlenker(profiler: Bildebærer[]): Map<string, string> {
  const [lenker, setLenker] = useState<Map<string, string>>(new Map())
  /** Økes når lenkene skal fornyes. */
  const [runde, setRunde] = useState(0)

  // Nøkkelen er stiene og tidspunktene de sist ble endret. Den endrer seg
  // bare når det faktisk er noe nytt å hente.
  const noekkel = profiler
    .filter((profil) => profil.avatar_path)
    .map((profil) => `${profil.avatar_path}@${profil.updated_at}`)
    .sort()
    .join('|')

  useEffect(() => {
    if (noekkel === '') {
      setLenker(new Map())
      return
    }
    let gjelder = true
    const stier = noekkel.split('|').map((oppf) => oppf.slice(0, oppf.lastIndexOf('@')))
    void signerteAvatarer(stier)
      .catch(() => new Map<string, string>())
      .then((hentet) => {
        if (gjelder) setLenker(hentet)
      })
    return () => {
      gjelder = false
    }
  }, [noekkel, runde])

  useEffect(() => {
    if (noekkel === '') return
    const klokke = window.setInterval(() => setRunde((forrige) => forrige + 1), FORNYES_ETTER)
    return () => window.clearInterval(klokke)
  }, [noekkel])

  return lenker
}
