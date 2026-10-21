import type { ChatService, Message } from "./types";
import { mockChats, mockMessages } from "./mock-data";

/** Demo service. Replace with `createHttpChatService` once the backend exists. */
export function createMockChatService(): ChatService {
  const listeners = new Set<(m: Message) => void>();
  return {
    async listChats() {
      return structuredClone(mockChats);
    },
    async listMessages(chatId) {
      return structuredClone(mockMessages[chatId] ?? []);
    },
    async sendMessage(chatId, body) {
      const msg: Message = {
        id: crypto.randomUUID(),
        chatId,
        fromMe: true,
        body,
        timestamp: Date.now(),
        status: "sent",
      };
      (mockMessages[chatId] ??= []).push(msg);
      return msg;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

/**
 * Talks to your local Node.js backend (e.g. http://localhost:3001), which
 * proxies WPPConnect Server and holds the secret token server-side.
 * Set VITE_API_URL in .env to enable.
 */
export function createHttpChatService(baseUrl: string): ChatService {
  const j = async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const r = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
    if (!r.ok) throw new Error(`API ${r.status}`);
    return r.json();
  };
  return {
    listChats: () => j("/chats"),
    listMessages: (id) => j(`/chats/${encodeURIComponent(id)}/messages`),
    sendMessage: (id, body) =>
      j(`/chats/${encodeURIComponent(id)}/messages`, { method: "POST", body: JSON.stringify({ body }) }),
    subscribe(fn) {
      const es = new EventSource(`${baseUrl}/events`);
      es.onmessage = (e) => fn(JSON.parse(e.data));
      return () => es.close();
    },
  };
}

const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
export const chatService: ChatService = apiUrl ? createHttpChatService(apiUrl) : createMockChatService();
