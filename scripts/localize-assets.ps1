[CmdletBinding()]
param([string]$OutputRoot = (Join-Path $PSScriptRoot '../imgs'))

$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath($OutputRoot)
$championManifest = @(Get-Content (Join-Path $root 'champions/manifest.json') -Raw | ConvertFrom-Json)
$patch = $championManifest[0].patch
$sources = @{
    champions = "https://ddragon.leagueoflegends.com/cdn/$patch/data/ko_KR/champion.json"
    braveryIcon = 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-champ-select/global/default/images/champion-grid/bravery-champion.png'
    items = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/ko_kr/v1/items.json'
    augments = 'https://raw.communitydragon.org/latest/cdragon/arena/ko_kr.json'
}
$items = Invoke-RestMethod $sources.items
$augments = (Invoke-RestMethod $sources.augments).augments
$champions = (Invoke-RestMethod $sources.champions).data.PSObject.Properties.Value
$maps = @{items = @{}; augments = @{}; champions = @{}}
foreach ($row in $champions) { $maps.champions[[string]$row.key] = [string]$row.name }
$maps.champions['bravery'] = '용기'
foreach ($row in $items) { $maps.items[[string]$row.id] = [string]$row.name }
foreach ($row in $augments) { $maps.augments[[string]$row.id] = [string]$row.name }

# Validate every ID before changing files. Preserve English names and image paths.
$pending = @()
foreach ($kind in @('items', 'augments', 'champions')) {
    foreach ($file in (Get-ChildItem (Join-Path $root $kind) -Filter manifest.json -Recurse)) {
        $rows = @(Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json)
        if ($kind -eq 'champions' -and 'bravery' -notin $rows.id) {
            $rows += [pscustomobject]@{id='bravery'; apiName='Bravery'; name='Bravery'; icon='icons/bravery.png'; iconUrl=$sources.braveryIcon; patch=$patch}
        }
        foreach ($row in $rows) {
            if ($kind -eq 'augments' -and [string]$row.id -like 'wiki-*') { continue }
            $nameKo = $maps[$kind][[string]$row.id]
            if ([string]::IsNullOrWhiteSpace($nameKo)) { throw "Missing Korean source name: $kind/$($row.id)" }
            $nameEn = if ($row.nameEn) { $row.nameEn } else { $row.name }
            $row | Add-Member -NotePropertyName nameEn -NotePropertyValue $nameEn -Force
            $row | Add-Member -NotePropertyName nameKo -NotePropertyValue $nameKo -Force
            $row.name = $nameKo
        }
        $pending += @{file = $file; rows = $rows}
    }
}
$braveryPath = Join-Path $root 'champions/icons/bravery.png'
if (-not (Test-Path -LiteralPath $braveryPath)) { Invoke-WebRequest $sources.braveryIcon -OutFile $braveryPath }
foreach ($entry in $pending) {
    ConvertTo-Json -InputObject @($entry.rows) -Depth 10 | Set-Content -LiteralPath $entry.file.FullName -Encoding utf8NoBOM
    $entry.rows | Export-Csv -LiteralPath (Join-Path $entry.file.DirectoryName 'manifest.csv') -NoTypeInformation -Encoding utf8NoBOM
}
$metadata = [ordered]@{updatedAtUtc = [DateTime]::UtcNow.ToString('o'); locale = 'ko_KR'; sources = $sources; manifestsUpdated = $pending.Count}
$metadata | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $root 'localization.json') -Encoding utf8NoBOM
Write-Host "Localized $($pending.Count) manifests. Korean display names and English search names saved."
