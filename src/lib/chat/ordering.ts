import type { Chat, Message } from "./types";

/** Never replace a newer SSE/history message with an old chat-list preview. */
export function newestMessage(a?: Message, b?: Message): Message | undefined {
  if (!a) return b;
  if (!b) return a;
  if (b.timestamp > a.timestamp) return b;
  if (b.timestamp < a.timestamp) return a;
  // Same timestamp, prefer a message with a body over an incomplete snapshot.
  return b.body && !a.body ? b : a;
}

export function lastActivity(chat: Chat): number {
  return Math.max(chat.activityAt || 0, chat.lastMessage?.timestamp || 0);
}

export function sortChatsByActivity(a: Chat, b: Chat): number {
  return Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) ||
    lastActivity(b) - lastActivity(a);
}
