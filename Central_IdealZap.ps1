# IDEAL-ZAP: painel local unico para Windows 10 (PowerShell 5.1).
# Coloque na MESMA pasta do INICIAR.bat antigo; nao o substitua.
# Nao apaga .env, tokens, userDataDir nem inicia outra sessao do WhatsApp.
# Os filhos sao criados sem janelas CMD e encerrados por suas IDs de processo.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$script:Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$script:NodeDir = Join-Path $script:Root 'runtime\node-v22.22.2-win-x64'
$script:NodeExe = Join-Path $script:NodeDir 'node.exe'
$script:LogFile = Join-Path $script:Root 'LOG_DIAGNOSTICO.txt'
$script:Running = @{}
$script:SetupProcess = $null
$script:Phase = 'parado'
$script:Since = Get-Date
$script:Quit = $false
$script:Opened = $false
$script:CheckEvent = $null
$script:SingleMutex = $null
$script:MutexOwned = $false

# Nao abrir varios gerenciadores: segundo clique restaura o painel existente.
$created = $false
$script:SingleMutex = [System.Threading.Mutex]::new($true, 'Local\IdealZapTrayControlV2', [ref]$created)
if (-not $created) {
    try {
        $ev = [System.Threading.EventWaitHandle]::OpenExisting('Local\IdealZapTrayControlShowV2')
        [void]$ev.Set()
        $ev.Dispose()
    } catch { }
    $script:SingleMutex.Dispose()
    exit 0
}
$script:MutexOwned = $true
$script:CheckEvent = [System.Threading.EventWaitHandle]::new(
    $false, [System.Threading.EventResetMode]::AutoReset, 'Local\IdealZapTrayControlShowV2')

$script:Form = New-Object System.Windows.Forms.Form
$script:Form.Text = 'Ideal-Zap - Central de Controle'
$script:Form.Size = New-Object System.Drawing.Size(570, 345)
$script:Form.MinimumSize = New-Object System.Drawing.Size(570, 345)
$script:Form.StartPosition = 'CenterScreen'
$script:Form.Font = New-Object System.Drawing.Font('Segoe UI', 10)
$script:Form.BackColor = [System.Drawing.Color]::FromArgb(246,248,249)

$script:AppIcon = $null
$iconFile = Join-Path $script:Root 'IdealZap_Tray.ico'
if (Test-Path -LiteralPath $iconFile) {
    try { $script:AppIcon = New-Object System.Drawing.Icon($iconFile) } catch { }
}
if (-not $script:AppIcon) { $script:AppIcon = [System.Drawing.SystemIcons]::Application }
$script:Form.Icon = $script:AppIcon

$headline = New-Object System.Windows.Forms.Label
$headline.Text = 'IDEAL-ZAP  |  CONTROLE'
$headline.Font = New-Object System.Drawing.Font('Segoe UI', 16, [System.Drawing.FontStyle]::Bold)
$headline.AutoSize = $true
$headline.Location = New-Object System.Drawing.Point(18,15)
$script:Form.Controls.Add($headline)

$script:Status = New-Object System.Windows.Forms.Label
$script:Status.Text = 'Parado.'
$script:Status.Location = New-Object System.Drawing.Point(20,61)
$script:Status.Size = New-Object System.Drawing.Size(525,26)
$script:Form.Controls.Add($script:Status)

function Make-Button([string]$title, [int]$x, [int]$width) {
    $b = New-Object System.Windows.Forms.Button
    $b.Text = $title
    $b.Location = New-Object System.Drawing.Point($x,100)
    $b.Size = New-Object System.Drawing.Size($width,38)
    $script:Form.Controls.Add($b)
    return $b
}
$script:BtnStart = Make-Button 'Iniciar' 18 121
$script:BtnRestart = Make-Button 'Reiniciar' 149 121
$script:BtnStop = Make-Button 'Encerrar' 280 121
$script:BtnOpen = Make-Button 'Abrir Zap' 411 139

$script:Details = New-Object System.Windows.Forms.TextBox
$script:Details.Multiline = $true
$script:Details.ReadOnly = $true
$script:Details.ScrollBars = 'Vertical'
$script:Details.Location = New-Object System.Drawing.Point(18,151)
$script:Details.Size = New-Object System.Drawing.Size(531,97)
$script:Details.Anchor = 'Top,Left,Right,Bottom'
$script:Details.BackColor = [System.Drawing.Color]::White
$script:Form.Controls.Add($script:Details)

