import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportUiCrash } from "@/lib/ui-diagnostics";

interface Props {
  chatId: string;
  onBack: () => void;
  children: ReactNode;
}
interface State {
  failed: boolean;
  retries: number;
}

export class ChatRenderBoundary extends Component<Props, State> {
  override state: State = { failed: false, retries: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    reportUiCrash("UI_RENDER_ERROR", error, info.componentStack || undefined);
  }

  override componentDidUpdate(previousProps: Props) {
    if (previousProps.chatId !== this.props.chatId && this.state.failed) {
      this.setState({ failed: false, retries: 0 });
    }
  }

  override render() {
    if (this.state.failed) {
      return (
        <div role="alert" className="flex h-full min-h-[320px] flex-col items-center justify-center gap-4 bg-panel px-6 text-center">
          <h2 className="text-lg font-semibold">Não foi possível exibir esta conversa</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            O WhatsApp retornou mensagens, mas ocorreu um problema ao desenhar a conversa.
            O erro técnico foi registrado no LOG_DIAGNOSTICO.txt, sem copiar mensagens.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button type="button" className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
              onClick={() => this.setState((prev) => ({ failed: false, retries: prev.retries + 1 }))}>
              Tentar novamente
            </button>
            <button type="button" className="rounded-lg border px-4 py-2 text-sm"
              onClick={this.props.onBack}>
              Voltar às conversas
            </button>
          </div>
        </div>
      );
    }
    // O key e controlado pelo pai, reiniciando estado ao trocar de conversa.
    return this.props.children;
  }
}
