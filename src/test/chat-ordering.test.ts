import { describe, expect, it } from "vitest";
import { lastActivity, newestMessage, sortChatsByActivity } from "@/lib/chat/ordering";
import type { Chat, Message } from "@/lib/chat/types";

const sample = (id: string, activityAt: number, pinned = false): Chat => ({
  id, contact: { id, name: id, phone: "" }, unreadCount: 0, activityAt, pinned,
});
const msg = (id: string, timestamp: number, body = "Mensagem"): Message => ({
  id, chatId: "chat", body, timestamp, fromMe: false,
});

describe("ordem de conversas e mensagens", () => {
  it("ordena pela atividade do WhatsApp mesmo sem preview", () => {
    const old = sample("antiga", 10000);
    const recent = sample("recente", 20000);
    expect([old, recent].sort(sortChatsByActivity).map((c) => c.id))
      .toEqual(["recente", "antiga"]);
  });
  it("respeita conversas fixadas", () => {
    expect([sample("recente", 20000), sample("fixada", 1000, true)]
      .sort(sortChatsByActivity)[0]?.id).toBe("fixada");
  });
  it("não regride uma prévia recebida por SSE para uma resposta antiga", () => {
    expect(newestMessage(msg("nova", 2000), msg("velha", 1000))?.id).toBe("nova");
    expect(newestMessage(msg("velha", 1000), msg("nova", 2000))?.id).toBe("nova");
  });
  it("considera a última mensagem mais recente que o timestamp do chat", () => {
    const chat = { ...sample("c", 1000), lastMessage: msg("latest", 2500) };
    expect(lastActivity(chat)).toBe(2500);
  });
});
