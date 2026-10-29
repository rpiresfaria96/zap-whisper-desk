import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ContactShareDialog } from "@/components/chat/ContactShareDialog";
import type { Chat } from "@/lib/chat/types";

const contacts: Chat[] = [
  { id: "5565999990001@c.us", contact: {
    id: "5565999990001@c.us", name: "Contato Teste", phone: "+5565999990001" },
    unreadCount: 0 },
];

describe("Compartilhamento de cartões de contato", () => {
  it("escolhe um contato salvo e envia o cartão", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<ContactShareDialog contacts={contacts} onLoad={vi.fn()}
      onSend={onSend} onClose={onClose} />);
    fireEvent.click(screen.getByText("Contato Teste"));
    fireEvent.click(screen.getByRole("button", { name: /Avançar/ }));
    expect(screen.getByText("Prévia do contato")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Enviar contato/ }));
    await vi.waitFor(() => expect(onSend).toHaveBeenCalledWith("5565999990001@c.us", "Contato Teste"));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("recusa envio sem telefone e nome", async () => {
    const onSend = vi.fn();
    render(<ContactShareDialog contacts={[]} onLoad={vi.fn()}
      onSend={onSend} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Avançar/ })).toBeDisabled();
    fireEvent.click(screen.getByText("+ Compartilhar número não salvo"));
    fireEvent.click(screen.getByRole("button", { name: "Visualizar contato" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Informe nome e telefone");
    expect(onSend).not.toHaveBeenCalled();
  });
});
