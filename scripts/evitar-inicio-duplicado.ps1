# Uso interno: INICIAR.bat prepara a copia local do WPPConnect e o canal de QR.
# Nunca excluir userDataDir, tokens ou a sessao salva do WhatsApp.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Entry = Join-Path $Root "wppconnect-server\src\server.ts"
$WppEnv = Join-Path $Root "wppconnect-server\.env"
$BackendEnv = Join-Path $Root "backend\.env"
$LogFile = Join-Path $Root "LOG_DIAGNOSTICO.txt"

# Apenas codigos fixos, sem nomes de arquivos locais, credenciais ou QR.
function Trace-Setup([string]$Code) {
  if ($Code -notmatch '^[A-Z_]{3,60}$') { return }
  try {
    Add-Content -LiteralPath $LogFile -Value ("[WPP_SETUP] " + $Code) -Encoding UTF8
  } catch {}
}

Trace-Setup "CONFIG_BEGIN"
if (-not (Test-Path $Entry)) {
  Trace-Setup "SERVER_ENTRY_MISSING"
  Write-Host "WPPConnect nao foi encontrado; execute PREPARAR_AMBIENTE.bat." -ForegroundColor Red
  exit 1
}
if (-not (Test-Path $WppEnv) -or -not (Test-Path $BackendEnv)) {
  Trace-Setup "ENV_FILE_MISSING"
  Write-Host "Configuracao local ausente; execute PREPARAR_AMBIENTE.bat." -ForegroundColor Red
  exit 1
}

function Read-Env([string]$Path, [string]$Key) {
  $text = [System.IO.File]::ReadAllText($Path)
  $match = [regex]::Match($text, '(?m)^\s*' + [regex]::Escape($Key) + '\s*=\s*(.*?)\s*$')
  if ($match.Success) { return $match.Groups[1].Value.Trim().Trim('"').Trim("'") }
  return ""
}

function Write-Env([string]$Path, [string]$Key, [string]$Value) {
  $lines = [System.Collections.Generic.List[string]]::new()
  foreach ($line in [System.IO.File]::ReadAllLines($Path)) { $lines.Add($line) }
  $pattern = '^\s*' + [regex]::Escape($Key) + '\s*=.*$'
  $seen = $false
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match $pattern) {
      $lines[$i] = "$Key=$Value"
      $seen = $true
    }
  }
  if (-not $seen) { $lines.Add("$Key=$Value") }
  [System.IO.File]::WriteAllLines($Path, $lines, [System.Text.UTF8Encoding]::new($false))
}

$Source = [System.IO.File]::ReadAllText($Entry)
$SingleStart = "initServer({ ...config, startAllSession: false });"
$Original = "initServer(config);"
if ($Source.Contains($Original)) {
  # Apenas a copia local do WPPConnect. Evita abrir dois Chromium na mesma sessao.
  $Updated = $Source.Replace($Original, $SingleStart)
  [System.IO.File]::WriteAllText($Entry, $Updated, [System.Text.UTF8Encoding]::new($false))
  Write-Host "WPPConnect: restauracao automatica concorrente desativada." -ForegroundColor Green
  Trace-Setup "AUTOSTART_DISABLED"
} elseif ($Source.Contains($SingleStart)) {
  Trace-Setup "AUTOSTART_ALREADY_DISABLED"
} else {
  Trace-Setup "AUTOSTART_LAYOUT_UNKNOWN"
  Write-Warning "WPPConnect nao tem o formato esperado para desativar o inicio automatico."
}

