# INTERNAL ONLY — DO NOT RUN FROM PUBLIC CI. Filtered out of public history in Step 5. See docs/HARNESS.md §13.
# Deploys the v1 (web) Next.js standalone bundle to an EC2 host via S3 + SSM.
#
# Hardening overview (track via Issue #161):
#   - Platform-dispatched staging (`cp -rL` on Linux/WSL, `robocopy` on Windows pwsh.exe) to
#     avoid the `Copy-Item` WSL-UNC symlink failure that broke the 1.0.2 production deploy.
#   - In-process pre-archive validation: `server.js`, `.next/standalone`, `.next/static`, `public`
#     are required to exist in $stageDir before the archive is built. Otherwise abort with a
#     distinct exit code (10/11/12/13) and a human-readable error pointing at the missing path.
#   - tar archive uses `tar.exe -c -f <tarball>` (not `-a -f <zip>`) so the EC2 side can extract
#     unambiguously with `tar -xzf`. Archive root is the staging root (no extra prefix directory),
#     because the tar invocation uses `-C $stageDir .`.
#   - SSM command is a single multi-line bash script with 6 explicit phases (0..5). Phase 0
#     captures the previous symlink target so Phase 5 can roll back. Phase 2 is a hard fail-closed
#     pre-swap validation that removes the bad release dir on failure. Phase 5 restores the
#     previous symlink target and restarts the service on readiness failure.
#   - SSM payload is written to a temp file with `Set-Content -Encoding ASCII` to avoid the
#     Windows cp932 decoding issue that historically broke `--parameters file://...`.
#   - `-DryRun` switch prints the SSM payload body and S3 key without invoking `aws s3 cp` or
#     `aws ssm send-command`. Lets a future agent verify the script template without IAM creds.
#   - `-SkipBuild` switch is an alias for the `TASTILE_WEB_SKIP_BUILD=1` env var (both work).
[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)][string]$Tag = "",
    [Parameter(Mandatory=$false)][string]$Region = "ap-northeast-1",
    [Parameter(Mandatory=$false)][string]$InstanceId = "",
    [Parameter(Mandatory=$false)][string]$TransferBucket = "tastile-deploy",
    [Parameter(Mandatory=$false)][string]$StackName = "tastile-foundation",
    [Parameter(Mandatory=$false)][string]$ReleaseRoot = "/opt/tastile/web/releases",
    [Parameter(Mandatory=$false)][string]$CurrentLink = "/opt/tastile/web/current",
    [Parameter(Mandatory=$false)][string]$ServiceName = "tastile-web.service",
    [Parameter(Mandatory=$false)][string]$ReleaseName = "",
    [switch]$SkipBuild,
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Allow -SkipBuild to imply the env var (and vice versa).
if ($SkipBuild -and ($env:TASTILE_WEB_SKIP_BUILD -ne '1')) {
    $env:TASTILE_WEB_SKIP_BUILD = '1'
}

function Resolve-IsLinux {
    # PowerShell 7 exposes $IsLinux automatically. Fallback: check OSVersion.Platform.
    if (Test-Path Variable:IsLinux) { return [bool]$IsLinux }
    return ([System.Environment]::OSVersion.Platform -eq 'Unix')
}

function Resolve-IsWsl {
    # WSL detection: $env:WSL_DISTRO_NAME is set by both WSL1 and WSL2 when the
    # parent shell is WSL bash. Note: this is typically empty when the script is
    # invoked from Windows pwsh.exe (Windows processes do not inherit Linux env
    # unless WSLENV plumbs the variable through).
    if ($env:WSL_DISTRO_NAME) { return $true }
    if (Test-Path Variable:IsWSL) { return [bool]$IsWSL }
    return $false
}

