# Ideal-Zap — Funções do Manager e teste da próxima versão

> **Atualização mais recente (23/10/2026):** consultar
> [ESCOPO_MANAGER_2026-10-23.md](./ESCOPO_MANAGER_2026-10-23.md).
> A prioridade agora é concluir **somente o Manager 2.0.0**, usando
> a sessão única atual. **Não** criar grupos, múltiplas sessões ou perfis
> remotos. Botões de **encerrar sessão sem logout** e **desvincular para novo
> QR** foram adicionados com confirmações. Duplicados PN/LID passaram a
> ser verificados pela API oficial. O WPPConnect aceita eventos pelo
> **webhook nativo**, não pelo bridge injetado anteriormente.
> Encaminhamento nativo, apagar para todos e notificações completas
> permanecem pendentes de prova no WhatsApp real.


**Atualização: 23/10/2026.** Este inventário separa funções observadas,
funcionalidades com código, limitações e solicitações expressamente excluídas.

## O que está confirmado pelo usuário ✅

| Função | Estado |
|---|---|
| Conectar/reconectar WhatsApp por QR | ✅ |
| Listar conversas, contatos e grupos | ✅ (alguns duplicados residuais) |
| Ler e enviar mensagens de texto | ✅ |
| Responder citando | ✅ |
| Reagir com emojis | ✅ |
| Editar mensagem própria | ✅ |
| Apagar mensagem apenas para mim | ✅ |
| Fixar/desafixar conversa | ✅ |
| Arquivar/desarquivar conversa | ✅ |
| Marcar como não lida | ✅ |
| Buscar dentro da conversa com setas e destaque | ✅ |
| Tema claro e escuro | ✅ |
| PDF e imagem com pré-visualização | ✅ |
| Reprodução de áudio recebido | ✅ |
| Anexo múltiplo (até 10) com legenda por arquivo | ✅ |
| Arrastar anexos | ✅ |
| Reproduzir GIF recebido | ✅ |
| Enviar cartão de contato (vCard) | ✅ envio confirmado |
| Favoritos de mensagens na interface | ✅ local; sincronização entre dispositivos não confirmada |
| Exportar mensagens carregadas em TXT | ✅ |

## Alterações desta rodada — testar 🧪

| Função | Como foi tratada |
|---|---|
| Cartão de contato **recebido** | Extrair nome/número de vCard no corpo do WhatsApp, apresentar **Conversar** e **Salvar contato**. Salvar gera arquivo .vcf para importar à agenda do dispositivo; não adiciona sozinho à agenda do celular. |
| Ícone de enviar cartão | Alterado de quadrado para ContactRound, ícone de contatos. |
| Campo de escrita | Recebe foco ao abrir/trocar conversa, sem clicar no rodapé. |
| Botão Enviar | Fica visível à direita mesmo quando o campo está vazio (desativado enquanto não houver texto). Microfone removido. |
| Notificações e som | Ponte autenticada de **onMessage** do WPP para SSE local; detecção adicional de novas mensagens por histórico/não lidas; som habilitado por padrão, desktop exige permissão do navegador. Novo log `INCOMING_EVENT_RELAYED`. |
| Encaminhar nativamente | Patch corrige lista de IDs no WPP e interpreta o resultado de IDs do WA-JS corretamente. A API registrou envio nativo 1/1, mas **não comprova** etiqueta "Encaminhada" no destino. |
| Apagar para todos | Reforçada verificação de `isRevoked`, uso do chat remoto original da própria mensagem no WA-JS e eventos seguros de tentativa/falha. **Não comprovado** que apaga no destinatário. |

### Diagnóstico LOG_DIAGNOSTICO(7).txt

- Inicializador registrou `FORWARD_ARRAY_ARGUMENT_FIXED`,
  `REVOKE_CHECK_PATCHED` e `DELETE_RESPONSE_FIXED`.
- WPP iniciou e conectou, 319 conversas disponíveis, histórico e mídias recuperados.
- `REVOKE_PNLID_LOOKUP resolved:true` na operação de exclusão, mas
  **não há evento posterior que confirme revogação** no log. Essa lacuna
  motivou novos eventos `REVOKE_WPP_CALL_STARTED` e `REVOKE_WPP_FAILED`.
- `MESSAGE_FORWARDED sent:1 total:1`: WPP/API considerou operação
  bem-sucedida; a presença da indicação nativa "Encaminhada" no
  telefone de destino permanece **não verificada**.
- `CONTACT_CARD_SENT`: envio confirmado pela API; recebimento e
  ações de cartão ainda precisavam ser implementados.
