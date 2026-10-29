# Certificado HTTPS do Ideal-Zap para a porta publica 8080. Windows 10 / PS 5.1.
# Nao usa OpenSSL, nao modifica a sessao WhatsApp, nao escreve segredos no log.
param([string]$RequestedIp = '192.168.100.88')
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$folder = Join-Path $root '.local\https'
$pfx = Join-Path $folder 'idealzap-lan.pfx'
$passFile = Join-Path $folder 'pfx.pass'
$public = Join-Path $folder 'IdealZap_CERTIFICADO_PUBLICO.cer'

$ipRef = $null
if (-not [System.Net.IPAddress]::TryParse($RequestedIp, [ref]$ipRef) -or
    $ipRef.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork -or
    $RequestedIp -like '127.*') { throw 'Endereco IPv4 invalido. Informe o IP real do computador servidor.' }
$localIp = Get-NetIPAddress -IPAddress $RequestedIp -AddressFamily IPv4 -ErrorAction SilentlyContinue
if (-not $localIp) {
    throw ('O IP ' + $RequestedIp + ' NAO pertence a este computador. Execute ipconfig NO SERVIDOR e corrija o endereco antes de criar o certificado.')
}

function Confirm-CertificateMatches {
    if (-not ((Test-Path -LiteralPath $pfx) -and (Test-Path -LiteralPath $passFile) -and
        (Test-Path -LiteralPath $public))) { return $false }
    try {
        $password = [System.IO.File]::ReadAllText($passFile).Trim()
        $tlsCert = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new(
            $pfx, $password, [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::DefaultKeySet)
        $publicCert = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($public)
        $extension = @($tlsCert.Extensions | Where-Object { $_.Oid.Value -eq '2.5.29.17' }) | Select-Object -First 1
        if (-not $extension) { return $false }
        $names = $extension.Format($true)
        $matchIp = [regex]::IsMatch($names, '(?<!\d)' + [regex]::Escape($RequestedIp) + '(?!\d)')
        return ($matchIp -and $tlsCert.Thumbprint -eq $publicCert.Thumbprint -and
            $tlsCert.NotAfter -gt (Get-Date).AddDays(7) -and $tlsCert.NotBefore -lt (Get-Date) -and
            $tlsCert.HasPrivateKey)
    } catch { return $false }
}

if (Confirm-CertificateMatches) {
    Write-Host 'CERTIFICADO EXISTENTE COMPATIVEL COM ESTE IP. Nada foi substituido.' -ForegroundColor Green
    Write-Host ('Link: https://' + $RequestedIp + ':8080/')
    Write-Host ('Certificado publico: ' + $public)
    Write-Host ('SHA256: ' + (Get-FileHash -LiteralPath $public -Algorithm SHA256).Hash)
    exit 0
}

# Protege quaisquer certificados anteriores. Se ja existem, so troca com
# consentimento explicito, guardando a chave anterior fora do GitHub.
$files = @('idealzap-lan.pfx', 'pfx.pass', 'IdealZap_CERTIFICADO_PUBLICO.cer', 'key.pem', 'cert.pem')
$existing = @($files | Where-Object { Test-Path -LiteralPath (Join-Path $folder $_) })
if ($existing.Count -gt 0) {
    Write-Host 'O certificado existente esta incompleto, vencido ou NAO corresponde ao IP informado.' -ForegroundColor Yellow
    Write-Host 'Um novo certificado exigira reinstalar o .cer nos navegadores dos computadores.'
    $confirmation = Read-Host 'Criar outro certificado e guardar os arquivos antigos em um backup privado? Digite SIM'
    if ($confirmation -ne 'SIM') { throw 'Cancelado. Nenhum certificado antigo foi alterado.' }
}
if (-not (Get-Command New-SelfSignedCertificate -ErrorAction SilentlyContinue)) {
    throw 'New-SelfSignedCertificate indisponivel neste Windows. Nao foi possivel gerar certificado.'
}

[void](New-Item -ItemType Directory -Path $folder -Force)
$certificate = $null
$backupFolder = $null
$created = @()
try {
    if ($existing.Count -gt 0) {
        $backupFolder = Join-Path $folder ('historico\certificado-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
        [void](New-Item -ItemType Directory -Path $backupFolder -Force)
        foreach ($file in $existing) {
            Move-Item -LiteralPath (Join-Path $folder $file) -Destination (Join-Path $backupFolder $file) -ErrorAction Stop
        }
        Write-Host ('Backup antigo protegido em: ' + $backupFolder)
    }
    # Subject Alternative Name para o IP explicitamente usado pelo segundo PC.
    $san = '2.5.29.17={text}DNS=localhost&IPAddress=127.0.0.1&IPAddress=' + $RequestedIp
    $parameters = @{
        Type = 'SSLServerAuthentication'
        Subject = 'CN=IdealZap-LAN'
        TextExtension = @($san)
        CertStoreLocation = 'Cert:\CurrentUser\My'
        KeyExportPolicy = 'Exportable'
        KeyAlgorithm = 'RSA'
        KeyLength = 3072
        HashAlgorithm = 'SHA256'
        NotAfter = (Get-Date).AddDays(365)
    }
    $certificate = New-SelfSignedCertificate @parameters
    if (-not $certificate -or -not $certificate.HasPrivateKey) { throw 'Windows nao criou chave exportavel.' }
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    $password = [Convert]::ToBase64String($bytes)
    $securePassword = ConvertTo-SecureString $password -AsPlainText -Force
    $created += $pfx
    [void](Export-PfxCertificate -Cert $certificate -FilePath $pfx -Password $securePassword -ErrorAction Stop)
    $created += $passFile
    [System.IO.File]::WriteAllText($passFile, $password, (New-Object System.Text.UTF8Encoding($false)))
    $created += $public
    [void](Export-Certificate -Cert $certificate -FilePath $public -Type CERT -ErrorAction Stop)
    if (-not (Confirm-CertificateMatches)) { throw 'Certificado gerado nao passou na verificacao do IP/SAN ou chave.' }
    Write-Host ''
    Write-Host 'CERTIFICADO HTTPS 8080 CRIADO E VALIDADO.' -ForegroundColor Green
    Write-Host ('Acesso HTTPS: https://' + $RequestedIp + ':8080/')
    Write-Host ('CERTIFICADO PUBLICO: ' + $public)
    Write-Host ('SHA256: ' + (Get-FileHash -LiteralPath $public -Algorithm SHA256).Hash)
    Write-Host 'Para o Chrome/Edge confiarem neste certificado, instale o .cer em cada PC (incluindo o servidor).'
    Write-Host 'NUNCA compartilhe arquivos .pfx, pfx.pass ou a pasta .local.'
} catch {
    $reason = $_.Exception.Message
    foreach ($file in $created) { if (Test-Path -LiteralPath $file) { Remove-Item -LiteralPath $file -Force -ErrorAction SilentlyContinue } }
    if ($backupFolder -and (Test-Path -LiteralPath $backupFolder)) {
        foreach ($file in $existing) {
            $from = Join-Path $backupFolder $file
            if (Test-Path -LiteralPath $from) { Move-Item -LiteralPath $from -Destination (Join-Path $folder $file) -Force -ErrorAction SilentlyContinue }
        }
    }
    throw ('Erro ao criar certificado: ' + $reason)
} finally {
    if ($certificate) {
        try { Remove-Item -LiteralPath ('Cert:\CurrentUser\My\' + $certificate.Thumbprint) -ErrorAction Stop } catch {}
    }
}
