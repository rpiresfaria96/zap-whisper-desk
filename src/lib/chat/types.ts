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
  senderName?: string | undefined;
  timestamp: number;
  status?: MessageStatus | undefined;
  mediaType?: "image" | "sticker" | "audio" | "ptt" | "video" | "document" | undefined;
  filename?: string | undefined;
  mimetype?: string | undefined;
  fileSize?: number | undefined;
  quotedId?: string | undefined;
  quotedText?: string | undefined;
  reactions?: string[] | undefined;
  starred?: boolean | undefined;
  deleted?: boolean | undefined;
  edited?: boolean | undefined;
  isGif?: boolean | undefined;
  contactCard?: { name: string; phone: string } | undefined;
}

export interface Chat {
  id: string;
  contact: Contact;
  lastMessage?: Message | undefined;
  unreadCount: number;
  pinned?: boolean | undefined;
  favorite?: boolean | undefined;
  archived?: boolean | undefined;
}

/**
 * Contract the UI depends on. Swap the mock implementation for one that calls
 * your local Node.js backend (which talks to WPPConnect Server). Never put
 * WPPConnect tokens in the browser — the backend holds them.
 */
export interface GroupDetails {
  name: string;
  description: string;
  count: number;
  participants: Array<{ id: string; admin: boolean }>;
}

export interface ChatLabel {
  id: string;
  name: string;
}

export interface ChatService {
  listChats(): Promise<Chat[]>;
  listContacts(): Promise<Chat[]>;
  listGroups(): Promise<Chat[]>;
  createGroup(name: string, participants: string[]): Promise<void>;
  listMessages(chatId: string): Promise<Message[]>;
  sendFile(chatId: string, file: File, caption?: string): Promise<void>;
  loadMedia(messageId: string): Promise<{ base64: string; mimetype: string }>;
  getAvatar(contactId: string): Promise<string | null>;
  getPreview(chatId: string): Promise<Message | null>;
  sendMessage(chatId: string, body: string): Promise<void>;
  savePhoneContact(phone: string, name: string): Promise<void>;
  sendContactCard(chatId: string, contactId: string, name: string): Promise<void>;
  replyMessage(chatId: string, body: string, messageId: string): Promise<void>;
  reactToMessage(messageId: string, reaction: string): Promise<void>;
  setUnread(chatId: string, unread: boolean): Promise<void>;
  setArchived(chatId: string, archived: boolean): Promise<void>;
  setPinned(chatId: string, pinned: boolean): Promise<void>;
  forwardMessage(messageId: string, destinations: string[], plainText?: string): Promise<{ copiedAsText: number }>;
  editMessage(messageId: string, text: string): Promise<void>;
  deleteMessage(chatId: string, messageId: string, onlyLocal: boolean): Promise<{ pending?: boolean }>;
  starMessage(messageId: string, star: boolean): Promise<void>;
  groupDetails(groupId: string): Promise<GroupDetails>;
  listLabels(): Promise<ChatLabel[]>;
  createLabel(name: string): Promise<void>;
  setChatLabel(chatId: string, labelId: string, mode: "add" | "remove"): Promise<void>;
  /** Real-time updates (e.g. via WebSocket/SSE from the backend). Returns unsubscribe. */
  subscribe(onMessage: (msg: Message) => void): () => void;
}
