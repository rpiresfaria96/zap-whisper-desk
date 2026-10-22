# Adaptador local do Ideal Zap para WPPConnect Server

O adaptador mantém o token do WPPConnect fora do navegador e escuta apenas em `127.0.0.1:3001`.

A configuração é feita em `backend/.env`:
- `WPP_BASE_URL=http://127.0.0.1:8787`
- `WPP_SESSION=Ideal`
- `WPP_TOKEN=` valor `token` (hash) retornado por `POST /api/:session/:secretkey/generate-token`; não use `full`, porque o adaptador envia o token como `Authorization: Bearer <token>` e já informa a sessão na URL.

O token é específico da sessão. Depois de gerar uma `SECRET_KEY` nova ou instalar um servidor limpo, gere/consulte um token válido para a sessão recém-vinculada. Nunca compartilhe esse token nem coloque-o em variáveis `VITE_*`.

## Rotas locais

- `GET /health`: estado da configuração (sem revelar segredos).
- `GET /status`: estado da sessão.
- `GET /chats`: conversas.
- `GET /chats/:id/messages`: últimas mensagens.
- `POST /chats/:id/messages`: envia texto.
- `GET /events`: fluxo de novas mensagens (SSE).

A integração deve ser validada com a versão e sessão reais antes de uso diário. Recursos além da leitura de conversas, histórico e mensagens de texto ainda podem exigir adaptação específica.
