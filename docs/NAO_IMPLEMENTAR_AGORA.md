# Ideal-Zap — NÃO IMPLEMENTAR POR ENQUANTO

**Decisão solicitada pelo usuário em 23/10/2026.** Atualização: sem criar grupos nem múltiplas sessões.

Estes recursos ficam FORA do escopo das próximas atualizações. Não adicionar
botões, rotas, menus ou componentes para eles mesmo que existam no
WPPConnect Manager. Só reavaliar se o usuário pedir explicitamente:

1. **Silenciar notificações de uma conversa** (já removido).
2. **Pesquisar GIFs numa biblioteca/catálogo**.
3. **Gravar e enviar mensagens de voz pelo microfone** (PTT).
4. **Fixar mensagens individuais dentro de uma conversa**.
5. **Bloquear e desbloquear contatos**.
6. **Gerenciamento avançado de grupos**, como promover/remover membros
   ou alterar configurações administrativas (consultar informações de
   grupo já implementado pode continuar).
7. **Enviar localização**.
8. **Criar enquetes**.
9. **Criar novos grupos** (o botão foi retirado da aba Grupos).
10. **Criar ou gerenciar múltiplas sessões WhatsApp**. Trabalhar com uma única sessão local.
11. **Perfis de múltiplos servidores remotos**, incompatíveis com a prioridade local e de sessão única.

## Funções relacionadas PERMITIDAS

- Continuar **recebendo e visualizando GIFs animados** nas conversas.
- **Não exibir um botão especial de envio de GIF**; o recurso de envio
  dedicado foi removido. Não adicionar catálogo.
- Continuar recebendo/ouvindo e baixando áudios enviados por outras pessoas;
  corrigir áudio indisponível é prioridade. Não criar gravador de voz.
- Notificações e sons **do próprio Ideal-Zap**, configuráveis em Configurações,
  são permitidos; isso é distinto de silenciar individualmente um contato.
- Visualizar informações básicas de grupos/participantes (somente leitura).
- Enviar cartão de contato (vCard), encaminhar mensagens, apagar para todos,
  pré-visualizar documentos e enviar anexos continuam no escopo.

## Prioridades autorizadas

1. Corrigir **apagar para todos**, nunca fingir êxito de revogação;
   confirmar no telefone destinatário.
2. Corrigir **encaminhamento nativo**, para aparecer a marca Encaminhada.
3. Corrigir download/reprodução de áudio recente, inclusive `audio/ogg; codecs=opus`.
4. Aperfeiçoar seletor de contato para ficar semelhante ao WhatsApp Web.
5. Estabilizar sessão e reduzir falhas no WPPConnect.

Atualizar este documento e o checklist principal quando houver novas
instruções. Nenhuma modificação em `main`, sessões ou segredos `.env`.

## Sessão única: gerenciar sem criar outras sessões

- **Permitido:** encerrar somente a sessão atual via rota original `close-session`,
  sem remover tokens nem o perfil Chromium; depois iniciar a mesma sessão.
- **Permitido com confirmação reforçada:** desvincular a sessão atual via
  `logout-session` oficial quando o usuário precisa ler um **novo QR**.
  Essa ação apaga credenciais locais da sessão, **não** o histórico no celular.
- Não adicionar criar sessão, adicionar usuário, perfil remoto ou criar grupo.
- Concluir primeiro a lista básica do Manager, depois melhorias adicionais.
