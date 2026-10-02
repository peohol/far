import { ANDRE_STOFFER_ID, type Stoffregister } from '../../domain/stoffregister'

/**
 * Kategoriene og underkategoriene som valg i en `<select>`: én gruppe per
 * kategori, med kategorien selv først — «(uten underkategori)» når den er delt
 * opp — og så underkategoriene. `opptatt` er de som ikke kan velges.
 */
export function Kategorialternativer({
  register,
  opptatt,
}: {
  register: Stoffregister
  opptatt?: ReadonlySet<string>
}) {
  return (
    <>
      {register.inndeling
        .filter((k) => k.id !== ANDRE_STOFFER_ID)
        .map((k) => (
          <optgroup key={k.id} label={k.navn}>
            <option value={k.id} disabled={opptatt?.has(k.id)}>
              {k.underkategorier.length > 0 ? `${k.navn} (uten underkategori)` : k.navn}
            </option>
            {k.underkategorier.map((u) => (
              <option key={u.id} value={u.id} disabled={opptatt?.has(u.id)}>
                {u.navn}
              </option>
            ))}
          </optgroup>
        ))}
    </>
  )
}
