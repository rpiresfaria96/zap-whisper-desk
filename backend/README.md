# API local do Ideal Zap

O backend Node.js faz a ponte entre a interface e o WPPConnect Server sem enviar o token secreto ao navegador.

## Inicialização

Não há mais lançador separado para a API. Execute na raiz:

1. `PREPARAR_AMBIENTE.bat` na primeira instalação;
2. `INICIAR.bat` nas utilizações seguintes.

O inicializador gera/atualiza o token da sessão automaticamente em `backend/.env` **antes** de abrir a API. Não é necessário copiar o token nem reiniciar a API manualmente.

## Configuração local (somente para diagnóstico)

- `WPP_BASE_URL=http://127.0.0.1:8788`
- `WPP_SESSION=Ideal Contabilidade`
- `WPP_TOKEN=` gerado pelo `scripts/configurar-sessao.ps1`
- `API_PORT=3001`

Guarde `backend/.env` apenas no computador; ele é ignorado pelo Git.

## Rotas

- `GET /health`: saúde e configuração (sem credenciais).
- `GET /connection`: status e QR Code de conexão, quando disponível.
- `POST /connection/start`: solicita início da sessão.
- `GET /status`: informações do estado da sessão (uso local).
- `GET /chats`: lista de conversas.
- `GET /chats/:id/messages`: últimas mensagens.
- `POST /chats/:id/messages`: envio de texto.
- `GET /events`: atualizações via SSE.

O backend escuta somente em `127.0.0.1` e restringe origens de navegador. O fluxo ainda precisa ser validado em Windows com uma sessão de WhatsApp real antes de uso diário.
