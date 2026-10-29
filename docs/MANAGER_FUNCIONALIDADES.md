# Ideal-Zap — mapa de funcionalidades do WPPConnect Manager

Revisão: 22/10/2026. Bases examinadas:
- WPPConnect Manager **v2.0.0**: `src/App.tsx`, `src/Workspace.tsx`, `src/Chat.tsx`, `src/api.ts` e README.pt-BR.
- WPPConnect Server **v2.10.61**: `src/routes/index.ts`, `src/controller/deviceController.ts` e `src/controller/sessionController.ts`.
- Código da branch `feat/conexao-whatsapp-na-interface` do Ideal-Zap.

**Definições:** **Validado** = o usuário confirmou com sessão real; **Implementado em código / testar** = integrado na interface/backend, mas falta confirmar com WhatsApp real; **Parcial** = fluxo existente, porém incompleto; **Pendente** = não implementado no Ideal-Zap. Não confundir "a API disponibiliza" com "o recurso funciona no Ideal-Zap".

## Funcionalidades existentes no Manager oficial 2.0.0

| Funcionalidade do Manager | Estado no Ideal-Zap | Observação / próxima validação |
|---|---|---|
| Iniciar servidor local | **Validado** | Node + WPPConnect + API + Vite em dois BATs. |
| Conectar via QR Code | **Validado** | Usuário confirmou leitura e conexão em 22/10. |
| Status da sessão | **Validado** | Painel conectado/desconectado + diagnóstico local. |
| Nova sessão / múltiplas sessões | **Pendente** | Projeto atualmente vincula uma sessão técnica; requer gerenciador de sessões, tokens separados e alternância segura. |
| Reconectar e regenerar QR | **Parcial** | Implementado; falhas anteriores corrigidas, validar reinícios posteriores. |
| Encerrar sessão sem logout | **Pendente** | Criar comando local autenticado e confirmação na UI. |
| Logout (desvincular WhatsApp) | **Pendente** | Evitar perda acidental da sessão; confirmação dupla. |
| Limpar dados de sessão | **Pendente** | Alto risco de perda de dados; backup e fluxo de permissão antes. |
| Acesso administrativo por chave | **Não incorporado à UI** | Chaves ficam nos arquivos de backend; não expor no navegador. |
| Perfis de múltiplos servidores | **Fora do escopo inicial** | Ideal-Zap opera com um servidor local fixo; arquitetura multi-servidor precisaria autenticação/HTTPS. |
| Listar conversas | **Implementado em código / testar** | Usa `list-chats` com fallback `all-chats`; o log grava contagem de registros brutos/normalizados. |
| Buscar conversas por nome/número | **Implementado em código / testar** | Busca local na lista já carregada. |
| Histórico de mensagens | **Implementado em código / testar** | `all-messages-in-chat` como Manager; fallback `get-messages`. Limitado à história sincronizada no WhatsApp. |
| Enviar mensagens de texto | **Implementado em código / testar** | `send-message`, com confirmação/erro visíveis. |
| Receber mensagens/eventos | **Parcial** | SSE de polling + atualização periódica de listas; não é ainda o Socket.IO autenticado por sessão do Manager. |
| Listar contatos | **Implementado em código / testar** | `all-contacts`. |
| Listar grupos | **Implementado em código / testar** | `all-groups`. |
| Abrir nova conversa por número | **Implementado em código / testar** | Informe telefone com DDI; contato pode não existir ou não estar no WhatsApp. |
| Criar grupo | **Implementado em código / testar** | `create-group`; requer nome e participantes. |
| Enviar anexos | **Implementado em código / testar** | `send-file-base64`; limite inicial conservador de **8 MB** por arquivo (Manager usa até 20 MB). |
| Ler imagens, áudio, vídeo, stickers e documentos | **Implementado em código / testar** | Carregar sob demanda via `download-media`; tamanho/mimetype limitados. |
| Tema claro/escuro | **Implementado** | Já disponível e alternável na interface. |
| Interface responsiva | **Implementado / revisar** | Estrutura responsiva existente, requer QA em telas pequenas. |
| Português/inglês | **Parcial** | Ideal-Zap em português; internacionalização para inglês pendente. |
| Painel de visão geral/sessões | **Parcial** | Status/QR no painel de conexão; falta visão de múltiplas sessões e ações administrativas. |
| Atualizar manualmente listas | **Implementado em código / testar** | Botão de atualização na lista. |
| Download de mídia/arquivo | **Implementado em código / testar** | Links gerados de mídia obtida da API local. |

