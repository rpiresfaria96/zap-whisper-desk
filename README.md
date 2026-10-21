# Zap Whisper Desk — Ideal Zap

Interface local de mensagens em React, TypeScript e Tailwind CSS. O projeto foi criado no Lovable e está conectado a este repositório.

A interface usa dados fictícios por padrão. Para conversar usando uma sessão real do WPPConnect Server, há um adaptador Node.js local que mantém o token fora do navegador.

## Requisitos

- Node.js 20 ou superior.
- WPPConnect Server funcionando, com a sessão já conectada ao WhatsApp.
- Token Bearer válido da sessão do WPPConnect.

## Configuração inicial (Windows)

1. Baixe/clone este repositório no computador em que vai rodar a interface.
2. Na pasta raiz, execute `npm install`.
3. Copie o arquivo raiz `.env.example` para `.env`. Ele deve conter `VITE_API_URL=http://127.0.0.1:3001`.
4. Copie `backend/.env.example` para `backend/.env`.
5. Edite `backend/.env` e preencha:
   - `WPP_BASE_URL`: endereço do seu WPPConnect Server, normalmente `http://127.0.0.1:21465`.
   - `WPP_SESSION`: nome exato da sessão.
   - `WPP_TOKEN`: token Bearer gerado para essa sessão, sem publicar ou compartilhar esse valor.
6. Execute `npm run api` em um terminal.
7. Em outro terminal, execute `npm run dev`.
8. Abra a URL indicada pelo Vite (normalmente `http://localhost:5173`).

Como alternativa, depois de criar os dois arquivos `.env`, execute `INICIAR_LOCAL.bat` para abrir o backend, a interface e o navegador em janelas separadas.

## Verificação

- Abra `http://127.0.0.1:3001/health`: mostra se o adaptador encontrou a configuração (nunca exibe o token).
- Abra `http://127.0.0.1:3001/status`: consulta o estado da sessão no WPPConnect.
- A interface deve carregar as conversas reais quando o adaptador estiver configurado. Se o token, a sessão ou a rota da API estiverem incorretos, confira a mensagem no terminal da janela “Ideal Zap - API local”.

## O que a primeira integração suporta

- Listar conversas.
- Ler as últimas mensagens de uma conversa.
- Enviar mensagens de texto.
- Atualizar mensagens recebidas por SSE, consultando o endpoint de novas mensagens do WPPConnect.

Ainda não foram integrados anexos, envio de áudio, chamadas, edição de mensagens ou uma tela para iniciar/vincular sessão por QR Code. A sessão do WhatsApp precisa estar autenticada no WPPConnect antes do uso.

## Segurança

- O adaptador escuta apenas em `127.0.0.1`, não fica disponível para outros computadores da rede.
- O token deve ficar apenas em `backend/.env`. Nunca o coloque em uma variável `VITE_*`, nem envie esse arquivo para o GitHub.
- As rotas e os formatos do WPPConnect Server podem mudar entre versões. Teste leitura e envio primeiro com uma conversa de teste.

## Desenvolvimento

```bash
npm run dev
npm run api
npm run build
npm run lint
npm test
```

O código do projeto sincroniza com o editor do Lovable conectado a este repositório.
