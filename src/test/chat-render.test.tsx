import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageList } from "@/components/chat/MessageList";
import { ChatRenderBoundary } from "@/components/chat/ChatRenderBoundary";
import type { Message } from "@/lib/chat/types";

function buildHistory(): Message[] {
  const now = Date.now();
  return Array.from({ length: 80 }, (_, i) => ({
    id: `message-${i}`,
    chatId: "test@g.us",
    body: `Mensagem de teste ${i + 1}`,
    fromMe: i % 2 === 0,
    timestamp: now - (80 - i) * 60_000,
    ...(i % 13 === 0 ? { mediaType: "image" as const } : {}),
  }));
}

describe("Mensagens reais na interface", () => {
  it("exibe até 80 mensagens e mídias sem derrubar a conversa", () => {
    const { container } = render(<MessageList messages={buildHistory()} />);
    expect(screen.getByText("Mensagem de teste 1")).toBeInTheDocument();
    expect(screen.getByText("Mensagem de teste 80")).toBeInTheDocument();
    expect(container.querySelectorAll('button').length).toBeGreaterThan(0);
  });

  it("isola um erro de render e mantém a opção de voltar", () => {
    const back = vi.fn();
    const originalError = console.error;
    console.error = () => {};
    function Throws(): never { throw new Error("rendering failed"); }
    try {
      render(
        <ChatRenderBoundary chatId="test@g.us" onBack={back}>
          <Throws />
        </ChatRenderBoundary>,
      );
      expect(screen.getByText("Não foi possível exibir esta conversa")).toBeInTheDocument();
      screen.getByRole("button", { name: "Voltar às conversas" }).click();
      expect(back).toHaveBeenCalledTimes(1);
    } finally {
      console.error = originalError;
    }
  });
});
