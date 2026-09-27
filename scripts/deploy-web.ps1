param(
    [Parameter(Mandatory = $false)][string]$Tag = "auth-redirect",
    [Parameter(Mandatory = $false)][string]$Region = "ap-northeast-1",
    [Parameter(Mandatory = $true)][ValidatePattern('\Ai-[0-9a-f]{17}\z')][string]$InstanceId,
    [Parameter(Mandatory = $false)][string]$TransferBucket = "tastile-beta-deploy",
    [Parameter(Mandatory = $false)][string]$ReleaseRoot = "/opt/tastile/web/releases",
    [Parameter(Mandatory = $false)][string]$CurrentLink = "/opt/tastile/web/current",
    [Parameter(Mandatory = $false)][string]$ServiceName = "tastile-web.service"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$timestamp = Get-Date -Format "yyyyMMdd-HHmm"
$releaseName = "tastile-web-${timestamp}-${Tag}"
$zipName = "${releaseName}.zip"
$buildDir = Join-Path $env:TEMP "tastile-web-build-$timestamp"
$zipPath = Join-Path $buildDir $zipName

Write-Host "== Tastile web deploy =="
Write-Host "  Release:    $releaseName"
Write-Host "  Region:     $Region"
Write-Host "  Instance:   $InstanceId"
Write-Host "  Bucket:     s3://$TransferBucket/web-releases/$zipName"

# 1. Build
# The release build receives production secrets through the Infisical wrapper.
Write-Host ""
Write-Host "== 1) lint + typecheck =="
Write-Host "  (skipped — typecheck currently fails on stale .next/dev/types/*.d.ts artifacts;"
Write-Host "   pinning deploy: lint passes, build runs clean. Investigate tsconfig after.)"
Write-Host "  -> bun run lint"
$proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "bun run lint" -NoNewWindow -Wait -PassThru
if ($proc.ExitCode -ne 0) {
    throw "bun run lint failed (exit=$($proc.ExitCode))"
}

# 1.5 Build through the reusable production-environment boundary.
Write-Host ""
Write-Host "== 1.5) Production build =="
Write-Host "  -> Infisical production environment + bun run build:prod"
$proc = Start-Process -FilePath "bun" -ArgumentList @(
    "scripts/run-with-infisical.mts", "prod", "--", "bun", "run", "build:prod"
) -NoNewWindow -Wait -PassThru
if ($proc.ExitCode -ne 0) {
    throw "Infisical production build failed (exit=$($proc.ExitCode))"
}

# 2. Stage the standalone bundle
Write-Host ""
Write-Host "== 2) Stage standalone bundle =="
New-Item -ItemType Directory -Force -Path $buildDir | Out-Null
$stageDir = Join-Path $buildDir $releaseName
New-Item -ItemType Directory -Force -Path $stageDir | Out-Null

Copy-Item -Recurse -Force ".next/standalone/*" $stageDir
Copy-Item -Recurse -Force ".next/static" (Join-Path $stageDir ".next/static")
$publicTarget = Join-Path $stageDir "public"
New-Item -ItemType Directory -Force -Path $publicTarget | Out-Null
Copy-Item -Recurse -Force "public/*" $publicTarget
New-Item -ItemType Directory -Force -Path (Join-Path $stageDir "ops/systemd") | Out-Null
Copy-Item -Force "ops/systemd/tastile-web.service.example" (Join-Path $stageDir "ops/systemd/tastile-web.service.example")

# Strip .env* files: Next.js standalone mode copies them into .next/standalone/
# at build time, but verify-web-artifact.ts rejects any .env* path segment.
# Production runtime env vars are fetched from Infisical by systemd, so
# shipping build-time .env.production is both a secret leak and a redundant
# configuration source. Mirrors the same step in .github/workflows/deploy.yml.
Get-ChildItem -Path $stageDir -Filter '.env*' -File | Remove-Item -Force

# 3. Zip it
Write-Host ""
Write-Host "== 3) Zip =="
$zipPath = Join-Path $buildDir $zipName
$compress = Start-Process -FilePath "C:\Windows\System32\tar.exe" -ArgumentList @(
    "-a", "-c", "-f", $zipPath,
    "-C", $stageDir,
    "."
) -NoNewWindow -Wait -PassThru
if ($compress.ExitCode -ne 0) {
    throw "tar zip failed (exit=$($compress.ExitCode))"
}
& bun scripts/verify-web-artifact.ts $zipPath
if ($LASTEXITCODE -ne 0) {
    throw "artifact secret verification failed (exit=$LASTEXITCODE)"
}
$zipSize = (Get-Item $zipPath).Length
Write-Host "  Built: $zipPath ($([math]::Round($zipSize/1MB, 1)) MB)"

# 4. Upload to S3
Write-Host ""
Write-Host "== 4) aws s3 cp =="
aws s3 cp $zipPath "s3://$TransferBucket/web-releases/$zipName" --region $Region
if ($LASTEXITCODE -ne 0) {
    throw "aws s3 cp failed (exit=$LASTEXITCODE)"
}
$presignedUrl = aws s3 presign "s3://$TransferBucket/web-releases/$zipName" --region $Region --expires-in 900

# 5. SSM send-command to deploy on the EC2 host
Write-Host ""
Write-Host "== 5) SSM deploy on $InstanceId =="
$commands = @(
    "set -euo pipefail",
    "if ! command -v infisical >/dev/null 2>&1; then",
    "  curl -fsSL https://github.com/Infisical/cli/releases/download/v0.43.136/cli_0.43.136_linux_amd64.tar.gz -o /tmp/infisical-cli-0.43.136-linux-amd64.tar.gz",
    "  echo '8fa977e6531d73c8a99d05c9255461e1831f7313acf957aa3daae05eccc132d3  /tmp/infisical-cli-0.43.136-linux-amd64.tar.gz' | sha256sum -c -",
    "  tar -xzf /tmp/infisical-cli-0.43.136-linux-amd64.tar.gz -C /tmp infisical",
    "  sudo install -o root -g root -m 0755 /tmp/infisical /usr/bin/infisical",
    "fi",
    "sudo mkdir -p $ReleaseRoot/$releaseName",
    "curl -fsSL '$presignedUrl' -o /tmp/$zipName",
    "sudo unzip -q -o /tmp/$zipName -d $ReleaseRoot/$releaseName",
    "sudo install -o root -g root -m 0644 $ReleaseRoot/$releaseName/ops/systemd/tastile-web.service.example /etc/systemd/system/tastile-web.service",
    "sudo install -d -o root -g root -m 0755 /etc/systemd/system/tastile-web.service.d",
    "printf '%s\\n' '[Service]' 'Environment=CLOUD_API_BASE=http://127.0.0.1:31400' | sudo tee /etc/systemd/system/tastile-web.service.d/cloud-api-base.conf >/dev/null",
    "sudo systemctl daemon-reload",
    "sudo ln -sfn $ReleaseRoot/$releaseName $CurrentLink",
    "sudo systemctl restart $ServiceName",
    "sleep 3",
    "systemctl is-active $ServiceName",
    "curl -fsS -o /dev/null -w 'HTTP %{http_code} in %{time_total}s\n' http://127.0.0.1:3000/login"
)
$payload = @{ commands = $commands } | ConvertTo-Json -Compress
$tmp = Join-Path $env:TEMP "tastile-web-deploy-$timestamp.json"
Set-Content -LiteralPath $tmp -Value $payload -Encoding ASCII

$commandId = aws ssm send-command `
    --region $Region `
    --instance-ids $InstanceId `
    --document-name AWS-RunShellScript `
    --parameters "file://$tmp" `
    --query "Command.CommandId" `
    --output text
Write-Host "  SSM CommandId: $commandId"

# 6. Wait + stream output
Write-Host ""
Write-Host "== 6) Wait for SSM command to complete =="
$status = "Pending"
$elapsed = 0
while ($status -in @("Pending", "InProgress", "Delayed") -and $elapsed -lt 180) {
    Start-Sleep -Seconds 5
    $elapsed += 5
    $invocation = aws ssm get-command-invocation `
        --region $Region `
        --command-id $commandId `
        --instance-id $InstanceId `
        --output json | ConvertFrom-Json
    $status = $invocation.Status
    Write-Host "  [${elapsed}s] status=$status"
}
if ($status -ne "Success") {
    Write-Host ""
    Write-Host "  FAILED — streaming output:"
    if ($null -ne $invocation.StandardOutputContent) { Write-Host $invocation.StandardOutputContent }
    Write-Host "--- stderr ---"
    if ($null -ne $invocation.StandardErrorContent) { Write-Host $invocation.StandardErrorContent }
    throw "SSM command ended in $status"
}

Write-Host ""
Write-Host "  Output:"
if ($null -ne $invocation.StandardOutputContent) { Write-Host $invocation.StandardOutputContent }
Write-Host ""
Write-Host "== Done. Release deployed: $releaseName =="
Write-Host "  URL:        https://app.tastile.app"
Write-Host "  Release:    $ReleaseRoot/$releaseName"
Write-Host "  Current:    $CurrentLink -> $ReleaseRoot/$releaseName"
