# check-skill-drift.ps1
#
# Detects unintended divergence between TestQuest's skills (the master copy)
# and a reference project's skills.
#
# Policy (PO decision 2026-08-21, homework A-3):
#   TestQuest (git-managed, outside OneDrive) is the MASTER for shared skills.
#   Rationale: OneDrive corrupted 7 skill files on 2026-07-11; the crossword
#   project has not been updated since 2026-06-11.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\check-skill-drift.ps1
#   ... -Reference "<path to other project's skills dir>"
#   ... -Quiet     (only report problems)
#
# Exit codes: 0 = no unintended drift, 1 = drift found, 2 = reference missing
#
# NOTE: ASCII only. PS 5.1 interprets BOM-less UTF-8 .ps1 as ANSI, so Japanese
# characters here would break parsing (see image-asset-production pitfalls.md).

param(
  [string]$Reference = '',
  [switch]$Quiet
)

Add-Type -AssemblyName System.IO.Compression.FileSystem

# Resolve the reference dir by wildcard so this file stays ASCII-only
# (the OneDrive folder name contains Japanese characters).
if (-not $Reference) {
  $pattern = Join-Path $env:USERPROFILE 'OneDrive*\AI_WG\crossword\jstqb-crossword-starter\skills'
  $found = @(Resolve-Path $pattern -ErrorAction SilentlyContinue)
  if ($found.Count -gt 0) { $Reference = $found[0].Path }
  else { $Reference = $pattern }
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillsDir = Join-Path (Split-Path -Parent $ScriptDir) 'skills'

# Skills that are DELIBERATELY different. Key = file name, Value = reason.
# NOTE: PowerShell variable names are case-INSENSITIVE, so these config
# variables must not collide with the lowercase tally variables below.
$IntentionalMap = @{
  'configuration-management.skill' = 'TestQuest adaptation v1.6 (PO approved 2026-07-16)'
}

# Skills where TestQuest must be a strict SUPERSET of the reference
# (same shared entries + TestQuest-only additions). Verified entry by entry.
$SupersetList = @('growth-tracker.skill')

function Get-ZipEntries($path) {
  $map = @{}
  $zip = [IO.Compression.ZipFile]::OpenRead($path)
  try { foreach ($e in $zip.Entries) { $map[$e.FullName] = $e.Length } }
  finally { $zip.Dispose() }
  return $map
}

if (-not (Test-Path $SkillsDir)) {
  Write-Host "ERROR: skills dir not found: $SkillsDir"
  exit 2
}
if (-not (Test-Path $Reference)) {
  Write-Host "ERROR: reference dir not found:"
  Write-Host "       $Reference"
  Write-Host "Pass -Reference <path> or skip the check on this machine."
  exit 2
}

$identical = @()
$intentional = @()
$superset = @()
$tqOnly = @()
$refOnly = @()
$drift = @()

foreach ($f in Get-ChildItem (Join-Path $SkillsDir '*.skill') | Sort-Object Name) {
  $refPath = Join-Path $Reference $f.Name
  if (-not (Test-Path $refPath)) { $tqOnly += $f.Name; continue }

  $same = (Get-FileHash $f.FullName -Algorithm SHA256).Hash -eq
          (Get-FileHash $refPath   -Algorithm SHA256).Hash
  if ($same) { $identical += $f.Name; continue }

  if ($IntentionalMap.ContainsKey($f.Name)) {
    $intentional += ("{0} -- {1}" -f $f.Name, $IntentionalMap[$f.Name])
    continue
  }

  if ($SupersetList -contains $f.Name) {
    # Every reference entry must exist in TestQuest with the SAME size.
    $tqE = Get-ZipEntries $f.FullName
    $rfE = Get-ZipEntries $refPath
    $missing = @()
    $changed = @()
    foreach ($k in $rfE.Keys) {
      if (-not $tqE.ContainsKey($k)) { $missing += $k }
      elseif ($tqE[$k] -ne $rfE[$k]) { $changed += $k }
    }
    $added = @($tqE.Keys | Where-Object { -not $rfE.ContainsKey($_) })
    if ($missing.Count -eq 0 -and $changed.Count -eq 0) {
      $superset += ("{0} -- superset OK (+{1} TestQuest entries)" -f $f.Name, $added.Count)
    } else {
      $drift += ("{0} -- SUPERSET BROKEN: {1} missing, {2} size-changed" -f `
                 $f.Name, $missing.Count, $changed.Count)
      foreach ($m in $missing) { $drift += ("      missing: " + $m) }
      foreach ($c in $changed) { $drift += ("      changed: " + $c) }
    }
    continue
  }

  $drift += ("{0} -- unexpected difference (TQ {1} bytes / REF {2} bytes)" -f `
             $f.Name, $f.Length, (Get-Item $refPath).Length)
}

foreach ($f in Get-ChildItem (Join-Path $Reference '*.skill') | Sort-Object Name) {
  if (-not (Test-Path (Join-Path $SkillsDir $f.Name))) { $refOnly += $f.Name }
}

if (-not $Quiet) {
  Write-Host "Master   : $SkillsDir"
  Write-Host "Reference: $Reference"
  Write-Host ""
  Write-Host ("IDENTICAL       ({0})" -f $identical.Count)
  foreach ($x in $identical) { Write-Host ("  = " + $x) }
  Write-Host ("INTENTIONAL     ({0})" -f $intentional.Count)
  foreach ($x in $intentional) { Write-Host ("  * " + $x) }
  Write-Host ("SUPERSET OK     ({0})" -f $superset.Count)
  foreach ($x in $superset) { Write-Host ("  + " + $x) }
  Write-Host ("TESTQUEST-ONLY  ({0})" -f $tqOnly.Count)
  foreach ($x in $tqOnly) { Write-Host ("  T " + $x) }
  Write-Host ("REFERENCE-ONLY  ({0})" -f $refOnly.Count)
  foreach ($x in $refOnly) { Write-Host ("  R " + $x) }
  Write-Host ""
}

if ($drift.Count -gt 0) {
  Write-Host ("DRIFT DETECTED  ({0})" -f $drift.Count)
  foreach ($x in $drift) { Write-Host ("  ! " + $x) }
  Write-Host ""
  Write-Host "Action: decide whether the change belongs in TestQuest (master),"
  Write-Host "        or register it in `$Intentional with a reason."
  exit 1
}

Write-Host "OK: no unintended drift."
exit 0
