import { ArrowLeft, Phone, Search, Video, MoreVertical } from "lucide-react";
import type { Contact } from "@/lib/chat/types";
import { ContactAvatar } from "./ContactAvatar";
import { IconButton } from "./IconButton";

export function ChatHeader({ contact, onBack, onSearch, onManager }: {
  contact: Contact; onBack?: (() => void) | undefined;
  onSearch?: (() => void) | undefined; onManager?: (() => void) | undefined;
}) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-panel-header px-4">
      {onBack && (
        <IconButton aria-label="Voltar para a lista de conversas" title="Voltar às conversas" onClick={onBack}>
          <ArrowLeft />
        </IconButton>
      )}
      <ContactAvatar contact={contact} size={40} />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate font-semibold">{contact.name}</p>
        {(contact.phone || contact.online) && (
          <p className="truncate text-xs text-muted-foreground">
            {contact.phone}
            {contact.online && <span className="text-primary"> · online</span>}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1">
        <IconButton aria-label="Chamada de vídeo indisponível" title="Chamadas de vídeo não disponíveis nesta integração" disabled className="hidden sm:inline-flex opacity-40"><Video /></IconButton>
        <IconButton aria-label="Ligação indisponível" title="Ligações não disponíveis nesta integração" disabled className="hidden sm:inline-flex opacity-40"><Phone /></IconButton>
        <IconButton aria-label="Pesquisar mensagens desta conversa" title="Pesquisar mensagens carregadas" onClick={onSearch}><Search /></IconButton>
        <IconButton aria-label="Ferramentas da conversa" title="Informações, etiquetas, mídias e exportação" onClick={onManager}><MoreVertical /></IconButton>
      </div>
    </header>
  );
}
