$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$source = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/ko_kr/v1/items.json'
$remote = Invoke-RestMethod $source
$en = Invoke-RestMethod 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/items.json'
$manifestPath = Join-Path $root 'imgs/items/manifest.json'
$rows = @(Get-Content $manifestPath -Raw | ConvertFrom-Json)
$patch = $rows[0].patch
foreach ($id in @(223040,223042,223121)) {
    $item = $remote | Where-Object id -eq $id
    $english = $en | Where-Object id -eq $id
    if (-not $item) { throw "Missing transformed item $id" }
    $icon = "legendary/$id-transformed.png"
    $url = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/' + ($item.iconPath -replace '^/lol-game-data/assets/','').ToLowerInvariant()
    Invoke-WebRequest $url -OutFile (Join-Path $root "imgs/items/$icon")
    $rows = @($rows | Where-Object id -ne $id)
    $rows += [pscustomobject]@{id=$id;name=$item.name;category='legendary';icon=$icon;iconUrl=$url;patch=$patch;nameKo=$item.name;nameEn=$english.name}
}
ConvertTo-Json -InputObject $rows -Depth 8 | Set-Content $manifestPath -Encoding utf8NoBOM
$rows | Export-Csv (Join-Path $root 'imgs/items/manifest.csv') -NoTypeInformation -Encoding utf8NoBOM
$legendary = @($rows | Where-Object category -eq 'legendary')
ConvertTo-Json -InputObject $legendary -Depth 8 | Set-Content (Join-Path $root 'imgs/items/legendary/manifest.json') -Encoding utf8NoBOM
$legendary | Export-Csv (Join-Path $root 'imgs/items/legendary/manifest.csv') -NoTypeInformation -Encoding utf8NoBOM
$icons = [ordered]@{ap='statmodsabilitypowericon.png';ad='statmodsattackdamageicon.png';health='statmodshealthplusicon.png';armor='statmodsarmoricon.png';mr='statmodsmagicresicon.png';speed='statmodsattackspeedicon.png';haste='statmodscdrscalingicon.png';move='statmodsmovementspeedicon.png'}
New-Item -ItemType Directory -Force (Join-Path $root 'imgs/stats') | Out-Null
$records = @()
foreach ($key in $icons.Keys) {
    $url = "https://raw.communitydragon.org/latest/game/assets/perks/statmods/$($icons[$key])"
    Invoke-WebRequest $url -OutFile (Join-Path $root "imgs/stats/$key.png")
    $records += @{key=$key;source=$url;icon="imgs/stats/$key.png"}
}
$records | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $root 'imgs/stats/sources.json') -Encoding utf8NoBOM
& (Join-Path $PSScriptRoot 'update-item-descriptions.ps1')
