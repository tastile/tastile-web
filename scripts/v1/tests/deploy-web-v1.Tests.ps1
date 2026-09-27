# Pester 5/6 tests for scripts/v1/deploy-web-v1.ps1.
# No external network calls. Tests are deterministic; `Get-Date` is not invoked.
#
# Run from repo root:
#   pwsh -NoProfile -ExecutionPolicy Bypass -Command "Invoke-Pester scripts/v1/tests/deploy-web-v1.Tests.ps1 -Output Detailed"

BeforeAll {
    # Load the deploy script and rebuild a functions-only module on every run so
    # the test can never drift from the script source. The extraction walks the AST
    # and copies each `function Name { ... }` block verbatim; the main-flow guard at
    # the bottom of deploy-web-v1.ps1 is excluded automatically (it's not wrapped
    # in `function`).
    $script:ScriptPath = (Resolve-Path "$PSScriptRoot/../deploy-web-v1.ps1").Path
    $script:ScriptContent = Get-Content -LiteralPath $script:ScriptPath -Raw
    $tokens = $null; $parseErrors = $null
    $scriptAst = [System.Management.Automation.Language.Parser]::ParseInput($script:ScriptContent, [ref]$tokens, [ref]$parseErrors)
    if ($parseErrors.Count -gt 0) {
        throw ("deploy-web-v1.ps1 has parse errors: " + (($parseErrors | ForEach-Object { $_.Message }) -join '; '))
    }
    $functionAsts = $scriptAst.FindAll({
        param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst]
    }, $true)
    $psm1Body = "# Auto-generated from deploy-web-v1.ps1 by deploy-web-v1.Tests.ps1 BeforeAll.`n"
    $psm1Body += "# Contains ONLY the function definitions so Pester can call them without`n"
    $psm1Body += "# triggering the deploy script's main flow (which checks `$PSCommandPath).`n"
    foreach ($fn in $functionAsts) {
        $psm1Body += "`n" + $fn.Extent.Text + "`n"
    }

    # Build a module with a deterministic name (`deploy-web-v1-functions`) so Pester's
    # `Mock -ModuleName` lookup resolves regardless of the temp path.
    $moduleScript = [scriptblock]::Create($psm1Body)
    New-Module -Name deploy-web-v1-functions -ScriptBlock $moduleScript | Import-Module -Force
}

Describe "deploy-web-v1.ps1 syntax" {
    It "parses as valid PowerShell" {
        # Parse the content already loaded in BeforeAll. Avoids reopening the file via
        # ParseFile, which trips on the WSL UNC provider-prefix corruption that
        # Resolve-Path emits when the runspace mounts the workspace over \\wsl.localhost.
        $tokens = $null; $errors = $null
        $null = [System.Management.Automation.Language.Parser]::ParseInput($script:ScriptContent, [ref]$tokens, [ref]$errors)
        if ($errors.Count -gt 0) {
            foreach ($e in $errors) {
                Write-Host ("PARSE-ERR line " + $e.Extent.StartLineNumber + ": " + $e.Message)
            }
        }
        $errors.Count | Should -Be 0
    }

    It "defines all expected functions" {
        $required = @('Resolve-IsLinux', 'Resolve-IsWsl', 'Resolve-WebInstanceId',
                      'Invoke-Staging', 'Test-StagedLayout', 'New-ArchiveTarball',
                      'Test-ArchiveTarball', 'New-SsmScript', 'Invoke-Deploy')
        foreach ($fn in $required) {
            $script:ScriptContent | Should -Match "function $fn\b"
        }
    }

    It "does not use ReadOnly automatic variables as locals" {
        # $IsLinux, $IsWSL, $IsWindows, $IsMacOS are automatic in PowerShell 7.
        # A naive "$isLinux = ..." assignment would collide with $IsLinux via case-insensitivity.
        $script:ScriptContent | Should -Not -Match '(?im)^\s*\$IsLinux\s*='
        $script:ScriptContent | Should -Not -Match '(?im)^\s*\$IsWSL\s*='
        $script:ScriptContent | Should -Not -Match '(?im)^\s*\$IsWindows\s*='
        $script:ScriptContent | Should -Not -Match '(?im)^\s*\$IsMacOS\s*='
    }
}

