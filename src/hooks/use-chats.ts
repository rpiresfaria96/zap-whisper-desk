import { useCallback, useEffect, useRef, useState } from "react";
import { chatService } from "@/lib/chat/service";
import type { Chat, Message } from "@/lib/chat/types";

// Registra somente eventos tecnicos. Nunca envia o ID, telefone, nome ou conteudo.
function traceHistory(event: "HISTORY_OPENED" | "HISTORY_DATA_READY" | "HISTORY_ERROR", status: string) {
  if (typeof window === "undefined") return;
  const api = "/ideal-api";
  void fetch(`${api.replace(/\/$/, "")}/internal/client-diagnostic`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, status }),
  }).catch(() => {});
}

function mergeMessages(existing: Message[], incoming: Message[]): Message[] {
  const byId = new Map(existing.map((message) => [message.id, message]));
  for (const message of incoming) {
    const old = byId.get(message.id);
    byId.set(message.id, {
      ...old, ...message,
      quotedId: message.quotedId || old?.quotedId,
      quotedText: message.quotedText || old?.quotedText,
      reactions: message.reactions?.length ? message.reactions : old?.reactions,
      starred: message.starred ?? old?.starred,
      edited: message.edited ?? old?.edited,
      ...(old?.deleted ? { body: old.body, deleted: true, mediaType: undefined } : {}),
    });
  }
  return [...byId.values()].sort((a, b) => a.timestamp - b.timestamp);
}

function emptyChat(id: string): Chat {
  const number = id.split("@")[0];
  return {
    id,
    contact: { id, name: `+${number}`, phone: `+${number}` },
    unreadCount: 0,
  };
}

