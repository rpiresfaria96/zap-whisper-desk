import { describe, expect, it } from "vitest";
import { normalizeOperatorName, signOutgoingMessage } from "@/hooks/use-operator";

describe("Assinatura individual por computador", () => {
  it("assina o texto como o atendente local, sem criar novo login de WhatsApp", () => {
    expect(signOutgoingMessage("Bom dia!", "Rafael")).toBe("Bom dia!\n\n— Rafael");
    expect(signOutgoingMessage("Bom dia!", "Maria")).toBe("Bom dia!\n\n— Maria");
  });
  it("assina até legendas vazias de anexos e não assina quando o nome é vazio", () => {
    expect(signOutgoingMessage("", "Maria")).toBe("— Maria");
    expect(signOutgoingMessage("Texto", "")).toBe("Texto");
  });
  it("remove quebra de linha do nome", () => {
    expect(normalizeOperatorName(" Rafael\nSilva ")).toBe("Rafael Silva");
  });
});
