# Correções de 23/10/2026

- Eventos recebidos usam separadores SSE válidos; som ligado por padrão quando ainda não há preferência salva.
- Notificações também avisam sobre outras conversas quando a janela está em foco.
- Salvar no telefone chama WPP.contact.save com syncAddressBook: true. Não baixa VCF; informa quando o WhatsApp não confirma. A sincronização final depende do telefone.
- Encaminhamento interpreta corretamente a lista de falhas retornada pelo WA-JS; não reenvia texto automaticamente após falhas incertas.
- Exclusão usa o chat real da mensagem, preserva a mídia no aparelho e verifica o estado revoked antes de confirmar na interface. Isso não comprova recebimento em todos os aparelhos remotos.
- INICIAR.bat instala as operações verificadas após os ajustes legados.

Validação: 21 testes da interface, 9 testes Node, TypeScript e compilação de produção passaram. Nenhuma mensagem foi enviada ou apagada em conversas reais durante os testes.

Após atualizar, feche as janelas de execução do Ideal-Zap e abra INICIAR.bat novamente. Autorize notificações nas configurações do aplicativo/navegador. Confira salvar contato, encaminhar texto/mídia e apagar mensagem recente com um contato de teste.

Referências: https://wppconnect.io/wa-js/functions/contact.save.html e código oficial de forwardMessages/deleteMessage em https://github.com/wppconnect-team/wa-js/tree/main/src/chat/functions.

## Teste real local — 23/10/2026

Commit 9d28e5f publicado na branch feat/conexao-whatsapp-na-interface. Aplicativo iniciado e sessão CONNECTED verificada.

- Envio na conversa com o próprio usuário: HTTP 200, mensagem localizada no histórico.
- Encaminhamento para essa mesma conversa: HTTP 200, segunda mensagem localizada no histórico.
- Apagar para todos: NÃO confirmado. WPPConnect respondeu 409 e o adaptador 502; as mensagens de teste não foram marcadas como apagadas. Não considerar essa função corrigida em produção.
- Som ativado nas configurações; reprodução com mensagem recebida de outro aparelho ainda pendente.
- Notificações permaneceram desligadas após a tentativa no navegador interno; validar no navegador habitual com permissão concedida.
- Salvar contato no telefone: implementado, mas ainda sem teste de gravação em aparelho real.

O teste em conversa própria não comprova entrega ou exclusão em outro aparelho. Nenhuma conversa de terceiros foi usada neste teste.

## Rodada de correção — LOG_DIAGNOSTICO(8).txt (23/10/2026)

O registro mostra duas inicializações bem-sucedidas do WPPConnect 2.10.61,
sessão CONNECTED, 319 conversas listadas e históricos de até 80 mensagens.
O mesmo log contém erros HTTP 502 de histórico em conversas @c.us, enquanto
outras @lid carregam, além de consultas periódicas em excesso.
O envio de mensagens, cartões e encaminhamento recebeu respostas de sucesso
da API, mas isso não comprova a etiqueta encaminhada ou entrega no destinatário.

Alterações publicadas na branch de desenvolvimento:
- CI: sincronizado bun.lock com a dependência @testing-library/dom; novamente
  possível instalar com `bun install --frozen-lockfile`.
- Histórico: ao falhar com @c.us, consultar `contact/pn-lid` do próprio
  WPPConnect e tentar @lid mapeado oficialmente, sem inventar identificadores.
  Registrar `HISTORY_PNLID_RECOVERED` ou erro específico.
- Desempenho: histórico e lista passam a ser consultados de 15 em 15 segundos;
  atualização em segundo plano não ativa indicador de carregamento.
  O fluxo SSE continua sendo consultado em tempo real.
- Notificações: se a permissão foi concedida nas Configurações, exibir
  notificação mesmo quando a conversa está aberta na janela ativa.
- Apagar para todos: distinguir retorno nativo aceito (PENDING) da
  revogação observada na sessão. Se pendente, não trocar a mensagem
  por um falso "apagada para todos"; atualizar após consultar o histórico.
  Aceitação NÃO prova remoção no aparelho destinatário.
- Diagnóstico: registrar motivo restrito e seguro da falha de revogação,
  sem telefones, conteúdo, credenciais ou QR.

### Conferência no computador

1. Fechar as janelas do WPPConnect, API e interface. Usar GitHub Desktop
   em `feat/conexao-whatsapp-na-interface` (Fetch/Pull); executar apenas
   `INICIAR.bat` com a sessão já instalada. NÃO repetir preparador e NÃO
   apagar `backend/.env`, `tokens` ou `userDataDir`.
2. Abrir um contato com identificador de telefone que antes mostrava
   "Não foi possível carregar histórico". Conferir `HISTORY_PNLID_RECOVERED`
   (se o mapa oficial PN/LID estiver disponível).
3. Enviar UMA mensagem nova para conta de teste, solicitar
   "Apagar para todos" e conferir se aparece "pendente" quando a chamada
   foi aceita, se o histórico mostra revogação e se desapareceu no celular
   do destinatário. Sem confirmação remota, manter como pendente.
4. Encaminhar texto E mídia para uma conta de teste e verificar se o
   destinatário vê a marca "Encaminhada".
5. Permitir Notificações do Windows no navegador, ativar som em
   Configurações e receber mensagem de outro aparelho, inclusive com
   conversa aberta. O log deve mostrar `INCOMING_EVENT_RELAYED` quando
   o webhook nativo enviar o evento.
6. Testar novamente áudio recente para reprodução/download e contato
   recebido para salvar/abrir conversa. Salvar contato no telefone ainda
   depende de sincronização confirmada no aparelho.
7. Usar `LOG_DIAGNOSTICO.txt` novo para reportar o resultado. Nunca enviar
   tokens, arquivos .env, QR ou dados brutos do WhatsApp.

Os testes de automação cobrem sintaxe, interface, SSE simulado e contratos
de ações locais; não substituem validação no WhatsApp real.