$link = New-Object System.Windows.Forms.LinkLabel
$link.Location = New-Object System.Drawing.Point(18,254)
$link.Size = New-Object System.Drawing.Size(530,24)
$link.Anchor = 'Bottom,Left,Right'
$link.Text = 'Segundo computador: ver endereco IP da rede local (ipconfig).'
$script:Form.Controls.Add($link)

$tip = New-Object System.Windows.Forms.Label
$tip.Location = New-Object System.Drawing.Point(18,281)
$tip.Size = New-Object System.Drawing.Size(532,23)
$tip.Anchor = 'Bottom,Left,Right'
$tip.Text = 'Minimize ou feche (X) para ocultar ao lado do relogio.'
$script:Form.Controls.Add($tip)

$script:Menu = New-Object System.Windows.Forms.ContextMenuStrip
$menuShow = $script:Menu.Items.Add('Mostrar janela')
$menuOpen = $script:Menu.Items.Add('Abrir Ideal-Zap')
$menuStart = $script:Menu.Items.Add('Iniciar servicos')
$menuRestart = $script:Menu.Items.Add('Reiniciar servicos')
$menuStop = $script:Menu.Items.Add('Encerrar servicos')
[void]$script:Menu.Items.Add('-')
$menuExit = $script:Menu.Items.Add('Sair do programa')
$script:Tray = New-Object System.Windows.Forms.NotifyIcon
$script:Tray.Icon = $script:AppIcon
$script:Tray.Text = 'Ideal-Zap'
$script:Tray.ContextMenuStrip = $script:Menu
$script:Tray.Visible = $true

function Write-Panel([string]$message) {
    $line = (Get-Date -Format 'HH:mm:ss') + '  ' + $message
    if ($script:Details.TextLength -gt 8000) {
        $script:Details.Text = $script:Details.Text.Substring($script:Details.TextLength - 4000)
    }
    $script:Details.AppendText($line + [Environment]::NewLine)
}

function Set-Phase([string]$phase, [string]$description) {
    $script:Phase = $phase
    $script:Since = Get-Date
    $script:Status.Text = $description
    $idle = ($phase -eq 'parado' -or $phase -eq 'falha')
    $ready = ($phase -eq 'pronto')
    $script:BtnStart.Visible = $idle
    $script:BtnRestart.Visible = $ready
    $script:BtnStop.Visible = $ready  # Encerrar aparece apenas quando iniciado.
    $script:BtnOpen.Enabled = $ready
    $menuStart.Visible = $idle
    $menuRestart.Visible = $ready
    $menuStop.Visible = $ready
    $menuOpen.Enabled = $ready
    if ($ready) { $script:Tray.Text = 'Ideal-Zap - em execucao' }
    else { $script:Tray.Text = 'Ideal-Zap - ' + $phase }
}

function Port-Used([int]$port) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $async = $client.BeginConnect('127.0.0.1', $port, $null, $null)
        if (-not $async.AsyncWaitHandle.WaitOne(400, $false)) { return $false }
        $client.EndConnect($async)
        return $true
    } catch { return $false }
    finally { $client.Close() }
}

function Url-Ready([string]$url) {
    try {
        $request = [System.Net.HttpWebRequest]::Create($url)
        $request.Timeout = 1200
        $request.ReadWriteTimeout = 1200
        $request.Proxy = $null
        if ($url.StartsWith('https://')) {
            # Checagem restrita a ESTE certificado, sem desativar validacao TLS global.
            # A confianca do navegador e instalada separadamente pelo usuario.
            $public = Join-Path $script:Root '.local\https\IdealZap_CERTIFICADO_PUBLICO.cer'
            $trustedCert = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($public)
            $expectedThumb = $trustedCert.Thumbprint
            $request.ServerCertificateValidationCallback = {
                param($sender, $serverCert, $chain, $errors)
                return ($null -ne $serverCert -and $serverCert.GetCertHashString() -eq $expectedThumb)
            }.GetNewClosure()
        }
        $response = $request.GetResponse()
        try { return ([int]$response.StatusCode -eq 200) }
        finally { $response.Close() }
    } catch { return $false }
}

function New-HiddenProcess([string]$executable, [string]$arguments, [string]$cwd) {
    $info = New-Object System.Diagnostics.ProcessStartInfo
    $info.FileName = $executable
    $info.Arguments = $arguments
    $info.WorkingDirectory = $cwd
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
    $process = [System.Diagnostics.Process]::Start($info)
    if (-not $process) { throw 'Falha ao criar processo.' }
    return $process
}

function Run-HiddenSetup([string]$filename) {
    $arguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File ' + ('"' + $filename + '"')
    return New-HiddenProcess 'powershell.exe' $arguments $script:Root
}

