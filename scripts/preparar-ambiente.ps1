$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Root = Split-Path -Parent $PSScriptRoot
$ServerDir = Join-Path $Root "wppconnect-server"
$RuntimeParent = Join-Path $Root "runtime"
$NodeDir = Join-Path $RuntimeParent "node-v22.22.2-win-x64"
$CacheDir = Join-Path $Root "_cache"
$CorepackHome = Join-Path $CacheDir "corepack"
$NpmCache = Join-Path $CacheDir "npm"
$YarnCache = Join-Path $CacheDir "yarn"
$ServerVersion = "2.10.61"
$ManagerVersion = "2.0.0"

New-Item -ItemType Directory -Force -Path $RuntimeParent, $CacheDir, $CorepackHome, $NpmCache, $YarnCache | Out-Null
$env:COREPACK_HOME = $CorepackHome
$env:npm_config_cache = $NpmCache
$env:YARN_CACHE_FOLDER = $YarnCache

function Set-EnvValue([string]$Path, [string]$Name, [string]$Value) {
  if (-not (Test-Path $Path)) { throw "Arquivo não encontrado: $Path" }
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

function Download-File([string]$Url, [string]$Destination) {
  Write-Host "Baixando $([System.IO.Path]::GetFileName($Destination)) ..."
  Invoke-WebRequest -Uri $Url -OutFile $Destination -UseBasicParsing
  if (-not (Test-Path $Destination) -or (Get-Item $Destination).Length -lt 1000) {
    throw "Download incompleto: $Url"
  }
}

Write-Host ""
Write-Host "=== IDEAL ZAP: PREPARAR TUDO EM UMA PASTA ===" -ForegroundColor Cyan
Write-Host "Pasta principal: $Root"
Write-Host "O instalador usa um Node.js portátil; não altera o Node já instalado no Windows."
Write-Host ""

# 1. Node.js portable, pinned to the version declared by the WPPConnect Server package.
if (-not (Test-Path (Join-Path $NodeDir "node.exe"))) {
  $nodeZip = Join-Path $CacheDir "node-v22.22.2-win-x64.zip"
  $nodeUrl = "https://nodejs.org/dist/v22.22.2/node-v22.22.2-win-x64.zip"
  Download-File $nodeUrl $nodeZip
  $nodeHash = (Get-FileHash -Path $nodeZip -Algorithm SHA256).Hash.ToLowerInvariant()
  $expectedNodeHash = "7c93e9d92bf68c07182b471aa187e35ee6cd08ef0f24ab060dfff605fcc1c57c"
  if ($nodeHash -ne $expectedNodeHash) { throw "A verificação SHA-256 do Node.js falhou. O arquivo não será extraído." }
  Write-Host "Node.js verificado. Extraindo..."
  Expand-Archive -Path $nodeZip -DestinationPath $RuntimeParent -Force
  Remove-Item $nodeZip -Force
}
if (-not (Test-Path (Join-Path $NodeDir "node.exe"))) {
  throw "Node.js portátil não foi extraído corretamente."
}
$env:PATH = "$NodeDir;$env:PATH"
$nodeVersion = (& (Join-Path $NodeDir "node.exe") -p "process.versions.node").Trim()
Write-Host "Node local: v$nodeVersion" -ForegroundColor Green

# 2. Download the official WPPConnect Server release into this project folder.
$serverPackage = Join-Path $ServerDir "package.json"
$installServer = $true
if (Test-Path $serverPackage) {
  try {
    $existingVersion = (Get-Content $serverPackage -Raw | ConvertFrom-Json).version
    if ($existingVersion -eq $ServerVersion -and (Test-Path (Join-Path $ServerDir "src\server.ts"))) {
      $installServer = $false
      Write-Host "WPPConnect Server v$ServerVersion já está presente; vou preservar essa pasta."
    }
  } catch {}
}
$serverWasInstalled = $installServer
if ($installServer) {
  if (Test-Path $ServerDir) {
    $backup = Join-Path $Root ("wppconnect-server.backup-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
    Write-Host "Fazendo backup da pasta anterior em: $backup" -ForegroundColor Yellow
    Move-Item -Path $ServerDir -Destination $backup
  }
  $serverZip = Join-Path $CacheDir "wppconnect-server-v$ServerVersion.zip"
  $serverUrl = "https://github.com/wppconnect-team/wppconnect-server/archive/refs/tags/v$ServerVersion.zip"
  Download-File $serverUrl $serverZip
  $stage = Join-Path $CacheDir "wpp-server-extract"
  if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $stage | Out-Null
  Expand-Archive -Path $serverZip -DestinationPath $stage -Force
  $source = Get-ChildItem $stage -Directory | Select-Object -First 1
  if (-not $source -or -not (Test-Path (Join-Path $source.FullName "package.json"))) {
    throw "O ZIP oficial do WPPConnect não contém a estrutura esperada."
  }
  New-Item -ItemType Directory -Force -Path $ServerDir | Out-Null
  Get-ChildItem $source.FullName -Force | Copy-Item -Destination $ServerDir -Recurse -Force
  Remove-Item $stage -Recurse -Force
  Remove-Item $serverZip -Force
  Write-Host "WPPConnect Server v$ServerVersion baixado." -ForegroundColor Green
}

# 3. Add the official Manager static bundle. The source-code install does not bundle these files.
$managerIndex = Join-Path $ServerDir "manager\index.html"
if (-not (Test-Path $managerIndex)) {
  $managerArchive = Join-Path $CacheDir "wppconnect-manager-v$ManagerVersion.tar.gz"
  $managerUrl = "https://github.com/wppconnect-team/wppconnect-manager/releases/download/v$ManagerVersion/wppconnect-manager.tar.gz"
  Download-File $managerUrl $managerArchive
  $managerHash = (Get-FileHash -Path $managerArchive -Algorithm SHA256).Hash.ToLowerInvariant()
  $expectedManagerHash = "e5cd47cbd56c5eca53751947cf5799f75aa5a4b4d7c2bf189471374a48b9ff7f"
  if ($managerHash -ne $expectedManagerHash) { throw "A verificação SHA-256 do Manager falhou. O arquivo não será extraído." }
  $tar = Get-Command "tar.exe" -ErrorAction SilentlyContinue
  if (-not $tar) { throw "Não encontrei tar.exe do Windows. Atualize o Windows ou extraia o pacote oficial wppconnect-manager.tar.gz na pasta wppconnect-server\manager." }
  $managerDir = Join-Path $ServerDir "manager"
  New-Item -ItemType Directory -Force -Path $managerDir | Out-Null
  & $tar.Source -xzf $managerArchive -C $managerDir
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $managerIndex)) {
    throw "Não consegui instalar os arquivos do Manager em $managerDir."
  }
  Remove-Item $managerArchive -Force
  Write-Host "Manager oficial v$ManagerVersion instalado e verificado." -ForegroundColor Green
}