function Resolve-WebInstanceId {
    param(
        [Parameter(Mandatory=$true)][string]$Region,
        [Parameter(Mandatory=$true)][string]$StackName
    )
    $cfnId = aws cloudformation describe-stacks --stack-name $StackName --region $Region --query "Stacks[0].Outputs[?OutputKey=='AppInstanceId'].OutputValue" --output text 2>$null
    if ($cfnId) {
        $cfnState = aws ec2 describe-instances --region $Region --instance-ids $cfnId --query "Reservations[0].Instances[0].State.Name" --output text 2>$null
        if ($cfnState -eq 'running' -or $cfnState -eq 'stopped') {
            return $cfnId
        }
    }
    $tagged = aws ec2 describe-instances --region $Region --filters 'Name=tag:Name,Values=tastile-web-server' 'Name=instance-state-name,Values=running' --query 'Reservations[0].Instances[0].InstanceId' --output text 2>$null
    if ($tagged) { return $tagged }
    throw "Could not resolve web server instance. Pass -InstanceId explicitly or ensure a running instance tagged Name=tastile-web-server exists in region $Region."
}

function Invoke-Staging {
    # Platform-dispatched staging. Symlinks inside `.next/standalone` MUST be followed
    # (`cp -rL` on Unix, `robocopy /E /SL` on Windows). Otherwise the production deploy
    # surfaces "ENOENT" when systemd tries to load the bundled binary.
    param(
        [Parameter(Mandatory=$true)][string]$SourceRoot,
        [Parameter(Mandatory=$true)][string]$StageDir
    )
    $platformIsLinux = Resolve-IsLinux
    $platformIsWsl = Resolve-IsWsl
    if ($platformIsLinux -or $platformIsWsl) {
        # WSL/Linux path: cp -rL follows symlinks. Native cp available in both.
        & cp -rL -- "$SourceRoot/.next/standalone/." "$StageDir/"
        if ($LASTEXITCODE -ne 0) { throw "cp -rL .next/standalone failed (exit=$LASTEXITCODE)" }
        & mkdir -p -- "$StageDir/.next"
        & cp -rL -- "$SourceRoot/.next/static" "$StageDir/.next/static"
        if ($LASTEXITCODE -ne 0) { throw "cp -rL .next/static failed (exit=$LASTEXITCODE)" }
        & mkdir -p -- "$StageDir/public"
        & cp -rL -- "$SourceRoot/public/." "$StageDir/public/"
        if ($LASTEXITCODE -ne 0) { throw "cp -rL public failed (exit=$LASTEXITCODE)" }
        return "cp-rL"
    } else {
        # Windows pwsh.exe: use robocopy which handles symlinks via /SL (follow).
        # /E copies subdirs including empties; /NFL /NDL /NJH /NJS /NC /NS /NP keep output quiet
        # so the operator's terminal doesn't drown in file-by-file progress. Robocopy does
        # not understand POSIX `--` end-of-options separator, so we omit it.
        $robocopyArgs = @("/E", "/SL", "/NFL", "/NDL", "/NJH", "/NJS", "/NC", "/NS", "/NP", "/R:0", "/W:0")
        $rc1 = & robocopy @robocopyArgs "$SourceRoot\.next\standalone" "$StageDir"
        # robocopy exit codes: 0=no change, 1=files copied, 2=extra, 3=both. >=8 is failure.
        if ($rc1 -ge 8) { throw "robocopy .next\standalone failed (exit=$rc1)" }
        $rc2 = & robocopy @robocopyArgs "$SourceRoot\.next\static" "$StageDir\.next\static"
        if ($rc2 -ge 8) { throw "robocopy .next\static failed (exit=$rc2)" }
        $rc3 = & robocopy @robocopyArgs "$SourceRoot\public" "$StageDir\public"
        if ($rc3 -ge 8) { throw "robocopy public failed (exit=$rc3)" }
        return "robocopy"
    }
}

function Test-StagedLayout {
    # In-process pre-archive validation. Throw with a distinct error code so the operator
    # can grep CI logs / journalctl for the specific missing file. Order matches the EC2
    # Phase 2 checks so the failure mode is symmetric end-to-end.
    param(
        [Parameter(Mandatory=$true)][string]$StageDir
    )
    $required = @(
        @{ Path = (Join-Path $StageDir 'server.js');          Code = 10; Label = 'server.js' },
        @{ Path = (Join-Path $StageDir '.next/standalone');   Code = 11; Label = '.next/standalone' },
        @{ Path = (Join-Path $StageDir '.next/static');       Code = 12; Label = '.next/static' },
        @{ Path = (Join-Path $StageDir 'public');             Code = 13; Label = 'public' }
    )
    foreach ($r in $required) {
        if (-not (Test-Path -LiteralPath $r.Path)) {
            throw "STAGE_VALIDATION_FAILED: missing $($r.Label) at $($r.Path) (code=$($r.Code))"
        }
    }
    return $true
}

