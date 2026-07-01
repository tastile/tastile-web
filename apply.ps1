# build-command.ts idempotencyKey stepKey applier
$ErrorActionPreference = "Stop"
$src = "C:\Users\rebui\Desktop\tastile\tastile-web\src\lib\api\v1\build-command.ts"
$lines = [System.IO.File]::ReadAllLines($src)
$changed = 0
for ($i=0; $i -lt $lines.Length; $i++) {
  if ($lines[$i].IndexOf("envelopes.push") -ge 0 -and $lines[$i].IndexOf("path: V1_PATH.createTile,") -ge 0 -and $lines[$i+1] -and $lines[$i+1].Trim() -eq "idempotencyKey,") { $lines[$i+1] = "      idempotencyKey: stepKey(0),"; $changed++ }
  if ($lines[$i].IndexOf("path:") -ge 0 -and $lines[$i].IndexOf("tileId") -ge 0 -and $lines[$i].IndexOf("plan") -ge 0 -and $lines[$i+1] -and $lines[$i+1].Trim() -eq "idempotencyKey,") { $lines[$i+1] = "        idempotencyKey: stepKey(1),"; $changed++ }
  if ($lines[$i].IndexOf("path:") -ge 0 -and $lines[$i].IndexOf("placements") -ge 0 -and $lines[$i+1] -and $lines[$i+1].Trim() -eq "idempotencyKey,") { $lines[$i+1] = "        idempotencyKey: stepKey(2),"; $changed++ }
}
[System.IO.File]::WriteAllLines($src, $lines)
Write-Host "CHANGED" $changed