- Não aparece evento `INCOMING_EVENT_RELAYED` (a ponte ainda não
  existia nesta execução). Alternativas antigas de polling não
  apresentaram aviso sonoro conforme retorno do usuário.
- `CONTACTS_LOADED normalized:576`, ainda podendo haver registros
  duplicados que não é seguro agrupar somente pelo nome.
- Após aproximadamente 10 minutos a conexão WPP retornou
  `ECONNREFUSED`. Não há causa demonstrada nos eventos.

## Funções disponíveis no Manager / WhatsApp a concluir ou melhorar

| Área | Pendência | Prioridade |
|---|---|---|
| Mensagens | **Apagar para todos de verdade**, sem excluir apenas localmente | Crítica |
| Mensagens | **Encaminhar nativo** com rótulo e mantendo anexos/arquivo original | Crítica |
| Notificações | Mostrar aviso e emitir som ao receber mensagem nova, inclusive janela minimizada | Alta |
| Contatos | Cartão recebido: conversar/guardar na agenda real após importação | Alta |
| Contatos | Tratar últimos duplicados e melhorar fotos/identificadores | Média |
| Histórico | Paginação e busca em **todo** o histórico (hoje 80 mensagens recentes) | Média |
| Conversas | Prévia da última mensagem consistente para todos os chats | Média |
| Mensagens | Sincronizar estrelas/favoritos entre dispositivos | Média |
| Mídias | Continuar melhorando carregamento de anexos, vídeos, áudios e documentos | Média |
| Arquivos | Prévia de DOCX/XLSX/PPTX sem download | Opcional |
| Business | Validar criar/aplicar/remover etiquetas em conta compatível | Teste |
| Grupos | Validar nome, descrição e lista de participantes (somente leitura) | Teste |
| Sistema | Estabilidade de WPPConnect após vários minutos e recuperação de processos | Alta |
| Atendentes | Múltiplos atendentes, sessão compartilhada, filas, atribuição e permissões | Futuro |
| Configurações | Ajuste de preferências de notificação e diagnóstico de permissão do navegador | Alta |

**Limite técnico:** integrar os botões e a API não garante o comportamento
de outros aparelhos. O recurso de excluir para todos deve ser considerado
pendente até ser conferido no telefone destinatário. Chamadas de áudio/vídeo
continuam fora das capacidades comprovadas da integração atual.

## Recursos que NÃO são para adicionar 🚫

Conforme o usuário: silenciar conversa, catálogo de GIFs pesquisáveis,
gravar/enviar mensagem de voz pelo microfone, fixar **mensagem** individual,
bloquear/desbloquear contato, gerenciamento avançado de grupos,
enviar localização e criar enquetes.

Consultar detalhes: [NAO_IMPLEMENTAR_AGORA.md](./NAO_IMPLEMENTAR_AGORA.md).

## Roteiro para a próxima validação no Windows

1. Atualizar branch no GitHub Desktop com Fetch/Pull e executar
   apenas `INICIAR.bat` com janelas antigas encerradas. Não tocar
   `userDataDir` ou `.env`.
2. Abrir contato e digitar **imediatamente**. Conferir o botão
   Enviar sempre visível, o microfone ausente e o novo ícone de contato.
3. Pedir para outra conta enviar um **cartão de contato** e testar
   **Conversar** e **Salvar contato**. Importar o arquivo .vcf na
   agenda do dispositivo para salvar de verdade.
4. Em Configurações, ativar **Notificações do Windows** e autorizar no
   navegador. Verificar som ativado. Deixar janela fora de foco e
   receber mensagem nova de outra conta. Procurar
   `INCOMING_EVENT_RELAYED` no log novo.
5. Encaminhar **texto e arquivo** a uma segunda conta e conferir a
   **etiqueta Encaminhada** nessa conta. Não confundir envio normal
   de texto com encaminhamento nativo.
6. Apagar para todos uma **mensagem recente sua**, testar no telefone
   destinatário. Se não funcionar, observar `REVOKE_WPP_CALL_STARTED`,
   `REVOKE_WPP_FAILED` ou `REVOKE_NATIVE_NOT_CONFIRMED` no log.
7. Deixar o aplicativo ativo por pelo menos 10 minutos para acompanhar
   o `ECONNREFUSED` intermitente.
8. Se falhar, enviar `LOG_DIAGNOSTICO.txt`, que exclui dados de
   pareamento, credenciais e conteúdo das mensagens.

**Todos os itens marcados como 🧪 aguardam teste real no Windows.**