# Bridge para o QR: quando WPPConnect gerar o QR, entrega diretamente
# ao adaptador 127.0.0.1:3001. A chave aleatoria nunca vai ao navegador.
$Secret = Read-Env $BackendEnv "WPP_QR_BRIDGE_SECRET"
if ($Secret -notmatch '^[a-f0-9]{64}$') {
  $bytes = New-Object byte[] 32
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  $Secret = ([System.BitConverter]::ToString($bytes)).Replace("-", "").ToLowerInvariant()
  Write-Env $BackendEnv "WPP_QR_BRIDGE_SECRET" $Secret
}
Trace-Setup "BRIDGE_SECRET_READY"
$Url = "http://127.0.0.1:3001/internal/wpp-hook?key=$Secret"
$existing = Read-Env $WppEnv "WEBHOOK_ALLOWED_URLS"
$urls = @($existing -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
if ($urls -notcontains $Url) {
  $urls += $Url
  Write-Env $WppEnv "WEBHOOK_ALLOWED_URLS" ($urls -join ',')
  Trace-Setup "HOOK_ALLOWLIST_UPDATED"
} else {
  Trace-Setup "HOOK_ALLOWLIST_EXISTS"
}
# WPPConnect 2.10.61 already supports a session-specific authenticated
# webhook via start-session { webhook }. Keep that official delivery channel
# lightweight: do not auto-decrypt media, and do not auto-mark incoming
# messages as read merely because the notification webhook was delivered.
$ConfigSource = Join-Path $Root "wppconnect-server\src\config.ts"
if (Test-Path $ConfigSource) {
  $ConfigText = [System.IO.File]::ReadAllText($ConfigSource)
  $NativeWebhookConfig = $ConfigText.Replace("autoDownload: true,", "autoDownload: false,").Replace("readMessage: true,", "readMessage: false,")
  if ($NativeWebhookConfig -ne $ConfigText) {
    [System.IO.File]::WriteAllText($ConfigSource, $NativeWebhookConfig, [System.Text.UTF8Encoding]::new($false))
    Trace-Setup "NATIVE_WEBHOOK_CONFIGURED"
  } else { Trace-Setup "NATIVE_WEBHOOK_ALREADY_CONFIGURED" }
}

# A versao 2.10.61 pode gerar o QR no terminal mas nao publicar na API:
# o status-session fica CLOSED e o webhook generico pode nao ser disparado.
# Ligamos diretamente o callback catchQR ao adaptador local ja autenticado.
# Esta alteracao age apenas na copia local do WPPConnect, nao em node_modules.
$QrSource = Join-Path $Root "wppconnect-server\src\util\createSessionUtil.ts"
if (-not (Test-Path $QrSource)) {
  Trace-Setup "QR_CALLBACK_SOURCE_MISSING"
  Write-Warning "Callback QR do WPPConnect indisponivel; continuando com captura alternativa pelo terminal."
} else {
try {
$QrText = [System.IO.File]::ReadAllText($QrSource)
$QrMarker = '[IdealZapQrBridge] QR_CALLBACK_RECEIVED'
$QrOld = @'
            ) => {
              if (!ownsAttempt()) return;
              this.exportQR(req, base64Qr, urlCode, client, res);
            },
'@
$QrNew = @'
            ) => {
              const currentAttempt = ownsAttempt();
              if (!currentAttempt) {
                req.logger.warn('[IdealZapQrBridge] QR_CALLBACK_STALE');
                return;
              }
              req.logger.info('[IdealZapQrBridge] QR_CALLBACK_RECEIVED');
              const localHook = (process.env.WEBHOOK_ALLOWED_URLS || '')
                .split(',')
                .map((value: string) => value.trim())
                .find((value: string) =>
                  /^http:\/\/127\.0\.0\.1:3001\/internal\/wpp-hook\?key=[a-f0-9]{64}$/.test(value)
                );
              if (localHook) {
                void fetch(localHook, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    event: 'qrcode',
                    session: session,
                    qrcode: base64Qr,
                  }),
                  signal: AbortSignal.timeout(8000),
                })
                  .then((response) =>
                    req.logger.info('[IdealZapQrBridge] QR_SEND_HTTP_' + response.status)
                  )
                  .catch(() => req.logger.warn('[IdealZapQrBridge] QR_SEND_NETWORK_ERROR'));
              } else {
                req.logger.warn('[IdealZapQrBridge] QR_HOOK_MISSING');
              }
              this.exportQR(req, base64Qr, urlCode, client, res);
            },
