# Checklist de conferência — Ideal-Zap x WPPConnect Manager x WhatsApp Web

Atualizado em **23/10/2026**. Controle de desenvolvimento da branch
`feat/conexao-whatsapp-na-interface` (PR #1). **Não é uma lista de funções já testadas.**

**Legenda:** ✅ Confirmado pelo usuário; 🧪 Implementado no código, precisa de teste real;
⚠️ Parcial ou correção ainda em validação; ⬜ Não implementado / depende de desenvolvimento.

## Rodada de 23/10/2026 — correções técnicas e escopo excluído

**Decisão explícita do usuário:** não implementar oito recursos nesta fase.
Lista permanente: [NAO_IMPLEMENTAR_AGORA.md](./NAO_IMPLEMENTAR_AGORA.md).
**Não sugerir nem recolocar** silenciar conversas, GIFs pesquisáveis,
gravação/envio de voz pelo microfone, fixar mensagens individuais,
bloquear/desbloquear contatos, gerenciamento avançado de grupos,
localização e enquetes.

### Diagnóstico LOG_DIAGNOSTICO(6).txt — o que realmente ocorreu

- WPPConnect v2.10.61 conectou; 319 conversas carregadas.
- `MESSAGE_REVOKE_REQUESTED lidResolved:false`: **apagar para todos não funcionou**;
  a API antiga responde sucesso sem garantir revogação.
- `MEDIA_BAD_RESPONSE` duas vezes com `mimeKnown:true, bytesPresent:true`:
  havia mídia na resposta, mas o adaptador a rejeitava (provável
  parâmetro MIME `audio/ogg; codecs=opus`, não comprovado pelo log).
  `MEDIA_GET_FAILED HTTP_500` em uma tentativa adicional.
- 14 consultas sucessivas `CONTACTS_LOADED` em cerca de oito segundos ao
  abrir o seletor de contatos: componente disparava carregamento repetido.
  Agora a consulta acontece uma vez por abertura.
- `CONNECTION_STATUS_ERROR ECONNREFUSED` no final: servidor WPP parou,
  sem causa comprovada. O excesso de requisições pode ter contribuído.

### Alterações realizadas no GitHub (🧪 aguardam teste no Windows)

- [ ] **Encaminhamento nativo com marca Encaminhada:** causa confirmada na
  interface de programação: `wa-js v4.6.0` espera **uma lista de IDs**,
  enquanto WPPConnect Server 2.10.61 encaminha uma única **string**.
  Correção idempotente no `INICIAR.bat`: `forwardMessagesV2(contact,
  [messageId])`. Também tratar retorno não enviado como falha, sem
  mensagem de sucesso falsa. Testar mensagem de texto e anexo.
  Eventos `FORWARD_ARRAY_ARGUMENT_FIXED`,
  `FORWARD_NATIVE_NOT_SENT`.
- [ ] **Apagar para todos sem apagar só localmente:** o método wrapper da
  biblioteca retorna `true` até quando a operação não revoga remotamente.
  Novo patch consulta o resultado efetivo `WPP.chat.deleteMessage`,
  exigindo `isRevoked:true` e verificando autoria antes de alterar.
  Tenta correspondência PN/LID oficial do WPPConnect.
  Se não confirmar, retorna erro em vez de fingir sucesso.
  **Ainda não existe confirmação de entrega no destinatário.**
  Eventos `REVOKE_CHECK_PATCHED`, `REVOKE_NATIVE_NOT_CONFIRMED`,
  `REVOKE_PNLID_LOOKUP`.
- [ ] **Áudios recebidos e arquivos recentes:** decodificação de MIME com
  parâmetros como `audio/ogg; codecs=opus`, espaços em base64,
  URI `data:` e Buffer JSON. Respostas inválidas tentam também
  `download-media` mesmo quando GET responde HTTP 200.
  Backend possui testes específicos `media-utils.test.mjs`.
- [ ] **Enviar contato parecido com WhatsApp Web:** lista com fotos,
  busca e seleção, botão Avançar, revisão do cartão antes de Enviar.
  Campo manual somente como opção adicional. Não carrega contatos em loop.
- [ ] **Botão/enviar GIF removido**. Receber e animar GIFs enviados por
  outras pessoas continua funcionando.
- [ ] Confirmar que exportação TXT, PDFs, múltiplos anexos e o restante
  das funções anteriormente confirmadas não regrediram.
- [ ] Confirmar se WPPConnect permanece estável depois de abrir
  seletor de contato e arquivos de áudio.

### Como testar

1. Fechar janelas, GitHub Desktop Fetch/Pull na branch de desenvolvimento
   e executar somente `INICIAR.bat`. Preservar sessão e `.env`.
2. Testar **encaminhar** texto e anexo para outra conta; verificar se o
   destinatário vê realmente o selo nativo **Encaminhada**.
3. Testar **Apagar para todos** com uma mensagem nova enviada por você;
   conferir que saiu tanto daqui quanto do celular do destinatário.
   Se aparecer erro, não repetir agressivamente: enviar diagnóstico.
4. Abrir **áudio de ontem** que antes exibia erro, tocar e baixar.
5. Abrir **Enviar contato** e verificar busca, seleção, prévia e envio.
6. Confirmar ausência do botão GIF e do item Silenciar; GIF recebido
   deve continuar animado.
7. Enviar o novo `LOG_DIAGNOSTICO.txt` caso haja falha. Não mandar
   conteúdo de conversa, telefone, senha nem QR de pareamento.

**Não declarar estas correções como testadas no WhatsApp real até
receber o retorno do usuário.** Teste CI de TypeScript, JS e UI não
verifica operações remotas.

## Rodada 18:04 — diagnóstico enviado, notificações, GIF e contatos (22/10/2026)

### Confirmado pelo usuário ✅
- Enviar **até 10 anexos** com prévia e legendas individuais.
- Citar mensagens, editar, reagir com emoji na posição correta, abrir PDFs.
- Fixar contatos/conversas, arquivar, marcar não lida, menus fecham ao clicar fora.
- Favoritar **localmente no Ideal-Zap** (não há sincronização comprovada com o WhatsApp).
- **Exportar** mensagens carregadas em TXT.
- Encaminhar **texto como nova mensagem**; não possui marca nativa "Encaminhada".

### Diagnóstico LOG_DIAGNOSTICO(5).txt
- WPP_SETUP `FORWARD_FALLBACK_PATCHED`, sessão `CONNECTED` e 319 chats.
- `MESSAGE_REVOKE_REQUESTED {"lidResolved":false}`: **Apagar para todos não funciona** no destinatário.
- `FORWARD_V2_FAILED`, depois `MESSAGE_FORWARD_WPP_ERROR HTTP_500` e
  `MESSAGE_FORWARDED_TEXT_FALLBACK`: a alternativa legada nativa também
  não confirmou entrega como encaminhamento. A marca "Encaminhada" segue pendente.
- `CONTACTS_LOADED raw:10677 normalized:576 lidPairsCollapsed:470`; reduzir
  mais contatos repetidos exige correspondência segura, sem apagar contatos legítimos.
- `LABELS_LOADED count:4`, `GROUP_INFO_LOADED members:37`;
  etiquetas e membros puderam ser consultados.
- Mídia: várias `MEDIA_LOADED`, porém `MEDIA_GET_FAILED HTTP_500`
  para determinados arquivos; GIFs ainda precisam de teste.
- A sessão ficou `CONNECTED` durante todo o trecho final do diagnóstico.

### Próximos testes 🧪 — implementados na branch

- [ ] **Ativar notificações do Windows** em Configurações e conceder permissão
  quando o navegador pedir. Deixar Ideal-Zap aberto, minimizar/trocar de janela
  e receber mensagem nova de outra conta. A notificação não contém conteúdo
  da mensagem por privacidade.
- [ ] **Ativar som** no mesmo painel, ouvir som de teste ao habilitar; receber
  mensagem nova em outra conversa. Se não houver som, conferir permissões de
  áudio do navegador/Windows. Os alertas deduplicam eventos SSE e usam
  acompanhamento de conversas como alternativa.
- [ ] **Receber GIF animado**: verificar movimento da imagem ou vídeo GIF em loop.
- [ ] **Enviar GIF** usando o botão GIF no composer para selecionar arquivo
  `.gif` do computador. **Não é um catálogo de GIFs online**;
  entrega como GIF animado precisa ser verificada no destinatário.
- [ ] **Enviar contato** com o botão de contato na barra de mensagem:
  pesquisar contato salvo ou inserir nome/telefone com DDI e
  confirmar envio via `contact-vcard` do WPPConnect. Verificar cartão
  no destinatário e representação de cartões recebidos.
- [ ] Menu Ferramentas ⋮ continua com **informações de grupo,
  etiquetas Business, galeria de mídia e exportação TXT**.
- [ ] O recurso **Silenciar notificações da conversa foi removido**
  da interface, serviço e rota, conforme solicitado. Isso não
  interfere nos novos alertas de mensagens do próprio Ideal-Zap.

### Ainda faltando ou com falha ⚠️ / ⬜
- [ ] ⚠️ **Apagar para todos**: sem confirmação de revogação remota em @lid.
- [ ] ⚠️ **Encaminhar como "Encaminhada"**: duas APIs nativas falham no WPP;
  alternativa de texto simples não tem o marcador nativo.
- [ ] ⚠️ GIF nativo de biblioteca/galeria e envio como GIF em todos os formatos
  de vídeo usados pelo WhatsApp; botão local GIF é apenas primeiro passo.
- [ ] ⚠️ Fotos e áudios de algumas mensagens com erro HTTP 500; rever mídia.
- [ ] ⚠️ Notificação quando navegador estiver **totalmente fechado**:
  não disponível sem serviço em segundo plano; só com Ideal-Zap aberto.
- [ ] ⬜ Gravar áudio/voz e enviar PTT; fixar mensagem individual;
  encaminhar anexos mantendo marca nativa; busca completa no histórico.
- [ ] ⬜ Renderizar Office (DOCX/XLSX/PPTX) sem baixar.
- [ ] ⬜ Bloquear contatos, recursos avançados de grupo, status/stories,
  mensagens temporárias, localização, enquetes e compartilhamento completo.
- [ ] ⬜ Multiatendentes, múltiplas sessões, filas, permissões e autenticação
  por usuário. Áudio/vídeo de chamada não é suportado pela arquitetura atual.

**Status:** alterações marcadas como 🧪 estão implementadas no GitHub mas
aguardam teste real no Windows. `userDataDir` e `.env` são preservados.
Não mesclar o PR em main.

## Rodada 17:32 — conferência real e próximas funções do Manager (22/10/2026)

**✅ Confirmado pelo usuário em Windows:** envio de até 10 anexos com legenda
individual e prévias, encaminhamento de **texto como mensagem comum**,
estrela/favorito dentro do Ideal-Zap, redução de contatos duplicados,
reações posicionadas, menus, edição, fixar conversas, citar e PDFs.

**Diagnóstico recebido:** três envios `ATTACHMENT_SENT`; conversas carregadas
318→319; **470 pares @lid/@c.us** agrupados (10.676 registros brutos, 576
contatos expostos). Houve **duas** falhas nativas de encaminhamento
`MESSAGE_FORWARD_WPP_ERROR HTTP_500`, compensadas por
`MESSAGE_FORWARDED_TEXT_FALLBACK`: o texto chega, mas **não tem marcador
Encaminhada**. Favoritos de WhatsApp nativo falham com
`STAR_WPP_FAILED HTTP_500` ou `MESSAGE_STAR_NO_CHANGE`: a estrela que
funciona hoje é **local ao Ideal-Zap**, não necessariamente aparece em
outros dispositivos. O pedido de exclusão remota registrou
`MESSAGE_REVOKE_REQUESTED lidResolved:false`; o destinatário manteve
a mensagem. Em algumas conversas @c.us, o WPPConnect retornou erro
HTTP 502 ao solicitar histórico e o fallback legado retornou lista vazia;
agora essa condição deve exibir erro e a opção de tentar novamente em
vez de inventar uma conversa vazia. O WPPConnect deixou de responder
`ECONNREFUSED` no final, sem causa comprovada.

### Novos testes da próxima versão — aguardando execução no Windows

- [ ] 🧪 **Encaminhar com marca nativa:** o inicializador aplica no WPPConnect
      local a tentativa de `forwardMessage` (API legada) caso
      `forwardMessagesV2` falhe. Verificar no WhatsApp de destino se
      aparece **Encaminhada**. Caso ambas falhem, texto comum continua
      sendo alternativa transparente e mídia ainda pode falhar.
      Logs seguros: `FORWARD_FALLBACK_PATCHED`,
      `FORWARD_V2_FAILED`, `FORWARD_LEGACY_OK`.
- [ ] 🧪 Abrir o menu **⋮ / Ferramentas da conversa** no cabeçalho.
- [ ] 🧪 Silenciar conversa por **8 horas** e por **uma semana**; remover
      silêncio. O WPPConnect pode rejeitar `time=0`, observar log.
- [ ] 🧪 Consultar **informações e participantes do grupo** (somente leitura).
- [ ] 🧪 Listar, criar e adicionar/remover **etiquetas Business** à conversa.
      A disponibilidade depende da conta e do WPPConnect.
- [ ] 🧪 Galeria de **imagens, vídeos, documentos e áudios** compartilhados
      nas mensagens carregadas (no máximo 18 itens por categoria). Abrir
      sem download obrigatório nos formatos suportados.
- [ ] 🧪 **Exportar as mensagens carregadas em TXT**, localmente, com
      clique explícito. **Não** inclui todo o histórico nem anexos.
- [ ] 🧪 Conversas cujo histórico falhou com HTTP 502 devem mostrar
      erro/Tentar novamente, não uma lista vazia enganosa.
- [ ] ⚠️ Verificar se sobraram contatos duplicados após a consolidação
      conservadora por ID/nome. Não mesclar pessoas apenas pelo nome.
- [ ] ⚠️ **Apagar para todos** ainda não funciona de forma comprovada.
      Não declarar concluído antes de confirmar no telefone de destino.
- [ ] ⚠️ **Fixar mensagem individual** ainda não foi implementado.
- [ ] ⬜ Bloquear/desbloquear contatos, moderar grupos, catálogo Business,
      chamadas, múltiplas sessões/atendentes e renderização Office.

As rotas Manager foram verificadas no código-fonte do **WPPConnect Server
v2.10.61**. O projeto testa automaticamente TypeScript, backend, React,
SSR e abertura da UI. Testes automatizados **não** comprovam efeitos
da API do WhatsApp no aparelho real.

## Rodada 16:44 — próximo teste e investigação (22/10/2026)

**✅ Confirmado pelo usuário:** reação na posição correta; menus fecham; edição,
fixar conversa, citar, arrastar arquivos e prévias de PDF/antes de envio.

**⚠️ Falhas reproduzidas no diagnóstico:**
- `MESSAGE_FORWARD_FAILED`, HTTP_500, duas tentativas, 0 mensagens enviadas.
  A API passou a reenviar **textos simples** por `send-message` quando o
  encaminhamento nativo retorna erro, exibindo aviso de que **não haverá
  a etiqueta de mensagem encaminhada**. Encaminhamento de mídias continua
  dependente de corrigir a rota nativa do WPPConnect.
- `CONTACTS_LOADED raw:10676, normalized:1046, duplicatesRemoved:0`.
  Não eram duplicações do mesmo ID. Incluída deduplicação conservadora de
  pares com **nome salvo igual + um @lid e um @c.us**, somente se houver
  exatamente dois registros. Registros ambíguos permanecem visíveis.
- `MESSAGE_REVOKE_REQUESTED lidResolved:false`; revogação não foi
  confirmada no aparelho do destinatário. O servidor agora consulta
  `message-by-id` para tentar identificar número @c.us correspondente ao
  LID, antes da revogação. **Apagar para todos permanece não comprovado**.
- Favoritos: o WPPConnect pode falhar na ação `star-message`. O app agora
  marca e persiste a estrela localmente **sem salvar texto da mensagem no
  navegador**; sinaliza explicitamente quando a estrela não sincronizou com
  WhatsApp. Aba `Favoritos` mostra estrelas de conversas carregadas.
- O WPPConnect ficou `ECONNREFUSED` no final da sessão de diagnóstico.
  A origem do encerramento não foi comprovada.

**🧪 Novos testes para confirmar no Windows:**
- [ ] Escolher vários arquivos no seletor (Ctrl + clique) ou arrastar até
      **10 arquivos** em um único lote, com **até 8 MB por arquivo**.
- [ ] Selecionar cada arquivo na fila, colocar legenda própria e enviar.
      Conferir no destinatário que chegaram todos e não foram duplicados.
- [ ] Se um arquivo do lote falhar, verificar que já enviados não retornam
      para a fila e que faltantes continuam disponíveis.
- [ ] Encaminhar uma mensagem de **texto simples**. Se o WPPConnect voltar
      HTTP 500, deve ser enviada como mensagem normal, **sem selo Encaminhada**.
      Encaminhar mídia pela API nativa continua ⚠️.
- [ ] Favoritar mensagem e abrir `Favoritos`. Verificar se é indicada
      sincronização local, caso o WhatsApp não tenha confirmado a estrela.
- [ ] Contatos: comparar pares exibidos e observar `lidPairsCollapsed` no log.
- [ ] Apagar mensagem recente própria para todos; conferir **diretamente no
      outro aparelho**. Até confirmar, manter ⚠️.

**Nenhuma alteração mexeu em `userDataDir`, tokens ou na branch `main`.**

## Revisão 16:15 — problemas novos e próxima validação

Relato confirmado pelo usuário: ✅ envio, citar, fixar conversa, editar texto,
apagar apenas para mim, pesquisar com setas. ⚠️ Reação deslocada,
favoritar, apagar para todos, encaminhar, menus abertos, contatos repetidos,
prévias de documentos e arrastar arquivos.

Alterações desenvolvidas (🧪 aguardando teste Windows):
- [ ] Reações em cápsula sobreposta à borda inferior do balão.
- [ ] Menus de emoji/ações fecham ao clicar fora ou apertar Esc.
- [ ] Indicador discreto **Editada** e estrela no rodapé da mensagem.
- [ ] Favoritar no menu de ações; resposta 0/falsa da API vira erro visível.
- [ ] Encaminhamento com pesquisa, seleção múltipla e até cinco destinos.
- [ ] Deduplicação de contatos pelo ID; evitar eliminar pessoas diferentes com mesmo nome.
- [ ] Arrastar anexos em qualquer ponto da janela, com área de soltar.
- [ ] Visualizar PDF antes de enviar e miniatura de PDF recebido;
  enviar vídeos/imagens com prévia. Arquivos Office ainda sem renderizador.
- [ ] Apagar para todos: tentar resolver destinatário real de mensagens @lid;
  a API legado pode aceitar solicitação sem comprovar revogação no destinatário.
  **Não declarar concluído sem confirmar no telefone de destino**.

Diagnóstico 16:02: SESSION_CONNECTED; 318 conversas; 10.676 contatos brutos
viraram 1.046 após filtro de salvos; MESSAGE_ACTION_OK edit/delete;
ATTACHMENT_SENT e MEDIA_LOADED; último evento ECONNREFUSED — serviço
WPPConnect parou de responder e causa não foi diagnosticada.

## Novas funções para testar — 22/10/2026

A partir do teste real, confirmar as seguintes mudanças:

- [ ] Resposta citada aparece no remetente e destinatário. Estado local preservado entre consultas.
- [ ] Reação aparece no balão do remetente, mesmo depois da atualização de mensagens.
- [ ] Pesquisa tipo Ctrl+F mantém todas as mensagens, destaca o termo e navega com setas.
- [ ] Encaminhar mensagem para contato, grupo ou telefone com DDI.
- [ ] Editar mensagem própria, sujeito ao limite imposto pelo WhatsApp.
- [ ] Apagar apenas para mim e tentar apagar para todos, com confirmação.
- [ ] Favoritar mensagem individual; é diferente de fixar.
- [ ] Fixar/desafixar **conversa** na lista. Fixar mensagem individual segue pendente.
- [ ] Contatos salvos separados de contatos automáticos pela propriedade isMyContact.
- [ ] Aba Contatos não solicita previews e não provoca centenas de erros HTTP 502.
- [ ] PDF, imagem, TXT, CSV, JSON abrem no visor local sem download obrigatório.
- [ ] Arrastar arquivo para o composer e confirmar envio.
- [ ] Documentos Office exigem renderizador adicional; não declarar como implementados.

O log de 15:17 mostra sucesso na API para REPLY_SENT, REACTION_SENT e
ATTACHMENT_SENT, mas isso não comprova exibição local. Mostra também
10676 contatos e muitos PREVIEW_ON_DEMAND_FAILED HTTP_502 após abrir
Contatos. A conexão terminou com ECONNREFUSED; ainda não se conhece a
causa do encerramento do servidor. Todos os itens acima são
**implementados no código, mas aguardam teste real**, exceto os descritos
como pendentes.

## Diagnóstico recebido às 14:37, 22/10/2026

- ✅ WhatsApp reconectou, sessão CONNECTED, lista de **314** conversas.
- ✅ Histórico carregado e montado no DOM (80 mensagens para conversas testadas).
- ✅ Envio de texto registrado como TEXT_SENT.
- ✅ Um anexo foi aceito pelo WPPConnect: ATTACHMENT_SENT, 420.468 bytes.
- ✅ Serviço retornou imagens/mídias, inclusive um arquivo >9 MB: MEDIA_LOADED.
- ⚠️ Previews abaixo do contato: `withPreview` foi **0**, subiu para **12** e depois **18**. Não há preview para todos.
- ⚠️ Fotos: AVATAR_LOADED e AVATAR_MISSING apareceram. Foto ausente pode ser privada ou falha no proxy.
- ⚠️ WPPConnect parou de responder em `CONNECTION_STATUS_ERROR ECONNREFUSED` no final do log; causa não identificada (não há PROCESS_EXIT associado no arquivo).
- ⚠️ `ATTACHMENT_SENT` confirma aceitação pelo servidor, **não prova que a imagem/documento foi enviada corretamente e exibida no destinatário**.
- ⚠️ `MEDIA_LOADED` confirma obtenção dos bytes, **não prova renderização perfeita**.
- ⚠️ Não há teste de read/unread, resposta citada, reação, PDF na tela ou pesquisa nesse log.

## 1. Conexão e administração do Manager

- [x] ✅ Iniciar WPPConnect, API e interface com `INICIAR.bat`.
- [x] ✅ Vincular WhatsApp por QR na interface.
- [x] ✅ Recuperar sessão existente sem novo QR.
- [x] ✅ Mostrar status CONNECTED/CLOSED/OFFLINE.
- [ ] ⚠️ Reconexão e QR após expirar: validar reinícios.
- [ ] ⬜ Listar e alternar múltiplas sessões.
- [ ] ⬜ Iniciar, pausar, fechar e desconectar sessão individualmente.
- [ ] ⬜ Gerar token por sessão / gerenciar permissões administrativas.
- [ ] ⬜ Conectar múltiplos servidores e alternar servidor.
- [ ] ⬜ Logout com confirmação e opção de backup de sessão.
- [ ] ⬜ Indicadores e notificações de saúde/reconexão do servidor.
- [ ] ⬜ Gerenciamento multiatendente (usuários, permissões, filas, departamentos).

## 2. Conversas e interface

- [x] ✅ Listar conversas (314 na conta de teste).
- [x] ✅ Abrir conversa e exibir mensagens de texto.
- [x] ✅ Enviar mensagem de texto (observado e confirmado no log).
- [x] ✅ Alternar tema claro/escuro.
- [ ] 🧪 Exibir **a última mensagem** abaixo de cada contato (busca lazy/cache).
- [ ] 🧪 Pesquisar nome, número e preview na lista de conversas.
- [ ] 🧪 Pesquisar texto nas **80 mensagens carregadas** do chat (não no histórico inteiro).
- [ ] 🧪 Marcar conversa como **não lida** e como lida (endpoint WPP real + atualização local).
- [ ] 🧪 Arquivar e desarquivar chat.
- [ ] 🧪 Responder citando mensagem (send-reply).
- [ ] 🧪 Reagir com emoji (react-message).
- [ ] 🧪 Mostrar prévia de citação recebida quando houver ID e corpo citado.
- [ ] ⚠️ Melhorar nomes em chats `@lid`; **não mostrar LID como número telefônico**.
- [ ] 🧪 Renderizar texto com negrito, itálico, tachado, monoespaçado e links.
- [ ] 🧪 Seletor de emojis ampliado (Unicode conforme fontes Windows).
- [ ] 🧪 Evitar caracteres de base64/binários junto a imagens e arquivos.
- [ ] ⚠️ Exibir indicador correto de enviado/entregue/lido em cada mensagem.
- [ ] ⚠️ Receber mensagens por SSE e polling sem duplicar mensagens.
- [ ] ⬜ Fixar/desafixar chats (pin-chat).
- [ ] ⬜ Encaminhar mensagens para contatos e grupos.
- [ ] ⬜ Editar e apagar mensagens.
- [ ] ⬜ Favoritar/desfavoritar mensagens.
- [ ] ⬜ Pesquisa no histórico completo com paginação e índice local.
- [ ] ⬜ Notificações desktop, contador total e som configurável.
- [ ] ⬜ Filtrar chat por arquivadas, etiquetas ou data.

## 3. Anexos, mídia e visualização como WhatsApp Web

- [ ] 🧪 Imagem recebida embutida no chat e **ampliação por modal, sem download obrigatório**.
- [ ] 🧪 **PDF recebido aberto no próprio Ideal-Zap** (iframe de Blob dentro do modal).
- [ ] 🧪 Reproduzir áudio/voz recebida via controles `audio`.
- [ ] 🧪 Reproduzir vídeo recebido via controles `video`.
- [ ] 🧪 Visualizar figurinhas e GIFs.
- [ ] 🧪 Baixar documento por opção explícita (sem baixar só para abrir PDF).
- [ ] 🧪 Enviar imagem, PDF, documento e arquivo (limite inicial 8 MB).
- [ ] 🧪 Não mostrar conteúdo base64 no corpo das mensagens nem como texto do anexo.
- [ ] ⚠️ Resolver fotos públicas e mostrar iniciais quando a foto for privada.
- [ ] ⬜ Prévia de mídia **antes** de enviar, legenda e confirmação.
- [ ] ⬜ Anexar vários arquivos em uma operação, com progressos independentes.
- [ ] ⬜ Arrastar e soltar arquivos na conversa.
- [ ] ⬜ Gravar áudio pelo microfone e enviar PTT.
- [ ] ⬜ Leitor de documentos Office/ZIP direto na interface (depende de renderizador específico).
- [ ] ⬜ Vídeos grandes, arquivos >8 MB e download streaming.
- [ ] ⬜ Galeria de mídia compartilhada por chat.

## 4. Contatos, grupos, Business e recursos avançados

- [x] ✅ Contatos e grupos disponíveis via API.
- [ ] 🧪 Listar contatos e grupos nas abas; resolver nomes.
- [ ] 🧪 Nova conversa por número real com DDI.
- [ ] 🧪 Criar grupo e inserir participantes.
- [ ] ⬜ Participantes de grupo: adicionar, remover, promover, rebaixar.
- [ ] ⬜ Foto, descrição, configurações e permissões do grupo.
- [ ] ⬜ Bloquear/desbloquear contatos.
- [ ] ⬜ Foto de perfil ampliada, dados do contato e status.
- [ ] ⬜ Indicador digitando/gravando, online/visto por último (sujeito à privacidade).
- [ ] ⬜ Etiquetas WhatsApp Business.
- [ ] ⬜ Catálogo, produtos e coleções Business.
- [ ] ⬜ Status/stories, localização, contatos/vCards, enquetes.
- [ ] ⬜ Silenciar, marcar mensagens favoritas e mensagens temporárias.
- [ ] ⬜ Chamadas de voz/vídeo (não suportadas pelo Manager; dependem de tecnologia adicional).

## Como conferir no Windows

1. Atualize a branch pelo GitHub Desktop (Fetch origin e Pull origin), feche os três processos antigos e inicie somente `INICIAR.bat`.
2. Abra uma conversa com **imagem**, outra com **PDF** e outra com **áudio**. Clique na imagem e no PDF para ver se abre **na interface**; o botão Baixar é opcional.
3. Pesquise contato pelo nome, clique na lupa da conversa e procure palavra que exista nas **80 mensagens carregadas**.
4. Responda citando uma mensagem; marque a conversa como não lida; reaja com um emoji. Faça isso usando conversa de teste.
5. Envie **um PDF pequeno**, depois uma imagem pequena, somente para uma conta sua/de teste. Confirme no WhatsApp de destino que foi entregue como arquivo, sem caracteres ilegíveis.
6. Confira que `@lid` não aparece como telefone fictício embaixo do nome.
7. Se houver problema, envie `LOG_DIAGNOSTICO.txt` atualizado, sem dados privados. Indique em qual ação falhou.
8. Marque [x] nesta lista somente depois de comprovar que o recurso funcionou no Windows.

**Notas técnicas:** Este repositório implementa e amplia o Manager; não é o WhatsApp Web oficial. O desempenho/fidelidade depende das rotas WPPConnect disponíveis e do conteúdo sincronizado. Sem executar na máquina do usuário, uma alteração em código continua 🧪, não ✅.