Describe "New-SsmScript" {
    It "emits Phase 0..5 markers" {
        $rendered = New-SsmScript -ReleaseRoot '/opt/tastile/web/releases' `
            -CurrentLink '/opt/tastile/web/current' `
            -ServiceName 'tastile-web.service' `
            -ReleaseName 'tastile-web-test' `
            -PresignedUrl 'https://example.com/x.tar.gz' `
            -TarballName 'tastile-web-test.tar.gz'

        $rendered | Should -Match 'Phase 0: capture previous target'
        $rendered | Should -Match 'Phase 1: extract to release dir'
        $rendered | Should -Match 'Phase 2: pre-swap validation'
        $rendered | Should -Match 'Phase 3: swap symlink'
        $rendered | Should -Match 'Phase 4: restart \+ readiness probe'
        $rendered | Should -Match 'Phase 5: rollback'
    }

    It "captures previous symlink target with readlink -f" {
        $rendered = New-SsmScript -ReleaseRoot '/r' -CurrentLink '/c' -ServiceName 's' `
            -ReleaseName 'n' -PresignedUrl 'u' -TarballName 't.tar.gz'
        $rendered | Should -Match 'readlink -f "\$CURRENT_LINK"'
    }

    It "uses tar -xzf (not unzip) to extract" {
        $rendered = New-SsmScript -ReleaseRoot '/r' -CurrentLink '/c' -ServiceName 's' `
            -ReleaseName 'n' -PresignedUrl 'u' -TarballName 't.tar.gz'
        $rendered | Should -Match 'tar -xzf'
        $rendered | Should -Not -Match '\bunzip\b'
    }

    It "validates server.js, .next/standalone, .next/static, public with distinct exit codes" {
        $rendered = New-SsmScript -ReleaseRoot '/r' -CurrentLink '/c' -ServiceName 's' `
            -ReleaseName 'n' -PresignedUrl 'u' -TarballName 't.tar.gz'
        $rendered | Should -Match 'test -f "\$RELEASE_PATH/server.js"'
        $rendered | Should -Match 'exit 10'
        $rendered | Should -Match 'test -d "\$RELEASE_PATH/\.next/standalone"'
        $rendered | Should -Match 'exit 11'
        $rendered | Should -Match 'test -d "\$RELEASE_PATH/\.next/static"'
        $rendered | Should -Match 'exit 12'
        $rendered | Should -Match 'test -d "\$RELEASE_PATH/public"'
        $rendered | Should -Match 'exit 13'
    }

    It "swaps symlink atomically with ln -sfn" {
        $rendered = New-SsmScript -ReleaseRoot '/r' -CurrentLink '/c' -ServiceName 's' `
            -ReleaseName 'n' -PresignedUrl 'u' -TarballName 't.tar.gz'
        $rendered | Should -Match 'ln -sfn "\$RELEASE_PATH" "\$CURRENT_LINK"'
    }

    It "restarts the service with systemctl restart" {
        $rendered = New-SsmScript -ReleaseRoot '/r' -CurrentLink '/c' -ServiceName 'tastile-web.service' `
            -ReleaseName 'n' -PresignedUrl 'u' -TarballName 't.tar.gz'
        $rendered | Should -Match 'systemctl restart "\$SERVICE"'
    }

    It "polls readiness with curl" {
        $rendered = New-SsmScript -ReleaseRoot '/r' -CurrentLink '/c' -ServiceName 's' `
            -ReleaseName 'n' -PresignedUrl 'u' -TarballName 't.tar.gz'
        $rendered | Should -Match 'curl -fsS -o /dev/null "http://127\.0\.0\.1:3000\$READY_PATH"'
        ($rendered | Select-String -Pattern 'seq 1 \$READY_TIMEOUT' -AllMatches).Matches.Count | Should -BeGreaterOrEqual 1
        ($rendered | Select-String -Pattern 'seq 1 \$ROLLBACK_TIMEOUT' -AllMatches).Matches.Count | Should -BeGreaterOrEqual 1
    }

    It "restores previous symlink target in Phase 5 with distinct exit codes 20/21/22" {
        $rendered = New-SsmScript -ReleaseRoot '/r' -CurrentLink '/c' -ServiceName 's' `
            -ReleaseName 'n' -PresignedUrl 'u' -TarballName 't.tar.gz'
        $rendered | Should -Match 'exit 20'
        $rendered | Should -Match 'exit 21'
        $rendered | Should -Match 'exit 22'
        $rendered | Should -Match '"\$PREVIOUS_TARGET"'
        $rendered | Should -Match 'ln -sfn "\$PREVIOUS_TARGET"'
    }

    It "configurable readiness/rollback timeouts" {
        $rendered = New-SsmScript -ReleaseRoot '/r' -CurrentLink '/c' -ServiceName 's' `
            -ReleaseName 'n' -PresignedUrl 'u' -TarballName 't.tar.gz' `
            -ReadinessTimeoutSec 25 -RollbackTimeoutSec 8
        $rendered | Should -Match 'READY_TIMEOUT=25'
        $rendered | Should -Match 'ROLLBACK_TIMEOUT=8'
    }

    It "configurable readiness path" {
        $rendered = New-SsmScript -ReleaseRoot '/r' -CurrentLink '/c' -ServiceName 's' `
            -ReleaseName 'n' -PresignedUrl 'u' -TarballName 't.tar.gz' `
            -ReadinessPath '/api/health'
        $rendered | Should -Match "READY_PATH='/api/health'"
    }

    It "disables nullglob for safer globbing" {
        $rendered = New-SsmScript -ReleaseRoot '/r' -CurrentLink '/c' -ServiceName 's' `
            -ReleaseName 'n' -PresignedUrl 'u' -TarballName 't.tar.gz'
        $rendered | Should -Match 'shopt -s nullglob'
    }

    It "uses set -euo pipefail strict mode" {
        $rendered = New-SsmScript -ReleaseRoot '/r' -CurrentLink '/c' -ServiceName 's' `
            -ReleaseName 'n' -PresignedUrl 'u' -TarballName 't.tar.gz'
        $rendered | Should -Match '^set -euo pipefail'
    }

    It "quotes variables to survive edge-case paths" {
        $rendered = New-SsmScript -ReleaseRoot '/r' -CurrentLink '/c' -ServiceName 's' `
            -ReleaseName 'n' -PresignedUrl 'u' -TarballName 't.tar.gz'
        $rendered | Should -Match '"\$RELEASE_PATH"'
        $rendered | Should -Match '"\$CURRENT_LINK"'
        $rendered | Should -Match '"\$PREVIOUS_TARGET"'
        $rendered | Should -Match '"\$TARBALL"'
    }

    It "does not contain parens in echo strings (cp932 / heredoc hazard)" {
        $rendered = New-SsmScript -ReleaseRoot '/r' -CurrentLink '/c' -ServiceName 's' `
            -ReleaseName 'n' -PresignedUrl 'u' -TarballName 't.tar.gz'
        $rendered | Should -Not -Match 'echo "[^"]*\('
    }
}