'@
# Normalizacao temporaria: os arquivos podem vir com CRLF ou LF.
# Preservar quebras originais ao salvar o arquivo local do WPPConnect.
$UseCrlf = $QrText.Contains("`r`n")
$Canonical = $QrText.Replace("`r`n", "`n")
$MatchOld = $QrOld.Replace("`r`n", "`n")
$MatchNew = $QrNew.Replace("`r`n", "`n")
if ($Canonical.Contains($QrMarker)) {
  Trace-Setup "QR_CALLBACK_ALREADY_PATCHED"
} elseif ($Canonical.Contains($MatchOld)) {
  $Canonical = $Canonical.Replace($MatchOld, $MatchNew)
  if ($UseCrlf) { $Canonical = $Canonical.Replace("`n", "`r`n") }
  [System.IO.File]::WriteAllText($QrSource, $Canonical, [System.Text.UTF8Encoding]::new($false))
  Trace-Setup "QR_CALLBACK_PATCHED"
  Write-Host "Captura direta do QR ativada." -ForegroundColor Green
} else {
  Trace-Setup "QR_CALLBACK_LAYOUT_UNKNOWN"
  Write-Warning "Callback QR diferente do esperado; seguindo com captura alternativa do terminal."
}
} catch {
  Trace-Setup "QR_CALLBACK_PATCH_ERROR"
  Write-Warning "Nao foi possivel ajustar callback QR; seguindo com captura alternativa do terminal."
}
}

