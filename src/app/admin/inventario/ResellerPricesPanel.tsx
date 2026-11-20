'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState, useTransition } from 'react';

import {
  type ResellerOption,
  type ResellerPriceList,
  type ResellerPriceRow,
  getResellerPriceList,
  setResellerCost,
} from '@/actions/pricing';
import { FeedbackMessage } from '@/components/ui/FeedbackMessage';
import { useFeedback } from '@/components/ui/FeedbackProvider';
import {
  CARD_CLASS,
  INPUT_CLASS,
  LABEL_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_CELL_CLASS,
  TABLE_CLASS,
  TABLE_HEAD_CELL_CLASS,
} from '@/components/ui/styles';
import { formatCurrency, formatProductLabel, formatUserLabel } from '@/lib/format';

/** El tendero fija lo que paga cada revendedor por producto; el revendedor despues vende al precio que quiera. */
export function ResellerPricesPanel({ resellers }: { resellers: ResellerOption[] }) {
  const [resellerId, setResellerId] = useState(resellers[0]?.id ?? '');
  const [priceList, setPriceList] = useState<ResellerPriceList | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!resellerId) {
      return;
    }

    let isCurrent = true;
    setPriceList(null);
    setErrorMessage(null);

    getResellerPriceList(resellerId).then((result) => {
      if (!isCurrent) {
        return;
      }

      if (result.success) {
        setPriceList(result.data);
      } else {
        setErrorMessage(result.error);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [resellerId]);

  if (resellers.length === 0) {
    return (
      <div className={CARD_CLASS}>
        <FeedbackMessage tone="error" message="Todavia no tienes revendedores. El administrador los asigna en Usuarios" />
      </div>
    );
  }

  return (
    <div className={`${CARD_CLASS} space-y-4`}>
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Costos de mis revendedores</h2>
        <p className="text-sm text-slate-500">
          Lo que paga cada revendedor por unidad. Sin costo fijado paga tu precio de venta del catalogo.
        </p>
      </div>

      <div className="max-w-xs">
        <label className={LABEL_CLASS} htmlFor="reseller-costs-select">
          Revendedor
        </label>
        <select
          id="reseller-costs-select"
          className={INPUT_CLASS}
          value={resellerId}
          onChange={(event) => setResellerId(event.target.value)}
        >
          {resellers.map((reseller) => (
            <option key={reseller.id} value={reseller.id}>
              {formatUserLabel(reseller)}
            </option>
          ))}
        </select>
      </div>

      {errorMessage && <FeedbackMessage tone="error" message={errorMessage} />}
      {!errorMessage && !priceList && <p className="text-sm text-slate-500">Cargando precios...</p>}

      {priceList &&
        (priceList.rows.length === 0 ? (
          <p className="text-sm text-slate-500">No tienes productos en tu inventario para fijar costos.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={TABLE_CLASS}>
              <thead>
                <tr>
                  <th className={TABLE_HEAD_CELL_CLASS}>Producto</th>
                  <th className={TABLE_HEAD_CELL_CLASS}>Su stock</th>
                  <th className={TABLE_HEAD_CELL_CLASS}>Mi precio</th>
                  <th className={TABLE_HEAD_CELL_CLASS}>Costo para el revendedor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {priceList.rows.map((row) => (
                  <CostRow key={`${priceList.reseller.id}-${row.productId}`} resellerId={priceList.reseller.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
}

function CostRow({ resellerId, row }: { resellerId: string; row: ResellerPriceRow }) {
  const router = useRouter();
  const feedback = useFeedback();
  const [isPending, startTransition] = useTransition();

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const costPrice = String(new FormData(event.currentTarget).get('costPrice') ?? '');

    startTransition(async () => {
      const result = await setResellerCost(resellerId, row.productId, costPrice);

      if (!result.success) {
        feedback.error(result.error);
        return;
      }

      feedback.success(
        result.data.costPrice === null
          ? `"${row.name}": sin costo propio`
          : `"${row.name}": costo ${formatCurrency(result.data.costPrice)}`,
      );
      router.refresh();
    });
  };

  return (
    <tr>
      <td className={TABLE_CELL_CLASS}>{formatProductLabel(row)}</td>
      <td className={TABLE_CELL_CLASS}>{row.resellerStock}</td>
      <td className={TABLE_CELL_CLASS}>{formatCurrency(row.referencePrice)}</td>
      <td className={TABLE_CELL_CLASS}>
        <form onSubmit={handleSave} className="flex items-center gap-2">
          <input
            name="costPrice"
            type="number"
            min={0}
            step="any"
            defaultValue={row.costPrice ?? ''}
            aria-label={`Costo de ${row.name}`}
            placeholder="Sin costo"
            className={`${INPUT_CLASS} w-32 py-1.5`}
          />
          <button type="submit" className={SECONDARY_BUTTON_CLASS} disabled={isPending}>
            {isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </form>
      </td>
    </tr>
  );
}
