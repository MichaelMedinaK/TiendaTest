'use server';

import type { Role } from '@prisma/client';

import { executeAction } from '@/lib/action-runner';
import { ActionResult } from '@/lib/action-result';
import { CHAT_MESSAGE_TTL_HOURS } from '@/lib/constants';
import { UserNotFoundError, ValidationError } from '@/lib/errors';
import { formatUserLabel } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/session';
import { requireText } from '@/lib/validation';

const MAX_MESSAGE_LENGTH = 1000;
const MAX_MESSAGES_PER_CONVERSATION = 200;

export interface ChatContact {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  isCourier: boolean;
  unreadCount: number;
  /** Fecha del ultimo mensaje vigente con este usuario, o null si no hay conversacion. */
  lastMessageAt: Date | null;
}

export interface ChatMessageView {
  id: string;
  body: string;
  createdAt: Date;
  isMine: boolean;
}

export interface ChatState {
  contacts: ChatContact[];
  /** Mensajes con el contacto abierto, del mas antiguo al mas reciente (vacio si no hay ninguno abierto). */
  messages: ChatMessageView[];
  /** Mensajes que se marcaron como leidos al abrir la conversacion. */
  markedRead: number;
}

function chatCutoff(): Date {
  return new Date(Date.now() - CHAT_MESSAGE_TTL_HOURS * 60 * 60 * 1000);
}

/** El chat es temporal: los mensajes vencidos se borran al consultar o enviar, sin tarea programada. */
async function purgeExpiredMessages(): Promise<void> {
  await prisma.chatMessage.deleteMany({ where: { createdAt: { lt: chatCutoff() } } });
}

/**
 * Estado del chat del usuario en sesion: sus contactos (con mensajes sin leer) y, si se indica uno, la conversacion
 * con ese contacto. Abrir una conversacion marca como leidos los mensajes que recibio. Cualquier usuario activo
 * puede chatear con cualquier otro, y cada conversacion solo la ven sus dos participantes.
 */
export async function getChatState(contactId: string | null): Promise<ActionResult<ChatState>> {
  return executeAction('chat.getChatState', async () => {
    const session = await requireSession();
    const openContactId = contactId ? requireText(contactId, 'contacto', 100) : null;

    await purgeExpiredMessages();

    const markedRead = openContactId
      ? (
          await prisma.chatMessage.updateMany({
            where: { senderId: openContactId, recipientId: session.userId, readAt: null },
            data: { readAt: new Date() },
          })
        ).count
      : 0;

    const [users, mine, conversation] = await Promise.all([
      prisma.user.findMany({
        where: { isActive: true, id: { not: session.userId } },
        select: { id: true, name: true, email: true, role: true, isCourier: true },
      }),
      prisma.chatMessage.findMany({
        where: { OR: [{ senderId: session.userId }, { recipientId: session.userId }] },
        orderBy: { createdAt: 'desc' },
        select: { senderId: true, recipientId: true, createdAt: true, readAt: true },
      }),
      openContactId
        ? prisma.chatMessage.findMany({
            where: {
              OR: [
                { senderId: session.userId, recipientId: openContactId },
                { senderId: openContactId, recipientId: session.userId },
              ],
            },
            orderBy: { createdAt: 'desc' },
            take: MAX_MESSAGES_PER_CONVERSATION,
            select: { id: true, body: true, createdAt: true, senderId: true },
          })
        : Promise.resolve([]),
    ]);

    const lastMessageAt = new Map<string, Date>();
    const unreadCount = new Map<string, number>();

    // Vienen del mas reciente al mas antiguo: el primero de cada contacto es el ultimo mensaje.
    for (const message of mine) {
      const otherId = message.senderId === session.userId ? message.recipientId : message.senderId;

      if (!lastMessageAt.has(otherId)) {
        lastMessageAt.set(otherId, message.createdAt);
      }

      if (message.recipientId === session.userId && !message.readAt) {
        unreadCount.set(otherId, (unreadCount.get(otherId) ?? 0) + 1);
      }
    }

    const contacts = users
      .map((user) => ({
        ...user,
        unreadCount: unreadCount.get(user.id) ?? 0,
        lastMessageAt: lastMessageAt.get(user.id) ?? null,
      }))
      .sort((a, b) => {
        if (a.lastMessageAt && b.lastMessageAt) {
          return b.lastMessageAt.getTime() - a.lastMessageAt.getTime();
        }

        if (a.lastMessageAt || b.lastMessageAt) {
          return a.lastMessageAt ? -1 : 1;
        }

        return formatUserLabel(a).localeCompare(formatUserLabel(b), 'es');
      });

    const messages = conversation
      .map((message) => ({
        id: message.id,
        body: message.body,
        createdAt: message.createdAt,
        isMine: message.senderId === session.userId,
      }))
      .reverse();

    return { contacts, messages, markedRead };
  });
}

export async function sendChatMessage(contactId: string, body: string): Promise<ActionResult<void>> {
  return executeAction('chat.sendChatMessage', async (trace) => {
    const session = await requireSession();
    const recipientId = requireText(contactId, 'destinatario', 100);
    const text = requireText(body, 'mensaje', MAX_MESSAGE_LENGTH);
    trace.setBusinessId(session.userId);

    if (recipientId === session.userId) {
      throw new ValidationError('No puedes escribirte a ti mismo');
    }

    const recipient = await prisma.user.findUnique({ where: { id: recipientId }, select: { isActive: true } });

    if (!recipient) {
      throw new UserNotFoundError(recipientId);
    }

    if (!recipient.isActive) {
      throw new ValidationError('Ese usuario esta desactivado y no puede recibir mensajes');
    }

    await purgeExpiredMessages();
    await prisma.chatMessage.create({ data: { senderId: session.userId, recipientId, body: text } });
    trace.addStep('mensaje-enviado');
  });
}

/** Mensajes vigentes que el usuario en sesion todavia no leyo; alimenta el contador del menu. */
export async function getUnreadChatCount(): Promise<ActionResult<number>> {
  return executeAction('chat.getUnreadChatCount', async () => {
    const session = await requireSession();

    return prisma.chatMessage.count({
      where: { recipientId: session.userId, readAt: null, createdAt: { gte: chatCutoff() } },
    });
  });
}
