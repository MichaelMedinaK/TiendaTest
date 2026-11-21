import { redirect } from 'next/navigation';

import { LOGIN_ROUTE } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import { ROLE_HOME_ROUTE } from '@/lib/permissions';
import { getCurrentSession } from '@/lib/session';
import { readSettings, SETTING_DEFINITIONS, SETTING_KEYS } from '@/lib/settings';

import { type SettingField, SettingsForm } from './SettingsForm';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect(LOGIN_ROUTE);
  }

  // El middleware ya lo restringe; la accion de guardar vuelve a validar el rol contra la base.
  if (session.role !== 'ADMIN') {
    redirect(ROLE_HOME_ROUTE[session.role]);
  }

  const settings = await readSettings();
  const fields: SettingField[] = SETTING_KEYS.map((key) => ({
    key,
    label: SETTING_DEFINITIONS[key].label,
    description: SETTING_DEFINITIONS[key].description,
    defaultValue: SETTING_DEFINITIONS[key].defaultValue,
    value: settings[key].value,
    source: settings[key].source,
    updatedAt: settings[key].updatedAt ? formatDateTime(settings[key].updatedAt) : null,
    updatedBy: settings[key].updatedBy,
  }));

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">Configurar parametros</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Valores de la tienda que se usan al calcular las ventas</p>
      </header>

      <SettingsForm fields={fields} />
    </section>
  );
}