function Run-HiddenNode([string]$filename, [string]$extra) {
    $arguments = ('"' + $filename + '"')
    if ($extra) { $arguments += ' ' + $extra }
    return New-HiddenProcess $script:NodeExe $arguments $script:Root
}

function Kill-ProcessTree($p) {
    if (-not $p) { return }
    try {
        if ($p.HasExited) { return }
        $pidNumber = [int]$p.Id
        $kill = New-HiddenProcess (Join-Path $env:WINDIR 'System32\taskkill.exe') ('/PID ' + $pidNumber + ' /T /F') $script:Root
        [void]$kill.WaitForExit(6500)
        $kill.Dispose()
    } catch { }
}

function Stop-Children {
    Kill-ProcessTree $script:SetupProcess
    $script:SetupProcess = $null
    foreach ($key in @('https','ui','api','wpp')) {
        $p = $script:Running[$key]
        if ($p) { Kill-ProcessTree $p }
    }
    $script:Running.Clear()
}

function Fail-Startup([string]$why) {
    Write-Panel ('ERRO: ' + $why)
    Stop-Children
    Set-Phase 'falha' ('Falha: ' + $why)
    [void][System.Windows.Forms.MessageBox]::Show(
        $why + [Environment]::NewLine + 'Nenhum token, QR ou sessao foi apagado.',
        'Ideal-Zap - Falha ao iniciar',
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Warning)
}

function Start-Services {
    if ($script:Phase -ne 'parado' -and $script:Phase -ne 'falha') { return }
    $need = @(
        $script:NodeExe,
        (Join-Path $script:NodeDir 'corepack.cmd'),
        (Join-Path $script:Root 'wppconnect-server\node_modules'),
        (Join-Path $script:Root 'node_modules'),
        (Join-Path $script:Root 'node_modules\vite\bin\vite.js'),
        (Join-Path $script:Root 'backend\server.mjs'),
        (Join-Path $script:Root 'scripts\evitar-inicio-duplicado.ps1'),
        (Join-Path $script:Root 'scripts\configurar-sessao.ps1'),
        (Join-Path $script:Root 'scripts\executar-wppconnect.mjs')
    )
    foreach ($file in $need) {
        if (-not (Test-Path -LiteralPath $file)) {
            Fail-Startup 'Faltam arquivos do projeto. Execute PREPARAR_AMBIENTE.bat antes.'
            return
        }
    }
    foreach ($port in @(8788,3001,8080,8081)) {
        if (Port-Used $port) {
            Fail-Startup ('Porta ' + $port + ' ocupada. Feche as janelas antigas CMD e tente outra vez.')
            return
        }
    }
    if (-not (Read-LanUrl)) {
        Fail-Startup 'Este servidor precisa ter o IP 192.168.100.88. Verifique ipconfig e o certificado HTTPS.'
        return
    }
    # O site inteiro usa HTTPS na porta 8080 (sem fallback HTTP na mesma porta).
    $tlsFolder = Join-Path $script:Root '.local\https'
    $hasPfx = (Test-Path -LiteralPath (Join-Path $tlsFolder 'idealzap-lan.pfx')) -and
        (Test-Path -LiteralPath (Join-Path $tlsFolder 'pfx.pass')) -and
        (Test-Path -LiteralPath (Join-Path $tlsFolder 'IdealZap_CERTIFICADO_PUBLICO.cer'))
    $hasPem = (Test-Path -LiteralPath (Join-Path $tlsFolder 'key.pem')) -and
        (Test-Path -LiteralPath (Join-Path $tlsFolder 'cert.pem')) -and
        (Test-Path -LiteralPath (Join-Path $tlsFolder 'IdealZap_CERTIFICADO_PUBLICO.cer'))
    if (-not ($hasPfx -or $hasPem)) {
        Fail-Startup 'HTTPS: falta certificado valido. Execute CRIAR_CERTIFICADO_8080.bat em Atualizacoes.'
        return
    }
    if (-not (Test-Path -LiteralPath (Join-Path $script:Root 'scripts\https-lan-gateway.mjs'))) {
        Fail-Startup 'HTTPS: falta scripts\https-lan-gateway.mjs. Reaplique a atualizacao.'
        return
    }
    # Recriar apenas o arquivo de diagnostico, como no iniciador original.
    $header = '=== IDEAL ZAP - DIAGNOSTICO AUTOMATICO ===' + [Environment]::NewLine +
        'Versao do diagnostico: 1' + [Environment]::NewLine +
        'Horario local da inicializacao: ' + (Get-Date -Format 'dd/MM/yyyy HH:mm:ss') + [Environment]::NewLine +
        'Dados de pareamento, mensagens e credenciais nao sao registrados.' + [Environment]::NewLine
    [System.IO.File]::WriteAllText($script:LogFile, $header, (New-Object System.Text.UTF8Encoding($false)))
    $env:Path = $script:NodeDir + ';' + $env:Path
    $env:COREPACK_HOME = Join-Path $script:Root '_cache\corepack'
    $env:npm_config_cache = Join-Path $script:Root '_cache\npm'
    $env:YARN_CACHE_FOLDER = Join-Path $script:Root '_cache\yarn'
    $script:Running.Clear()
    try {
        Write-Panel 'Preparando WPPConnect sem abrir novas janelas CMD...'
        $script:SetupProcess = Run-HiddenSetup (Join-Path $script:Root 'scripts\evitar-inicio-duplicado.ps1')
        Set-Phase 'preparando' 'Preparando servidor do WhatsApp...'
    } catch { Fail-Startup 'Nao foi possivel iniciar a preparacao.' }
}

