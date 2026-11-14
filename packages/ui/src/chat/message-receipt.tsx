import { Check } from 'lucide-react';
import { roleName, type ChatMessage, type ChatThread } from './chat-display';

export function seenByNames(thread: ChatThread, message: ChatMessage): string[] {
  if (!message.mine) return [];
  return thread.participants.filter((person) => person.active && person.actorId !== message.senderId && person.lastReadAt && Date.parse(person.lastReadAt) >= Date.parse(message.createdAt))
    .map((person) => person.name?.trim() || roleName(person.actorRole));
}

/** This is a portal read receipt, never evidence of email or Viber delivery. */
export function MessageReceipt({ thread, message, enabled }: { thread: ChatThread; message: ChatMessage; enabled: boolean }) {
  const names = enabled ? seenByNames(thread, message) : [];
  if (!names.length) return <Check className="size-3" aria-label="Sent" />;
  return <span className="ml-1" aria-label={`Seen by ${names.join(', ')}`}>{names.length === 1 ? `Seen by ${names[0]}` : `Seen by ${names.length}`}</span>;
}
