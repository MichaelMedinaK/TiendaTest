'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { getUnreadChatCount } from '@/actions/chat';
import { CHAT_READ_EVENT } from '@/lib/constants';

const POLL_INTERVAL_MS = 30000;

/** Mensajes de chat sin leer del usuario; se actualiza al navegar, cada tanto y cuando se leen mensajes. */
export function useUnreadChatCount(enabled: boolean): number {
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let isCurrent = true;
    const refresh = async () => {
      if (document.hidden) {
        return;
      }

      try {
        const result = await getUnreadChatCount();

        if (isCurrent && result.success) {
          setCount(result.data);
        }
      } catch {
        // Sin conexion: se conserva el ultimo valor y se reintenta en el siguiente ciclo.
      }
    };

    void refresh();
    const interval = window.setInterval(refresh, POLL_INTERVAL_MS);
    window.addEventListener(CHAT_READ_EVENT, refresh);

    return () => {
      isCurrent = false;
      window.clearInterval(interval);
      window.removeEventListener(CHAT_READ_EVENT, refresh);
    };
  }, [enabled, pathname]);

  return count;
}
