$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$Root = Split-Path -Parent $PSScriptRoot
$ServerDir = Join-Path $Root "wppconnect-server"
$ServerEnv = Join-Path $ServerDir ".env"
$BackendEnv = Join-Path $Root "backend\.env"
$BaseUrl = "http://127.0.0.1:8788"

# ID tecnico sem espacos; nome exibido ao usuario: Ideal Contabilidade.
$Session = "Ideal Contabilidade"
$SessionUrl = [System.Uri]::EscapeDataString($Session)
$SessionLabel = "Ideal Contabilidade"

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
  throw "SECRET_KEY não está configurada em wppconnect-server\.env. Execute PREPARAR_AMBIENTE.bat."
}
$SecretKey = $secretMatch.Groups[1].Value.Trim().Trim('"').Trim("'")
if ($SecretKey -in @("123", "THISISMYSECURETOKEN", "CHANGE_ME")) {
  throw "SECRET_KEY está usando um valor fraco. Execute PREPARAR_AMBIENTE.bat atualizado."
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
Write-Host "Verificando o WPPConnect deste projeto em $BaseUrl ..." -ForegroundColor Cyan
try {
  Invoke-RestMethod -Uri "$BaseUrl/healthz" -TimeoutSec 5 | Out-Null
} catch {
  throw "O WPPConnect não respondeu em $BaseUrl. Execute PREPARAR_AMBIENTE.bat e depois INICIAR_TUDO.bat. O projeto usa a porta 8788 para evitar instalações antigas na 8787."
}

Write-Host "Gerando token interno para '$SessionLabel'..." -ForegroundColor Cyan
try {
  $tokenResult = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/$SessionUrl/$SecretKey/generate-token" -TimeoutSec 20
} catch {
  $response = $_.Exception.Response
  $statusCode = 0
  $allowHeader = ""
  $responseBody = ""
  if ($response) {
    try { $statusCode = [int]$response.StatusCode } catch {}
    try { $allowHeader = [string]$response.Headers["Allow"] } catch {}
    try {
      $stream = $response.GetResponseStream()
      if ($stream) {
        $reader = New-Object System.IO.StreamReader($stream)
        $responseBody = $reader.ReadToEnd()
        $reader.Dispose()
      }
    } catch {}
  }
  if ($statusCode -eq 405) {
    $extra = if ($allowHeader) { " Métodos aceitos informados pelo servidor: $allowHeader." } else { "" }
    throw "Erro 405: o serviço na porta 8788 não parece ser a API oficial esperada; a rota de geração de token do WPPConnect usa POST.$extra Confira se a janela 'WPPConnect Server - 8788' iniciou sem erro. Resposta: $responseBody"
  }
  throw "Não consegui gerar o token (HTTP $statusCode). Confira a janela 'WPPConnect Server - 8788'. Detalhe: $($_.Exception.Message) $responseBody"
}

$Token = [string]$tokenResult.token
if ([string]::IsNullOrWhiteSpace($Token)) { throw "O WPPConnect não retornou o campo token. Verifique a versão oficial na porta 8788." }

Set-EnvValue $BackendEnv "WPP_BASE_URL" $BaseUrl
Set-EnvValue $BackendEnv "WPP_SESSION" $Session
Set-EnvValue $BackendEnv "WPP_TOKEN" $Token
Set-EnvValue $BackendEnv "API_PORT" "3001"
Set-EnvValue $BackendEnv "CORS_ORIGINS" "http://localhost:8080,http://127.0.0.1:8080,http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000"
Write-Host "Token interno configurado automaticamente, sem pedir senha." -ForegroundColor Green

$Headers = @{ Authorization = "Bearer $Token" }
$QrPath = Join-Path $env:TEMP "IdealContabilidade_WhatsApp_QR.png"
$Connected = $false
try {
  $status = Invoke-RestMethod -Uri "$BaseUrl/api/$SessionUrl/status-session" -Headers $Headers -TimeoutSec 10
  if ($status.status -eq "CONNECTED") { $Connected = $true }
} catch {}

if (-not $Connected) {
  Write-Host "Iniciando a sessão e solicitando o QR Code..." -ForegroundColor Cyan
  $start = $null
  try {
    $body = '{"waitQrCode":true}'
    $start = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/$SessionUrl/start-session" -Headers $Headers -ContentType "application/json" -Body $body -TimeoutSec 90
  } catch {
    Write-Host "A sessão pode estar inicializando; vou tentar obter o QR Code atual." -ForegroundColor Yellow
  }

  if ($start -and $start.qrcode) {
    $qrBase64 = [string]$start.qrcode -replace '^data:image/png;base64,', ''
    [System.IO.File]::WriteAllBytes($QrPath, [Convert]::FromBase64String($qrBase64))
  } else {
    try {
      Invoke-WebRequest -Uri "$BaseUrl/api/$SessionUrl/qrcode-session" -Headers $Headers -OutFile $QrPath -UseBasicParsing -TimeoutSec 15
      $signature = [System.IO.File]::ReadAllBytes($QrPath) | Select-Object -First 8
      if ((Get-Item $QrPath).Length -lt 500 -or (($signature -join ',') -ne "137,80,78,71,13,10,26,10")) {
        Remove-Item $QrPath -Force -ErrorAction SilentlyContinue
      }
    } catch {
      Remove-Item $QrPath -Force -ErrorAction SilentlyContinue
    }
  }

  if (Test-Path $QrPath) {
    Write-Host ""
    Write-Host "Leia o QR Code com o WhatsApp do celular que ficará conectado ao Ideal Contabilidade." -ForegroundColor Yellow
    Start-Process $QrPath
    Write-Host "No celular: WhatsApp > Dispositivos conectados > Conectar dispositivo."
    Write-Host "Aguardando confirmação por até 75 segundos..."
    $deadline = (Get-Date).AddSeconds(75)
    while ((Get-Date) -lt $deadline) {
      Start-Sleep -Seconds 3
      try {
        $status = Invoke-RestMethod -Uri "$BaseUrl/api/$SessionUrl/status-session" -Headers $Headers -TimeoutSec 8
        if ($status.status -eq "CONNECTED") { $Connected = $true; break }
      } catch {}
    }
  } else {
    Write-Host "Não consegui obter o QR Code. Confira a janela 'WPPConnect Server - 8788' e execute CONECTAR_WHATSAPP.bat novamente." -ForegroundColor Yellow
  }
}

if ($Connected) {
  Write-Host ""
  Write-Host "WhatsApp do Ideal Contabilidade conectado com sucesso!" -ForegroundColor Green
} else {
  Write-Host ""
  Write-Host "A conexão não foi confirmada. Se o QR expirou, execute CONECTAR_WHATSAPP.bat novamente." -ForegroundColor Yellow
}
Remove-Item $QrPath -Force -ErrorAction SilentlyContinue
Write-Host "Configuração salva em backend\.env."
Write-Host "Feche a janela antiga 'Ideal Zap - API local - 3001' e execute INICIAR_API.bat para carregar o token novo."
Write-Host "Depois confira http://127.0.0.1:3001/chats e atualize http://127.0.0.1:8080/."