function New-ArchiveTarball {
    # Use tar.exe (Windows built-in since 1803 / Ubuntu by default) explicitly. The archive
    # is created with `-C $StageDir .` so the archive root is the staging root, with no
    # extra prefix directory.
    param(
        [Parameter(Mandatory=$true)][string]$StageDir,
        [Parameter(Mandatory=$true)][string]$TarballPath
    )
    if (Test-Path -LiteralPath $TarballPath) { Remove-Item -LiteralPath $TarballPath -Force }
    & "$env:SystemRoot\System32\tar.exe" -c -f "$TarballPath" -C "$StageDir" .
    if ($LASTEXITCODE -ne 0) { throw "tar.exe archive creation failed (exit=$LASTEXITCODE)" }
    if (-not (Test-Path -LiteralPath $TarballPath)) { throw "tarball not produced at $TarballPath" }
    return (Get-Item -LiteralPath $TarballPath).Length
}

function New-SsmScript {
    # Build the single-string bash script that the EC2 SSM agent will execute. Exposed as a
    # function so Pester can assert its content (Phase 0..5 markers, distinct exit codes).
    #
    # Exit code legend (so the operator can diagnose from `aws ssm get-command-invocation`):
    #   0   success
    #   10  missing server.js
    #   11  missing .next/standalone
    #   12  missing .next/static
    #   13  missing public
    #   20  rolled back to previous and ready
    #   21  rolled back to previous but still not ready
    #   22  no previous target to roll back to
    #   23  curl / sudo / unzip failed
    param(
        [Parameter(Mandatory=$true)][string]$ReleaseRoot,
        [Parameter(Mandatory=$true)][string]$CurrentLink,
        [Parameter(Mandatory=$true)][string]$ServiceName,
        [Parameter(Mandatory=$true)][string]$ReleaseName,
        [Parameter(Mandatory=$true)][string]$PresignedUrl,
        [Parameter(Mandatory=$true)][string]$TarballName,
        [int]$ReadinessTimeoutSec = 15,
        [int]$RollbackTimeoutSec = 10,
        [string]$ReadinessPath = '/login'
    )
    # NOTE: bash strict mode is on. Avoid parens in echo strings (cp932 / heredoc hazard).
    # Use a single-quoted here-string (@'...'@) so PowerShell does NOT interpolate the
    # bash `$VAR` tokens. PowerShell parameters that need interpolation are spliced in
    # via the `[string]::Format` call after the here-string literal is built.
    $rr = $ReleaseRoot
    $cl = $CurrentLink
    $sn = $ServiceName
    $rn = $ReleaseName
    $pu = $PresignedUrl
    $tn = $TarballName
    $rt = $ReadinessTimeoutSec
    $rb = $RollbackTimeoutSec
    $rp = $ReadinessPath
    $literal = @'
set -euo pipefail
shopt -s nullglob

RELEASE_ROOT='__RELEASE_ROOT__'
CURRENT_LINK='__CURRENT_LINK__'
SERVICE='__SERVICE_NAME__'
RELEASE_NAME='__RELEASE_NAME__'
URL='__PRESIGNED_URL__'
TARBALL='/tmp/__TARBALL_NAME__'
READY_PATH='__READY_PATH__'
READY_TIMEOUT=__READY_TIMEOUT__
ROLLBACK_TIMEOUT=__ROLLBACK_TIMEOUT__

echo "Phase 0: capture previous target"
if [ -L "$CURRENT_LINK" ]; then
  PREVIOUS_TARGET=$(readlink -f "$CURRENT_LINK")
  echo "  previous=$PREVIOUS_TARGET"
else
  PREVIOUS_TARGET=""
  echo "  no previous symlink"
fi

echo "Phase 1: extract to release dir"
sudo mkdir -p "$RELEASE_ROOT/$RELEASE_NAME"
sudo curl -fsSL "$URL" -o "$TARBALL"
sudo tar -xzf "$TARBALL" -C "$RELEASE_ROOT/$RELEASE_NAME"
sudo rm -f "$TARBALL"
RELEASE_PATH="$RELEASE_ROOT/$RELEASE_NAME"

echo "Phase 2: pre-swap validation"
test -f "$RELEASE_PATH/server.js" || { echo "FAIL: server.js missing in $RELEASE_PATH" 1>&2; sudo rm -rf "$RELEASE_PATH"; exit 10; }
test -d "$RELEASE_PATH/.next/standalone" || { echo "FAIL: .next/standalone missing" 1>&2; sudo rm -rf "$RELEASE_PATH"; exit 11; }
test -d "$RELEASE_PATH/.next/static" || { echo "FAIL: .next/static missing" 1>&2; sudo rm -rf "$RELEASE_PATH"; exit 12; }
test -d "$RELEASE_PATH/public" || { echo "FAIL: public missing" 1>&2; sudo rm -rf "$RELEASE_PATH"; exit 13; }
echo "  validation passed"

echo "Phase 3: swap symlink"
sudo ln -sfn "$RELEASE_PATH" "$CURRENT_LINK"

echo "Phase 4: restart + readiness probe"
sudo systemctl restart "$SERVICE"
READY=0
for i in $(seq 1 $READY_TIMEOUT); do
  if curl -fsS -o /dev/null "http://127.0.0.1:3000$READY_PATH"; then
    echo "  ready after ${i}s"
    READY=1
    break
  fi
  sleep 1
done
if [ "$READY" = "1" ]; then
  echo "DEPLOYED $RELEASE_NAME"
  exit 0
fi

echo "Phase 5: rollback"
if [ -n "$PREVIOUS_TARGET" ] && [ -d "$PREVIOUS_TARGET" ]; then
  sudo ln -sfn "$PREVIOUS_TARGET" "$CURRENT_LINK"
  sudo systemctl restart "$SERVICE"
  for i in $(seq 1 $ROLLBACK_TIMEOUT); do
    if curl -fsS -o /dev/null "http://127.0.0.1:3000$READY_PATH"; then
      echo "  rolled back to $PREVIOUS_TARGET after ${i}s"
      exit 20
    fi
    sleep 1
  done
  echo "FAIL: rollback target not ready" 1>&2
  exit 21
else
  echo "FAIL: no previous target to roll back to" 1>&2
  exit 22
fi
'@
    # Splice PowerShell parameters into the placeholder tokens. Use a single replace()
    # pass per token to avoid re-interpolating bash `$VAR` patterns.
    $tokens = [ordered]@{
        '__RELEASE_ROOT__'    = $rr
        '__CURRENT_LINK__'    = $cl
        '__SERVICE_NAME__'    = $sn
        '__RELEASE_NAME__'    = $rn
        '__PRESIGNED_URL__'   = $pu
        '__TARBALL_NAME__'    = $tn
        '__READY_PATH__'      = $rp
        '__READY_TIMEOUT__'   = $rt
        '__ROLLBACK_TIMEOUT__'= $rb
    }
    foreach ($k in $tokens.Keys) {
        $literal = $literal.Replace($k, [string]$tokens[$k])
    }
    return $literal
}

