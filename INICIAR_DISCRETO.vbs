Option Explicit
' Abra este arquivo com dois cliques na pasta raiz do Ideal-Zap.
' O PowerShell fica oculto; apenas a janela grafica e o icone na bandeja aparecem.
Dim shell, fso, folder, cmd
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
folder = fso.GetParentFolderName(WScript.ScriptFullName)
If Not fso.FileExists(fso.BuildPath(folder, "Central_IdealZap.ps1")) Then
    MsgBox "Central_IdealZap.ps1 nao foi encontrado nesta pasta.", vbExclamation, "Ideal-Zap"
    WScript.Quit 1
End If
cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File """ & fso.BuildPath(folder, "Central_IdealZap.ps1") & """"
shell.Run cmd, 0, False