# Instrumentar callback de autenticacao no WPPConnect local, sem alterar
# mensagens, QR, telefone ou dados da sessao. Em algumas instalacoes
# disconnectedMobile ocorre durante a primeira leitura do QR; nao pode
# encerrar a tentativa antes de concluir a vinculacao.
if (Test-Path $QrSource) {
  try {
    $AuthSource = [System.IO.File]::ReadAllText($QrSource)
    $AuthIsCrlf = $AuthSource.Contains("`r`n")
    $AuthContent = $AuthSource.Replace("`r`n", "`n")
    $AuthOld = @'
            statusFind: (statusFind: StatusFind) => {
              // A cleanup or newer start owns this session now.
              if (!ownsAttempt()) return;
              try {
'@
    $AuthNew = @'
            statusFind: (statusFind: StatusFind) => {
              // Estado tecnico da autenticacao, sem dados pessoais.
              req.logger.info('[IdealZapQrBridge] AUTH_EVENT_' + statusFind);
              // A cleanup or newer start owns this session now.
              if (!ownsAttempt()) {
                req.logger.warn('[IdealZapQrBridge] AUTH_CALLBACK_STALE');
                return;
              }
              try {
'@
    $AuthOld = $AuthOld.Replace("`r`n", "`n")
    $AuthNew = $AuthNew.Replace("`r`n", "`n")
    if ($AuthContent.Contains("[IdealZapQrBridge] AUTH_EVENT_")) {
      Trace-Setup "AUTH_CALLBACK_ALREADY_PATCHED"
    } elseif ($AuthContent.Contains($AuthOld)) {
      $AuthContent = $AuthContent.Replace($AuthOld, $AuthNew)
      Trace-Setup "AUTH_CALLBACK_PATCHED"
    } else {
      Trace-Setup "AUTH_CALLBACK_LAYOUT_UNKNOWN"
    }

    $EarlyCloseOld = "statusFind === StatusFind.disconnectedMobile"
    $EarlyCloseNew = "(statusFind === StatusFind.disconnectedMobile && client.status === 'CONNECTED')"
    if ($AuthContent.Contains($EarlyCloseOld)) {
      $AuthContent = $AuthContent.Replace($EarlyCloseOld, $EarlyCloseNew)
      Trace-Setup "EARLY_DISCONNECT_GUARD"
    }
    $StaleOld = "req.logger.warn('[IdealZapQrBridge] QR_CALLBACK_STALE');"
    $StaleNew = "req.logger.warn('[IdealZapQrBridge] QR_CALLBACK_STALE_' + (clientsArray[session] !== client ? 'OWNER_CHANGED' : client.status || 'UNKNOWN'));"
    if ($AuthContent.Contains($StaleOld)) {
      $AuthContent = $AuthContent.Replace($StaleOld, $StaleNew)
      Trace-Setup "QR_STALE_REASON_ENABLED"
    }

    if ($AuthIsCrlf) { $AuthContent = $AuthContent.Replace("`n", "`r`n") }
    if ($AuthContent -ne $AuthSource) {
      [System.IO.File]::WriteAllText($QrSource, $AuthContent, [System.Text.UTF8Encoding]::new($false))
    }
  } catch {
    Trace-Setup "AUTH_CALLBACK_PATCH_ERROR"
  }
}

# A biblioteca WPPConnect fecha a leitura em 60s por padrao. Extendemos
# somente a janela de vinculacao do WhatsApp para 120s, preservando sessoes.
$ConfigSource = Join-Path $Root "wppconnect-server\src\config.ts"
if (Test-Path $ConfigSource) {
  try {
    $ConfigText = [System.IO.File]::ReadAllText($ConfigSource)
    $AutoCloseTag = "    autoClose: 120000,"
    if ($ConfigText.Contains($AutoCloseTag)) {
      Trace-Setup "PAIRING_TIMEOUT_ALREADY_SET"
    } elseif ($ConfigText.Contains("  createOptions: {" + "`n")) {
      $ConfigText = $ConfigText.Replace("  createOptions: {" + "`n", "  createOptions: {" + "`n" + $AutoCloseTag + "`n")
      [System.IO.File]::WriteAllText($ConfigSource, $ConfigText, [System.Text.UTF8Encoding]::new($false))
      Trace-Setup "PAIRING_TIMEOUT_EXTENDED"
    } elseif ($ConfigText.Contains("  createOptions: {" + "`r`n")) {
      $ConfigText = $ConfigText.Replace("  createOptions: {" + "`r`n", "  createOptions: {" + "`r`n" + $AutoCloseTag + "`r`n")
      [System.IO.File]::WriteAllText($ConfigSource, $ConfigText, [System.Text.UTF8Encoding]::new($false))
      Trace-Setup "PAIRING_TIMEOUT_EXTENDED"
    } else {
      Trace-Setup "PAIRING_TIMEOUT_LAYOUT_UNKNOWN"
    }
  } catch {
    Trace-Setup "PAIRING_TIMEOUT_SET_FAILED"
  }
}

# O upstream usa forwardMessagesV2, que retorna HTTP 500 em algumas
# sessoes (inclusive a sessao testada). A funcao anterior forwardMessage
# ainda existe na biblioteca WPPConnect 2.3.x. Primeiro tenta V2; se
# falhar, tenta a API anterior, mantendo a marca nativa Encaminhada
# caso a propria biblioteca consiga reenviar. O fallback texto do backend
# continua sendo a terceira alternativa, sem marca de encaminhamento.
# O patch e local, idempotente e nao toca dados de usuario.
$ForwardController = Join-Path $Root "wppconnect-server\src\controller\deviceController.ts"
if (Test-Path $ForwardController) {
  try {
    $ForwardText = [System.IO.File]::ReadAllText($ForwardController)
    $ForwardMarker = "[IdealZapForward] LEGACY_OK"
    $ForwardOld = "response = await req.client.forwardMessagesV2(contact, messageId);"
    $ForwardNew = @'
try {
        response = await req.client.forwardMessagesV2(contact, messageId);
      } catch (primaryError) {
        req.logger.warn('[IdealZapForward] V2_FAILED');
        response = await req.client.forwardMessage(contact, messageId);
        req.logger.info('[IdealZapForward] LEGACY_OK');
      }
'@
    if ($ForwardText.Contains($ForwardMarker)) {
      Trace-Setup "FORWARD_FALLBACK_ALREADY_PATCHED"
    } elseif ($ForwardText.Contains($ForwardOld)) {
      $ForwardText = $ForwardText.Replace($ForwardOld, $ForwardNew.TrimEnd())
      [System.IO.File]::WriteAllText($ForwardController, $ForwardText, [System.Text.UTF8Encoding]::new($false))
      Trace-Setup "FORWARD_FALLBACK_PATCHED"
    } else {
      Trace-Setup "FORWARD_FALLBACK_LAYOUT_UNKNOWN"
    }
  } catch {
    Trace-Setup "FORWARD_FALLBACK_PATCH_ERROR"
  }
}

# Correção comprovada pela assinatura wa-js 4.6.0: forwardMessages
# itera sobre uma LISTA de mensagens. WPPConnect Server 2.10.61
# repassa uma string, que vira caracteres individuais e falha.
# Isto corrige TANTO o codigo upstream quanto nosso fallback ja instalado.
if (Test-Path $ForwardController) {
  try {
    $ForwardArrayText = [System.IO.File]::ReadAllText($ForwardController)
    $ForwardArrayBefore = "response = await req.client.forwardMessagesV2(contact, messageId);"
    $ForwardArrayAfter = "response = await req.client.forwardMessagesV2(contact, [messageId]);"
    if ($ForwardArrayText.Contains($ForwardArrayBefore)) {
      $ForwardArrayText = $ForwardArrayText.Replace($ForwardArrayBefore, $ForwardArrayAfter)
      [System.IO.File]::WriteAllText($ForwardController, $ForwardArrayText, [System.Text.UTF8Encoding]::new($false))
      Trace-Setup "FORWARD_ARRAY_ARGUMENT_FIXED"
    } elseif ($ForwardArrayText.Contains($ForwardArrayAfter)) {
      Trace-Setup "FORWARD_ARRAY_ARGUMENT_ALREADY_FIXED"
    } else {
      Trace-Setup "FORWARD_ARRAY_LAYOUT_UNKNOWN"
    }
  } catch {
    Trace-Setup "FORWARD_ARRAY_FIX_ERROR"
  }
}

# O controller upstream devolve sucesso se client.deleteMessage retorna true,
# MAS a biblioteca 2.3.3 sempre retorna true, mesmo quando a mensagem foi
# apagada SOMENTE localmente. Na API wa-js 4.6.0 o retorno isRevoked e distinto
# de isDeleted. Confirmamos ownership ANTES de tocar uma mensagem.
$DeleteController = Join-Path $Root "wppconnect-server\src\controller\deviceController.ts"
if (Test-Path $DeleteController) {
  try {
    $DeleteOriginal = [System.IO.File]::ReadAllText($DeleteController)
    $DeleteContent = $DeleteOriginal.Replace("`r`n", "`n")
    $DeleteOld = @'
    const result = await req.client.deleteMessage(
      `${phone}`,
      messageId,
      onlyLocal,
      deleteMediaInDevice
    );
'@
    $DeleteNew = @'
    // [IdealZapRevoke] CHECK_REAL_REVOKE: wa-js returns {isRevoked,isDeleted}.
    // WPPConnect wrapper otherwise swallows the outcome and reports true.
    const result = onlyLocal
      ? await req.client.deleteMessage(
          `${phone}`, messageId, true, deleteMediaInDevice
        )
      : await req.client.page.evaluate(
          async (args: { chatId: string; messageId: string; clearMedia: boolean }) => {
            const wa = (globalThis as any).WPP;
            const existing = await wa.chat.getMessageById(args.messageId);
            // Do not accidentally delete a foreign message only for myself.
            if (!existing ||
                !(existing.senderObj?.isMe === true ||
                  existing.id?.fromMe === true || existing.fromMe === true)) {
              return { isRevoked: false };
            }
            const outcome = await wa.chat.deleteMessage(
              args.chatId, args.messageId, args.clearMedia, true
            );
            return { isRevoked: outcome?.isRevoked === true };
          },
          { chatId: String(phone), messageId: String(messageId),
            clearMedia: Boolean(deleteMediaInDevice) }
        );
    if (!onlyLocal && (result as any)?.isRevoked !== true) {
      req.logger.warn('[IdealZapRevoke] NOT_REVOKED');
      return res.status(409).json({
        status: 'error', message: 'WhatsApp did not confirm revoke for everyone'
      });
    }
'@
    $DeleteOld = $DeleteOld.Replace("`r`n", "`n")
    $DeleteNew = $DeleteNew.Replace("`r`n", "`n")
    if ($DeleteContent.Contains("[IdealZapRevoke] CHECK_REAL_REVOKE")) {
      Trace-Setup "REVOKE_CHECK_ALREADY_PATCHED"
    } elseif ($DeleteContent.Contains($DeleteOld)) {
      $DeleteContent = $DeleteContent.Replace($DeleteOld, $DeleteNew)
      if ($DeleteOriginal.Contains("`r`n")) { $DeleteContent = $DeleteContent.Replace("`n", "`r`n") }
      [System.IO.File]::WriteAllText($DeleteController, $DeleteContent, [System.Text.UTF8Encoding]::new($false))
      Trace-Setup "REVOKE_CHECK_PATCHED"
    } else {
      Trace-Setup "REVOKE_CHECK_LAYOUT_UNKNOWN"
    }
  } catch {
    Trace-Setup "REVOKE_CHECK_PATCH_ERROR"
  }
}

# A API wa-js retorna uma LISTA de mensagens que falharam ao encaminhar.
# Resposta HTTP 201 sem testar essa lista pode fingir entrega bem-sucedida.
if (Test-Path $ForwardController) {
  try {
    $ForwardChecked = [System.IO.File]::ReadAllText($ForwardController)
    $ForwardStart = $ForwardChecked.IndexOf("export async function forwardMessages")
    $ForwardEnd = $ForwardChecked.IndexOf("export async function markUnseenMessage", $ForwardStart)
    if ($ForwardStart -ge 0 -and $ForwardEnd -gt $ForwardStart) {
      $ForwardSection = $ForwardChecked.Substring($ForwardStart, $ForwardEnd - $ForwardStart)
      $ForwardCheckMarker = "[IdealZapForward] NATIVE_NOT_SENT"
      $ForwardResponseLine = "    res.status(201).json({ status: 'success', response });"
      $ForwardCheckText = @'
    if (response === false || (Array.isArray(response) && response.length > 0)) {
      req.logger.warn('[IdealZapForward] NATIVE_NOT_SENT');
      return res.status(409).json({
        status: 'error', message: 'WhatsApp did not confirm native forwarding'
      });
    }
    res.status(201).json({ status: 'success', response });
'@
      if ($ForwardSection.Contains($ForwardCheckMarker)) {
        Trace-Setup "FORWARD_VERIFY_ALREADY_PATCHED"
      } elseif ($ForwardSection.Contains($ForwardResponseLine)) {
        $ForwardSection = $ForwardSection.Replace($ForwardResponseLine, $ForwardCheckText.TrimEnd())
        $ForwardChecked = $ForwardChecked.Substring(0, $ForwardStart) + $ForwardSection +
          $ForwardChecked.Substring($ForwardEnd)
        [System.IO.File]::WriteAllText($ForwardController, $ForwardChecked, [System.Text.UTF8Encoding]::new($false))
        Trace-Setup "FORWARD_VERIFY_PATCHED"
      } else {
        Trace-Setup "FORWARD_VERIFY_LAYOUT_UNKNOWN"
      }
    } else {
      Trace-Setup "FORWARD_VERIFY_LAYOUT_UNKNOWN"
    }
  } catch {
    Trace-Setup "FORWARD_VERIFY_PATCH_ERROR"
  }
}

# Bug do controller v2.10.61: após responder HTTP 200 em deleteMessage,
# faltava return; Express tentava enviar uma segunda resposta 401.
if (Test-Path $DeleteController) {
  try {
    $DeleteResponseContent = [System.IO.File]::ReadAllText($DeleteController)
    $DeleteResponseCrlf = $DeleteResponseContent.Contains("`r`n")
    $DeleteResponseText = $DeleteResponseContent.Replace("`r`n", "`n")
    $DeleteStart = $DeleteResponseText.IndexOf("export async function deleteMessage")
    $DeleteEnd = $DeleteResponseText.IndexOf("export async function reactMessage", $DeleteStart)
    if ($DeleteStart -ge 0 -and $DeleteEnd -gt $DeleteStart) {
      $DeleteSection = $DeleteResponseText.Substring($DeleteStart, $DeleteEnd - $DeleteStart)
      $BadResponse = "    if (result) {`n      res`n"
      $GoodResponse = "    if (result) {`n      return res`n"
      if ($DeleteSection.Contains($GoodResponse)) {
        Trace-Setup "DELETE_RESPONSE_ALREADY_FIXED"
      } elseif ($DeleteSection.Contains($BadResponse)) {
        $DeleteSection = $DeleteSection.Replace($BadResponse, $GoodResponse)
        $DeleteResponseText = $DeleteResponseText.Substring(0, $DeleteStart) + $DeleteSection +
          $DeleteResponseText.Substring($DeleteEnd)
        if ($DeleteResponseCrlf) { $DeleteResponseText = $DeleteResponseText.Replace("`n", "`r`n") }
        [System.IO.File]::WriteAllText($DeleteController, $DeleteResponseText, [System.Text.UTF8Encoding]::new($false))
        Trace-Setup "DELETE_RESPONSE_FIXED"
      } else { Trace-Setup "DELETE_RESPONSE_LAYOUT_UNKNOWN" }
    }
  } catch { Trace-Setup "DELETE_RESPONSE_PATCH_ERROR" }
}

# The native WPPConnect webhook is now selected explicitly by the
# backend in start-session. Remove the previous injected onMessage forwarder
# if present; it produced duplicate events and was not part of the Manager.
$RealtimeSource = Join-Path $Root "wppconnect-server\src\util\createSessionUtil.ts"
if (Test-Path $RealtimeSource) {
  try {
    $RealtimeText = [System.IO.File]::ReadAllText($RealtimeSource)
    $RealtimeMarker = '// [IdealZapRealtime] BRIDGE_ONMESSAGE'
    $RealtimeAnchor = "      callWebHook(client, req, 'onmessage', message);"
    $StartMarker = $RealtimeText.IndexOf($RealtimeMarker)
    if ($StartMarker -ge 0) {
      $StartLine = $RealtimeText.LastIndexOf([char]10, [Math]::Max(0, $StartMarker - 1)) + 1
      $EndMarker = $RealtimeText.IndexOf($RealtimeAnchor, $StartMarker)
      if ($EndMarker -gt $StartMarker -and ($EndMarker - $StartMarker) -lt 2600) {
        $RealtimeText = $RealtimeText.Substring(0, $StartLine) + $RealtimeText.Substring($EndMarker)
        [System.IO.File]::WriteAllText($RealtimeSource, $RealtimeText, [System.Text.UTF8Encoding]::new($false))
        Trace-Setup "LEGACY_REALTIME_BRIDGE_REMOVED"
      } else { Trace-Setup "LEGACY_REALTIME_LAYOUT_UNKNOWN" }
    } else { Trace-Setup "NATIVE_REALTIME_WEBHOOK_READY" }
  } catch { Trace-Setup "REALTIME_BRIDGE_CLEANUP_ERROR" }
}

# O WPP JS armazena o chat na mensagem usando id.remote. Quando o
# backend recebe @lid e converte para @c.us, o ID convertido pode nao
# existir no MsgStore e a exclusao falha. Priorizar o chat real da mensagem.
if (Test-Path $DeleteController) {
  try {
    $RevocationText = [System.IO.File]::ReadAllText($DeleteController)
    $RevocationOld = "              args.chatId, args.messageId, args.clearMedia, true"
    $RevocationNew = "              (existing.id?.remote?.toString?.() || args.chatId), args.messageId, args.clearMedia, true"
    if ($RevocationText.Contains($RevocationNew)) {
      Trace-Setup "REVOKE_REAL_CHAT_ALREADY_PATCHED"
    } elseif ($RevocationText.Contains($RevocationOld)) {
      $RevocationText = $RevocationText.Replace($RevocationOld, $RevocationNew)
      [System.IO.File]::WriteAllText($DeleteController, $RevocationText, [System.Text.UTF8Encoding]::new($false))
      Trace-Setup "REVOKE_REAL_CHAT_PATCHED"
    } else { Trace-Setup "REVOKE_REAL_CHAT_LAYOUT_UNKNOWN" }
  } catch { Trace-Setup "REVOKE_REAL_CHAT_PATCH_ERROR" }
}

# WA-JS v4.6.0 retorna IDs das mensagens encaminhadas (nao lista de
# erros). Nunca tratar retorno com IDs como falha: o ajuste anterior
# podia rejeitar um encaminhamento valido depois que ele ja foi enviado.
if (Test-Path $ForwardController) {
  try {
    $ForwardCheck = [System.IO.File]::ReadAllText($ForwardController)
    $BadArrayCheck = "response === false || (Array.isArray(response) && response.length > 0)"
    $CorrectArrayCheck = "response === false || response == null"
    if ($ForwardCheck.Contains($BadArrayCheck)) {
      $ForwardCheck = $ForwardCheck.Replace($BadArrayCheck, $CorrectArrayCheck)
      [System.IO.File]::WriteAllText($ForwardController, $ForwardCheck, [System.Text.UTF8Encoding]::new($false))
      Trace-Setup "FORWARD_RETURN_ARRAY_FIXED"
    } elseif ($ForwardCheck.Contains($CorrectArrayCheck)) {
      Trace-Setup "FORWARD_RETURN_ARRAY_ALREADY_FIXED"
    } else {
      Trace-Setup "FORWARD_RETURN_ARRAY_LAYOUT_UNKNOWN"
    }
  } catch { Trace-Setup "FORWARD_RETURN_ARRAY_FIX_ERROR" }
}

# Apply checked operations after older compatibility patches.
& node (Join-Path $PSScriptRoot "install-phone-actions.mjs")
if ($LASTEXITCODE -ne 0) { throw "Nao foi possivel preparar as operacoes do WhatsApp." }
Trace-Setup "PHONE_ACTIONS_INSTALLED"

Trace-Setup "CONFIG_COMPLETED"
Write-Host "Canal local para QR Code configurado (credencial protegida)." -ForegroundColor Green
