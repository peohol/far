/** Hvor lenge en fagside ligger i papirkurven før den slettes for godt (`rydd_stoffpapirkurven`). */
export const PAPIRKURVDAGER = 30

/** Når en fagside som ble lagt i papirkurven `iso`, slettes for godt: «1. november». */
export function slettesForGodt(iso: string): string {
  const dato = new Date(iso)
  dato.setDate(dato.getDate() + PAPIRKURVDAGER)
  return dato.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' })
}
