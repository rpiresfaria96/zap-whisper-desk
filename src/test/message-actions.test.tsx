import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MessageList } from "@/components/chat/MessageList";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ForwardDialog } from "@/components/chat/ForwardDialog";
import { Composer } from "@/components/chat/Composer";
import type { Chat } from "@/lib/chat/types";
import type { Message } from "@/lib/chat/types";

const messages: Message[] = [
  { id: "a1", chatId: "test@c.us", fromMe: false, body: "Mensagem de teste",
    timestamp: 1750000000000 },
  { id: "a2", chatId: "test@c.us", fromMe: true, body: "Arquivo recebido",
    timestamp: 1750000010000, quotedId: "a1", quotedText: "Mensagem de teste",
    reactions: ["❤️"], starred: true },
  { id: "a3", chatId: "test@c.us", fromMe: false, body: "Outra mensagem",
    timestamp: 1750000020000 },
];

describe("Cartões compartilhados recebidos", () => {
  it("mostra botões Conversar e Salvar contato para vCard com telefone", () => {
    const openContact = vi.fn();
    render(<MessageBubble message={{
      ...messages[0]!, body: "[Contato] Maria",
      contactCard: { name: "Maria", phone: "+5565999999999" },
    }} tail onOpenContact={openContact} />);
    fireEvent.click(screen.getByRole("button", { name: "Conversar" }));
    expect(openContact).toHaveBeenCalledWith("+5565999999999");
    expect(screen.getByRole("button", { name: "Salvar no telefone" })).toBeInTheDocument();
  });

  it("não permite conversar quando o cartão não tem telefone", () => {
    render(<MessageBubble message={{
      ...messages[0]!, contactCard: { name: "Sem número", phone: "" },
    }} tail />);
    expect(screen.queryByRole("button", { name: "Conversar" })).not.toBeInTheDocument();
    expect(screen.getByText(/sem número legível/)).toBeInTheDocument();
  });
});

describe("Pesquisa e acoes das mensagens", () => {
  it("pesquisa destaca termo sem esconder outras mensagens", () => {
    const { container } = render(
      <MessageList messages={messages} searchTerm="teste" selectedMatchId="a1" />,
    );
    expect(screen.getByText("Outra mensagem")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-search-message]").length).toBe(3);
    expect(container.querySelector("mark")?.textContent).toBe("teste");
  });

  it("resposta citada e reacao ficam visiveis na propria interface", () => {
    render(<MessageBubble message={messages[1]!} tail />);
    expect(screen.getByText("Em resposta a uma mensagem")).toBeInTheDocument();
    expect(screen.getByLabelText("Reações")).toHaveTextContent("❤️");
  });

  it("reação aparece na borda do balão e exibe a marca de edição", () => {
    const { container } = render(<MessageBubble
      message={{ ...messages[1]!, edited: true }} tail />);
    expect(screen.getByText("Editada")).toBeInTheDocument();
    expect(screen.getByLabelText("Reações").className).toContain("-bottom-2.5");
    expect(container.querySelector('[aria-label="Mensagem favorita"]')).toBeInTheDocument();
  });

  it("fecha o menu ao clicar fora", () => {
    render(<MessageBubble message={messages[1]!} tail onForward={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Mais ações da mensagem" }));
    expect(screen.getByText("Encaminhar")).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByText("Encaminhar")).not.toBeInTheDocument();
  });

  it("seleciona mais de um contato para encaminhar", async () => {
    const chats: Chat[] = [1, 2, 3].map((n) => ({
      id: `551199999000${n}@c.us`,
      contact: { id: `551199999000${n}@c.us`, name: `Pessoa ${n}`, phone: `+551199999000${n}` },
      unreadCount: 0,
    }));
    const send = vi.fn().mockResolvedValue(undefined);
    render(<ForwardDialog message={messages[0]!} chats={chats} contacts={[]}
      groups={[]} onCancel={vi.fn()} onForward={send} />);
    fireEvent.click(screen.getByText("Pessoa 1"));
    fireEvent.click(screen.getByText("Pessoa 2"));
    fireEvent.click(screen.getByRole("button", { name: /Encaminhar/ }));
    await vi.waitFor(() => expect(send).toHaveBeenCalledWith(
      ["5511999990001@c.us", "5511999990002@c.us"],
    ));
  });

  it("enfileira dois documentos arrastados", async () => {
    const sendFile = vi.fn().mockResolvedValue(undefined);
    render(<Composer onSend={vi.fn()} onAttach={sendFile} />);
    const files = [new File(["a"], "a.txt"), new File(["b"], "b.txt")];
    fireEvent.drop(window, { dataTransfer: { types: ["Files"], files } });
    expect(screen.getByRole("button", { name: /1\. a\.txt/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /2\. b\.txt/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enviar 2 arquivo(s)" }));
    await vi.waitFor(() => expect(sendFile).toHaveBeenCalledTimes(2));
  });

  it("permite soltar arquivo em qualquer lugar da janela", () => {
    render(<Composer onSend={vi.fn()} onAttach={vi.fn()} />);
    const file = new File(["arquivo-teste"], "teste.txt", { type: "text/plain" });
    const dataTransfer = { types: ["Files"], files: [file] };
    fireEvent.dragEnter(window, { dataTransfer });
    expect(screen.getByText("Solte o arquivo para anexar à conversa")).toBeInTheDocument();
    fireEvent.drop(window, { dataTransfer });
    expect(screen.getByText("teste.txt")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar 1 arquivo(s)" })).toBeInTheDocument();
  });
  it("mostra encaminhar, editar e apagar nas acoes", () => {
    const forward = vi.fn();
    const edit = vi.fn();
    const remove = vi.fn();
    render(<MessageBubble message={messages[1]!} tail
      onForward={forward} onEdit={edit} onDelete={remove} />);
    fireEvent.click(screen.getByRole("button", { name: "Mais ações da mensagem" }));
    fireEvent.click(screen.getByRole("button", { name: "Encaminhar" }));
    expect(forward).toHaveBeenCalledOnce();
  });
});
