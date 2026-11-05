import { getChatState } from '@/actions/chat';
import { FeedbackMessage } from '@/components/ui/FeedbackMessage';
import { CHAT_MESSAGE_TTL_HOURS } from '@/lib/constants';

import { ChatPanel } from './ChatPanel';

export const dynamic = 'force-dynamic';

export default async function ChatPage() {
  const result = await getChatState(null);

  if (!result.success) {
    return <FeedbackMessage tone="error" message={result.error} />;
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Chat</h1>
        <p className="text-sm text-slate-500">
          Conversaciones temporales entre usuarios: los mensajes se borran solos a las {CHAT_MESSAGE_TTL_HOURS} horas
        </p>
      </header>

      <ChatPanel initialContacts={result.data.contacts} />
    </section>
  );
}
