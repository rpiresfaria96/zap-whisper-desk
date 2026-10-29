import { Star } from "lucide-react";
import type { Chat, Message } from "@/lib/chat/types";
export function FavoriteMessages({ messages, chats, onSelect }: {
  messages: Message[]; chats: Chat[]; onSelect: (id: string) => void;
}) {
  return <section className="h-full overflow-y-auto bg-panel">
    <h1 className="flex items-center gap-2 p-5 text-xl font-semibold"><Star className="h-5 w-5" /> Mensagens favoritas</h1>
    <p className="px-5 pb-3 text-xs text-muted-foreground">Exibindo favoritas das conversas já carregadas.</p>
    {messages.map((m) => <button type="button" key={m.id} onClick={() => onSelect(m.chatId)}
      className="block w-full border-t px-5 py-3 text-left hover:bg-hover">
      <span className="block truncate font-medium">{chats.find(c => c.id === m.chatId)?.contact.name || "Conversa"}</span>
      <span className="block truncate text-sm text-muted-foreground">{m.mediaType ? m.filename || "Arquivo" : m.body}</span>
    </button>)}
    {!messages.length && <p className="p-5 text-sm text-muted-foreground">Abra uma conversa e marque uma mensagem com a estrela.</p>}
  </section>;
}