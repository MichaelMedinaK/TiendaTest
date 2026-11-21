'use server';

import { revalidatePath } from 'next/cache';

import { executeAction } from '@/lib/action-runner';
import { ActionResult } from '@/lib/action-result';
import { ServiceUnavailableError, ValidationError } from '@/lib/errors';
import { roundToCents } from '@/lib/payments-view';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { isMissingSettingsTable, isSettingKey, SETTING_DEFINITIONS } from '@/lib/settings';
import { requirePositiveNumber } from '@/lib/validation';

// Vistas que muestran o usan la tarifa del delivery.
const SETTINGS_VIEWS = ['/admin/parametros', '/admin/ventas', '/admin/dashboard', '/admin/cotizar-envio'];

/** Guarda un parametro de la tienda. Solo aplica a ventas nuevas o editadas: las ya registradas conservan su envio. */
export async function updateSetting(key: string, value: string | number): Promise<ActionResult<{ key: string; value: number }>> {
  return executeAction('settings.updateSetting', async (trace) => {
    const session = await requireRole('ADMIN');

    if (!isSettingKey(key)) {
      throw new ValidationError(`El parametro "${key}" no existe`);
    }

    const parsedValue = roundToCents(requirePositiveNumber(value, SETTING_DEFINITIONS[key].label.toLowerCase()));
    trace.setBusinessId(key);

    try {
      await prisma.setting.upsert({
        where: { key },
        create: { key, value: String(parsedValue), updatedById: session.userId },
        update: { value: String(parsedValue), updatedById: session.userId },
      });
    } catch (error) {
      if (isMissingSettingsTable(error)) {
        throw new ServiceUnavailableError(
          'Falta crear la tabla de parametros en la base de datos. Ejecuta "npm run db:push" y luego "npm run db:rls"',
        );
      }

      throw error;
    }

    trace.addStep(`parametro-guardado:${parsedValue}`);
    SETTINGS_VIEWS.forEach((path) => revalidatePath(path));

    return { key, value: parsedValue };
  });
}
