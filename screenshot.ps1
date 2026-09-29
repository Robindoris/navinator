param(
  [string]$ProcessName = "electron",
  [string]$OutFile = "$env:TEMP\navinator-shot.png"
)

Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr dc, uint flags);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
}
"@

$proc = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue |
        Where-Object { $_.MainWindowHandle -ne 0 } |
        Select-Object -First 1

if (-not $proc) { Write-Output "NO_WINDOW"; exit 1 }

$h = $proc.MainWindowHandle
[void][Win]::ShowWindow($h, 9)   # SW_RESTORE
[void][Win]::SetForegroundWindow($h)
Start-Sleep -Milliseconds 900

$rect = New-Object Win+RECT
[void][Win]::GetWindowRect($h, [ref]$rect)
$w = $rect.Right - $rect.Left
$ht = $rect.Bottom - $rect.Top
if ($w -le 0 -or $ht -le 0) { Write-Output "BAD_RECT"; exit 1 }

$bmp = New-Object System.Drawing.Bitmap $w, $ht
$g = [System.Drawing.Graphics]::FromImage($bmp)
# 2 = PW_RENDERFULLCONTENT, needed for composited/GPU surfaces
$ok = [Win]::PrintWindow($h, $g.GetHdc(), 2)
$g.ReleaseHdc()
$g.Dispose()

$bmp.Save($OutFile, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output "SAVED $OutFile  ${w}x${ht}  printWindow=$ok"
