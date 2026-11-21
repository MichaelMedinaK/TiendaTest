import 'server-only';

import { Prisma } from '@prisma/client';

import { prisma } from './prisma';

/** Parametros editables desde el panel. Cada clave coincide con la variable de entorno que la respalda. */
export const SETTING_DEFINITIONS = {
  DELIVERY_MIN_PRICE: {
    label: 'Precio minimo del delivery',
    description: 'Si kilometros x tarifa queda por debajo, el envio cobra este valor.',
    defaultValue: 8,
  },
  DELIVERY_RATE_PER_KM: {
    label: 'Tarifa por kilometro',
    description: 'El envio se calcula como kilometros x esta tarifa, redondeado hacia arriba.',
    defaultValue: 1.7,
  },
} as const;

export type SettingKey = keyof typeof SETTING_DEFINITIONS;

/** De donde sale el valor vigente: guardado en el panel, variable de entorno o valor por defecto del codigo. */
export type SettingSource = 'panel' | 'env' | 'default';

export interface ResolvedSetting {
  value: number;
  source: SettingSource;
  updatedAt: Date | null;
  updatedBy: string | null;
}

export const SETTING_KEYS = Object.keys(SETTING_DEFINITIONS) as SettingKey[];

export function isSettingKey(key: string): key is SettingKey {
  return key in SETTING_DEFINITIONS;
}

/** La tabla aun no se creo (falta `db push`): P2021 de Prisma. */
export function isMissingSettingsTable(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021';
}

const toPositiveNumber = (value: string | undefined | null): number | null => {
  const parsed = Number(value);
  return value?.trim() && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

/** Valor vigente de cada parametro: panel > variable de entorno > valor por defecto. */
export async function readSettings(): Promise<Record<SettingKey, ResolvedSetting>> {
  let rows: { key: string; value: string; updatedAt: Date; updatedBy: { name: string | null; email: string } | null }[] = [];

  try {
    rows = await prisma.setting.findMany({
      where: { key: { in: SETTING_KEYS } },
      select: { key: true, value: true, updatedAt: true, updatedBy: { select: { name: true, email: true } } },
    });
  } catch (error) {
    // Sin la tabla la tienda sigue funcionando con las variables de entorno, como antes del panel.
    if (!isMissingSettingsTable(error)) {
      throw error;
    }
  }

  const stored = new Map(rows.map((row) => [row.key, row]));

  return Object.fromEntries(
    SETTING_KEYS.map((key) => {
      const row = stored.get(key);
      const panelValue = toPositiveNumber(row?.value);

      if (row && panelValue !== null) {
        const updatedBy = row.updatedBy ? row.updatedBy.name?.trim() || row.updatedBy.email : null;
        return [key, { value: panelValue, source: 'panel', updatedAt: row.updatedAt, updatedBy }];
      }

      const envValue = toPositiveNumber(process.env[key]);
      const resolved: ResolvedSetting =
        envValue !== null
          ? { value: envValue, source: 'env', updatedAt: null, updatedBy: null }
          : { value: SETTING_DEFINITIONS[key].defaultValue, source: 'default', updatedAt: null, updatedBy: null };

      return [key, resolved];
    }),
  ) as Record<SettingKey, ResolvedSetting>;
}
