export type MessageStatus = "sending" | "sent" | "delivered" | "read";

export interface Contact {
  id: string;
  name: string;
  phone: string;
  avatarUrl?: string | undefined;
  about?: string | undefined;
  online?: boolean | undefined;
}

export interface Message {
  id: string;
  chatId: string;
  fromMe: boolean;
  body: string;
  timestamp: number;
  status?: MessageStatus | undefined;
}

export interface Chat {
  id: string;
  contact: Contact;
  lastMessage?: Message | undefined;
  unreadCount: number;
  pinned?: boolean | undefined;
  favorite?: boolean | undefined;
}

/**
 * Contract the UI depends on. Swap the mock implementation for one that calls
 * your local Node.js backend (which talks to WPPConnect Server). Never put
 * WPPConnect tokens in the browser — the backend holds them.
 */
export interface ChatService {
  listChats(): Promise<Chat[]>;
  listMessages(chatId: string): Promise<Message[]>;
  sendMessage(chatId: string, body: string): Promise<Message>;
  /** Real-time updates (e.g. via WebSocket/SSE from the backend). Returns unsubscribe. */
  subscribe(onMessage: (msg: Message) => void): () => void;
}
