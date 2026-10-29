# Ideal-Zap — projeto local (cópia preparada em 29/10/2026)

Esta cópia foi organizada a partir dos arquivos locais enviados pelo usuário. É um **projeto-fonte novo, sem o histórico Git antigo**; não contém credenciais, tokens, conversas, logs, dependências instaladas ou perfil do WhatsApp.

## Situação da versão recebida

- Interface Web (TanStack/React), adaptador Node em `backend/` e código WPPConnect Server **2.10.61** em `wppconnect-server/`.
- **Central de Controle gráfica**: `INICIAR_DISCRETO.vbs` chama `Central_IdealZap.ps1` para iniciar, reiniciar e encerrar serviços e ocultar na bandeja do Windows.
- O `INICIAR.bat` é o **iniciador antigo**, ainda abre janelas CMD. Prefira `INICIAR_DISCRETO.vbs`.
- A **assinatura automática foi retirada da interface**; as mensagens são enviadas sem sufixo de atendente.
- O **favicon de coração da cópia recebida foi substituído pelo ícone do WhatsApp** no novo projeto.
- A funcionalidade de desvincular/novo QR e outras pendências históricas ainda exigem testes no Windows real.

## Antes de usar

**Não substitua sua pasta de instalação atual por esta cópia.** Esta versão contém somente o código-fonte, de propósito. Ela não possui arquivos `.env`, `node_modules`, `runtime` ou dados da sessão. Faça backup da pasta instalada e mantenha o original funcionando.

Para instalar **separadamente** em outra pasta no Windows, execute `PREPARAR_AMBIENTE.bat`. O preparador baixa o Node portátil e as dependências, prepara arquivos `.env` locais e pode exigir vinculação ao WhatsApp novamente. **Nunca execute as duas cópias em paralelo**: elas usam as mesmas portas 8788, 3001 e 8080.

Se precisar manter o pareamento atual, preserve os dados da sessão e os `.env` **somente no seu computador**, jamais no repositório público ou privado. Uma instalação limpa não possui a sessão original.

## Estrutura

| Local | Finalidade |
| --- | --- |
| `src/` | Frontend e testes da interface |
| `backend/` | API local, eventos, mídias e testes |
| `scripts/` | Preparação e integração com WPPConnect |
| `wppconnect-server/` | Código-fonte WPPConnect 2.10.61 + Manager, sem dependências ou dados de sessão |
| `public/` | Arquivos estáticos, incluindo ícones WhatsApp |
| `Central_IdealZap.ps1`, `INICIAR_DISCRETO.vbs` | Painel que fica na bandeja do Windows |
| `PREPARAR_AMBIENTE.bat` | Instalação de dependências no computador |

## Abrir em dois computadores

O principal executa a Central de Controle e abre `http://127.0.0.1:8080/`; outro computador da **mesma rede privada** acessa `http://IP_DO_PRINCIPAL:8080/`. Não há autenticação por atendente, portanto pessoas que acessarem a interface na rede poderão visualizar e enviar mensagens. Nunca exponha a porta 8080 na internet. Navegadores podem bloquear notificações em HTTP remoto.

## Git e publicação

Este pacote foi entregue **sem `.git`**, sem vínculo com a conta antiga e com `.gitignore` reforçado para excluir dados sensíveis. O código do WPPConnect foi mantido para não perder eventuais modificações locais. A validação do GitHub Actions é **manual** (sem executar a cada push).

Leia **`PUBLICAR_REPOSITORIO.md`** para criar um repositório local com GitHub Desktop e sincronizar quando estiver autorizado pelo GitHub. Enquanto a conta original estiver suspensa, não use outra conta para contornar a decisão; aguarde o resultado do recurso ou autorização expressa do suporte.

Os arquivos antigos de `docs/` registram decisões e verificações anteriores e podem conter instruções de versões passadas; este README e `PUBLICAR_REPOSITORIO.md` têm precedência para a cópia nova.

## Verificações

Código Node validável por `node --check backend/server.mjs` e outros arquivos `.mjs`. Testes de frontend e o teste `phone-actions` exigem dependências instaladas. Não foi possível executar a conexão real com WhatsApp neste ambiente.

O WPPConnect Server tem licença própria em `wppconnect-server/LICENSE`. Respeite a licença e os termos dos serviços utilizados.
