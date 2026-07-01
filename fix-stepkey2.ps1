$ErrorActionPreference = "Stop"
$src = "C:\Users\rebui\Desktop\tastile\tastile-web\src\lib\api\v1\build-command.ts"
$lines = [System.IO.File]::ReadAllLines($src)
for ($i=0; $i -lt $lines.Length; $i++) {
  if ($lines[$i].IndexOf('const stepKey = (i: number)') -ge 0) {
    $lines[$i] = '  const stepKey = (i: number) => ' + [char]96 + '$' + '{idempotencyKey}:' + '$' + '{i}' + [char]96 + ';'
    Write-Host "FIXED line $i: " + $lines[$i]
  }
}
[System.IO.File]::WriteAllLines($src, $lines)
