import { ArrowLeft, Phone, Search, Video, MoreVertical } from "lucide-react";
import type { Contact } from "@/lib/chat/types";
import { ContactAvatar } from "./ContactAvatar";
import { IconButton } from "./IconButton";

export function ChatHeader({ contact, onBack }: { contact: Contact; onBack?: () => void }) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-panel-header px-4">
      {onBack && (
        <IconButton aria-label="Voltar" onClick={onBack} className="md:hidden">
          <ArrowLeft />
        </IconButton>
      )}
      <ContactAvatar contact={contact} size={40} />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate font-semibold">{contact.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {contact.phone}
          {contact.online && <span className="text-primary"> · online</span>}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <IconButton aria-label="Chamada de vídeo" className="hidden sm:inline-flex"><Video /></IconButton>
        <IconButton aria-label="Ligar" className="hidden sm:inline-flex"><Phone /></IconButton>
        <IconButton aria-label="Pesquisar"><Search /></IconButton>
        <IconButton aria-label="Mais opções"><MoreVertical /></IconButton>
      </div>
    </header>
  );
}