export function useChats(onIncoming?: ((message: Message, isOpen: boolean, senderName?: string) => void) | undefined) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [contacts, setContacts] = useState<Chat[]>([]);
  const [groups, setGroups] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [selectedId, setSelectedId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [actionError, setActionError] = useState("");
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState("");
  const [historyLoaded, setHistoryLoaded] = useState<Record<string, boolean>>({});
  const historyAttempts = useRef(new Map<string, number>());
  const readOverrides = useRef(new Map<string, { unread: boolean; at: number }>());
  const pinOverrides = useRef(new Map<string, { pinned: boolean; at: number }>());
  const messageOverlays = useRef(new Map<string, Partial<Message>>());
  const localStars = useRef(new Map<string, boolean>());
  useEffect(() => {
    try {
      const data = JSON.parse(localStorage.getItem("ideal-zap:stars-v1") || "{}");
      if (!data || typeof data !== "object") return;
      for (const [id, marked] of Object.entries(data)) {
        if (id.length <= 250 && typeof marked === "boolean") {
          localStars.current.set(id, marked);
          messageOverlays.current.set(id, { starred: marked });
        }
      }
    } catch { /* armazenamento indisponível: favoritos continuam nesta sessão */ }
  }, []);
  const recentReplies = useRef<Array<{ chatId: string; body: string; quote: Message; at: number }>>([]);
  const selectedRef = useRef<string | undefined>(undefined);
  selectedRef.current = selectedId;
  const incomingCallback = useRef(onIncoming);
  incomingCallback.current = onIncoming;
  const realtimeSeen = useRef(new Set<string>());
  const lastPollIds = useRef(new Map<string, string>());
  const contactNames = useRef(new Map<string, string>());
  const rememberContactNames = (items: Chat[]) => {
    for (const item of items) {
      const name = item.contact.name?.trim();
      if (name && name !== "Contato do WhatsApp" && name !== item.id)
        contactNames.current.set(item.id, name);
    }
  };
  const senderDisplay = (message: Message) => {
    const contact = contactNames.current.get(message.chatId);
    if (message.chatId.endsWith("@g.us") && message.senderName)
      return contact ? `${message.senderName} • ${contact}` : message.senderName;
    if (contact) return contact;
    if (message.chatId.endsWith("@c.us")) return "+" + message.chatId.split("@")[0];
    return message.chatId.endsWith("@g.us") ? "Grupo" : "Contato do WhatsApp";
  };
  const emitIncoming = (message: Message, isOpen: boolean) =>
    incomingCallback.current?.(message, isOpen, senderDisplay(message));
  const firstSnapshotLoaded = useRef(false);
  const unreadSnapshots = useRef(new Map<string, number>());
  const historyLastSeen = useRef(new Map<string, string>());

  const refreshChats = useCallback(async () => {
    try {
      const next = await chatService.listChats();
      rememberContactNames(next);
      // Reserva: alguns aparelhos não emitem eventos SSE consistentemente.
      // Detectar novas mensagens que a listagem realmente informa, sem
      // tocar som por mensagens antigas carregadas na inicialização.
      const now = Date.now();
      for (const item of next) {
        const incoming = item.lastMessage;
        const oldId = lastPollIds.current.get(item.id);
        const oldUnread = unreadSnapshots.current.get(item.id);
        // Algumas sessões não retornam lastMessage na lista (neste caso
        // apenas 24 de 319 conversas tinham prévia). Usar aumento real
        // de não lidas como sinal alternativo, sem conteúdo privado.
        if (firstSnapshotLoaded.current && oldUnread !== undefined &&
            item.unreadCount > oldUnread && !incoming?.id) {
          const syntheticId = `unread:${item.id}:${item.unreadCount}`;
          if (!realtimeSeen.current.has(syntheticId)) {
            realtimeSeen.current.add(syntheticId);
            emitIncoming({
              id: syntheticId, chatId: item.id, fromMe: false,
              body: "", timestamp: now,
            }, selectedRef.current === item.id);
          }
        }
        unreadSnapshots.current.set(item.id, item.unreadCount);
        if (firstSnapshotLoaded.current && incoming && oldId && oldId !== incoming.id &&
            !incoming.fromMe && incoming.timestamp >= now - 120_000 &&
            !realtimeSeen.current.has(incoming.id)) {
          realtimeSeen.current.add(incoming.id);
          emitIncoming(incoming, selectedRef.current === item.id);
        }
        if (incoming?.id) lastPollIds.current.set(item.id, incoming.id);
      }
      firstSnapshotLoaded.current = true;
      setChats((previous) => {
        const cached = new Map(previous.map((item) => [item.id, item]));
        return next.map((item) => {
          const previousItem = cached.get(item.id);
          const lastMessage = item.lastMessage && item.lastMessage.body
            ? item.lastMessage : previousItem?.lastMessage || item.lastMessage;
          const override = readOverrides.current.get(item.id);
          if (override && Date.now() - override.at > 3 * 60_000) readOverrides.current.delete(item.id);
          const effective = readOverrides.current.get(item.id);
          const pin = pinOverrides.current.get(item.id);
          if (pin && Date.now() - pin.at > 3 * 60_000) pinOverrides.current.delete(item.id);
          return { ...item, lastMessage,
            pinned: pinOverrides.current.get(item.id)?.pinned ?? item.pinned,
            unreadCount: effective ? (effective.unread ? Math.max(1, item.unreadCount) : 0) : item.unreadCount,
            contact: { ...item.contact,
              name: item.contact.name || previousItem?.contact.name || item.contact.phone,
            } };
        });
      });
      setListError("");
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Falha ao carregar conversas.");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshContacts = useCallback(async () => {
    try { const entries = await chatService.listContacts(); rememberContactNames(entries); setContacts(entries); setListError(""); }
    catch (error) { setListError(error instanceof Error ? error.message : "Falha ao carregar contatos."); }
  }, []);

  const refreshGroups = useCallback(async () => {
    try { const entries = await chatService.listGroups(); rememberContactNames(entries); setGroups(entries); setListError(""); }
    catch (error) { setListError(error instanceof Error ? error.message : "Falha ao carregar grupos."); }
  }, []);

  // Consulta sempre um unico chat. Erros de historico sao independentes
  // de erros ao enviar para evitar que uma falha no polling esconda um envio.
  const enrich = useCallback((id: string, incoming: Message[]) => {
    recentReplies.current = recentReplies.current.filter((p) => Date.now() - p.at < 90_000);
    return incoming.map((message) => {
      const matching = message.fromMe ? recentReplies.current.find((entry) =>
        entry.chatId === id && entry.body === message.body &&
        Math.abs(message.timestamp - entry.at) < 75_000) : undefined;
      const overlay = messageOverlays.current.get(message.id);
      return { ...message,
        ...(matching && !message.quotedId ? {
          quotedId: matching.quote.id, quotedText: matching.quote.body.slice(0, 200),
        } : {}),
        ...overlay,
      };
    });
  }, []);

  const refreshMessages = useCallback(async (id: string, silent = false) => {
    const requestNumber = (historyAttempts.current.get(id) ?? 0) + 1;
    historyAttempts.current.set(id, requestNumber);
    const isCurrentRequest = () => historyAttempts.current.get(id) === requestNumber;
    if (!silent) setHistoryLoadingId(id);
    if (!silent && selectedRef.current === id) setHistoryError("");
    try {
      const raw = await chatService.listMessages(id);
      if (!Array.isArray(raw)) throw new Error("A API não retornou uma lista de mensagens.");
      const updated = enrich(id, raw);
      if (!isCurrentRequest()) return;
      const newest = updated[updated.length - 1];
      const prevLastId = historyLastSeen.current.get(id);
      if (newest?.id) historyLastSeen.current.set(id, newest.id);
      if (newest && prevLastId && newest.id !== prevLastId &&
          !newest.fromMe && newest.timestamp >= Date.now() - 120_000 &&
          !realtimeSeen.current.has(newest.id)) {
        realtimeSeen.current.add(newest.id);
        emitIncoming(newest, selectedRef.current === id);
      }
      setMessages((prev) => ({ ...prev, [id]: mergeMessages(prev[id] ?? [], updated) }));
      // Mesmo que list-chats nao informe lastMessage, a conversa aberta
      // agora alimenta a pre-visualizacao abaixo do nome no painel lateral.
      const mostRecent = [...updated].reverse().find((msg) => Boolean(msg.body) || Boolean(msg.mediaType));
      if (mostRecent) {
        setChats((previous) => previous.map((chat) =>
          chat.id === id && (!chat.lastMessage || chat.lastMessage.timestamp <= mostRecent.timestamp)
            ? { ...chat, lastMessage: mostRecent } : chat));
      }
      setHistoryLoaded((prev) => ({ ...prev, [id]: true }));
      if (selectedRef.current === id) {
        setHistoryError("");
        traceHistory("HISTORY_DATA_READY", updated.length ? "HAS_MESSAGES" : "EMPTY");
      }
    } catch (error) {
      if (!isCurrentRequest()) return;
      if (selectedRef.current === id) {
        traceHistory("HISTORY_ERROR", "REQUEST_FAILED");
        setHistoryError(error instanceof Error ? error.message : "Falha ao carregar mensagens.");
      }
    } finally {
      if (!silent && isCurrentRequest()) setHistoryLoadingId((current) => current === id ? null : current);
    }
  }, [enrich]);

  useEffect(() => {
    void refreshChats();
    const timer = window.setInterval(() => {
      void refreshChats();
      if (selectedRef.current) void refreshMessages(selectedRef.current, true);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [refreshChats, refreshMessages]);

  const pushMessage = useCallback((message: Message) => {
    // Eventos SSE podem repetir após reconexão. Nunca tocar som de novo.
    if (!realtimeSeen.current.has(message.id)) {
      realtimeSeen.current.add(message.id);
      if (realtimeSeen.current.size > 1000)
        realtimeSeen.current.delete(realtimeSeen.current.values().next().value!);
      emitIncoming(message, selectedRef.current === message.chatId);
    }
    setMessages((all) => ({
      ...all,
      [message.chatId]: mergeMessages(all[message.chatId] ?? [], enrich(message.chatId, [message])),
    }));
    setChats((all) => all.map((chat) => chat.id === message.chatId
      ? { ...chat, lastMessage: message, unreadCount: chat.id === selectedRef.current ? 0 : chat.unreadCount + 1 }
      : chat));
  }, [enrich]);

  useEffect(() => chatService.subscribe(pushMessage), [pushMessage]);

  const select = useCallback(async (id: string | undefined) => {
    selectedRef.current = id;
    setSelectedId(id);
    setHistoryError("");
    setActionError("");
    if (!id) return;
    traceHistory("HISTORY_OPENED", id.endsWith("@g.us") ? "GROUP" : "PRIVATE");
    readOverrides.current.set(id, { unread: false, at: Date.now() });
    setChats((prev) => prev.map((chat) => chat.id === id ? { ...chat, unreadCount: 0 } : chat));
    void chatService.setUnread(id, false).catch(() => {
      // O chat continua acessível se a sincronização de leitura falhar.
    });
    await refreshMessages(id);
  }, [refreshMessages]);

  const openNumber = useCallback(async (phone: string) => {
    const number = phone.replace(/\D/g, "");
    if (!/^[0-9]{7,15}$/.test(number)) throw new Error("Informe telefone com DDI, somente números.");
    const id = `${number}@c.us`;
    setChats((all) => all.some((chat) => chat.id === id) ? all : [emptyChat(id), ...all]);
    await select(id);
  }, [select]);

  const send = useCallback(async (body: string, quoted?: Message) => {
    if (!selectedRef.current) return;
    const chatId = selectedRef.current;
    try {
      if (quoted) {
        await chatService.replyMessage(chatId, body, quoted.id);
        recentReplies.current.unshift({ chatId, body, quote: quoted, at: Date.now() });
      } else await chatService.sendMessage(chatId, body);
      // Usar o ID real do WPPConnect; nao duplicar mensagem criada
      // artificialmente e recebida depois via SSE/historico.
      setActionError("");
      await refreshMessages(chatId);
      void refreshChats();
      window.setTimeout(() => {
        if (selectedRef.current === chatId) void refreshMessages(chatId);
      }, 1200);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Mensagem não enviada.");
      throw error;
    }
  }, [refreshMessages, refreshChats]);

  const shareContact = useCallback(async (contactId: string, name: string) => {
    const chatId = selectedRef.current;
    if (!chatId) throw new Error("Abra uma conversa antes de enviar o contato.");
    await chatService.sendContactCard(chatId, contactId, name);
    setActionError("");
    await refreshMessages(chatId);
    void refreshChats();
  }, [refreshChats, refreshMessages]);

  const sendFile = useCallback(async (file: File, caption = "") => {
    if (!selectedRef.current) return;
    try {
      await chatService.sendFile(selectedRef.current, file, caption);
      await refreshMessages(selectedRef.current);
      void refreshChats();
      setActionError("");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Não foi possível enviar o arquivo.");
      throw error;
    }
  }, [refreshChats, refreshMessages]);

  const markUnread = useCallback(async (id: string, unread: boolean) => {
    await chatService.setUnread(id, unread);
    readOverrides.current.set(id, { unread, at: Date.now() });
    setChats((prev) => prev.map((chat) => chat.id === id
      ? { ...chat, unreadCount: unread ? Math.max(chat.unreadCount, 1) : 0 } : chat));
  }, []);

  const archive = useCallback(async (id: string, state: boolean) => {
    await chatService.setArchived(id, state);
    setChats((prev) => prev.map((chat) => chat.id === id
      ? { ...chat, archived: state } : chat));
  }, []);

  const react = useCallback(async (messageId: string, emoji: string) => {
    await chatService.reactToMessage(messageId, emoji);
    const current = messageOverlays.current.get(messageId);
    const reactions = [...new Set([...(current?.reactions || []), emoji])];
    messageOverlays.current.set(messageId, { ...current, reactions });
    setMessages((all) => Object.fromEntries(Object.entries(all).map(([id, items]) =>
      [id, items.map((item) => item.id === messageId ? { ...item, reactions } : item)])));
    if (selectedRef.current) void refreshMessages(selectedRef.current);
  }, [refreshMessages]);

  const pin = useCallback(async (id: string, pinned: boolean) => {
    await chatService.setPinned(id, pinned);
    pinOverrides.current.set(id, { pinned, at: Date.now() });
    setChats((items) => items.map((item) => item.id === id ? { ...item, pinned } : item));
  }, []);

  const forward = useCallback(async (message: Message, destinations: string[]) => {
    const result = await chatService.forwardMessage(message.id, destinations,
      message.mediaType ? "" : message.body);
    void refreshChats();
    return result;
  }, [refreshChats]);

  const edit = useCallback(async (message: Message, text: string) => {
    await chatService.editMessage(message.id, text);
    const overlay = { ...messageOverlays.current.get(message.id), body: text, edited: true };
    messageOverlays.current.set(message.id, overlay);
    setMessages((all) => ({ ...all, [message.chatId]:
      (all[message.chatId] || []).map((msg) => msg.id === message.id ? { ...msg, ...overlay } : msg) }));
  }, []);

  const remove = useCallback(async (message: Message, onlyLocal: boolean) => {
    const outcome = await chatService.deleteMessage(message.chatId, message.id, onlyLocal);
    if (outcome.pending) {
      // Revocation was sent but is not yet reflected by WhatsApp. Do not fake deletion.
      window.setTimeout(() => void refreshMessages(message.chatId, true), 5000);
      return { pending: true };
    }
    const overlay: Partial<Message> = { body: onlyLocal ? "Mensagem apagada para você" : "Mensagem apagada para todos", deleted: true, mediaType: undefined, contactCard: undefined };
    messageOverlays.current.set(message.id, overlay);
    setMessages((all) => ({ ...all, [message.chatId]:
      (all[message.chatId] || []).map((msg) => msg.id === message.id ? { ...msg, ...overlay } : msg) }));
    return { pending: false };
  }, [refreshMessages]);

  const star = useCallback(async (message: Message, value: boolean) => {
    let synced = true;
    try { await chatService.starMessage(message.id, value); }
    catch { synced = false; }
    localStars.current.set(message.id, value);
    try { localStorage.setItem("ideal-zap:stars-v1",
      JSON.stringify(Object.fromEntries(localStars.current))); } catch {}
    const overlay = { ...messageOverlays.current.get(message.id), starred: value };
    messageOverlays.current.set(message.id, overlay);
    setMessages((all) => ({ ...all, [message.chatId]:
      (all[message.chatId] || []).map((msg) => msg.id === message.id ? { ...msg, ...overlay } : msg) }));
    return { synced };
  }, []);

  const createGroup = useCallback(async (name: string, participants: string[]) => {
    await chatService.createGroup(name, participants);
    await Promise.all([refreshGroups(), refreshChats()]);
  }, [refreshGroups, refreshChats]);

  const selectedChat = chats.find((chat) => chat.id === selectedId) ??
    contacts.find((chat) => chat.id === selectedId) ??
    groups.find((chat) => chat.id === selectedId) ??
    (selectedId ? emptyChat(selectedId) : undefined);

  const favoriteMessages = Object.values(messages).flat()
    .filter((message) => message.starred === true)
    .sort((a, b) => b.timestamp - a.timestamp);

  return {
    chats, contacts, groups, favoriteMessages, loading, listError, actionError,
    historyError, historyLoading: Boolean(selectedId && historyLoadingId === selectedId),
    historyLoaded: Boolean(selectedId && historyLoaded[selectedId]),
    refreshChats, refreshContacts, refreshGroups, refreshMessages,
    selectedChat, messages: selectedId ? messages[selectedId] ?? [] : [],
    select, openNumber, send, sendFile, shareContact, createGroup, markUnread, archive, react,
    pin, forward, edit, remove, star,
  };
}
