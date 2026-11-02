# Generates the PNG application icons from the same geometry as `public/icons/icon.svg`.
#
# One-off tooling, not used at runtime: the generated PNGs are committed, so neither
# the application nor its tests need PowerShell or System.Drawing. Re-run only when
# the icon design changes, then commit the regenerated files.
#
#   pwsh -File scripts/generate-pwa-icons.ps1
#
# Sizes mirror the manifest and the Apple/favicon links:
#   192/512 "any" (rounded), 512 maskable (full bleed, glyph in the 80 % safe zone),
#   180 Apple touch icon (full bleed), 32 favicon.

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root 'public/icons'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function New-Icon {
  param(
    [int]$Size,
    [string]$FileName,
    [bool]$Rounded,
    [double]$GlyphRatio,
    [double]$BaselineNudge
  )

  $bitmap = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $background = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#2563eb'))

  if ($Rounded) {
    $radius = [Math]::Round($Size * 0.22)
    $diameter = $radius * 2
    $shape = New-Object System.Drawing.Drawing2D.GraphicsPath
    $shape.AddArc(0, 0, $diameter, $diameter, 180, 90)
    $shape.AddArc($Size - $diameter, 0, $diameter, $diameter, 270, 90)
    $shape.AddArc($Size - $diameter, $Size - $diameter, $diameter, $diameter, 0, 90)
    $shape.AddArc(0, $Size - $diameter, $diameter, $diameter, 90, 90)
    $shape.CloseFigure()
    $graphics.FillPath($background, $shape)
    $shape.Dispose()
  } else {
    $graphics.FillRectangle($background, 0, 0, $Size, $Size)
  }

  $fontSize = [Math]::Max(8, [Math]::Round($Size * $GlyphRatio))
  $font = New-Object System.Drawing.Font('Segoe UI', $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center

  # DrawString centres the em box; the glyph then looks slightly high, so nudge
  # it down by a fraction of the square before saving.
  $nudge = [float]($Size * $BaselineNudge)
  $rect = New-Object System.Drawing.RectangleF(0, $nudge, $Size, $Size)
  $graphics.DrawString('d', $font, $white, $rect, $format)

  $path = Join-Path $outDir $FileName
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)

  $format.Dispose()
  $white.Dispose()
  $font.Dispose()
  $background.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()

  Write-Host "écrit $FileName ($Size×$Size)"
}

# Rounded "any" icons.
New-Icon -Size 192 -FileName 'icon-192.png' -Rounded $true -GlyphRatio 0.60 -BaselineNudge 0.01
New-Icon -Size 512 -FileName 'icon-512.png' -Rounded $true -GlyphRatio 0.60 -BaselineNudge 0.01

# Maskable: full-bleed background and a glyph well inside the central 80 % safe
# zone, so any platform mask keeps the letter intact.
New-Icon -Size 512 -FileName 'icon-maskable-512.png' -Rounded $false -GlyphRatio 0.44 -BaselineNudge 0.01

# iOS ignores the manifest icon and rounds the full-bleed square itself.
New-Icon -Size 180 -FileName 'apple-touch-icon-180.png' -Rounded $false -GlyphRatio 0.58 -BaselineNudge 0.01

# Browser tab.
New-Icon -Size 32 -FileName 'favicon-32.png' -Rounded $true -GlyphRatio 0.60 -BaselineNudge 0.01
