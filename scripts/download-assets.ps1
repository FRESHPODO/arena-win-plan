[CmdletBinding()]
param(
    [string]$OutputRoot = (Join-Path $PSScriptRoot '..\imgs'),
    [int]$ThrottleLimit = 16
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$outputPath = [System.IO.Path]::GetFullPath($OutputRoot)
$cdragonRoot = 'https://raw.communitydragon.org/latest'
$lolDataRoot = "$cdragonRoot/plugins/rcp-be-lol-game-data/global/default"
$versionsUrl = 'https://ddragon.leagueoflegends.com/api/versions.json'
$arenaDataUrl = "$cdragonRoot/cdragon/arena/en_us.json"
$itemsDataUrl = "$lolDataRoot/v1/items.json"

function ConvertTo-SafeName {
    param([Parameter(Mandatory)][string]$Name)

    $normalized = $Name.Normalize([Text.NormalizationForm]::FormD)
    $ascii = -join ($normalized.ToCharArray() | Where-Object {
        [Globalization.CharUnicodeInfo]::GetUnicodeCategory($_) -ne
        [Globalization.UnicodeCategory]::NonSpacingMark
    })
    $ascii = $ascii -replace '[^A-Za-z0-9]+', '-'
    return $ascii.Trim('-').ToLowerInvariant()
}

function Convert-LolAssetPathToUrl {
    param([Parameter(Mandatory)][string]$AssetPath)

    $relative = $AssetPath -replace '^/lol-game-data/assets/', ''
    return "$lolDataRoot/$($relative.ToLowerInvariant())"
}

function Write-Manifest {
    param(
        [Parameter(Mandatory)][object[]]$Rows,
        [Parameter(Mandatory)][string]$Directory
    )

    New-Item -ItemType Directory -Force -Path $Directory | Out-Null
    $Rows | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 (Join-Path $Directory 'manifest.json')
    $Rows | Export-Csv -NoTypeInformation -Encoding utf8 (Join-Path $Directory 'manifest.csv')
}

function Add-Download {
    param(
        [Parameter(Mandatory)][AllowEmptyCollection()][Collections.Generic.List[object]]$Queue,
        [Parameter(Mandatory)][string]$Url,
        [Parameter(Mandatory)][string]$Path
    )

    $Queue.Add([pscustomobject]@{ url = $Url; path = $Path })
}

New-Item -ItemType Directory -Force -Path $outputPath | Out-Null

$versions = Invoke-RestMethod -Uri $versionsUrl
$patchVersion = [string]$versions[0]
$championsUrl = "https://ddragon.leagueoflegends.com/cdn/$patchVersion/data/en_US/champion.json"
$ddragonItemsUrl = "https://ddragon.leagueoflegends.com/cdn/$patchVersion/data/en_US/item.json"

$champions = (Invoke-RestMethod -Uri $championsUrl).data.PSObject.Properties.Value
$arena = Invoke-RestMethod -Uri $arenaDataUrl
$ddragonItems = (Invoke-RestMethod -Uri $ddragonItemsUrl).data.PSObject.Properties
$clientItems = Invoke-RestMethod -Uri $itemsDataUrl
$clientItemsById = @{}
foreach ($item in $clientItems) {
    $clientItemsById[[int]$item.id] = $item
}

$downloads = [Collections.Generic.List[object]]::new()

# Champions: one current base splash and one square portrait per live champion.
$championRows = foreach ($champion in ($champions | Sort-Object name)) {
    $safeName = ConvertTo-SafeName $champion.id
    $splashRelative = "splash/$safeName.jpg"
    $iconRelative = "icons/$safeName.png"
    $splashUrl = "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/$($champion.id)_0.jpg"
    $iconUrl = "https://ddragon.leagueoflegends.com/cdn/$patchVersion/img/champion/$($champion.image.full)"
    Add-Download $downloads $splashUrl (Join-Path $outputPath "champions/$splashRelative")
    Add-Download $downloads $iconUrl (Join-Path $outputPath "champions/$iconRelative")

    [pscustomobject]@{
        id = [int]$champion.key
        apiName = [string]$champion.id
        name = [string]$champion.name
        splash = $splashRelative
        icon = $iconRelative
        splashUrl = $splashUrl
        iconUrl = $iconUrl
        patch = $patchVersion
    }
}
Write-Manifest @($championRows) (Join-Path $outputPath 'champions')

# Arena augments: use the large client icon whenever it is available.
$augmentRows = foreach ($augment in ($arena.augments | Sort-Object id)) {
    $safeName = ConvertTo-SafeName $augment.apiName
    $relative = "icons/$($augment.id)-$safeName.png"
    $assetPath = if ($augment.iconLarge) { $augment.iconLarge } else { $augment.iconSmall }
    $iconUrl = "$cdragonRoot/game/$($assetPath.ToLowerInvariant())"
    Add-Download $downloads $iconUrl (Join-Path $outputPath "augments/$relative")

    [pscustomobject]@{
        id = [int]$augment.id
        apiName = [string]$augment.apiName
        name = [string]$augment.name
        rarity = [int]$augment.rarity
        icon = $relative
        iconUrl = $iconUrl
    }
}
Write-Manifest @($augmentRows) (Join-Path $outputPath 'augments')

$allItems = @($ddragonItems | ForEach-Object {
    [pscustomobject]@{
        id = [int]$_.Name
        data = $_.Value
    }
})

$normalName = {
    param([string]$Name)
    return (($Name -replace '<[^>]+>', '') -replace '[^A-Za-z0-9]+', '').ToLowerInvariant()
}

$summonersRiftNames = @{}
foreach ($entry in $allItems) {
    if (
        $entry.data.maps.'11' -eq $true -and
        $entry.data.gold.purchasable -eq $true -and
        $entry.data.name
    ) {
        $summonersRiftNames[(& $normalName $entry.data.name)] = $true
    }
}

$legendary = @($allItems | Where-Object {
    $_.data.maps.'30' -eq $true -and
    $_.data.gold.purchasable -eq $true -and
    [int]$_.data.gold.total -eq 2500 -and
    $_.data.tags -notcontains 'Boots' -and
    $_.data.tags -notcontains 'Consumable'
})

$prismatic = @($allItems | Where-Object {
    $_.data.maps.'30' -eq $true -and
    $_.data.gold.purchasable -eq $true -and
    [int]$_.data.gold.total -eq 2750
})

$anvilIds = @(220000, 220001, 220002, 220003, 220004, 220005, 220006, 220007)
$anvils = @($allItems | Where-Object { $_.id -in $anvilIds })
$excludedArenaIds = @(2001, 2007, 2010, 2052, 2145, 2146, 3330, 3348, 3400, 3599, 3600, 3901, 3902, 3903, 7050, 220008, 220009, 220010, 220011)
$exclusive = @($allItems | Where-Object {
    $normalizedName = & $normalName $_.data.name
    $_.data.maps.'30' -eq $true -and
    $_.data.gold.purchasable -eq $true -and
    [int]$_.data.gold.total -gt 0 -and
    $_.data.name -and
    $_.id -notin $excludedArenaIds -and
    $_.id -notin $anvilIds -and
    $_.id -notin $prismatic.id -and
    $_.id -notin $legendary.id -and
    -not $summonersRiftNames.ContainsKey($normalizedName)
})

$itemGroups = [ordered]@{
    legendary = $legendary
    prismatic = $prismatic
    anvil = $anvils
    exclusive = $exclusive
}

$allItemRows = [Collections.Generic.List[object]]::new()
foreach ($group in $itemGroups.GetEnumerator()) {
    $category = $group.Key
    $categoryRows = foreach ($entry in ($group.Value | Sort-Object { $_.data.name }, id)) {
        if (-not $clientItemsById.ContainsKey($entry.id)) {
            Write-Warning "Client item metadata is missing for item $($entry.id): $($entry.data.name)"
            continue
        }

        $clientItem = $clientItemsById[$entry.id]
        $safeName = ConvertTo-SafeName $entry.data.name
        if (-not $safeName) { $safeName = 'unnamed' }
        $relative = "$category/$($entry.id)-$safeName.png"
        $iconUrl = Convert-LolAssetPathToUrl $clientItem.iconPath
        Add-Download $downloads $iconUrl (Join-Path $outputPath "items/$relative")

        $row = [pscustomobject]@{
            id = $entry.id
            name = [string]$entry.data.name
            category = $category
            icon = $relative
            iconUrl = $iconUrl
            patch = $patchVersion
        }
        $allItemRows.Add($row)
        $row
    }
    Write-Manifest @($categoryRows) (Join-Path $outputPath "items/$category")
}
Write-Manifest @($allItemRows) (Join-Path $outputPath 'items')

$sourceInfo = [pscustomobject]@{
    generatedAtUtc = [DateTime]::UtcNow.ToString('o')
    patch = $patchVersion
    championData = $championsUrl
    augmentData = $arenaDataUrl
    itemData = $ddragonItemsUrl
    itemAssetData = $itemsDataUrl
    counts = [ordered]@{
        champions = @($championRows).Count
        championImages = @($championRows).Count * 2
        augments = @($augmentRows).Count
        legendaryItems = @($legendary).Count
        prismaticItems = @($prismatic).Count
        anvilItems = @($anvils).Count
        arenaExclusiveItems = @($exclusive).Count
        totalDownloads = $downloads.Count
    }
}
$sourceInfo | ConvertTo-Json -Depth 6 | Set-Content -Encoding utf8 (Join-Path $outputPath 'sources.json')

$downloads | ForEach-Object -Parallel {
    $directory = Split-Path -Parent $_.path
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
    if (-not (Test-Path -LiteralPath $_.path) -or (Get-Item -LiteralPath $_.path).Length -eq 0) {
        Invoke-WebRequest -Uri $_.url -OutFile $_.path -MaximumRetryCount 3 -RetryIntervalSec 2
    }
} -ThrottleLimit $ThrottleLimit

& (Join-Path $PSScriptRoot 'localize-assets.ps1') -OutputRoot $outputPath
if ($outputPath -eq [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../imgs'))) {
    & (Join-Path $PSScriptRoot 'complete-item-assets.ps1')
    & (Join-Path $PSScriptRoot 'update-augment-descriptions.ps1')
}

Write-Host "Downloaded $($downloads.Count) assets for patch $patchVersion to $outputPath"
Write-Host ($sourceInfo.counts | ConvertTo-Json -Compress)
