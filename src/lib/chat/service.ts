import type { ChatService, Message } from "./types";
import { mockChats, mockMessages } from "./mock-data";

/** Demo service. Replace with `createHttpChatService` once the backend exists. */
export function createMockChatService(): ChatService {
  const listeners = new Set<(m: Message) => void>();
  return {
    async listChats() {
      return structuredClone(mockChats);
    },
    async listContacts() { return structuredClone(mockChats); },
    async listGroups() { return structuredClone(mockChats.filter((c) => c.id.endsWith("@g.us"))); },
    async createGroup() { throw new Error("Criação de grupos disponível somente conectado ao WhatsApp."); },
    async sendFile() { throw new Error("Anexos disponíveis somente conectado ao WhatsApp."); },
    async loadMedia() { throw new Error("Mídia disponível somente conectado ao WhatsApp."); },
    async getAvatar() { return null; },
    async getPreview(chatId) {
      return (mockMessages[chatId] || []).at(-1) || null;
    },
    async listMessages(chatId) {
      return structuredClone(mockMessages[chatId] ?? []);
    },
    async sendContactCard() {},
    async sendMessage(chatId, body) {
      const msg: Message = {
        id: crypto.randomUUID(), chatId, fromMe: true, body, timestamp: Date.now(), status: "sent",
      };
      (mockMessages[chatId] ??= []).push(msg);
    },
    async replyMessage(chatId, body, messageId) {
      const msg: Message = { id: crypto.randomUUID(), chatId, body, quotedId: messageId,
        timestamp: Date.now(), fromMe: true, status: "sent" };
      (mockMessages[chatId] ??= []).push(msg);
    },
    async reactToMessage() {},
    async setUnread() {},
    async setArchived() {},
    async setPinned() {},
    async savePhoneContact() { throw new Error("Conecte o WhatsApp para salvar no telefone."); },
    async forwardMessage() { return { copiedAsText: 0 }; },
    async editMessage() {},
    async deleteMessage() { return {}; },
    async starMessage() {},
    async groupDetails() { return { name: "Grupo de demonstração", description: "",
      count: 0, participants: [] }; },
    async listLabels() { return []; },
    async createLabel() {},
    async setChatLabel() {},
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
    if (!r.ok) {
      let message = `Não foi possível concluir a operação (HTTP ${r.status}).`;
      try {
        const payload = await r.json() as { error?: unknown };
        // Apenas mensagens padronizadas do nosso backend local.
        if (typeof payload?.error === "string" && payload.error.length <= 180 &&
            !/[\\\r\n]/.test(payload.error)) message = payload.error;
      } catch {}
      throw new Error(message);
    }
    const data = await r.json();
    return data as T;
  };
  return {
    listChats: () => j("/chats"),
    listContacts: () => j("/contacts"),
    listGroups: () => j("/groups"),
    createGroup: async (name, participants) => {
      await j("/groups", { method: "POST", body: JSON.stringify({ name, participants }) });
    },
    sendFile: async (chatId, file, caption = "") => {
      if (file.size > 8 * 1024 * 1024) throw new Error("Anexos limitados a 8 MB nesta versão.");
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
        reader.readAsDataURL(file);
      });
      await j("/attachments", { method: "POST", body: JSON.stringify({ chatId, base64, filename: file.name, caption }) });
    },
    loadMedia: (messageId) => j(`/media/${encodeURIComponent(messageId)}`),
    getAvatar: async (contactId) => {
      const data = await j<{ url?: string | null }>(`/avatars/${encodeURIComponent(contactId)}`);
      return data?.url || null;
    },
    getPreview: async (chatId) => {
      const data = await j<{ lastMessage?: Message | null }>(`/chats/${encodeURIComponent(chatId)}/preview`);
      return data?.lastMessage || null;
    },
    listMessages: (id) => j(`/chats/${encodeURIComponent(id)}/messages`),
    sendContactCard: async (chatId, contactId, name) => {
      await j("/contacts/share", {
        method: "POST", body: JSON.stringify({ chatId, contactId, name }),
      });
    },
    sendMessage: async (id, body) => {
      await j(`/chats/${encodeURIComponent(id)}/messages`, {
        method: "POST", body: JSON.stringify({ body }),
      });
    },
    replyMessage: async (chatId, message, messageId) => {
      await j("/reply", { method: "POST", body: JSON.stringify({ chatId, message, messageId }) });
    },
    reactToMessage: async (messageId, reaction) => {
      await j("/reaction", { method: "POST", body: JSON.stringify({ messageId, reaction }) });
    },
    setUnread: async (chatId, unread) => {
      await j(`/chats/${encodeURIComponent(chatId)}/read-state`,
        { method: "POST", body: JSON.stringify({ unread }) });
    },
    setArchived: async (chatId, archive) => {
      await j(`/chats/${encodeURIComponent(chatId)}/archive`,
        { method: "POST", body: JSON.stringify({ archive }) });
    },
    setPinned: async (chatId, pinned) => {
      await j(`/chats/${encodeURIComponent(chatId)}/pin`,
        { method: "POST", body: JSON.stringify({ pinned }) });
    },
    savePhoneContact: async (phone, name) => {
      await j("/contacts/save", { method: "POST", body: JSON.stringify({ phone, name }) });
    },
    forwardMessage: async (messageId, destinations, plainText) => {
      return j("/forward", { method: "POST", body: JSON.stringify({ messageId, destinations, text: plainText || "" }) });
    },
    editMessage: async (messageId, text) => {
      await j("/message-action", { method: "POST",
        body: JSON.stringify({ action: "edit", messageId, text }) });
    },
    deleteMessage: async (chatId, messageId, onlyLocal) => {
      return j<{ pending?: boolean }>("/message-action", { method: "POST",
        body: JSON.stringify({ action: "delete", chatId, messageId, onlyLocal }) });
    },
    starMessage: async (messageId, star) => {
      await j("/message-action", { method: "POST",
        body: JSON.stringify({ action: "star", messageId, star }) });
    },
    groupDetails: (groupId) => j(`/manager/group-info/${encodeURIComponent(groupId)}`),
    listLabels: () => j("/manager/labels"),
    createLabel: async (name) => {
      await j("/manager/labels", { method: "POST", body: JSON.stringify({ name }) });
    },
    setChatLabel: async (chatId, labelId, mode) => {
      await j("/manager/label-chat", { method: "POST",
        body: JSON.stringify({ chatId, labelId, mode }) });
    },
    subscribe(fn) {
      const es = new EventSource(`${baseUrl}/events`);
      es.onmessage = (e) => fn(JSON.parse(e.data));
      return () => es.close();
    },
  };
}

// A interface de desenvolvimento local sempre usa a API real, mesmo que
// .env ainda nao tenha sido importado pelo Vite. No SSR mantemos mock
// somente para nao fazer chamadas de dados do usuario no servidor HTML.
// Browsers on localhost or another PC share the same-origin proxy.
// No WhatsApp token is ever exposed to a browser.
const apiUrl = typeof window !== "undefined" ? "/ideal-api" : undefined;
export const chatService: ChatService = apiUrl
  ? createHttpChatService(apiUrl.replace(/\/$/, ""))
  : createMockChatService();