## WhatsApp Web: recursos adicionais que o Manager não implementa como chat completo

O WPPConnect Server inclui muitas rotas que **não são telas prontas** do Manager. Priorização sugerida para aproximar o Ideal-Zap do WhatsApp Web:

| Prioridade | Recurso | Estado | Dependência conhecida |
|---|---|---|---|
| P0 | Conversas e histórico reais, nomes, mensagens enviadas/recebidas | **Implementado em código / testar** | Testar sincronização com conta conectada; verificar log CHATS_LOADED e MESSAGES_LOADED. |
| P0 | Envio de texto e anexos, renderização de mídias | **Implementado em código / testar** | Testar com conta própria e arquivo pequeno. |
| P1 | Responder citando mensagem | **Pendente** | Rota `send-reply`, UI de citação e ID correto. |
| P1 | Reações com emoji | **Pendente** | `react-message`, atualização de mensagens. |
| P1 | Encaminhar mensagens | **Pendente** | `forward-messages`, seletor de destinos. |
| P1 | Apagar e editar mensagens | **Pendente** | `delete-message`, `edit-message` e confirmações. |
| P1 | Marcar como lida e não lida | **Pendente** | `send-seen` e `mark-unseen`. |
| P1 | Fixar e arquivar conversas | **Pendente** | `pin-chat` e `archive-chat`. |
| P1 | Busca dentro da conversa | **Pendente** | Filtro do histórico carregado ou API específica. |
| P1 | Busca de contatos e foto de perfil | **Parcial** | Lista/nome implementados; melhorar avatar e cache autorizado. |
| P2 | Gravar/enviar áudio por microfone | **Pendente** | `send-voice-base64`, MediaRecorder, permissão e testes em browsers. Botão de gravação fictício foi desativado. |
| P2 | Digitação e gravação em andamento | **Pendente** | `typing`, `recording`, indicadores remotos. |
| P2 | Presença online/último acesso | **Pendente** | `chat-is-online`, `last-seen`; depende das permissões de privacidade do contato. |
| P2 | Figurinhas/arrastar e soltar arquivos | **Pendente/parcial** | Anexar arquivo existe, mas fluxo específico de sticker e drag-and-drop falta. |
| P2 | Mensagens favoritas, temporárias e silenciamento | **Pendente** | `star-message`, `temporary-messages`, `send-mute`. |
| P2 | Gerenciar participantes e informações de grupos | **Pendente** | Diversas rotas de grupo; autenticação e permissões de administrador. |
| P3 | Etiquetas (WhatsApp Business) | **Pendente** | Rotas de labels; suporte depende da conta. |
| P3 | Catálogo, produtos, coleções | **Pendente** | Endpoints de catálogo no Server, sobretudo WhatsApp Business. |
| P3 | Stories/status | **Pendente** | Rotas para texto, imagem e vídeo. |
| P3 | Envio de localização, enquetes e contatos | **Pendente** | Rotas de envio; UX específica. |
| Limitação | Fazer/receber chamadas de voz/vídeo como no WhatsApp Web | **Não disponível nesta arquitetura** | O Manager não implementa chamadas nativas; exigiria outra tecnologia/integração. Ícones foram desativados para não aparentar recurso funcional. |

## Próximos passos recomendados

1. **Validar o P0 no Windows:** fechar os três processos, GitHub Desktop Fetch/Pull na branch, `INICIAR.bat`, abrir Conversas e Contatos. Ver `LOG_DIAGNOSTICO.txt` para `CHATS_LOADED`, `CONTACTS_LOADED`, `MESSAGES_LOADED`. Confirmar nomes, IDs e datas; enviar mensagem à própria conta/teste.
2. Verificar fotos, mensagens com documentos/imagens, eventos/atualizações ao vivo. Ajustar normalizadores e erros de API que a conta real revelar.
3. Fechar recursos P1: respostas, reação, encaminhamento, apagar/editar, lidas, arquivamento/fixação e pesquisa.
4. Depois P2/P3 e gerenciamento de múltiplas sessões/atendentes: separar usuários/permissões antes de disponibilizar o serviço pela rede local.