function Stop-Services {
    Write-Panel 'Encerrando servicos desta central (preservando pareamento)...'
    Stop-Children
    Set-Phase 'parado' 'Servicos encerrados. WhatsApp continua vinculado.'
}

function Restart-Services {
    if ($script:Phase -ne 'pronto') { return }
    Stop-Services
    Start-Services
}

function Open-WhatsApp {
    if ($script:Phase -eq 'pronto') {
        Start-Process 'https://127.0.0.1:8080/' | Out-Null
    }
}

function Restore-Window {
    $script:Form.Show()
    $script:Form.WindowState = [System.Windows.Forms.FormWindowState]::Normal
    [void]$script:Form.Activate()
}

function Read-LanUrl {
    try {
        $serverIp = Get-NetIPAddress -IPAddress '192.168.100.88' -AddressFamily IPv4 -ErrorAction SilentlyContinue
        if ($serverIp) { return 'https://192.168.100.88:8080/' }
    } catch { }
    return ''
}

$script:LanUrl = Read-LanUrl
if ($script:LanUrl) {
    $link.Text = 'Outro computador: ' + $script:LanUrl + '  (clique para copiar)'
}
$link.Add_LinkClicked({
    if ($script:LanUrl) {
        [System.Windows.Forms.Clipboard]::SetText($script:LanUrl)
        Write-Panel 'Link local copiado. Compartilhe somente na rede privada.'
    }
})

