import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import type { Message } from "@/lib/chat/types";
import { cn } from "@/lib/utils";
import { NavRail, type NavSection } from "@/components/chat/NavRail";
import { ChatList } from "@/components/chat/ChatList";
import { FavoriteMessages } from "@/components/chat/FavoriteMessages";
import { ForwardDialog } from "@/components/chat/ForwardDialog";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatManagerTools } from "@/components/chat/ChatManagerTools";
import { ContactShareDialog } from "@/components/chat/ContactShareDialog";
import { MessageList } from "@/components/chat/MessageList";
import { ChatRenderBoundary } from "@/components/chat/ChatRenderBoundary";
import { Composer } from "@/components/chat/Composer";
import { EmptyChat } from "@/components/chat/EmptyChat";
import { WhatsAppConnection } from "@/components/chat/WhatsAppConnection";
import { SessionControls } from "@/components/chat/SessionControls";
import { useChats } from "@/hooks/use-chats";
import { useTheme } from "@/hooks/use-theme";
import { useIncomingAlerts } from "@/hooks/use-incoming-alerts";

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
  groups: "Grupos",
  favorites: "Favoritos",
  archived: "Arquivadas",
  settings: "Configurações",
};

function Index() {
  const { dark, toggle } = useTheme();
  const alerts = useIncomingAlerts();
  const {
    chats, contacts, groups, favoriteMessages, loading, listError, actionError,
    selectedChat, messages, select, openNumber, send, sendFile, shareContact, markUnread, archive, react,
    pin, forward, edit, remove, star,
    historyError, historyLoading, historyLoaded, refreshMessages,
    refreshChats, refreshContacts, refreshGroups,
  } = useChats(alerts.onIncoming);
  const [section, setSection] = useState<NavSection>("chats");
  const [dialog, setDialog] = useState<"number" | null>(null);
  const [phone, setPhone] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [busy, setBusy] = useState(false);
  const [quoted, setQuoted] = useState<Message | null>(null);
  const [searchChat, setSearchChat] = useState(false);
  const [messageSearch, setMessageSearch] = useState("");
  const [reactionError, setReactionError] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [messageAction, setMessageAction] = useState<"forward" | "edit" | null>(null);
  const [actionMessage, setActionMessage] = useState<Message | null>(null);
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [actionInput, setActionInput] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [activeMatch, setActiveMatch] = useState(0);
  const onConnected = useCallback(() => {
    // Nao carregar 10 mil contatos junto com o historico. Contatos e
    // grupos sao buscados apenas quando suas abas forem abertas.
    void refreshChats();
  }, [refreshChats]);

  useEffect(() => {
    if (section === "contacts") void refreshContacts();
    if (section === "groups") void refreshGroups();
  }, [section, refreshContacts, refreshGroups]);

  const visible = useMemo(() => {
    if (section === "favorites") return chats.filter((chat) => chat.favorite && !chat.archived);
    if (section === "archived") return chats.filter((chat) => chat.archived);
    if (section === "contacts") return [...contacts].sort((a, b) =>
      a.contact.name.localeCompare(b.contact.name));
    if (section === "groups") return groups;
    return chats.filter((chat) => !chat.archived);
  }, [chats, contacts, groups, section]);

  // Pesquisa semelhante a Ctrl+F: mensagens nao desaparecem.
  const searchMatches = messageSearch.trim() ? messages.filter((m) =>
    m.body.toLocaleLowerCase("pt-BR").includes(messageSearch.trim().toLocaleLowerCase("pt-BR"))) : [];
  const currentMatch = searchMatches.length
    ? searchMatches[((activeMatch % searchMatches.length) + searchMatches.length) % searchMatches.length] : undefined;
  const selectedMatchId = currentMatch?.id;

  useEffect(() => {
    setQuoted(null);
    setSearchChat(false);
    setMessageSearch("");
    setReactionError("");
    setActionNotice("");
    setActiveMatch(0);
    setMessageAction(null);
    setForwardMessage(null);
    setManagerOpen(false);
    setContactPickerOpen(false);
  }, [selectedChat?.id]);

  const reactToMessage = (message: Message, emoji: string) => {
    setReactionError("");
    void react(message.id, emoji).catch(() => setReactionError("Não foi possível reagir a essa mensagem."));
  };

  const startMessageAction = (kind: "forward" | "edit", message: Message) => {
    if (kind === "forward") {
      setForwardMessage(message);
      if (!contacts.length) void refreshContacts();
      if (!groups.length) void refreshGroups();
      return;
    }
    setMessageAction(kind);
    setActionMessage(message);
    setActionInput(kind === "edit" ? message.body : "");
    setReactionError("");
  };

  const deleteMessage = (message: Message, onlyLocal: boolean) => {
    const prompt = onlyLocal
      ? "Apagar esta mensagem apenas da sua conversa?"
      : "Tentar apagar esta mensagem para todos? Esta ação pode ser irreversível.";
    if (typeof window !== "undefined" && !window.confirm(prompt)) return;
    setActionNotice("");
    void remove(message, onlyLocal).then((result) => {
      if (!onlyLocal) setActionNotice(result.pending
        ? "O WPPConnect aceitou o pedido de apagar para todos, mas a revogação remota ainda não foi confirmada. A mensagem será atualizada quando o histórico confirmar; confira também no destinatário."
        : "A revogação apareceu no WhatsApp local. Confira também no telefone destinatário.");
    }).catch(() =>
      setReactionError("Não foi possível apagar a mensagem. Confira os limites do WhatsApp."));
  };

  const submitMessageAction = async () => {
    if (!messageAction || !actionMessage || actionBusy) return;
    setActionBusy(true);
    setReactionError("");
    try {
      if (messageAction === "edit") {
        if (!actionMessage.fromMe || !actionInput.trim())
          throw new Error("Escolha uma mensagem sua e um texto válido.");
        await edit(actionMessage, actionInput.trim());
      }
      setMessageAction(null);
      setActionMessage(null);
      setActionInput("");
    } catch (error) {
      setReactionError(error instanceof Error ? error.message : "Falha ao executar ação.");
    } finally {
      setActionBusy(false);
    }
  };

  const unread = chats.filter((chat) => chat.unreadCount > 0).length;
  const refreshCurrent = () => {
    if (section === "contacts") void refreshContacts();
    else if (section === "groups") void refreshGroups();
    else void refreshChats();
  };
  const openDialog = () => {
    setDialog("number");
    setDialogError("");
  };

  async function submitDialog() {
    if (!dialog || busy) return;
    setBusy(true);
    setDialogError("");
    try {
      await openNumber(phone);
      setPhone("");
      setSection("chats");
      setDialog(null);
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "Não foi possível concluir a operação.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <NavRail active={section} onChange={setSection} dark={dark} onToggleTheme={toggle} unread={unread} />
      <aside className={cn("flex h-full w-full flex-col border-r md:w-[360px] lg:w-[400px] md:shrink-0", selectedChat && "hidden md:flex")}>
        <WhatsAppConnection onConnected={onConnected} />
        {section === "settings" ? (
          <section className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto bg-panel p-5 pb-10">
            <h1 className="text-2xl font-bold">Configurações</h1>
            <p className="text-sm text-muted-foreground">Ideal-Zap local • WPPConnect</p>
            <SessionControls />
            <button type="button" onClick={toggle}
              className="rounded-lg border px-4 py-3 text-left text-sm hover:bg-selected">
              Tema atual: {dark ? "Escuro" : "Claro"} — alternar
            </button>
            <button type="button" onClick={refreshCurrent}
              className="rounded-lg border px-4 py-3 text-left text-sm hover:bg-selected">
              Atualizar conversas
            </button>
            <section className="space-y-3 rounded-xl border bg-card p-4">
              <h2 className="font-semibold">Notificações de mensagens</h2>
              <p className="text-xs text-muted-foreground">Ative para receber avisos também quando a conversa estiver aberta.
                Seu navegador pode pedir autorização. Funciona enquanto o Ideal-Zap estiver aberto.</p>
              <button type="button" onClick={() => void alerts.toggleDesktop()}
                className="w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-secondary"
                aria-pressed={alerts.desktopEnabled}>
                {alerts.desktopEnabled ? "✓ " : ""}Notificações do Windows: {alerts.desktopEnabled ? "Ligadas" : "Desligadas"}
              </button>
              <button type="button" onClick={alerts.toggleSound}
                className="w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-secondary"
                aria-pressed={alerts.soundEnabled}>
                {alerts.soundEnabled ? "✓ " : ""}Som ao receber mensagens: {alerts.soundEnabled ? "Ligado" : "Desligado"}
              </button>
              {alerts.insecureOrigin && <p role="alert" className="text-xs text-destructive">
                Neste computador o site está aberto por HTTP na rede local. Chrome e Edge exigem
                HTTPS confiável para permitir notificações do Windows. Use o acesso HTTPS seguro
                descrito em docs/NOTIFICACOES_REDE_LOCAL.md no computador servidor.
                O som na aba continua disponível.
              </p>}
              {alerts.permission === "denied" && !alerts.insecureOrigin && <p className="text-xs text-destructive">
                O navegador bloqueou notificações. Autorize notificações para este endereço nas configurações do navegador.
              </p>}
              {alerts.permission === "unsupported" && <p className="text-xs text-muted-foreground">
                Este navegador não oferece notificações do sistema.
              </p>}
            </section>
            <p className="text-xs text-muted-foreground">
              Os dados da sessão e as chaves ficam apenas no servidor local. O Ideal-Zap utiliza uma única sessão.
            </p>
          </section>
        ) : section === "favorites" ? (
          <FavoriteMessages messages={favoriteMessages} chats={[...chats, ...contacts, ...groups]}
            onSelect={(id) => { setSection("chats"); void select(id); }} />
        ) : (
          <div className="min-h-0 flex-1">
            <ChatList
              title={titles[section]} chats={visible} selectedId={selectedChat?.id}
              onSelect={select} onNewChat={openDialog} onRefresh={refreshCurrent}
              onMarkUnread={markUnread} onArchive={archive} onPin={pin}
              loading={loading && section === "chats"} error={listError}
            />
          </div>
        )}
      </aside>
      <main className={cn("h-full min-w-0 flex-1 flex-col", selectedChat ? "flex" : "hidden md:flex")}>
        {selectedChat ? (
          <ChatRenderBoundary key={selectedChat.id} chatId={selectedChat.id}
            onBack={() => void select(undefined)}>
          <div className="flex h-full flex-col animate-in fade-in duration-300">
            <ChatHeader contact={selectedChat.contact} onBack={() => void select(undefined)}
              onSearch={() => setSearchChat((current) => !current)}
              onManager={() => setManagerOpen(true)} />
            {searchChat && (
              <div className="flex items-center gap-3 border-b bg-panel-header p-2">
                <input type="search" autoFocus value={messageSearch}
                  onChange={(event) => { setMessageSearch(event.target.value); setActiveMatch(0); }}
                  placeholder="Pesquisar nas mensagens carregadas..."
                  className="min-w-0 flex-1 rounded-lg bg-card px-3 py-2 text-sm outline-none" />
                <span className="shrink-0 text-xs text-muted-foreground">
                  {messageSearch ? searchMatches.length : messages.length} encontradas
                </span>
                {!!searchMatches.length && <>
                  <span className="text-xs text-muted-foreground">
                    {(activeMatch % searchMatches.length) + 1}/{searchMatches.length}
                  </span>
                  <button type="button" aria-label="Ocorrência anterior" title="Anterior"
                    onClick={() => setActiveMatch((index) =>
                      (index - 1 + searchMatches.length) % searchMatches.length)}>
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button type="button" aria-label="Próxima ocorrência" title="Próxima"
                    onClick={() => setActiveMatch((index) => (index + 1) % searchMatches.length)}>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </>}
                <button type="button" className="text-xs underline" onClick={() => {
                  setSearchChat(false); setMessageSearch("");
                }}>Fechar</button>
              </div>
            )}
            {reactionError && <div className="px-4 py-2 text-xs text-destructive" role="alert">{reactionError}</div>}
            {actionNotice && <div className="flex items-center justify-between gap-3 bg-secondary px-4 py-2 text-xs" role="status">
              <span>{actionNotice}</span>
              <button type="button" onClick={() => setActionNotice("")} className="underline">Fechar</button>
            </div>}
            {actionError && (
              <div role="alert" className="bg-destructive/10 px-4 py-2 text-sm text-destructive">
                Não foi possível enviar: {actionError}
              </div>
            )}
            <div className="flex min-h-0 flex-1 flex-col">
              {historyError && (
                <div role="alert" className="mx-4 mt-3 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm">
                  <p>Não foi possível carregar o histórico: {historyError}</p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" disabled={historyLoading}
                      className="rounded-md border px-3 py-1.5 text-xs disabled:opacity-50"
                      onClick={() => void refreshMessages(selectedChat.id)}>Tentar novamente</button>
                    <button type="button" className="rounded-md border px-3 py-1.5 text-xs"
                      onClick={() => void select(undefined)}>Voltar à lista</button>
                  </div>
                </div>
              )}
              {historyLoading && messages.length === 0 && (
                <div role="status" className="mx-4 mt-3 rounded-lg bg-secondary p-3 text-center text-sm text-muted-foreground">
                  Carregando mensagens do WhatsApp...
                </div>
              )}
              {!historyLoading && historyLoaded && !historyError && messages.length === 0 && (
                <div role="status" className="mx-4 mt-3 rounded-lg bg-secondary p-3 text-center text-sm text-muted-foreground">
                  Nenhuma mensagem disponível neste momento. O WhatsApp pode ainda estar sincronizando o histórico.
                  <button type="button" className="ml-2 underline"
                    onClick={() => void refreshMessages(selectedChat.id)}>Atualizar mensagens</button>
                </div>
              )}
              <MessageList key={selectedChat.id} chatId={selectedChat.id} messages={messages} onReply={setQuoted} onReact={reactToMessage}
                onOpenContact={(phone) => {
                  void openNumber(phone).catch(() =>
                    setReactionError("Não foi possível abrir a conversa com o contato compartilhado."));
                }}
                onForward={(message) => startMessageAction("forward", message)}
                onEdit={(message) => startMessageAction("edit", message)}
                onDelete={deleteMessage}
                onStar={(message) => {
                  void star(message, !message.starred).then(({ synced }) => {
                    if (!synced) setActionNotice(
                      "Favorito salvo neste computador. O WhatsApp não confirmou a sincronização da estrela.");
                  }).catch(() => setReactionError("Não foi possível favoritar a mensagem."));
                }}
                searchTerm={messageSearch} selectedMatchId={selectedMatchId} />
            </div>
            <Composer chatId={selectedChat.id} onSend={send} onAttach={sendFile} onShareContact={() => setContactPickerOpen(true)}
              quoted={quoted} onCancelQuote={() => setQuoted(null)} />
          </div>
          </ChatRenderBoundary>
        ) : <EmptyChat />}
      </main>
      {contactPickerOpen && selectedChat && (
        <ContactShareDialog contacts={contacts} onLoad={() => void refreshContacts()}
          onSend={(id, name) => shareContact(id, name)}
          onClose={() => setContactPickerOpen(false)} />
      )}
      {managerOpen && selectedChat && (
        <ChatManagerTools key={selectedChat.id} chat={selectedChat}
          messages={messages} onClose={() => setManagerOpen(false)} />
      )}
      {forwardMessage && <ForwardDialog key={forwardMessage.id} message={forwardMessage}
        chats={chats} contacts={contacts} groups={groups}
        onCancel={() => setForwardMessage(null)}
        onForward={async (ids) => {
          const result = await forward(forwardMessage, ids);
          if (result.copiedAsText) setActionNotice(
            "Mensagem enviada como texto comum; o WPPConnect não confirmou o encaminhamento nativo.");
        }} />}
      {messageAction === "edit" && actionMessage && (
        <div role="dialog" aria-modal="true" aria-label="Ação de mensagem"
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-4">
          <form className="w-full max-w-md space-y-3 rounded-xl bg-card p-5"
            onSubmit={(event) => { event.preventDefault(); void submitMessageAction(); }}>
            <h2 className="text-xl font-semibold">Editar mensagem</h2>
            <input aria-label="Novo texto"
              autoFocus value={actionInput} onChange={(event) => setActionInput(event.target.value)}
              className="w-full rounded-md border bg-background p-3" />
            {reactionError && <p role="alert" className="text-xs text-destructive">{reactionError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" disabled={actionBusy}
                onClick={() => setMessageAction(null)} className="rounded-md border px-3 py-2">
                Cancelar</button>
              <button type="submit" disabled={actionBusy}
                className="rounded-md bg-primary px-3 py-2 text-primary-foreground">
                {actionBusy ? "Enviando..." : "Confirmar"}</button>
            </div>
          </form>
        </div>
      )}
      {dialog && (
        <div role="dialog" aria-modal="true" aria-label="Nova conversa"
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4">
          <form className="w-full max-w-md space-y-4 rounded-xl border bg-card p-6 shadow-xl"
            onSubmit={(event) => { event.preventDefault(); void submitDialog(); }}>
            <h2 className="text-xl font-semibold">Nova conversa</h2>
            <label className="block space-y-1 text-sm">
              <span>Telefone com DDI</span>
              <input autoFocus value={phone} onChange={(event) => setPhone(event.target.value)}
                placeholder="5511999999999" className="w-full rounded-md border bg-background p-3" />
            </label>
            {dialogError && <p role="alert" className="text-sm text-destructive">{dialogError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => setDialog(null)}
                className="rounded-md border px-4 py-2 text-sm">Cancelar</button>
              <button type="submit" disabled={busy}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
                {busy ? "Processando..." : "Abrir conversa"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
