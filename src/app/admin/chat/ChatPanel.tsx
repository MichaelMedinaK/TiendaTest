'use client';

import { ArrowLeft, Send } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useRef, useState, useTransition } from 'react';

import { type ChatContact, type ChatMessageView, getChatState, sendChatMessage } from '@/actions/chat';
import { FeedbackMessage } from '@/components/ui/FeedbackMessage';
import { INPUT_CLASS, PRIMARY_BUTTON_CLASS } from '@/components/ui/styles';
import { CHAT_READ_EVENT } from '@/lib/constants';
import { formatDateTime, formatUserLabel } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/labels';

const POLL_INTERVAL_MS = 5000;
const CONNECTION_ERROR = 'No se pudo actualizar el chat. Revisa tu conexion a internet';
const PANEL_CLASS = 'rounded-xl border border-slate-200 bg-white shadow-sm';

function roleText(contact: ChatContact): string {
  return contact.isCourier && contact.role !== 'COURIER' ? `${ROLE_LABELS[contact.role]} + Domiciliario` : ROLE_LABELS[contact.role];
}

export function ChatPanel({ initialContacts }: { initialContacts: ChatContact[] }) {
  const [contacts, setContacts] = useState(initialContacts);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSending, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);

  const selected = contacts.find((contact) => contact.id === selectedId) ?? null;

  // `isCurrent` descarta la respuesta si mientras tanto se cambio de conversacion.
  const refresh = useCallback(async (contactId: string | null, isCurrent: () => boolean) => {
    try {
      const result = await getChatState(contactId);

      if (!isCurrent()) {
        return;
      }

      if (!result.success) {
        setErrorMessage(result.error);
        return;
      }

      setErrorMessage(null);
      setContacts(result.data.contacts);
      setMessages(result.data.messages);

      if (result.data.markedRead > 0) {
        window.dispatchEvent(new Event(CHAT_READ_EVENT));
      }
    } catch {
      if (isCurrent()) {
        setErrorMessage(CONNECTION_ERROR);
      }
    }
  }, []);

  useEffect(() => {
    let isCurrent = true;
    const tick = () => {
      if (!document.hidden) {
        void refresh(selectedId, () => isCurrent);
      }
    };

    tick();
    const interval = window.setInterval(tick, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', tick);

    return () => {
      isCurrent = false;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [selectedId, refresh]);

  useEffect(() => {
    const list = listRef.current;

    if (list) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messages.length, selectedId]);

  const selectContact = (contactId: string | null) => {
    setSelectedId(contactId);
    setMessages([]);
    setErrorMessage(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedId) {
      return;
    }

    const form = event.currentTarget;
    const body = String(new FormData(form).get('body') ?? '');
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const result = await sendChatMessage(selectedId, body);

        if (!result.success) {
          setErrorMessage(result.error);
          return;
        }

        form.reset();
        await refresh(selectedId, () => true);
      } catch {
        setErrorMessage(CONNECTION_ERROR);
      }
    });
  };

  return (
    <div className="space-y-3">
      {errorMessage && <FeedbackMessage tone="error" message={errorMessage} />}

      <div className="grid gap-4 md:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className={`${PANEL_CLASS} p-2 ${selected ? 'hidden md:block' : ''}`}>
          {contacts.length === 0 ? (
            <p className="p-3 text-sm text-slate-500">No hay otros usuarios activos con quien chatear.</p>
          ) : (
            <ul className="space-y-1">
              {contacts.map((contact) => (
                <li key={contact.id}>
                  <button
                    type="button"
                    onClick={() => selectContact(contact.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition ${
                      contact.id === selectedId ? 'bg-brand-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900">{formatUserLabel(contact)}</span>
                      <span className="block truncate text-xs text-slate-500">{roleText(contact)}</span>
                    </span>
                    {contact.unreadCount > 0 && (
                      <span className="shrink-0 rounded-full bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white">
                        {contact.unreadCount}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className={`${PANEL_CLASS} flex-col ${selected ? 'flex' : 'hidden md:flex'}`}>
          {selected ? (
            <>
              <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
                <button
                  type="button"
                  aria-label="Volver a los contactos"
                  onClick={() => selectContact(null)}
                  className="rounded-lg p-1 text-slate-600 hover:bg-slate-100 md:hidden"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{formatUserLabel(selected)}</p>
                  <p className="truncate text-xs text-slate-500">{roleText(selected)}</p>
                </div>
              </div>

              <div ref={listRef} className="flex h-[50vh] flex-col gap-2 overflow-y-auto px-4 py-3">
                {messages.length === 0 && (
                  <p className="m-auto text-sm text-slate-500">Todavia no hay mensajes. Escribe el primero.</p>
                )}
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.isMine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                        message.isMine ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-900'
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{message.body}</p>
                      <p className={`mt-1 text-[10px] ${message.isMine ? 'text-white/70' : 'text-slate-500'}`}>
                        {formatDateTime(new Date(message.createdAt))}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="flex gap-2 border-t border-slate-200 p-3">
                <input
                  name="body"
                  required
                  maxLength={1000}
                  autoComplete="off"
                  placeholder="Escribe un mensaje..."
                  aria-label="Mensaje"
                  className={INPUT_CLASS}
                />
                <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={isSending}>
                  <Send className="h-4 w-4" />
                  Enviar
                </button>
              </form>
            </>
          ) : (
            <p className="p-6 text-sm text-slate-500">Elige con quien quieres hablar.</p>
          )}
        </div>
      </div>
    </div>
  );
}
