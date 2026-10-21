import { useCallback, useEffect, useState } from "react";
import { chatService } from "@/lib/chat/service";
import type { Chat, Message } from "@/lib/chat/types";

/** All chat state flows through `chatService`, so swapping mock → real API needs no UI changes. */
export function useChats() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [selectedId, setSelectedId] = useState<string>();

  useEffect(() => {
    chatService.listChats().then(setChats);
  }, []);

  const pushMessage = useCallback((m: Message) => {
    setMessages((all) => {
      const cur = all[m.chatId];
      return cur ? { ...all, [m.chatId]: [...cur, m] } : all;
    });
    setChats((cs) => cs.map((c) => (c.id === m.chatId ? { ...c, lastMessage: m } : c)));
  }, []);

  useEffect(() => chatService.subscribe(pushMessage), [pushMessage]);

  const select = useCallback(async (id: string | undefined) => {
    setSelectedId(id);
    if (!id) return;
    setChats((cs) => cs.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)));
    const list = await chatService.listMessages(id);
    setMessages((all) => ({ ...all, [id]: list }));
  }, []);

  const send = useCallback(async (body: string) => {
    if (!selectedId) return;
    const msg = await chatService.sendMessage(selectedId, body);
    pushMessage(msg);
  }, [selectedId, pushMessage]);

  return {
    chats,
    selectedChat: chats.find((c) => c.id === selectedId),
    messages: selectedId ? messages[selectedId] ?? [] : [],
    select,
    send,
  };
}
