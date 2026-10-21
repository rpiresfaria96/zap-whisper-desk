import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { NavRail, type NavSection } from "@/components/chat/NavRail";
import { ChatList } from "@/components/chat/ChatList";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { MessageList } from "@/components/chat/MessageList";
import { Composer } from "@/components/chat/Composer";
import { EmptyChat } from "@/components/chat/EmptyChat";
import { useChats } from "@/hooks/use-chats";
import { useTheme } from "@/hooks/use-theme";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ideal Zap — Mensagens no seu computador" },
      { name: "description", content: "Ideal Zap: converse com seus contatos pelo navegador com uma interface moderna e elegante." },
      { property: "og:title", content: "Ideal Zap" },
      { property: "og:description", content: "Mensagens no seu computador, com visual moderno e elegante." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const titles: Record<NavSection, string> = {
  chats: "Conversas",
  contacts: "Contatos",
  favorites: "Favoritos",
  settings: "Configurações",
};

function Index() {
  const { dark, toggle } = useTheme();
  const { chats, selectedChat, messages, select, send } = useChats();
  const [section, setSection] = useState<NavSection>("chats");

  const visible = useMemo(() => {
    if (section === "favorites") return chats.filter((c) => c.favorite);
    if (section === "contacts") return [...chats].sort((a, b) => a.contact.name.localeCompare(b.contact.name));
    return chats;
  }, [chats, section]);

  const unread = chats.filter((c) => c.unreadCount > 0).length;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <NavRail active={section} onChange={setSection} dark={dark} onToggleTheme={toggle} unread={unread} />
      <aside className={cn("h-full w-full border-r md:w-[360px] lg:w-[400px] md:shrink-0", selectedChat && "hidden md:block")}>
        <ChatList title={titles[section]} chats={visible} selectedId={selectedChat?.id} onSelect={select} />
      </aside>
      <main className={cn("h-full min-w-0 flex-1 flex-col", selectedChat ? "flex" : "hidden md:flex")}>
        {selectedChat ? (
          <div key={selectedChat.id} className="flex h-full flex-col animate-in fade-in duration-300">
            <ChatHeader contact={selectedChat.contact} onBack={() => select(undefined)} />
            <MessageList messages={messages} />
            <Composer onSend={send} />
          </div>
        ) : (
          <EmptyChat />
        )}
      </main>
    </div>
  );
}
