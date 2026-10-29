import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChatManagerTools } from "@/components/chat/ChatManagerTools";
import type { Chat } from "@/lib/chat/types";

const { groupDetails, listLabels, setChatLabel, createLabel } = vi.hoisted(() => ({
  groupDetails: vi.fn(),
  listLabels: vi.fn(),
  setChatLabel: vi.fn(),
  createLabel: vi.fn(),
}));

vi.mock("@/lib/chat/service", () => ({
  chatService: { groupDetails, listLabels, setChatLabel, createLabel },
}));

const testChat: Chat = {
  id: "123456789-1710000000@g.us",
  contact: { id: "123456789-1710000000@g.us", name: "Grupo Teste", phone: "" },
  unreadCount: 0,
};

describe("Funções do Manager na interface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    groupDetails.mockResolvedValue({ name: "Grupo Teste", description: "Equipe",
      count: 3, participants: [{ id: "5511999999999@c.us", admin: true }] });
    listLabels.mockResolvedValue([{ id: "76", name: "Clientes" }]);
    setChatLabel.mockResolvedValue(undefined);
    createLabel.mockResolvedValue(undefined);
  });

  it("exibe participantes do grupo e etiquetas disponíveis", async () => {
    render(<ChatManagerTools chat={testChat} messages={[]} onClose={vi.fn()} />);
    expect(await screen.findByText("3 participante(s)")).toBeInTheDocument();
    expect(await screen.findByText("Clientes")).toBeInTheDocument();
  });

  it("remove silenciamento e aplica etiqueta pelo serviço local", async () => {
    render(<ChatManagerTools chat={testChat} messages={[]} onClose={vi.fn()} />);
    expect(screen.queryByText("Silenciar notificações")).not.toBeInTheDocument();
    await screen.findByText("Clientes");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    await vi.waitFor(() => expect(setChatLabel).toHaveBeenCalledWith(testChat.id, "76", "add"));
  });
});