function Tick-Status {
    if ($script:CheckEvent.WaitOne(0)) { Restore-Window }
    $elapsed = ((Get-Date) - $script:Since).TotalSeconds
    try {
        if ($script:Phase -eq 'preparando') {
            if ($script:SetupProcess.HasExited) {
                if ($script:SetupProcess.ExitCode -ne 0) { Fail-Startup 'Preparacao WPPConnect falhou.'; return }
                $script:SetupProcess = $null
                Write-Panel 'WPPConnect preparado. Iniciando servidor oculto...'
                $script:Running['wpp'] = Run-HiddenNode (Join-Path $script:Root 'scripts\executar-wppconnect.mjs') ''
                Set-Phase 'wpp' 'Aguardando WPPConnect na porta 8788...'
            } elseif ($elapsed -gt 110) { Fail-Startup 'Tempo esgotado preparando WPPConnect.' }
        } elseif ($script:Phase -eq 'wpp') {
            if (Url-Ready 'http://127.0.0.1:8788/healthz') {
                Write-Panel 'WPPConnect pronto; configurando sessao ja existente...'
                $script:SetupProcess = Run-HiddenSetup (Join-Path $script:Root 'scripts\configurar-sessao.ps1')
                Set-Phase 'sessao' 'Preparando autenticacao local...'
            } elseif ($script:Running['wpp'].HasExited -or $elapsed -gt 180) {
                Fail-Startup 'WPPConnect saiu ou nao respondeu.'
            }
        } elseif ($script:Phase -eq 'sessao') {
            if ($script:SetupProcess.HasExited) {
                if ($script:SetupProcess.ExitCode -ne 0) { Fail-Startup 'Falha configurando a sessao.'; return }
                $script:SetupProcess = $null
                Write-Panel 'Sessao configurada. Iniciando API em segundo plano...'
                $script:Running['api'] = Run-HiddenNode (Join-Path $script:Root 'backend\server.mjs') ''
                Set-Phase 'api' 'Aguardando API na porta 3001...'
            } elseif ($elapsed -gt 80) { Fail-Startup 'Configuracao de sessao demorou demais.' }
        } elseif ($script:Phase -eq 'api') {
            if (Url-Ready 'http://127.0.0.1:3001/health') {
                Write-Panel 'API pronta. Iniciando interface em segundo plano...'
                $script:Running['ui'] = Run-HiddenNode (Join-Path $script:Root 'node_modules\vite\bin\vite.js') 'dev --host 127.0.0.1 --port 8081 --strictPort'
                Set-Phase 'interface' 'Aguardando interface interna (127.0.0.1:8081)...'
            } elseif ($script:Running['api'].HasExited -or $elapsed -gt 60) {
                Fail-Startup 'API nao iniciou ou parou.'
            }
        } elseif ($script:Phase -eq 'interface') {
            if (Url-Ready 'http://127.0.0.1:8081/') {
                Write-Panel 'Interface interna pronta. Iniciando HTTPS na porta 8080...'
                $script:Running['https'] = Run-HiddenNode (Join-Path $script:Root 'scripts\https-lan-gateway.mjs') ''
                Set-Phase 'https' 'Aguardando acesso HTTPS (porta 8080)...'
            } elseif ($script:Running['ui'].HasExited -or $elapsed -gt 125) {
                Fail-Startup 'Interface interna nao iniciou; consulte o diagnostico.'
            }
        } elseif ($script:Phase -eq 'https') {
            if (Url-Ready 'https://127.0.0.1:8080/') {
                Set-Phase 'pronto' 'ATIVO - HTTPS seguro na porta 8080.'
                Write-Panel 'Ideal-Zap pronto em HTTPS:8080. HTTP antigo foi substituido.'
                if (-not $script:Opened) {
                    $script:Opened = $true
                    Open-WhatsApp
                }
            } elseif ($script:Running['https'].HasExited -or $elapsed -gt 45) {
                Fail-Startup 'HTTPS nao iniciou na porta 8080. Verifique certificado e porta livre.'
            }
        } elseif ($script:Phase -eq 'pronto') {
            foreach ($key in @('wpp','api','ui','https')) {
                $proc = $script:Running[$key]
                if ($proc -and $proc.HasExited) {
                    Fail-Startup ('Servico ' + $key + ' encerrou inesperadamente.')
                    break
                }
            }
        }
    } catch {
        Fail-Startup 'Erro no painel. Consulte LOG_DIAGNOSTICO.txt.'
    }
}

$script:BtnStart.Add_Click({ Start-Services })
$script:BtnRestart.Add_Click({ Restart-Services })
$script:BtnStop.Add_Click({ Stop-Services })
$script:BtnOpen.Add_Click({ Open-WhatsApp })
$menuShow.Add_Click({ Restore-Window })
$menuOpen.Add_Click({ Open-WhatsApp })
$menuStart.Add_Click({ Start-Services })
$menuRestart.Add_Click({ Restart-Services })
$menuStop.Add_Click({ Stop-Services })
$menuExit.Add_Click({
    $script:Quit = $true
    Stop-Children
    $script:Form.Close()
})
$script:Tray.Add_DoubleClick({ Restore-Window })
$script:Form.Add_Resize({
    if ($script:Form.WindowState -eq [System.Windows.Forms.FormWindowState]::Minimized) {
        $script:Form.Hide()
    }
})
$script:Form.Add_FormClosing({
    if (-not $script:Quit) {
        $_.Cancel = $true
        $script:Form.Hide()
    }
})
$script:Timer = New-Object System.Windows.Forms.Timer
$script:Timer.Interval = 1300
$script:Timer.Add_Tick({ Tick-Status })
$script:Timer.Start()
Set-Phase 'parado' 'Parado. Clique Iniciar para conectar os servicos.'
Write-Panel 'Iniciador novo: nenhuma janela CMD extra sera aberta.'
# Inicie automaticamente quando o painel abrir pela primeira vez.
$script:Form.Add_Shown({ Start-Services })
try {
    [void][System.Windows.Forms.Application]::Run($script:Form)
} finally {
    $script:Timer.Stop()
    Stop-Children
    $script:Tray.Visible = $false
    $script:Tray.Dispose()
    $script:Menu.Dispose()
    if ($script:CheckEvent) { $script:CheckEvent.Dispose() }
    if ($script:SingleMutex) {
        if ($script:MutexOwned) { try { $script:SingleMutex.ReleaseMutex() } catch { } }
        $script:SingleMutex.Dispose()
    }
}
