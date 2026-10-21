import { Laptop, Lock } from "lucide-react";

export function EmptyChat() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 border-b-4 border-primary bg-panel-header px-8 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Laptop className="h-11 w-11" />
      </div>
      <h2 className="text-3xl font-light tracking-tight">Ideal Zap</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Envie e receba mensagens direto do seu computador. Selecione uma conversa para começar.
      </p>
      <p className="mt-8 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="h-3 w-3" /> Protegido com criptografia de ponta a ponta
      </p>
    </div>
  );
}
