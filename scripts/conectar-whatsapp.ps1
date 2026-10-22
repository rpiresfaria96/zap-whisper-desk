$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$Root = Split-Path -Parent $PSScriptRoot
$ServerDir = Join-Path $Root "wppconnect-server"
$ServerEnv = Join-Path $ServerDir ".env"
$BackendEnv = Join-Path $Root "backend\.env"
$BaseUrl = "http://127.0.0.1:8787"
$Session = Read-Host "Nome da sessão WhatsApp [Ideal]"
if ([string]::IsNullOrWhiteSpace($Session)) { $Session = "Ideal" }
if ($Session -notmatch '^[A-Za-z0-9_-]+$') { throw "Nome de sessão inválido. Use letras, números, hífen ou sublinhado." }

if (-not (Test-Path $ServerEnv)) { throw "Não encontrei $ServerEnv. Execute PREPARAR_AMBIENTE.bat primeiro." }
if (-not (Test-Path $BackendEnv)) {
  if (Test-Path (Join-Path $Root "backend\.env.example")) {
    Copy-Item (Join-Path $Root "backend\.env.example") $BackendEnv
  } else {
    throw "Não encontrei backend\.env nem backend\.env.example."
  }
}

$envText = Get-Content $ServerEnv -Raw
$secretMatch = [regex]::Match($envText, '(?m)^\s*SECRET_KEY\s*=\s*(.*?)\s*$')
if (-not $secretMatch.Success -or [string]::IsNullOrWhiteSpace($secretMatch.Groups[1].Value)) {
  throw "SECRET_KEY não está configurada em wppconnect-server\.env."
}
$SecretKey = $secretMatch.Groups[1].Value.Trim().Trim('"').Trim("'")
if ($SecretKey -eq "123" -or $SecretKey -eq "THISISMYSECURETOKEN") {
  throw "SECRET_KEY ainda está usando um valor fraco. Execute PREPARAR_AMBIENTE.bat atualizado antes de continuar."
}

function Set-EnvValue([string]$Path, [string]$Name, [string]$Value) {
  $lines = [System.Collections.Generic.List[string]]::new()
  foreach ($line in [System.IO.File]::ReadAllLines($Path)) { $lines.Add($line) }
  $pattern = '^\s*' + [regex]::Escape($Name) + '\s*=.*$'
  $found = $false
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match $pattern) {
      $lines[$i] = "$Name=$Value"
      $found = $true
    }
  }
  if (-not $found) { $lines.Add("$Name=$Value") }
  [System.IO.File]::WriteAllLines($Path, $lines, [System.Text.UTF8Encoding]::new($false))
}

Write-Host ""
Write-Host "Verificando WPPConnect em $BaseUrl ..." -ForegroundColor Cyan
try {
  Invoke-RestMethod -Uri "$BaseUrl/healthz" -TimeoutSec 5 | Out-Null
} catch {
  throw "O WPPConnect não respondeu em $BaseUrl. Execute INICIAR_TUDO.bat e confira a janela 'WPPConnect Server - 8787'."
}

Write-Host "Gerando token para a sessão '$Session'..." -ForegroundColor Cyan
$tokenResult = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/$Session/$SecretKey/generate-token" -TimeoutSec 20
$Token = [string]$tokenResult.token
if ([string]::IsNullOrWhiteSpace($Token)) { throw "O WPPConnect não retornou o campo token." }

# IMPORTANT: backend sends the hash as Authorization: Bearer <token> and the session in the URL.
# Save token (hash) only, not 'full' (which includes 'Session:').
Set-EnvValue $BackendEnv "WPP_BASE_URL" $BaseUrl
Set-EnvValue $BackendEnv "WPP_SESSION" $Session
Set-EnvValue $BackendEnv "WPP_TOKEN" $Token
Set-EnvValue $BackendEnv "API_PORT" "3001"
Set-EnvValue $BackendEnv "CORS_ORIGINS" "http://localhost:8080,http://127.0.0.1:8080,http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000"
Write-Host "Token guardado em backend\.env sem exibi-lo no terminal." -ForegroundColor Green

$Headers = @{ Authorization = "Bearer $Token" }
$QrPath = Join-Path $env:TEMP ("IdealZap_QR_" + $Session + ".png")
$Connected = $false
try {
  $status = Invoke-RestMethod -Uri "$BaseUrl/api/$Session/status-session" -Headers $Headers -TimeoutSec 10
  if ($status.status -eq "CONNECTED") { $Connected = $true }
} catch {}

if (-not $Connected) {
  Write-Host "Solicitando início da sessão e QR Code..." -ForegroundColor Cyan
  $start = $null
  try {
    $body = '{"waitQrCode":true}'
    $start = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/$Session/start-session" -Headers $Headers -ContentType "application/json" -Body $body -TimeoutSec 90
  } catch {
    Write-Host "A sessão pode já estar inicializando; vou tentar obter o QR Code atual."
  }

  if ($start -and $start.qrcode) {
    $qrBase64 = [string]$start.qrcode -replace '^data:image/png;base64,', ''
    [System.IO.File]::WriteAllBytes($QrPath, [Convert]::FromBase64String($qrBase64))
  } else {
    # If Start Session returned without the QR, request the current PNG.
    try {
      $qrResponse = Invoke-WebRequest -Uri "$BaseUrl/api/$Session/qrcode-session" -Headers $Headers -OutFile $QrPath -PassThru -UseBasicParsing -TimeoutSec 15
      if ($qrResponse.Headers["Content-Type"] -notmatch "image/png") {
        Remove-Item $QrPath -Force -ErrorAction SilentlyContinue
      }
    } catch {
      Remove-Item $QrPath -Force -ErrorAction SilentlyContinue
    }
  }

  if (Test-Path $QrPath) {
    Write-Host ""
    Write-Host "O QR Code será aberto agora. Leia-o imediatamente pelo celular." -ForegroundColor Yellow
    Start-Process $QrPath
    Write-Host "No celular: WhatsApp > Dispositivos conectados > Conectar dispositivo."
    Write-Host "Aguardando conexão por até 75 segundos..."
    $deadline = (Get-Date).AddSeconds(75)
    while ((Get-Date) -lt $deadline) {
      Start-Sleep -Seconds 3
      try {
        $status = Invoke-RestMethod -Uri "$BaseUrl/api/$Session/status-session" -Headers $Headers -TimeoutSec 8
        if ($status.status -eq "CONNECTED") { $Connected = $true; break }
      } catch {}
    }
  } else {
    Write-Host "Não consegui obter o QR Code automaticamente. Confira a janela do WPPConnect e abra novamente este arquivo." -ForegroundColor Yellow
  }
}

if ($Connected) {
  Write-Host ""
  Write-Host "WhatsApp conectado com sucesso!" -ForegroundColor Green
} else {
  Write-Host ""
  Write-Host "A conexão ainda não foi confirmada. Se o QR expirou, execute este arquivo novamente." -ForegroundColor Yellow
}
Remove-Item $QrPath -Force -ErrorAction SilentlyContinue
Write-Host "A configuração de backend foi atualizada. Reinicie a janela 'Ideal Zap - API local - 3001' para recarregar o token."
Write-Host "Depois confira http://127.0.0.1:3001/chats e atualize http://127.0.0.1:8080/."
