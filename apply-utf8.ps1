#$ErrorAtionPreference="Stop"
$$src = "C:\Users\rebui\Desktop\tastile\tastile-web\src\lib\api\v1\build-command.ts"
$lines = [System.IO.File]::ReadAllLines($src)
$changed = 0
for ($i =0; $i -lt $lines.Length; $i++) {
  if ($lines[$i] -match "envelopes\.push\(\{\s*path: V1_PATH\.createTile," -and $lines[$i+1].Trim() -eq "idempotencyKey,") { $lines[$i+1] = "     idempotencyKey: stepKey(0),"; $changed++ }
  if ($lines[$i] -match "path:\s*\"/v1/tiles/\{tileId\}/plan\"" -and $lines[$i+1].Trim() -eq "idempotencyKey,") { $lines[$i+1] = "       idempotencyKey: stepKey(1),"; $changed++ }
  if ($lines[$i] -match "path:\s*\"/v1/placements\" -and $lines[$i+1].Trim() -eq "idempotencyKey,") { $lines[$i+1] = "        idempotencyKey: stepKey(2),"; $changed++ }
}
[System.IO.File]::WriteAllLines($src,ƐưƤƸƔÌ¤ĨŜǈƤǐƴĠƼǌÐƈČĠĄĸĜĔƐƌƠƄƸƜƔ