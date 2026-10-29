import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useIncomingAlerts } from "@/hooks/use-incoming-alerts";

describe("Alertas de mensagens", () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  it("ativa som na primeira utilização e respeita a escolha de desligar", () => {
    const first = renderHook(() => useIncomingAlerts());
    expect(first.result.current.soundEnabled).toBe(true);
    act(() => first.result.current.toggleSound());
    first.unmount();
    const second = renderHook(() => useIncomingAlerts());
    expect(second.result.current.soundEnabled).toBe(false);
  });
  it("avisa sobre outra conversa mesmo com janela em foco e elimina duplicatas", async () => {
    const shown = vi.fn();
    class NotificationMock {
      static permission = "granted";
      constructor(...args: unknown[]) { shown(...args); }
    }
    vi.stubGlobal("Notification", NotificationMock);
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    const { result } = renderHook(() => useIncomingAlerts());
    await act(async () => { await result.current.toggleDesktop(); });
    const message = { id: "incoming", chatId: "test", fromMe: false, body: "", timestamp: Date.now() };
    act(() => { result.current.onIncoming(message, false, "Maria"); result.current.onIncoming(message, false, "Maria"); });
    expect(shown).toHaveBeenCalledTimes(1);
    expect(shown).toHaveBeenCalledWith("Maria • Ideal-Zap", expect.objectContaining({ body: "Nova mensagem recebida." }));
    act(() => result.current.onIncoming({ ...message, id: "mine", fromMe: true }, false));
    act(() => result.current.onIncoming({ ...message, id: "old", timestamp: 1 }, false));
    expect(shown).toHaveBeenCalledTimes(1);
  });
});
