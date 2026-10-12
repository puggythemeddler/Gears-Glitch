<#
.SYNOPSIS
  DR restore drill: restore a control-plane tenant backup (.sql.gz) into a
  scratch Neon database and verify it.

.DESCRIPTION
  Implements ACTION_ITEMS.md "Runbook B". It NEVER touches production -- pass
  the connection string of a throwaway/scratch Neon project only.

  The dump is produced by pg_dump 17 (Neon runs PostgreSQL 17) and its preamble
  includes `SET transaction_timeout = ...`, so the TARGET database must be
  PostgreSQL 17 or newer. A Neon scratch project satisfies this automatically.
  When restoring into a plain / non-Neon Postgres, also pass -ProvisionNeonRoles
  so the Neon-owned objects resolve (owner `neondb_owner`; roles `neon_superuser`
  and `cloud_admin`).

  Steps: decompress the .sql.gz (native PowerShell, no 7z/gzip needed), restore
  with psql (ON_ERROR_STOP, so it fails loudly), then print verification counts.

.EXAMPLE
  .\scripts\dr-restore.ps1 `
    -BackupGz  "$env:USERPROFILE\Downloads\myshop_2026-01-15.sql.gz" `
    -ScratchUrl "postgresql://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require"
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$BackupGz,
  [Parameter(Mandatory = $true)][string]$ScratchUrl,
  [string]$PgBin = "C:\Program Files\PostgreSQL\17\bin",
  # Create the Neon-owned roles before restoring (needed for a non-Neon target).
  [switch]$ProvisionNeonRoles
)

$ErrorActionPreference = "Stop"

function Resolve-Psql {
  param([string]$Bin)
  $candidates = @()
  if ($Bin) { $candidates += (Join-Path $Bin "psql.exe") }
  $cmd = Get-Command psql.exe -ErrorAction SilentlyContinue
  if ($cmd) { $candidates += $cmd.Source }
  $candidates += (Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName })
  $found = $candidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
  if (-not $found) { throw "psql 17 not found. Install it with: winget install --id PostgreSQL.PostgreSQL.17 -e" }
  return $found
}

$psql = Resolve-Psql -Bin $PgBin
Write-Host "psql:    $psql"
Write-Host "backup:  $BackupGz"
Write-Host "target:  scratch DB only`n"

if (-not (Test-Path -LiteralPath $BackupGz)) { throw "Backup file not found: $BackupGz" }
if ($ScratchUrl -notmatch "sslmode=") { $ScratchUrl += "?sslmode=require" }

# 0. Target must be PostgreSQL 17+ (dump preamble sets `transaction_timeout`).
$serverNum = $(& $psql $ScratchUrl -tAc "SHOW server_version_num;").Trim()
Write-Host "target server_version_num: $ver"
if ([int]$ver -lt 170000) {
  Write-Warning "Target is PostgreSQL < 17; restore may fail on 'SET transaction_timeout'. Use a PG17+ target (Neon scratch)."
}

if ($ProvisionNeonRoles) {
  Write-Host "Provisioning Neon roles on the target (neondb_owner, neon_superuser, cloud_admin)..."
  foreach ($role in @("neondb_owner", "neon_superuser", "cloud_admin")) {
    & $psql $ScratchUrl -c ('CREATE ROLE "' + $role + '";') 2>$null
  }
}

# 1. Decompress .sql.gz -> .sql using native .NET (no external gzip needed).
$sqlPath = [System.IO.Path]::ChangeExtension($BackupGz, ".sql")
$src = [System.IO.Compression.GZipStream]::new(
  [System.IO.File]::OpenRead($BackupGz),
  [System.IO.Compression.CompressionMode]::Decompress)
$dst = [System.IO.File]::Create($sqlPath)
try { $src.CopyTo($dst) } finally { $src.Dispose(); $dst.Dispose() }
$sizeMB = [math]::Round((Get-Item -LiteralPath $sqlPath).Length / 1MB, 2)
Write-Host "decompressed: $sqlPath ($sizeMB MB)"
if ($sizeMB -lt 0.01) { throw "Decompressed file is essentially empty - the backup download may be corrupt." }

# 2. Restore into the scratch DB. ON_ERROR_STOP aborts on the first error.
Write-Host "`nRestoring (ON_ERROR_STOP=1)..."
& $psql $ScratchUrl -v ON_ERROR_STOP=1 -f $sqlPath
if ($LASTEXITCODE -ne 0) { throw "Restore failed (psql exit $LASTEXITCODE)" }

# 3. Verify tenant tables (NOT `clients`, which lives in the control-plane DB).
Write-Host "`n--- verification ---"
$queries = @(
  "SELECT count(*) AS products FROM products;",
  "SELECT count(*) FROM customers;",
  "SELECT count(*) FROM orders;",
  "SELECT count(*) FROM invoices;",
  "SELECT max(version) AS schema_migrations_head FROM schema_migrations;"
)
foreach ($q in $queries) {
  Write-Host "`n> $q"
  & $psql $ScratchUrl -v ON_ERROR_STOP=1 -c $q
}
Write-Host "`nRecent customers (sanity check that rows resolve):"
& $psql $ScratchUrl -c "SELECT id, name, email FROM customers ORDER BY id DESC LIMIT 5;"

Write-Host "`nDone. Compare the counts above to the SAME queries run against prod." -ForegroundColor Green
Write-Host "Then drop the scratch Neon project and update PRODUCTION_READINESS_CURRENT.md (L101)."