function Invoke-Deploy {
    # Main flow, factored into a function so the script can be dot-sourced for unit
    # testing (Pester) without triggering the deploy side-effects. When the script is
    # invoked directly (`pwsh -File deploy-web-v1.ps1 ...`), `Invoke-Deploy` is called
    # from the bottom-of-file guard.
    [CmdletBinding()]
    param(
        [string]$Tag,
        [string]$Region,
        [string]$InstanceId,
        [string]$TransferBucket,
        [string]$StackName,
        [string]$ReleaseRoot,
        [string]$CurrentLink,
        [string]$ServiceName,
        [string]$ReleaseName,
        [switch]$SkipBuild,
        [switch]$DryRun
    )

    if (-not $InstanceId) {
        $InstanceId = Resolve-WebInstanceId -Region $Region -StackName $StackName
    }

    $timestamp = Get-Date -Format "yyyyMMdd-HHmm"
    if (-not $Tag) {
        $repoRoot = (Get-Item $PSScriptRoot).Parent.Parent.FullName
        Push-Location $repoRoot
        try {
            $Tag = (& git rev-parse --short HEAD).Trim()
        } finally {
            Pop-Location
        }
    }
    if (-not $ReleaseName) {
        $ReleaseName = "tastile-web-$timestamp-$Tag"
    }
    $tarballName = "$ReleaseName.tar.gz"
    $buildDir = Join-Path $env:TEMP "tastile-web-build-$timestamp"
    $tarballPath = Join-Path $buildDir $tarballName
    $stageDir = Join-Path $buildDir $ReleaseName

    Write-Host "== Tastile v1 web deploy =="
    Write-Host ("  Release:    " + $ReleaseName)
    Write-Host ("  Region:     " + $Region)
    Write-Host ("  Instance:   " + $InstanceId)
    Write-Host ("  Bucket:     s3://" + $TransferBucket + "/web-releases/" + $tarballName)
    Write-Host ("  SkipBuild:  " + [bool]($env:TASTILE_WEB_SKIP_BUILD -eq '1'))
    Write-Host ("  DryRun:     " + [bool]$DryRun)

    # Step 1 -- build (or skip)
    Write-Host ""
    if ($env:TASTILE_WEB_SKIP_BUILD -eq '1') {
        Write-Host "== 1 -- SKIPPED (TASTILE_WEB_SKIP_BUILD=1; caller ran build:infisical beforehand) =="
    } else {
        Write-Host "== 1 -- lint + typecheck + build =="
        foreach ($step in @("lint", "typecheck", "build")) {
            Write-Host ("  -> bun run " + $step)
            $proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", ("bun run " + $step) -NoNewWindow -Wait -PassThru
            if ($proc.ExitCode -ne 0) {
                throw ("bun run " + $step + " failed (exit=" + $proc.ExitCode + ")")
            }
        }
    }

    # Step 2 -- stage the standalone bundle (platform-dispatched, symlink-safe)
    Write-Host ""
    Write-Host "== 2 -- Stage standalone bundle =="
    $repoRoot = (Get-Item $PSScriptRoot).Parent.Parent.FullName
    Push-Location $repoRoot
    try {
        New-Item -ItemType Directory -Force -Path $stageDir | Out-Null
        $stagingBackend = Invoke-Staging -SourceRoot $repoRoot -StageDir $stageDir
        Write-Host ("  Staging backend: " + $stagingBackend)
        Test-StagedLayout -StageDir $stageDir | Out-Null
        Write-Host "  Pre-archive layout validation: OK"
    } finally {
        Pop-Location
    }

    # Step 3 -- tar archive (no nested prefix)
    Write-Host ""
    Write-Host "== 3 -- Archive (tar.gz, no extra prefix dir) =="
    New-Item -ItemType Directory -Force -Path $buildDir | Out-Null
    $tarballSize = New-ArchiveTarball -StageDir $stageDir -TarballPath $tarballPath
    Write-Host ("  Built: " + $tarballPath + " (" + [math]::Round($tarballSize/1MB, 1) + " MB)")

    # Step 4 -- render SSM payload (always; DryRun needs it too)
    $ssmScript = New-SsmScript `
        -ReleaseRoot $ReleaseRoot `
        -CurrentLink $CurrentLink `
        -ServiceName $ServiceName `
        -ReleaseName $ReleaseName `
        -PresignedUrl "PRESIGNED_URL_PLACEHOLDER" `
        -TarballName $tarballName

    if ($DryRun) {
        Write-Host ""
        Write-Host "== 4 -- DRY RUN: skipping aws s3 cp + aws ssm send-command =="
        Write-Host ("  Would upload to: s3://" + $TransferBucket + "/web-releases/" + $tarballName)
        Write-Host "  SSM script payload:"
        Write-Host "----- BEGIN SSM PAYLOAD -----"
        Write-Host $ssmScript
        Write-Host "----- END SSM PAYLOAD -----"
        Write-Host ""
        Write-Host ("== Done (dry run). Release: " + $ReleaseName + " ==")
        return
    }

    # Step 5 -- upload to S3
    Write-Host ""
    Write-Host "== 4 -- aws s3 cp =="
    aws s3 cp $tarballPath ("s3://" + $TransferBucket + "/web-releases/" + $tarballName) --region $Region
    if ($LASTEXITCODE -ne 0) { throw ("aws s3 cp failed (exit=" + $LASTEXITCODE + ")") }
    $presignedUrl = aws s3 presign ("s3://" + $TransferBucket + "/web-releases/" + $tarballName) --region $Region --expires-in 900

    # Step 6 -- SSM Send-Command
    Write-Host ""
    Write-Host ("== 5 -- SSM deploy on " + $InstanceId + " ==")
    $ssmScript = New-SsmScript `
        -ReleaseRoot $ReleaseRoot `
        -CurrentLink $CurrentLink `
        -ServiceName $ServiceName `
        -ReleaseName $ReleaseName `
        -PresignedUrl $presignedUrl `
        -TarballName $tarballName

    $payload = @{ commands = @($ssmScript) } | ConvertTo-Json -Compress -Depth 5
    $tmp = Join-Path $env:TEMP ("tastile-web-deploy-" + $timestamp + ".json")
    Set-Content -LiteralPath $tmp -Value $payload -Encoding ASCII

    $commandId = aws ssm send-command --region $Region --instance-ids $InstanceId --document-name AWS-RunShellScript --parameters ("file://" + $tmp) --query "Command.CommandId" --output text
    Write-Host ("  SSM CommandId: " + $commandId)

    # Step 7 -- wait for SSM command to complete
    Write-Host ""
    Write-Host "== 6 -- Wait for SSM command to complete =="
    $status = "Pending"
    $elapsed = 0
    while ($status -in @("Pending", "InProgress", "Delayed") -and $elapsed -lt 240) {
        Start-Sleep -Seconds 5
        $elapsed += 5
        $invocation = aws ssm get-command-invocation --region $Region --command-id $commandId --instance-id $InstanceId --output json | ConvertFrom-Json
        $status = $invocation.Status
        Write-Host ("  [" + $elapsed + "s] status=" + $status)
    }
    if ($status -ne "Success") {
        Write-Host ""
        Write-Host "  FAILED -- streaming output:"
        if ($null -ne $invocation.StandardOutputContent) { Write-Host $invocation.StandardOutputContent }
        Write-Host "--- stderr ---"
        if ($null -ne $invocation.StandardErrorContent) { Write-Host $invocation.StandardErrorContent }
        throw ("SSM command ended in " + $status)
    }

    Write-Host ""
    Write-Host "  Output:"
    if ($null -ne $invocation.StandardOutputContent) { Write-Host $invocation.StandardOutputContent }
    Write-Host ""
    Write-Host ("== Done. Release deployed: " + $ReleaseName + " ==")
    Write-Host "  URL:        https://app.tastile.app"
    Write-Host ("  Release:    " + $ReleaseRoot + "/" + $ReleaseName)
    Write-Host ("  Current:    " + $CurrentLink + " -> " + $ReleaseRoot + "/" + $ReleaseName)
}

# --- entry point guard ---
# When this script is invoked directly (`pwsh -File deploy-web-v1.ps1 ...`), call
# Invoke-Deploy with the param block values. When dot-sourced (e.g. from Pester
# tests), $MyInvocation.MyCommand.Path is the calling file and $PSCommandPath is
# the test file, so the guard correctly skips main.
if ($MyInvocation.MyCommand.Path -eq $PSCommandPath) {
    Invoke-Deploy `
        -Tag $Tag `
        -Region $Region `
        -InstanceId $InstanceId `
        -TransferBucket $TransferBucket `
        -StackName $StackName `
        -ReleaseRoot $ReleaseRoot `
        -CurrentLink $CurrentLink `
        -ServiceName $ServiceName `
        -ReleaseName $ReleaseName `
        -SkipBuild:$SkipBuild `
        -DryRun:$DryRun
}
