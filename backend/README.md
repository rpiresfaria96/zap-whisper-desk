# Adaptador local do Ideal Zap para WPPConnect Server

Este backend mantém o token do WPPConnect fora do navegador. Ele é um adaptador de API local; não é o WPPConnect Server em si.

## Requisitos

- Node.js 20 ou mais recente.
- WPPConnect Server em execução e uma sessão já autenticada.
- O token Bearer da sessão.

## Configuração

1. Copie `.env.example` para `.env`, dentro desta pasta `backend`.
2. Configure `WPP_BASE_URL`, `WPP_SESSION` e `WPP_TOKEN`.
3. Na pasta raiz, crie um arquivo `.env` baseado em `.env.example` com `VITE_API_URL=http://127.0.0.1:3001`.
4. Na raiz do projeto, execute `npm run api` para iniciar o adaptador e `npm run dev` em outro terminal para iniciar a interface.

## Endpoints locais usados pela interface

- `GET /health`: verifica configuração local (não revela o token).
- `GET /status`: consulta o status da sessão no WPPConnect.
- `GET /chats`: lista conversas.
- `GET /chats/:id/messages`: carrega as últimas 100 mensagens (pode ser configurado por query string).
- `POST /chats/:id/messages`: envia texto.
- `GET /events`: envia atualizações via SSE, consultando o endpoint de novas mensagens do WPPConnect a cada 5 segundos enquanto houver clientes conectados.

## Segurança

- O servidor escuta somente em `127.0.0.1`, não na rede local.
- Nunca compartilhe o arquivo `.env` nem coloque seu token em variáveis `VITE_*`.
- Este adaptador foi feito para a API REST de versões atuais do WPPConnect Server. Como versões e formatos podem variar, valide a leitura e o envio usando sua sessão real antes de usar em produção.
