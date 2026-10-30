'use client';

import { usePathname, useRouter } from 'next/navigation';

import type { InventoryOwner } from '@/actions/products';
import { INPUT_CLASS, LABEL_CLASS } from '@/components/ui/styles';
import { formatUserLabel } from '@/lib/format';

interface OwnerSelectProps {
  owners: InventoryOwner[];
  /** Id del usuario elegido, o `ALL` para todos. */
  value: string;
  /** Agrega la opcion "Todos los inventarios". */
  includeAll?: boolean;
  label?: string;
}

/** Selector de inventario/vendedor: navega a la misma pagina con `?duenio=`. Solo se muestra al administrador. */
export function OwnerSelect({ owners, value, includeAll = false, label = 'Inventario de' }: OwnerSelectProps) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="max-w-xs">
      <label className={LABEL_CLASS} htmlFor="owner-select">
        {label}
      </label>
      <select
        id="owner-select"
        className={INPUT_CLASS}
        value={value}
        onChange={(event) => router.push(`${pathname}?duenio=${encodeURIComponent(event.target.value)}`)}
      >
        {includeAll && <option value="ALL">Todos los inventarios</option>}
        {owners.map((owner) => (
          <option key={owner.id} value={owner.id}>
            {formatUserLabel(owner)}
          </option>
        ))}
      </select>
    </div>
  );
}
