$ErrorActionPreference = "Stop"
$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjUsInVzZXJuYW1lIjoiSm9sbHkgV2lzZXIiLCJlbWFpbCI6Impvc3BoYXRsaW5nZTlAZ21haWwuY29tIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzg0MjQwMDI3LCJleHAiOjE3ODQzMjY0Mjd9.AYlzNbpx4L1RjhygkEYYgkYPhUmxePdgG6H6ljXhweY"
$baseUrl = "https://gears-glitch.onrender.com"
$imgDir = "I:\Laptop sale\data\uploads_images"
if (!(Test-Path $imgDir)) { New-Item -ItemType Directory -Path $imgDir -Force | Out-Null }

# Product ID -> Unsplash photo search term -> specific unsplash photo URL
$products = @(
    @{ id = "LEN-001"; query = "lenovo thinkbook laptop"; name = "Lenovo Thinkbook 15" },
    @{ id = "46231"; query = "hp omen gaming laptop"; name = "HP Omen" },
    @{ id = "wl-probook-14"; query = "hp probook laptop silver"; name = "ProBook 14 Work" },
    @{ id = "wl-ultralite-13"; query = "ultrabook thin laptop touchscreen"; name = "UltraLite 13" },
    @{ id = "wl-student-15"; query = "budget student laptop"; name = "Student 15" },
    @{ id = "ml-air-m2"; query = "macbook air m2 silver"; name = "MacBook Air M2" },
    @{ id = "ml-pro-14"; query = "macbook pro 14 laptop"; name = "MacBook Pro 14" },
    @{ id = "ml-air-15"; query = "macbook air 15 inch laptop"; name = "MacBook Air 15" },
    @{ id = "gl-aurora-15"; query = "gaming laptop rgb keyboard"; name = "Aurora 15 Gaming" },
    @{ id = "gl-strike-17"; query = "large gaming laptop 17 inch"; name = "Strike 17 Pro" },
    @{ id = "gl-compact-g14"; query = "compact gaming laptop 14 inch"; name = "Compact G14" },
    @{ id = "gp-nebula-rx"; query = "gaming pc desktop rgb tower"; name = "Nebula RX Gaming PC" },
    @{ id = "gp-titan-ultra"; query = "high end gaming desktop pc"; name = "Titan Ultra" },
    @{ id = "gp-entry-storm"; query = "entry gaming pc desktop"; name = "Storm Entry" },
    @{ id = "bp-office-slim"; query = "small form factor desktop pc"; name = "Office Slim SFF" },
    @{ id = "bp-workstation-tower"; query = "workstation desktop tower pc"; name = "Workstation Tower" },
    @{ id = "bp-micro-desk"; query = "mini desktop pc small"; name = "Micro Desk Mini" },
    @{ id = "md-studio-m2"; query = "apple mac studio desktop"; name = "Mac Studio" },
    @{ id = "md-mini-m2"; query = "mac mini desktop computer"; name = "Mac Mini" },
    @{ id = "md-pro-tower"; query = "professional desktop workstation tower"; name = "Pro Tower Workstation" },
    @{ id = "rs-rack-2u-a"; query = "2u rack server datacenter"; name = "Rack Server 2U" },
    @{ id = "rs-rack-1u-b"; query = "1u rack server"; name = "Rack Server 1U" },
    @{ id = "rs-rack-4u-storage"; query = "storage server rack nas"; name = "Storage Node 4U" },
    @{ id = "ts-tower-entry"; query = "tower server entry level"; name = "Tower Server Entry" },
    @{ id = "ts-tower-pro"; query = "tower server professional"; name = "Tower Server Pro" },
    @{ id = "ts-tower-smb"; query = "small business tower server"; name = "SMB Tower Bundle" },
    @{ id = "bs-blade-chassis"; query = "blade server chassis"; name = "Blade Chassis" },
    @{ id = "bs-blade-node"; query = "server blade compute node"; name = "Blade Compute Node" },
    @{ id = "bs-blade-storage"; query = "blade storage module server"; name = "Blade Storage Module" },
    @{ id = "pr-laser-office"; query = "office laser printer"; name = "Office Laser Printer" },
    @{ id = "pr-inkjet-home"; query = "home inkjet all in one printer"; name = "Home Inkjet Printer" },
    @{ id = "pr-label-industrial"; query = "industrial label printer thermal"; name = "Label Printer" },
    @{ id = "rp-screen-laptop"; query = "laptop screen replacement repair"; name = "Laptop Screen Repair" },
    @{ id = "rp-virus-tuneup"; query = "computer virus removal software"; name = "Virus Removal" },
    @{ id = "rp-data-recovery"; query = "hard drive data recovery"; name = "Data Recovery" }
)

function Download-Image($url, $outPath) {
    try {
        $wc = New-Object System.Net.WebClient
        $wc.Headers.Add("User-Agent", "Mozilla/5.0")
        $wc.DownloadFile($url, $outPath)
        return $true
    } catch {
        return $false
    }
}