# 4. Create and configure the WPPConnect .env. A weak sample secret is replaced automatically.
$wppEnv = Join-Path $ServerDir ".env"
$wppExample = Join-Path $ServerDir ".env.example"
if (-not (Test-Path $wppEnv)) {
  if (-not (Test-Path $wppExample)) { throw "Não encontrei wppconnect-server\.env.example." }
  Copy-Item $wppExample $wppEnv
}
$currentEnv = Get-Content $wppEnv -Raw
$secretMatch = [regex]::Match($currentEnv, '(?m)^\s*SECRET_KEY\s*=\s*(.*?)\s*$')
if (-not $secretMatch.Success -or [string]::IsNullOrWhiteSpace($secretMatch.Groups[1].Value) -or $secretMatch.Groups[1].Value -in @("123","THISISMYSECURETOKEN","CHANGE_ME")) {
  $secretBytes = New-Object byte[] 32
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($secretBytes)
  $rng.Dispose()
  $secret = ([System.BitConverter]::ToString($secretBytes)).Replace("-", "").ToLowerInvariant()
  Set-EnvValue $wppEnv "SECRET_KEY" $secret
}
Set-EnvValue $wppEnv "PORT" "8787"
Set-EnvValue $wppEnv "HOST" "http://localhost"
Set-EnvValue $wppEnv "MANAGER_ENABLED" "true"
Write-Host "Configuração do WPPConnect ajustada para a porta 8787." -ForegroundColor Green

# 5. Set up Manager / frontend integration without overwriting any existing session token.
$rootEnv = Join-Path $Root ".env"
if (-not (Test-Path $rootEnv)) {
  if (Test-Path (Join-Path $Root ".env.example")) { Copy-Item (Join-Path $Root ".env.example") $rootEnv }
  else { Set-Content -Path $rootEnv -Value "VITE_API_URL=http://127.0.0.1:3001" -Encoding UTF8 }
}
Set-EnvValue $rootEnv "VITE_API_URL" "http://127.0.0.1:3001"

