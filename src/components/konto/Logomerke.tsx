/**
 * OUSFAR-merket: en førsteordens konsentrasjonskurve med halveringstiden
 * markert, i en avrundet firkant (fra Atlas, `assets/logo/`).
 *
 * Tegnet med tokens i stedet for faste farger, så det samme merket følger
 * temaet. Det er pynt ved siden av ordmerket, og skjult for skjermlesere.
 */
export function Logomerke() {
  return (
    <svg className="logomerke" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <rect className="logomerke__flate" width="48" height="48" rx="11" />
      <path className="logomerke__akse" d="M11 9.5V37.5H39.5" />
      <path className="logomerke__hjelpelinje" d="M11 24H18.2V37.5" />
      <path className="logomerke__kurve" d="M11 11L15 19.3L19 25L23 28.8L27 31.4L31 33.2L35 34.4L39 35.2" />
      <circle className="logomerke__punkt" cx="18.2" cy="24" r="3" />
    </svg>
  )
}
