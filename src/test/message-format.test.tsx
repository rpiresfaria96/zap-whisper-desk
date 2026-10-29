import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FormattedMessage } from "@/components/chat/FormattedMessage";
import { Composer } from "@/components/chat/Composer";

describe("WhatsApp Web: texto e emojis", () => {
  it("formata negrito, italico, tachado e emojis sem executar HTML", () => {
    const { container } = render(
      <FormattedMessage text={"*Olá* _pessoal_ ~antigo~ 😀 ❤️ <img onerror=alert(1) />"} />
    );
    expect(container.querySelector("strong")?.textContent).toBe("Olá");
    expect(container.querySelector("em")?.textContent).toBe("pessoal");
    expect(container.querySelector("del")?.textContent).toBe("antigo");
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText(/😀/)).toBeInTheDocument();
  });

  it("abre a paleta maior que 12 emojis", () => {
    render(<Composer onSend={async () => {}} onAttach={async () => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Emojis" }));
    const picker = screen.getByRole("dialog", { name: "Selecionar emoji" });
    expect(picker.querySelectorAll("button").length).toBeGreaterThan(25);
  });
});
