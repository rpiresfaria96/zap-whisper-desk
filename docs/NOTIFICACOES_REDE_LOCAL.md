# Ideal-Zap: HTTPS no mesmo endereco e na mesma porta (8080)

Enderecos: **servidor e outros computadores**: `https://192.168.100.88:8080/`.
O endereco antigo `http://192.168.100.88:8080/` **deixa de funcionar** depois desta
correcao, pois uma mesma porta nao pode servir HTTP e HTTPS ao mesmo tempo sem
roteamento especial. A configuracao nova usa HTTPS em 8080, Vite interno em
`127.0.0.1:8081`, API em `127.0.0.1:3001` e WPPConnect em `127.0.0.1:8788`.
Nao ha mais acesso via porta 8443.

## Instalar no servidor Windows 10

1. Salve o que estiver editando, use **Encerrar** na Central e depois clique no
   icone da bandeja (perto do relogio) com botao direito -> **Sair do programa**.
   Isso fecha a janela antiga de controle e os processos iniciados por ela.
2. Extraia o ZIP na raiz do Ideal-Zap, mantendo a pasta `Atualizações`.
3. Abra `Atualizações/2026-10-29_HTTPS_8080/ATUALIZAR_HTTPS_8080.bat`.
   O instalador faz backup de quatro arquivos e nao toca em dados do WhatsApp.
4. Execute **CRIAR_CERTIFICADO_8080.bat** NO SERVIDOR. O script confirma que o
   IP 192.168.100.88 pertence a ele. Se o certificado anterior ja serve,
   sera reaproveitado sem trocar a chave. Se nao servir, pede confirmacao antes
   de guardar o antigo em backup privado e criar outro (sem OpenSSL).
5. Execute **INSTALAR_CERTIFICADO.bat no proprio servidor**. Confira o SHA256
   antes de dar confianca ao certificado. Ele e importado SOMENTE para o usuario
   atual do Windows.
6. Abra `INICIAR_DISCRETO.vbs`. Ao ficar **Ativo**, abra
   `https://127.0.0.1:8080/` no servidor e `https://192.168.100.88:8080/`
   no segundo computador. Feche todas as janelas do navegador antes, se preciso.

## Segundo computador

1. Copie do servidor **somente** `.local/https/IdealZap_CERTIFICADO_PUBLICO.cer`
   e o arquivo `INSTALAR_CERTIFICADO.bat` da pasta da atualizacao para uma
   pasta temporaria no segundo PC. Nunca copie `pfx`, `pfx.pass` ou `.local`.
2. Confira se o hash SHA256 impresso no segundo computador e IGUAL ao mostrado
   no servidor. Depois confirme a instalacao.
3. Encerre e abra novamente o Chrome/Edge. Entre no endereco EXATO:
   `https://192.168.100.88:8080/`.
4. Em Configuracoes -> Notificacoes de mensagens, habilite notificacoes e
   permita no navegador. A aba Ideal-Zap deve continuar aberta.

## Problemas frequentes

- **Nao inicia a Central:** confira se a porta 8080 ou 8081 esta ocupada. Nao
  mantenha outra instancia da central ou o CMD antigo em paralelo.
- **ERR_CONNECTION_REFUSED** em HTTPS: confirme que a Central mostra **Ativo**,
  que a porta TCP 8080 esta liberada SOMENTE no perfil **Privado** do Firewall
  do Windows e que o segundo PC esta na mesma rede.
- **Erro de certificado:** nao clique para ignorar. Confira o IP usado na
  geracao, data/hora, certificado instalado e SHA256 do arquivo .cer.
- **Chrome bloqueia notificacoes:** certifique-se que o navegador mostra o
  cadeado/conexao segura, que o Windows permite notificacoes e que voce
  habilitou as notificacoes neste HTTPS novo (permissoes de HTTP e HTTPS
  sao separadas).
- **Abre mas a API nao funciona:** envie `LOG_DIAGNOSTICO.txt` SEM segredos,
  e descreva o erro. A interface HTTPS encaminha `/ideal-api` para a API local.

## Avisos de seguranca

O certificado e autossinado e so sera confiavel nos computadores em que voce
concordou em instala-lo. Confiar nele modifica a lista de autoridades/certificados
confiaveis do usuario, o que deve ser feito apenas quando gerado por voce.
Nao exponha a porta 8080 na Internet, nao desligue o Firewall. **HTTPS nao
coloca senha no Ideal-Zap**: qualquer computador com acesso a esta rede pode
ler e enviar mensagens. As chaves TLS nao devem ir para o GitHub.

Esta alteracao NAO apaga tokens, mensagens, contatos ou sessao do WhatsApp.
O backup dos arquivos alterados fica em `.idealzap-backups` no servidor.
