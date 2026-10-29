# Criar um novo repositório local com o Ideal-Zap (Windows / GitHub Desktop)

Esta pasta já foi preparada como **projeto-fonte independente** do repositório antigo. O ZIP não inclui a pasta `.git` antiga. **Não foi criado nem sincronizado um repositório remoto automaticamente.**

## Antes de publicar

1. Preserve a pasta original do Ideal-Zap no computador. Esta pasta limpa **não substitui a instalação em uso** nem inclui WhatsApp pareado.
2. Confirme que o recurso contra a suspensão da conta GitHub foi resolvido ou que o suporte autorizou expressamente a publicação. **Não use outra conta para contornar a suspensão.**
3. Decida se o repositório será **privado** (recomendado). Mantenha `.env`, sessões, tokens e perfis do navegador SOMENTE no computador local.

## Criar no GitHub Desktop (depois de autorizado)

1. Extraia `IdealZap_Projeto_Pronto_GitHub.zip` em uma pasta NOVA (por exemplo, `Documentos\IdealZap-Novo`).
2. Abra GitHub Desktop, vá em **File > Add local repository...**, e selecione a pasta extraída que contém `package.json`.
3. Como não existe `.git`, o GitHub Desktop oferecerá **Create a repository here**; crie o repositório local nessa pasta.
4. Confirme no GitHub Desktop que não há `.env`, tokens, runtime, cache, logs, sessões ou `node_modules` em **Changes**.
5. Faça um único commit inicial, por exemplo **`Importar versão local organizada do Ideal-Zap`**.
6. Quando seu acesso estiver autorizado, use **Publish repository** e escolha **Keep this code private**. Confira que a conta usada está autorizada pelo GitHub.
7. Os próximos commits podem ser agrupados, com testes antes de publicar. O workflow de CI é iniciado manualmente pelo menu **Actions**.

## Alternativa por terminal (somente no repositório local)

Dentro da pasta nova: `git init -b main`, `git add .`, `git status`, depois `git commit -m "Importar versao local do Ideal-Zap"`. **Não execute push até o caso da suspensão estar regularizado.**

## Limitações

- O ZIP não preserva commits anteriores nem o vínculo com a conta antiga (por escolha, para evitar histórico com credenciais).
- Dependências e runtime serão baixados por `PREPARAR_AMBIENTE.bat` para uma instalação nova. Não execute em paralelo com a instalação antiga.
- Se faltar algum arquivo da instalação original porque foi excluído antes do envio do RAR, ele também não estará neste projeto.
- O GitHub não executará Actions automaticamente a cada push nesta versão.
