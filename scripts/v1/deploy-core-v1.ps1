# INTERNAL ONLY — DO NOT RUN FROM PUBLIC CI. Filtered out of public history in Step 5. See docs/HARNESS.md §13.
# Deploys the v1 (api) Rust binary to an EC2 host using S3 + SSM.
# v7 binaries (tastile-daemon, tastile-cli) are intentionally NOT deployed.
param(
    [Parameter(Mandatory=$false)][string]$Region = "ap-northeast-1",
    [Parameter(Mandatory=$false)][string]$InstanceId = "",
    [Parameter(Mandatory=$false)][string]$TransferBucket = "tastile-deploy",
    [Parameter(Mandatory=$false)][string]$StackName = "tastile-foundation",
    [Parameter(Mandatory=$false)][string]$ReleaseRoot = "/opt/tastile/api/releases",
    [Parameter(Mandatory=$false)][string]$CurrentLink = "/opt/tastile/api/current",
    [Parameter(Mandatory=$false)][string]$Version = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $InstanceId) {
    $InstanceId = aws cloudformation describe-stacks --stack-name $StackName --region $Region --query "Stacks[0].Outputs[?OutputKey=='AppInstanceId'].OutputValue" --output text
}
if (-not $InstanceId) {
    throw "Could not resolve AppInstanceId from stack $StackName. Pass -InstanceId explicitly."
}

$repoRoot = (Get-Item $PSScriptRoot).Parent.Parent.FullName
Push-Location $repoRoot
try {
    $shortSha = (& git rev-parse --short HEAD).Trim()
    if (-not $Version) { $Version = $shortSha }
    $binaryName = "tastile-api-$Version"
    $buildDir = Join-Path $env:TEMP "tastile-core-v1-build-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    $binaryPath = Join-Path $buildDir "api"
    $binaryArchive = Join-Path $buildDir $binaryName

    Write-Host "== Tastile v1 core (api) deploy =="
    Write-Host "  Repo:        $repoRoot"
    Write-Host "  Version:     $Version"
    Write-Host "  Region:      $Region"
    Write-Host "  Instance:    $InstanceId"
    Write-Host "  Bucket path: s3://$TransferBucket/$binaryName"

    New-Item -ItemType Directory -Force -Path $buildDir | Out-Null

    Write-Host ""
    Write-Host "== 1) docker build =="
    $imageTag = "tastile-api-build:$Version"
    $build = Start-Process -FilePath "docker" -ArgumentList "build", "-f", "Dockerfile.v1", "-t", $imageTag, "." -NoNewWindow -Wait -PassThru
    if ($build.ExitCode -ne 0) { throw "docker build failed (exit=$($build.ExitCode))" }

    Write-Host ""
    Write-Host "== 2) Extract api from the build container =="
    $rand = [guid]::NewGuid().ToString().Substring(0,8); $containerName = "tastile-extract-" + $Version + "-" + $rand
    $create = Start-Process -FilePath "docker" -ArgumentList "create", "--name", $containerName, $imageTag -NoNewWindow -Wait -PassThru
    if ($create.ExitCode -ne 0) { throw "docker create failed (exit=$($create.ExitCode))" }
    try {
        $cp = Start-Process -FilePath "docker" -ArgumentList "cp", "${containerName}:/app/target/release/api", $binaryPath -NoNewWindow -Wait -PassThru
        if ($cp.ExitCode -ne 0) { throw "docker cp failed (exit=$($cp.ExitCode))" }
    } finally {
        Start-Process -FilePath "docker" -ArgumentList "rm", $containerName -NoNewWindow -Wait | Out-Null
    }
    if (-not (Test-Path $binaryPath)) { throw "Binary not found at $binaryPath" }
    $strip = Start-Process -FilePath "docker" -ArgumentList "run", "--rm", "-v", "${buildDir}:/out", "alpine:3.20", "strip", "/out/api" -NoNewWindow -Wait -PassThru
    $binarySize = (Get-Item $binaryPath).Length
    Write-Host "  Binary: $binaryPath ($([math]::Round($binarySize/1MB, 1)) MB)"

    Write-Host ""
    Write-Host "== 3) aws s3 cp =="
    Move-Item -Force $binaryPath $binaryArchive
    aws s3 cp $binaryArchive "s3://$TransferBucket/$binaryName" --region $Region
    if ($LASTEXITCODE -ne 0) { throw "aws s3 cp failed" }
    $presignedUrl = aws s3 presign "s3://$TransferBucket/$binaryName" --region $Region --expires-in 3600

    Write-Host ""
    Write-Host "== 4) SSM: stage, swap, restart =="
    $webBridgeSecret = $env:TASTILE_WEB_BRIDGE_SECRET
    if (-not $webBridgeSecret) { $webBridgeSecret = "" }
    $commands = @(
        "set -euo pipefail"
        "VERSION='$Version'"
        "RELEASES='$ReleaseRoot'"
        "CURRENT_LINK='$CurrentLink'"
        'sudo mkdir -p "$RELEASES/$VERSION"'
        "sudo install -d -m 0755 -o tastile -g tastile /etc/tastile"
        "sudo touch /etc/tastile/tastile.env"
        "sudo sed -i.bak '/^TASTILE_WEB_BRIDGE_SECRET=/d' /etc/tastile/tastile.env"
        'printf ''%s\n'' ''TASTILE_WEB_BRIDGE_SECRET=$webBridgeSecret'' | sudo tee -a /etc/tastile/tastile.env >/dev/null'
        "curl -fsSL '$presignedUrl' -o /tmp/api"
        'sudo install -m 0755 -o tastile -g tastile /tmp/api "$RELEASES/$VERSION/api"'
        'sudo ln -sfn "$RELEASES/$VERSION" "$CURRENT_LINK"'
        "sudo systemctl restart tastile-api.service"
        "sudo systemctl is-active tastile-api.service"
        "curl -fsS http://127.0.0.1:31400/v1/health"
    )
    $commandId = aws ssm send-command `
        --instance-ids $InstanceId `
        --document-name "AWS-RunShellScript" `
        --parameters "commands=$(($commands | ConvertTo-Json -Compress))" `
        --region $Region `
        --output text --query "Command.CommandId"
    Write-Host "SSM command: $commandId"
    aws ssm wait command-executed --command-id $commandId --instance-id $InstanceId --region $Region
    aws ssm get-command-invocation --command-id $commandId --instance-id $InstanceId --region $Region --query "{Status:Status,Output:StandardOutputContent,Error:StandardErrorContent}" --output json
} finally {
    Pop-Location
}


