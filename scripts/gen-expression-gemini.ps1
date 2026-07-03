# TestQuest: expression variation generator via Gemini image editing (paid API)
# Edits a base character image, changing ONLY the facial expression.
# Docs (source of truth): docs/画像生成プロンプト集_v0.1.md sec.3 / skills/image-asset-production.skill
# Usage:
#   .\scripts\gen-expression-gemini.ps1 -CharId rin -Expressions happy,angry,sad,thinking
#   .\scripts\gen-expression-gemini.ps1 -CharId rin -Expressions normal -BaseImage <path>  # remake normal from another expression
# Requires: user env var GEMINI_API_KEY (billing enabled). NEVER commit the key.
param(
  [Parameter(Mandatory)][string]$CharId,
  [string[]]$Expressions = @('happy','angry','sad','thinking'),
  [string]$BaseImage = '',   # default: assets-candidates\stepC-gemini\clean\{CharId}_normal.png
  [string]$Model = 'gemini-3.1-flash-image',
  [string]$OutDir = '',
  [switch]$Overwrite
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Repo = Split-Path $PSScriptRoot -Parent
if (-not $BaseImage) { $BaseImage = Join-Path $Repo "assets-candidates\stepC-gemini\clean\${CharId}_normal.png" }
if (-not $OutDir) { $OutDir = Join-Path $Repo "assets-candidates\stepC-gemini" }
if (-not (Test-Path $BaseImage)) { throw "base image not found: $BaseImage" }
$key = (Get-ItemProperty HKCU:\Environment).GEMINI_API_KEY
if (-not $key) { throw "GEMINI_API_KEY not found in user environment (HKCU:\Environment)" }
New-Item -ItemType Directory -Force $OutDir | Out-Null

# Common guard (eye symmetry / identity preservation) - see prompt collection sec.3
$guard = "Keep this exact same character and illustration: same face shape, same hairstyle, same hair color, same clothes, same colors, same art style, same pose, same framing, same background. Keep the same eye size and keep both eyes perfectly symmetrical with matching pupils and matching highlights in both eyes. Change ONLY the facial expression to: "

$exprText = @{
  normal   = "the character's default resting expression as defined in the design doc."
  happy    = "a bright happy smile, eyes slightly closed with joy, cheerful."
  angry    = "furrowed brows, a displeased frowning expression, tense mouth."
  sad      = "sad downcast eyes, slightly lowered eyebrows, a worried unhappy mouth."
  thinking = "a thoughtful expression, eyes looking up and away, pondering."
}
# Per-character acting corrections (REPLACE the expression text, do not append) - design doc sec.4
$acting = @{
  'rin.normal'    = "a calm warm reassuring gentle smile with the mouth closed, relaxed kind eyes looking straight at the viewer. Her default resting expression as a reliable mentor."
  'rin.angry'     = "a quiet stern look, furrowed brows, a displeased frowning expression, composed and not shouting."
  'tanaka.normal' = "a composed neutral serious expression, firm closed mouth, calm sharp eyes looking straight at the viewer. His default resting expression as a strict manager."
  'tanaka.happy'  = "a subtle restrained warm smile with the mouth CLOSED, only the corners of his mouth lift slightly, eyes soften a little, dignified and composed. Do NOT show teeth."
  'ken.normal'    = "a natural relaxed friendly expression with a light easygoing smile, bright open eyes looking straight at the viewer. His default resting expression as a cheerful rookie."
  'ken.angry'     = "a childish sulky pout, puffed cheeks, not truly menacing."
  # AL-TTA mentor pair (design doc v1.4 sec.4.4-4.5, prompt collection v1.4 sec.3)
  'takumi.normal'   = "a calm quiet neutral expression, firm closed mouth, narrow composed eyes looking straight at the viewer. His default resting expression as a taciturn craftsman engineer."
  'takumi.happy'    = "a very subtle quiet craftsman's smile with the mouth CLOSED, only the corners of his mouth lift very slightly, his eyes soften a little. He never smiles broadly. Do NOT show teeth."
  'takumi.angry'    = "quietly intense stern eyes, slightly narrowed, a silent pressuring look, mouth firmly closed, calm and not shouting."
  'takumi.sad'      = "eyebrows slightly lowered, eyes quietly looking down, a faint subdued troubled look, restrained."
  'takumi.thinking' = "a quiet thoughtful expression, narrowed eyes looking away to the side as if gazing at code on a distant screen, pondering silently."
  'mio.normal'      = "a cool calm neutral expression, composed narrow eyes behind her glasses looking straight at the viewer. Her default resting expression as a quiet precise specialist."
  'mio.happy'       = "a faint composed smile with the mouth closed, only her eyes soften subtly, cool and restrained."
  'mio.angry'       = "calmly narrowed eyes behind her glasses, a cool displeased look, composed, mouth in a firm line."
  'mio.sad'         = "eyes quietly lowered behind her glasses, eyebrows slightly drawn, a faint composed melancholy, restrained and not dramatic."
  'mio.thinking'    = "a focused analytical expression, eyes narrowed slightly looking away to the side as if examining data on a screen, calm and silent."
}

$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($BaseImage))
$uri = "https://generativelanguage.googleapis.com/v1beta/models/${Model}:generateContent?key=$key"

foreach ($e in $Expressions) {
  $outFile = Join-Path $OutDir "${CharId}_${e}.png"
  if ((Test-Path $outFile) -and -not $Overwrite) { Write-Host "SKIP: ${CharId}_${e} (exists; use -Overwrite)"; continue }
  $k = "${CharId}.${e}"
  $instr = if ($acting.ContainsKey($k)) { $guard + $acting[$k] } else { $guard + $exprText[$e] }
  $body = @{
    contents = @(@{ parts = @(
      @{ inline_data = @{ mime_type = 'image/png'; data = $b64 } },
      @{ text = $instr }
    ) })
    generationConfig = @{ responseModalities = @('IMAGE') }
  } | ConvertTo-Json -Depth 12
  $ok = $false
  foreach ($try in 1..3) {
    try {
      $r = Invoke-RestMethod -Uri $uri -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 180
      $img = $r.candidates[0].content.parts | Where-Object { $_.inlineData } | Select-Object -First 1
      if ($img) {
        [IO.File]::WriteAllBytes($outFile, [Convert]::FromBase64String($img.inlineData.data))
        Write-Host ("OK: {0}_{1} ({2:N0} KB)" -f $CharId, $e, ((Get-Item $outFile).Length/1KB))
        $ok = $true; break
      } else { Write-Host "NG: ${CharId}_${e} no image part (finishReason=$($r.candidates[0].finishReason))" }
    } catch { Write-Host "RETRY ${try}: ${CharId}_${e} $($_.Exception.Message)"; Start-Sleep -Seconds 15 }
  }
  if (-not $ok) { Write-Host "GAVE UP: ${CharId}_${e}" }
  Start-Sleep -Seconds 4
}
Write-Host "--- DONE ---"