$backendDir = Join-Path $Root "backend"
New-Item -ItemType Directory -Force -Path $backendDir | Out-Null
$backendEnv = Join-Path $backendDir ".env"
if (-not (Test-Path $backendEnv)) {
  $backendExample = Join-Path $backendDir ".env.example"
  if (-not (Test-Path $backendExample)) { throw "Não encontrei backend\.env.example." }
  Copy-Item $backendExample $backendEnv
}
Set-EnvValue $backendEnv "WPP_BASE_URL" "http://127.0.0.1:8787"
if ($serverWasInstalled) {
  # Tokens from the previous server secret cannot be reused after a clean server install.
  Set-EnvValue $backendEnv "WPP_SESSION" "Ideal"
  Set-EnvValue $backendEnv "WPP_TOKEN" ""
}
Set-EnvValue $backendEnv "API_PORT" "3001"
Set-EnvValue $backendEnv "CORS_ORIGINS" "http://localhost:8080,http://127.0.0.1:8080,http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000"

# 6. Install app and server dependencies using the bundled Node runtime.
Write-Host ""
Write-Host "Instalando dependências do WPPConnect Server (pode demorar)..." -ForegroundColor Cyan
Push-Location $ServerDir
try {
  $corepack = Join-Path $NodeDir "corepack.cmd"
  if (Test-Path $corepack) {
    & $corepack prepare yarn@4.14.1 --activate
    if ($LASTEXITCODE -ne 0) { throw "Não foi possível preparar o Yarn 4.14.1." }

    # Corepack may cache yarn.js inside this ESM project. Without a local package
    # scope, Node inherits the root package.json "type": "module" and Yarn throws
    # "Dynamic require of util is not supported". Force the downloaded Yarn CLI
    # to be interpreted as CommonJS; this does not change app/server package types.
    $yarnVersionDir = Join-Path $CorepackHome "v1\yarn\4.14.1"
    $yarnJs = Join-Path $yarnVersionDir "yarn.js"
    if (Test-Path $yarnJs) {
      $yarnScope = Join-Path $yarnVersionDir "package.json"
      if (Test-Path $yarnScope) {
        try {
          $yarnPackage = Get-Content $yarnScope -Raw | ConvertFrom-Json
          $yarnPackage | Add-Member -NotePropertyName type -NotePropertyValue "commonjs" -Force
          $yarnPackage | ConvertTo-Json -Depth 10 | Set-Content -Path $yarnScope -Encoding UTF8
        } catch {
          Set-Content -Path $yarnScope -Value '{"type":"commonjs"}' -Encoding ASCII
        }
      } else {
        Set-Content -Path $yarnScope -Value '{"type":"commonjs"}' -Encoding ASCII
      }
      Write-Host "Ajuste de compatibilidade do Yarn aplicado." -ForegroundColor Green
    } else {
      throw "O arquivo do Yarn não foi encontrado em $yarnJs após a preparação."
    }

    & $corepack yarn install --immutable
    if ($LASTEXITCODE -ne 0) { throw "A instalação das dependências do WPPConnect falhou." }
  } else {
    throw "O pacote Node.js portátil não contém corepack.cmd. Baixe o MSI oficial do Node.js v22.22.2 e execute a preparação novamente."
  }
} finally { Pop-Location }

Write-Host "Instalando dependências da interface..." -ForegroundColor Cyan
if (-not (Test-Path (Join-Path $Root "package.json"))) {
  throw "Não encontrei package.json na pasta principal. Execute este preparador dentro da pasta raiz do projeto da interface."
}
Push-Location $Root
try {
  $npm = Join-Path $NodeDir "npm.cmd"
  & $npm install --no-package-lock
  if ($LASTEXITCODE -ne 0) { throw "A instalação das dependências da interface falhou." }
} finally { Pop-Location }

Write-Host ""
Write-Host "PREPARAÇÃO CONCLUÍDA." -ForegroundColor Green
Write-Host "Tudo está dentro desta pasta:"
Write-Host "  Interface : $Root"
Write-Host "  WPPConnect: $ServerDir"
Write-Host "  Node local: $NodeDir"
Write-Host ""
Write-Host "Próximo passo: execute INICIAR_TUDO.bat."
Write-Host "Na primeira conexão, abra o Manager, entre com a SECRET_KEY do arquivo wppconnect-server\.env e crie/vincule a sessão Ideal pelo QR Code."
Write-Host "Depois copie o token da sessão para backend\.env (WPP_SESSION e WPP_TOKEN)."
