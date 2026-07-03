# TestQuest: design exploration via Pollinations.ai (free, no key)
# For STEP A candidate generation ONLY. Adopted assets must be recreated
# via Gemini editing (see gen-expression-gemini.ps1) to unify provenance.
# Docs: skills/image-asset-production.skill references/service-selection.md
# Usage:
#   .\scripts\gen-explore-pollinations.ps1 -Prompt "<full english prompt>" -OutFile <path> [-Seed 42]
param(
  [Parameter(Mandatory)][string]$Prompt,
  [Parameter(Mandatory)][string]$OutFile,
  [int]$Seed = 42,
  [int]$Width = 768,
  [int]$Height = 1024,
  [string]$Model = 'flux'
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$uri = "https://image.pollinations.ai/prompt/" + [uri]::EscapeDataString($Prompt) +
  "?width=$Width&height=$Height&nologo=true&model=$Model&seed=$Seed"
foreach ($try in 1..3) {
  try {
    Invoke-WebRequest -UseBasicParsing -Uri $uri -OutFile $OutFile -TimeoutSec 180
    Write-Host ("OK: {0} seed={1} ({2:N0} KB)" -f $OutFile, $Seed, ((Get-Item $OutFile).Length/1KB))
    return
  } catch {
    Write-Host "RETRY ${try}: $($_.Exception.Message)"
    Start-Sleep -Seconds 20
  }
}
throw "gave up after 3 tries"
