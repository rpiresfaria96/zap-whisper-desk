# Uso interno: chamado automaticamente por INICIAR.bat.
# Gera um token de sessao sem expo-lo no navegador nem no terminal.
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Root = Split-Path -Parent $PSScriptRoot
$ServerEnv = Join-Path $Root "wppconnect-server\.env"
$BackendEnv = Join-Path $Root "backend\.env"
$BackendExample = Join-Path $Root "backend\.env.example"
$BaseUrl = "http://127.0.0.1:8788"
# O WPPConnect aceita apenas letras, numeros, hifen e sublinhado no ID tecnico.
# O nome exibido pela interface continua sendo "Ideal Contabilidade".
$Session = "Ideal_Contabilidade"

function Get-EnvValue([string]$Path, [string]$Key) {
  if (-not (Test-Path $Path)) { return "" }
  $match = [regex]::Match([System.IO.File]::ReadAllText($Path), '(?m)^\s*' + [regex]::Escape($Key) + '\s*=\s*(.*?)\s*$')
  if (-not $match.Success) { return "" }
  return $match.Groups[1].Value.Trim().Trim('"').Trim("'")
}

function Set-EnvValue([string]$Path, [string]$Key, [string]$Value) {
  $lines = [System.Collections.Generic.List[string]]::new()
  foreach ($line in [System.IO.File]::ReadAllLines($Path)) { $lines.Add($line) }
  $pattern = '^\s*' + [regex]::Escape($Key) + '\s*=.*$'
  $found = $false
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match $pattern) {
      $lines[$i] = "$Key=$Value"
      $found = $true
    }
  }
  if (-not $found) { $lines.Add("$Key=$Value") }
  [System.IO.File]::WriteAllLines($Path, $lines, [System.Text.UTF8Encoding]::new($false))
}

if (-not (Test-Path $ServerEnv)) {
  throw "Configuracao do WPPConnect ausente. Execute PREPARAR_AMBIENTE.bat primeiro."
}
if (-not (Test-Path $BackendEnv)) {
  if (-not (Test-Path $BackendExample)) { throw "Arquivo backend\.env.example nao encontrado." }
  Copy-Item $BackendExample $BackendEnv
}

$Secret = Get-EnvValue $ServerEnv "SECRET_KEY"
if ([string]::IsNullOrWhiteSpace($Secret) -or $Secret -in @("123", "THISISMYSECURETOKEN", "CHANGE_ME")) {
  throw "Chave interna do WPPConnect nao configurada. Execute PREPARAR_AMBIENTE.bat."
}

$ConfiguredSession = Get-EnvValue $BackendEnv "WPP_SESSION"
if ($ConfiguredSession -eq "Ideal Contabilidade") {
  # Corrige automaticamente as instalacoes da versao anterior (ID com espaco).
  # A sessao antiga nunca pode ter sido iniciada com esse ID invalido.
  Write-Host "Corrigindo ID tecnico da sessao anterior..." -ForegroundColor Yellow
  Set-EnvValue $BackendEnv "WPP_SESSION" $Session
} elseif (-not [string]::IsNullOrWhiteSpace($ConfiguredSession)) {
  if ($ConfiguredSession -notmatch '^[A-Za-z0-9_-]+$') {
    throw "ID de sessao invalido em backend\.env. Use apenas letras, numeros, _ ou -."
  }
  # Preservar outros IDs tecnicos validos e suas sessoes existentes.
  $Session = $ConfiguredSession
}
$SessionUrl = [System.Uri]::EscapeDataString($Session)
$SecretUrl = [System.Uri]::EscapeDataString($Secret)

Write-Host "Configurando a sessao WhatsApp automaticamente..." -ForegroundColor Cyan
try {
  $TokenResult = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/$SessionUrl/$SecretUrl/generate-token" -TimeoutSec 20
} catch {
  # O erro HTTP pode conter o URL com a chave secreta. Nunca imprimir o erro bruto.
  throw "Nao foi possivel gerar o token interno. Confira a janela do WPPConnect (porta 8788)."
}

$Token = [string]$TokenResult.token
if ([string]::IsNullOrWhiteSpace($Token)) {
  throw "O WPPConnect nao retornou um token valido. Confira a versao instalada."
}

Set-EnvValue $BackendEnv "WPP_BASE_URL" $BaseUrl
Set-EnvValue $BackendEnv "WPP_SESSION" $Session
Set-EnvValue $BackendEnv "WPP_TOKEN" $Token
Set-EnvValue $BackendEnv "API_PORT" "3001"
Write-Host "Sessao e token configurados com seguranca." -ForegroundColor Green

# A sessao sera iniciada pela propria interface, depois que a API estiver pronta.
# Antes, esta chamada abria o QR com antecedencia e podia competir com
# o botao da interface, causando erro "browser is already running".
Write-Host "Token pronto. O Ideal Zap vai gerar o QR na propria interface." -ForegroundColor Green