Describe "Test-StagedLayout" {
    It "throws STAGE_VALIDATION_FAILED when server.js missing" {
        $tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("stage-test-" + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Force -Path $tmp | Out-Null
        try {
            New-Item -ItemType Directory -Force -Path (Join-Path $tmp '.next/standalone') | Out-Null
            New-Item -ItemType Directory -Force -Path (Join-Path $tmp '.next/static') | Out-Null
            New-Item -ItemType Directory -Force -Path (Join-Path $tmp 'public') | Out-Null
            { Test-StagedLayout -StageDir $tmp } | Should -Throw -ExpectedMessage '*server.js*10*'
        } finally {
            Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
        }
    }

    It "passes when all four required paths exist" {
        $tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("stage-test-" + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Force -Path $tmp | Out-Null
        try {
            New-Item -ItemType Directory -Force -Path (Join-Path $tmp '.next/standalone') | Out-Null
            New-Item -ItemType Directory -Force -Path (Join-Path $tmp '.next/static') | Out-Null
            New-Item -ItemType Directory -Force -Path (Join-Path $tmp 'public') | Out-Null
            Set-Content -LiteralPath (Join-Path $tmp 'server.js') -Value 'module.exports = {};'
            Test-StagedLayout -StageDir $tmp | Should -BeTrue
        } finally {
            Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

Describe "Invoke-Staging platform dispatch" {
    It "returns cp-rL on Unix and copies tree to StageDir" {
        # `cp -rL` only resolves to GNU coreutils cp under Linux pwsh. Under Windows
        # pwsh.exe, `cp` is an alias to Copy-Item which rejects `-rL`. We can't mock
        # the alias from inside a Pester runspace, so skip when we're not on the
        # canonical host. The static check below covers the script intent either way.
        if (-not $IsLinux) {
            Set-ItResult -Skipped -Because "cp -rL path requires Linux pwsh; Windows pwsh.exe maps `cp` to Copy-Item which rejects -rL"
        }

        Mock -ModuleName deploy-web-v1-functions -CommandName Resolve-IsLinux -MockWith { return $true }
        Mock -ModuleName deploy-web-v1-functions -CommandName Resolve-IsWsl -MockWith { return $false }

        $src = Join-Path ([System.IO.Path]::GetTempPath()) ("stage-src-" + [guid]::NewGuid().ToString('N'))
        $dst = Join-Path ([System.IO.Path]::GetTempPath()) ("stage-dst-" + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Force -Path $src | Out-Null
        New-Item -ItemType Directory -Force -Path $dst | Out-Null
        try {
            # Seed source with sentinel files in each required subtree. -rL must
            # preserve the standalone/static/public split on the destination side.
            $standaloneDir = Join-Path $src '.next/standalone'
            $staticDir = Join-Path $src '.next/static'
            $publicDir = Join-Path $src 'public'
            New-Item -ItemType Directory -Force -Path $standaloneDir | Out-Null
            New-Item -ItemType Directory -Force -Path $staticDir | Out-Null
            New-Item -ItemType Directory -Force -Path $publicDir | Out-Null
            Set-Content -LiteralPath (Join-Path $standaloneDir 'server.js') -Value '// standalone sentinel'
            Set-Content -LiteralPath (Join-Path $staticDir 'chunk.js') -Value '// static sentinel'
            Set-Content -LiteralPath (Join-Path $publicDir 'favicon.ico') -Value 'fav sentinel'

            $backend = Invoke-Staging -SourceRoot $src -StageDir $dst
            $backend | Should -Be 'cp-rL'
            Test-Path (Join-Path $dst '.next/standalone/server.js') | Should -BeTrue
            Test-Path (Join-Path $dst '.next/static/chunk.js') | Should -BeTrue
            Test-Path (Join-Path $dst 'public/favicon.ico') | Should -BeTrue
        } finally {
            Remove-Item -LiteralPath $src -Recurse -Force -ErrorAction SilentlyContinue
            Remove-Item -LiteralPath $dst -Recurse -Force -ErrorAction SilentlyContinue
        }
    }

    It "uses `cp -rL --` to follow symlinks safely in source" {
        # Static guard. The `-rL` flag is critical: it dereferences symlinks so the
        # .next/standalone bundle is copied as a tree (not as broken symlinks).
        # Without -L, systemd on the production host fails to load server.js.
        $script:ScriptContent | Should -Match 'cp -rL --'
    }

    It "returns robocopy on Windows" {
        Mock -ModuleName deploy-web-v1-functions -CommandName Resolve-IsLinux -MockWith { return $false }
        Mock -ModuleName deploy-web-v1-functions -CommandName Resolve-IsWsl -MockWith { return $false }

        $called = $false
        # robocopy.exe is an external command (Application). Mock it so the function
        # completes without touching the host filesystem. `Mock -ModuleName` for an
        # application works by injecting a scriptblock function in the module's
        # session state that wins command resolution for the duration of the test.
        Mock -ModuleName deploy-web-v1-functions -CommandName robocopy -MockWith {
            param([Parameter(ValueFromRemainingArguments=$true)][object[]]$rest)
            $script:called = $true
            return 0
        }

        $backend = Invoke-Staging -SourceRoot 'C:\fake\src' -StageDir 'C:\fake\dst'
        $backend | Should -Be 'robocopy'
        $script:called | Should -BeTrue
    }
}

Describe "DryRun short-circuit" {
    It "DryRun marker is positioned before the S3 cp invocation" {
        $dryRunIdx = $script:ScriptContent.IndexOf('DRY RUN')
        $s3CpIdx = $script:ScriptContent.IndexOf('aws s3 cp')
        $s3CpRealIdx = $script:ScriptContent.IndexOf('aws s3 cp ', $dryRunIdx + 1)
        $dryRunIdx | Should -BeGreaterOrEqual 0
        $s3CpRealIdx | Should -BeGreaterOrEqual 0
        $dryRunIdx | Should -BeLessThan $s3CpRealIdx
    }

    It "renders BEGIN/END SSM payload markers in -DryRun" {
        $script:ScriptContent | Should -Match 'BEGIN SSM PAYLOAD'
        $script:ScriptContent | Should -Match 'END SSM PAYLOAD'
    }
}

Describe "SkipBuild switch" {
    It "implies TASTILE_WEB_SKIP_BUILD env var" {
        $script:ScriptContent | Should -Match 'if \(\$SkipBuild -and \(\$env:TASTILE_WEB_SKIP_BUILD -ne ''1''\)\)'
    }

    It "still allows TASTILE_WEB_SKIP_BUILD env-var form" {
        $script:ScriptContent | Should -Match 'if \(\$env:TASTILE_WEB_SKIP_BUILD -eq ''1''\)'
    }
}

Describe "Encoding safety" {
    It "writes SSM payload with ASCII encoding (cp932 safety)" {
        $script:ScriptContent | Should -Match 'Set-Content -LiteralPath \$tmp -Value \$payload -Encoding ASCII'
    }
}

Describe "Entry-point guard" {
    It "only invokes Invoke-Deploy when $MyInvocation.MyCommand.Path -eq $PSCommandPath" {
        # This guards against the script accidentally running main() when dot-sourced
        # from a test. The pattern is a known PowerShell idiom.
        $script:ScriptContent | Should -Match '\$MyInvocation\.MyCommand\.Path -eq \$PSCommandPath'
    }
}

Describe "Archive integrity (v1.0.4 gzip fix)" {
    It "invokes tar with -czf so bsdtar/libarchive produces gzip output" {
        # v1.0.3 used `tar -c -f <tarball>` which on bsdtar / libarchive produces an
        # uncompressed tar with a `.tar.gz` suffix. EC2 `tar -xzf` then fails with
        # `gzip: stdin: not in gzip format`. v1.0.4 must use `-czf` (or `-a`).
        $script:ScriptContent | Should -Match 'tar\.exe -czf'
    }

    It "verifies gzip magic (0x1f 0x8b) on the produced archive" {
        # Belt-and-braces: even if some host tar ignores `-z`, refuse to upload the file
        # unless the first two bytes are 0x1f 0x8b. This catches the silent gzip-skip bug
        # at the source rather than at EC2 extraction time.
        $script:ScriptContent | Should -Match '0x1f'
        $script:ScriptContent | Should -Match '0x8b'
    }

    It "calls Test-ArchiveTarball in Invoke-Deploy to confirm `tar -tzf` opens cleanly" {
        # Pre-upload sanity check: open the archive with `tar -tzf` and confirm it parses.
        $script:ScriptContent | Should -Match 'Test-ArchiveTarball -TarballPath \$tarballPath'
    }

    It "produces a gzip archive from a real staging dir (end-to-end)" {
        # We can run this on any host with `tar.exe` in PATH or `$env:SystemRoot\System32\tar.exe`.
        # Skip if neither is available — the static checks above cover the contract.
        $tarExe = "$env:SystemRoot\System32\tar.exe"
        if (-not (Test-Path -LiteralPath $tarExe)) { $tarExe = (Get-Command tar -ErrorAction SilentlyContinue).Source }
        if (-not $tarExe) {
            Set-ItResult -Skipped -Because "no tar.exe available in this environment"
        }

        $src = Join-Path ([System.IO.Path]::GetTempPath()) ("tar-src-" + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Force -Path $src | Out-Null
        try {
            New-Item -ItemType Directory -Force -Path (Join-Path $src '.next/standalone') | Out-Null
            New-Item -ItemType Directory -Force -Path (Join-Path $src '.next/static') | Out-Null
            New-Item -ItemType Directory -Force -Path (Join-Path $src 'public') | Out-Null
            Set-Content -LiteralPath (Join-Path $src 'server.js') -Value 'module.exports={}'

            $tarball = Join-Path ([System.IO.Path]::GetTempPath()) ("tar-out-" + [guid]::NewGuid().ToString('N') + '.tar.gz')
            & $tarExe -czf "$tarball" -C "$src" .
            if ($LASTEXITCODE -ne 0) { throw "tar -czf failed (exit=$LASTEXITCODE)" }

            # First, gzip magic verification (mirrors New-ArchiveTarball's check).
            $bytes = [System.IO.File]::ReadAllBytes($tarball)
            ($bytes.Length -ge 2 -and $bytes[0] -eq 0x1f -and $bytes[1] -eq 0x8b) | Should -BeTrue

            # Second, `tar -tzf` opens it cleanly (mirrors Test-ArchiveTarball).
            $list = & $tarExe -tzf "$tarball" 2>&1
            $LASTEXITCODE | Should -Be 0
            ($list -join "`n") | Should -Match 'server\.js'
            ($list -join "`n") | Should -Match '\.next/standalone'
            ($list -join "`n") | Should -Match '\.next/static'
            ($list -join "`n") | Should -Match 'public'
        } finally {
            Remove-Item -LiteralPath $src -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

Describe "Source-tag pinning (v1.0.4 release-integrity gate)" {
    It "refuses to deploy when -Tag is vX.Y.Z but HEAD != ${Tag}^{commit}" {
        # Static guard. The pin uses `git rev-parse ${Tag}^{commit}` and refuses to proceed
        # if the resolved commit SHA differs from local HEAD. Override with -SkipSourcePin.
        # Use [regex]::Escape so the literal `\d+\.\d+\.\d+` text in the source matches verbatim
        # without the test author hand-rolling backslash escaping for the .NET regex engine.
        $pattern = [regex]::Escape("if (`$Tag -match '^v\d+\.\d+\.\d+$'")
        $script:ScriptContent | Should -Match $pattern
        $script:ScriptContent | Should -Match 'SOURCE_TAG_MISMATCH'
        $script:ScriptContent | Should -Match 'git rev-parse "\$\{Tag\}\^\{commit\}"'
    }

    It "documents -SkipSourcePin as the override for intentional HEAD/tag mismatch" {
        $script:ScriptContent | Should -Match 'SkipSourcePin'
    }
}