**Segurança:** tokens do WPPConnect, chave administrativa e segredos de webhook **nunca** devem ir para React. O servidor local controla autenticação e normaliza dados. Não pedir arquivo `.env`, QR, `userDataDir` ou logs brutos da sessão para suporte.

**Testes:** implementação no GitHub não comprova funcionamento contra uma sessão WhatsApp real. O build, envio e recuperação de mídia desta etapa **ainda precisam ser testados no Windows**.


## Retorno do primeiro teste de lista de chats (22/10/2026)

**Confirmado pelo usuário:** tema claro/escuro funcionando; conversas carregando; contatos e grupos aparentemente listados. **Falhou no teste:** selecionar um contato não mostrou o histórico, exigindo voltar à lista; envio de mensagens e anexos ainda não testados.

A branch recebeu correções específicas para testar novamente:
- `/chats/:id/messages` passa a consultar primeiro o `get-messages` oficial do WPPConnect 2.10.61 com `count=80`, recorrendo a `all-messages-in-chat` (rota usada pelo Manager) se houver erro ou lista vazia.
- O backend grava `HISTORY_REQUESTED`, `HISTORY_GET_MESSAGES`, `HISTORY_LEGACY_MESSAGES`, `HISTORY_GET_FAILED`, `HISTORY_LEGACY_FAILED`, `HISTORY_BOTH_FAILED` e `MESSAGES_LOADED`, sem escrever qualquer nome, telefone ou texto de mensagem.
- A interface mostra carregamento, erro, botão **Tentar novamente**, estado vazio/pendente de sincronização e botão **Voltar à lista**, inclusive no desktop; a navegação não fica presa esperando o WhatsApp.
- O log inclui eventos técnicos `[WEB] HISTORY_OPENED`, `HISTORY_RENDERED` e `HISTORY_ERROR`. A interface não envia identificadores dos contatos.
- Requisições antigas não sobrescrevem as mensagens de uma seleção mais recente.

**Validação pendente:** reiniciar os serviços depois de Fetch/Pull na branch, abrir uma conversa e copiar `LOG_DIAGNOSTICO.txt` caso o histórico continue ausente. A causa do resultado anterior ainda não está confirmada sem esse novo log.


## Teste de 13:50 (22/10/2026) — API carrega histórico, interface cai

O usuário relatou tela `This page didn't load` ao abrir conversa privada e grupo. O log comprova:
- WPPConnect conectado (`AUTH_EVENT isLogged`, `inChat`, `SESSION_CONNECTED`).
- `314` conversas, `10674` contatos e `29` grupos disponibilizados pela API.
- Ao abrir conversa privada `@lid`, `HISTORY_GET_MESSAGES {count:80}` e `MESSAGES_LOADED {count:80}`; mesmo resultado em grupo.
- A antiga linha `WEB HISTORY_RENDERED` era emitida **logo após a resposta HTTP**, antes de o React desenhar o histórico; não provava que as mensagens estavam na tela.
- A página de erro em inglês é a fronteira de erro do TanStack e/ou do servidor React Start, portanto a falha é de **interface/renderização** ou SSR, não da busca no WPPConnect. **Ainda não há a exceção exata no log enviado.**

Alterações desta rodada:
- `ChatRenderBoundary` limita falhas de renderização à conversa e mantém a interface/lista e o botão **Voltar às conversas**.
- Substituída a rolagem global via `scrollIntoView` por rolagem no contêiner das mensagens, menos propensa a erro/recarregamento.
- Captura segura de categoria de erro em `WEB UI_RENDER_ERROR`, `WEB UI_ROOT_ERROR` e `WEB UI_SERVER_ERROR`; registra somente categoria conhecida e componente, nunca stack/mensagem/contato. O erro SSR também passa a ser enviado à API local quando rodar em Windows.
- Diferenciamos `HISTORY_DATA_READY` (HTTP retornou) de `HISTORY_DOM_MOUNTED` (mensagens chegaram ao DOM React). Assim, um novo log pode localizar o ponto da falha.
- Mensagem de erro foi traduzida para português e passou a apontar para `LOG_DIAGNOSTICO.txt`.
- Adicionado teste de renderização de 80 mensagens e de isolamento de erro no componente `src/test/chat-render.test.tsx` (aguarda execução).