function Upload-ProductImage($id, $filePath, $token, $baseUrl) {
    try {
        $boundary = [System.Guid]::NewGuid().ToString()
        $fileName = [System.IO.Path]::GetFileName($filePath)
        $fileBytes = [System.IO.File]::ReadAllBytes($filePath)
        $encoding = [System.Text.Encoding]::UTF8

        $bodyLines = @(
            "--$boundary",
            "Content-Disposition: form-data; name=`"image`"; filename=`"$fileName`"",
            "Content-Type: image/jpeg",
            "",
            ""
        )
        $headerBytes = $encoding.GetBytes(($bodyLines -join "`r`n"))
        $footerBytes = $encoding.GetBytes("`r`n--$boundary--`r`n")

        $bodyStream = New-Object System.IO.MemoryStream
        $bodyStream.Write($headerBytes, 0, $headerBytes.Length)
        $bodyStream.Write($fileBytes, 0, $fileBytes.Length)
        $bodyStream.Write($footerBytes, 0, $footerBytes.Length)
        $bodyBytes = $bodyStream.ToArray()
        $bodyStream.Dispose()

        $resp = Invoke-WebRequest -Uri "$baseUrl/api/products/$id/image" -Method POST -Body $bodyBytes -ContentType "multipart/form-data; boundary=$boundary" -Headers @{ Authorization = "Bearer $token" }
        return $resp.StatusCode -eq 200
    } catch {
        Write-Host "  Upload error for ${id}: $($_.Exception.Message)"
        return $false
    }
}

# Search Pexels for images (no API key needed for basic search)
function Search-Pexels($query) {
    try {
        $encoded = [System.Uri]::EscapeDataString($query)
        $resp = Invoke-WebRequest -Uri "https://www.pexels.com/search/$encoded/" -Headers @{ "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } -TimeoutSec 10
        $matches = [regex]::Matches($resp.Content, 'src="https://images\.pexels\.com/photos/\d+/[^"]+\.pexels\.com[^"]*\?auto=compress[^"]*"')
        if ($matches.Count -gt 0) {
            $url = $matches[0].Value -replace '^src="', '' -replace '"$', ''
            return $url
        }
        return $null
    } catch {
        return $null
    }
}

Write-Host "Starting image download and upload for $($products.Count) products..."
Write-Host ""

$success = 0
$failed = 0

foreach ($p in $products) {
    Write-Host "[$($p.id)] $($p.name)..."
    
    # Try Pexels search
    $imgUrl = Search-Pexels $p.query
    
    if ($imgUrl) {
        $outFile = Join-Path $imgDir "$($p.id).jpg"
        $downloaded = Download-Image $imgUrl $outFile
        if ($downloaded -and (Get-Item $outFile).Length -gt 1000) {
            Write-Host "  Downloaded from Pexels"
            $uploaded = Upload-ProductImage $p.id $outFile $token $baseUrl
            if ($uploaded) {
                Write-Host "  Uploaded OK"
                $success++
            } else {
                Write-Host "  Upload FAILED"
                $failed++
            }
        } else {
            Write-Host "  Download failed, trying Unsplash..."
            # Fallback: Unsplash source
            $unsplashUrl = "https://source.unsplash.com/800x600/?$([System.Uri]::EscapeDataString($p.query))"
            $downloaded = Download-Image $unsplashUrl $outFile
            if ($downloaded -and (Get-Item $outFile).Length -gt 1000) {
                Write-Host "  Downloaded from Unsplash"
                $uploaded = Upload-ProductImage $p.id $outFile $token $baseUrl
                if ($uploaded) { Write-Host "  Uploaded OK"; $success++ } else { Write-Host "  Upload FAILED"; $failed++ }
            } else {
                Write-Host "  All downloads failed"
                $failed++
            }
        }
    } else {
        Write-Host "  No search results, trying Unsplash fallback..."
        $outFile = Join-Path $imgDir "$($p.id).jpg"
        $unsplashUrl = "https://source.unsplash.com/800x600/?$([System.Uri]::EscapeDataString($p.query))"
        $downloaded = Download-Image $unsplashUrl $outFile
        if ($downloaded -and (Get-Item $outFile).Length -gt 1000) {
            Write-Host "  Downloaded from Unsplash"
            $uploaded = Upload-ProductImage $p.id $outFile $token $baseUrl
            if ($uploaded) { Write-Host "  Uploaded OK"; $success++ } else { Write-Host "  Upload FAILED"; $failed++ }
        } else {
            Write-Host "  All downloads failed"
            $failed++
        }
    }
    
    Start-Sleep -Milliseconds 500
}

Write-Host ""
Write-Host "Done! Success: $success / Failed: $failed / Total: $($products.Count)"
