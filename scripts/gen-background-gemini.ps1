# TestQuest: background generator via Gemini text-to-image (paid API)
# Backgrounds have no identity constraint (unlike character sprites), so plain text
# generation is used - the edit-only rule in .claude/rules/project/image-assets.md
# applies to character variations, not to backgrounds.
# Docs (source of truth): docs/画像生成プロンプト集_v0.1.md sec.4 / docs/画像デザイン設定書_v0.1.md sec.5
# Usage:
#   .\scripts\gen-background-gemini.ps1 -Ids ending-sunset                 # 1 image (staged run)
#   .\scripts\gen-background-gemini.ps1 -Ids ending-sunset,ending-rooftop -Variants 2
# Requires: user env var GEMINI_API_KEY (billing enabled). NEVER commit the key.
param(
  [Parameter(Mandatory)][string[]]$Ids,
  [int]$Variants = 1,
  [string]$Model = 'gemini-3.1-flash-image',
  [string]$OutDir = '',
  [switch]$Overwrite
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Repo = Split-Path $PSScriptRoot -Parent
if (-not $OutDir) { $OutDir = Join-Path $Repo 'assets-candidates\endings' }
$key = (Get-ItemProperty HKCU:\Environment).GEMINI_API_KEY
if (-not $key) { throw 'GEMINI_API_KEY not found in user environment (HKCU:\Environment)' }
New-Item -ItemType Directory -Force $OutDir | Out-Null

# Shared tail: safe area, art style, exclusions, resolution (same as office/server)
$tail = @"
Keep the main focal elements within the center third of the image,
because the left and right edges will be cropped on mobile screens.
Clean Japanese anime style background art, muted colors,
slightly soft focus, low contrast so foreground characters stand out.
No readable text, no logos, no watermark, no brand names.
Do not depict any real, famous or identifiable landmark, tower or building;
any cityscape must be a generic anonymous skyline.
A full-bleed 16:9 composition that fills the entire frame edge to edge.
No borders, no letterboxing, no pillarboxing, no blurred duplicated side panels.
High resolution, 1920x1080 or larger.
"@

$scene = @{
  'ending-sunset' = @"
Background illustration for a visual novel, no people.
A modern Japanese IT company open office at sunset, after working hours.
Warm orange evening light coming through the large windows,
long soft shadows across the desks, monitors switched off, quiet and calm.
Warm amber and soft violet palette with a gentle glow.
"@
  'ending-skyline' = @"
Background illustration for a visual novel, no people.
A modern Japanese IT company open office early in the morning, seen from near the large windows.
A clear blue morning sky and a distant city skyline outside the window,
fresh cool sunlight, clean and tidy empty desks, a feeling of a new beginning.
Bright white and light blue palette.
"@
  'ending-meeting-night' = @"
Background illustration for a visual novel, no people.
A quiet meeting room in a Japanese IT company at night.
A long table with empty chairs, a large wall display showing abstract unreadable
chart-like shapes (never actual numbers or letters), warm desk lamp light,
and city lights outside the window at night.
Deep navy palette with warm lamp accents.
"@
  'ending-server-night' = @"
Background illustration for a visual novel, no people.
A modern server room late at night with the lights dimmed.
Rows of server racks with many small glowing LED indicators fading away into the darkness,
the faint glow of a single monitor in the foreground, cables, silence.
Cool dark blue and teal palette, dim lighting.
"@
  'ending-rooftop' = @"
Background illustration for a visual novel, no people.
The rooftop of an office building in a Japanese city at dusk.
A safety fence in the foreground, the city spreading out below with lights beginning to turn on,
a wide open sky with a gradient from warm orange near the horizon to deep blue above.
Orange to deep blue gradient palette.
"@
}

$uri = "https://generativelanguage.googleapis.com/v1beta/models/${Model}:generateContent?key=$key"
foreach ($id in $Ids) {
  if (-not $scene.ContainsKey($id)) { Write-Host "SKIP: $id (unknown id; see prompt doc sec.4)"; continue }
  foreach ($v in 1..$Variants) {
    $outFile = Join-Path $OutDir "${id}_v${v}.png"
    if ((Test-Path $outFile) -and -not $Overwrite) { Write-Host "SKIP: ${id}_v${v} (exists; use -Overwrite)"; continue }
    $body = @{
      contents = @(@{ parts = @(@{ text = ($scene[$id] + "`n" + $tail) }) })
      generationConfig = @{ responseModalities = @('IMAGE') }
    } | ConvertTo-Json -Depth 12
    $ok = $false
    foreach ($try in 1..3) {
      try {
        $r = Invoke-RestMethod -Uri $uri -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 180
        $img = $r.candidates[0].content.parts | Where-Object { $_.inlineData } | Select-Object -First 1
        if ($img) {
          [IO.File]::WriteAllBytes($outFile, [Convert]::FromBase64String($img.inlineData.data))
          Write-Host ("OK: {0}_v{1} ({2:N0} KB)" -f $id, $v, ((Get-Item $outFile).Length/1KB))
          $ok = $true; break
        } else { Write-Host "NG: ${id}_v${v} no image part (finishReason=$($r.candidates[0].finishReason))" }
      } catch { Write-Host "RETRY ${try}: ${id}_v${v} $($_.Exception.Message)"; Start-Sleep -Seconds 15 }
    }
    if (-not $ok) { Write-Host "GAVE UP: ${id}_v${v}" }
    Start-Sleep -Seconds 4
  }
}
Write-Host '--- DONE ---'