**Status real:** listagem de conversas, contatos e grupos confirmada pelo log. Carregar **dados** de histórico de 80 mensagens confirmado pelo log. **Exibir** o histórico não está validado; nova rodada exige atualizar via GitHub Desktop, reiniciar `INICIAR.bat` e clicar em conversa/grupo. Se falhar, enviar o novo `LOG_DIAGNOSTICO.txt` com a linha `UI_RENDER_ERROR`/`UI_ROOT_ERROR`/`UI_SERVER_ERROR`.


## Auditoria de UX após testes de mensagens — correções P0 (22/10/2026)

**Relato do usuário:** conversas de texto estão aparecendo; envio de texto foi testado; mensagem para a própria conta apareceu duplicada; resumos de última mensagem sob nomes estavam vazios; imagens, áudios e documentos não abriam corretamente; algumas fotos de perfil não carregavam; formatação do texto e catálogo de emojis eram insuficientes.

Alterações da branch nesta etapa (ainda requerem validação no Windows):
- **Prévia da última mensagem:** ampliação do normalizador WPP (`lastMsg`, `lastMessageObj`, `last_message`, `msgs`) e busca das últimas mensagens sob demanda para cada conversa visível (`GET /chats/:id/preview`). Um lote inicial de até 40 conversas pode ser preenchido em segundo plano, com cache; não são feitas centenas de requisições a cada atualização.
- **Duplicação ao enviar para si:** antes o backend retornava um ID fictício `local-...`, e a sincronização trazia a mesma mensagem com o ID real. O backend agora confirma o envio sem inventar ID; a interface aguarda a mensagem oficial para exibição, incluindo SSE e atualização do histórico.
- **Mídia recebida:** `get-media-by-message` como rota principal, `download-media` alternativa; PNG/JPEG/WebP/áudio/vídeo/documentos validados. Imagens e figurinhas são carregadas automaticamente apenas quando visíveis; áudio, vídeo e arquivos permitem carregar/baixar com nova tentativa. Erros técnicos são registrados por categoria, nunca com conteúdo.
- **Fotos de perfil:** rota `GET /avatars/:id` consulta `profile-pic` do WPPConnect, limita hosts externos de imagem a domínios conhecidos, baixa tamanho limitado e entrega imagem codificada à interface local, com cache e lazy loading; contatos com fotos privadas continuam exibindo iniciais.
- **Formatação:** mensagens com marcadores do WhatsApp (`*negrito*`, `_itálico_`, `~tachado~`, monoespaçado e links HTTPS/HTTP) passam a ser desenhadas como componentes React, sem usar `innerHTML`.
- **Emojis:** seletor passou de apenas 12 símbolos para uma paleta categorizada com centenas de emojis, incluindo rostos, gestos, corações, objetos, animais, comidas, bandeiras. A aparência de emojis novos depende do suporte de fontes do Windows.
- **Testes em código:** `src/test/message-format.test.tsx` verifica texto formatado sem interpretar HTML e a paleta maior. Ainda é necessário executar os testes no ambiente do projeto.

**Validação proposta:** atualizar pelo GitHub Desktop, fechar WPP/API/UI antigos, iniciar só `INICIAR.bat`. Confirmar resumos em chats visíveis (podem preencher após alguns segundos), abrir imagens/áudios/documentos, conferir fotos públicas de perfil, formatar mensagens e enviar uma mensagem de teste para si: a tela deve mostrar somente uma ocorrência. Se falhar, compartilhar apenas `LOG_DIAGNOSTICO.txt` e os nomes das funções que falharam; nunca copiar códigos de vinculação ou conversas.
