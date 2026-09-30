$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$source = 'https://raw.communitydragon.org/latest/cdragon/arena/ko_kr.json'
$remote = (Invoke-RestMethod $source).augments
$byId = @{}
foreach ($augment in $remote) { $byId[[string]$augment.id] = $augment }
$manifest = Get-Content (Join-Path $root 'imgs/augments/manifest.json') -Raw | ConvertFrom-Json
$previous = Get-Content (Join-Path $root 'data/augment-descriptions.ko.json') -Raw | ConvertFrom-Json
$rows = foreach ($entry in $manifest) {
    if ([string]$entry.id -like 'wiki-*') {
        $previous.augments | Where-Object { $_.id -eq $entry.id }
        continue
    }
    $original = $byId[[string]$entry.id]
    if (-not $original -or -not $original.desc) { throw "Missing augment description: $($entry.id)" }
    $text = [string]$original.desc
    if ($text -match 'Cherry_') { $text = [string]$original.tooltip }
    $text = $text -replace '\{\{\s*Item_Keyword_OnHit\s*\}\}', '적중 시'
    $unresolved = [Collections.Generic.List[string]]::new()
    $text = [regex]::Replace($text, '@([^@]+)@', {
        param($match)
        $token = $match.Groups[1].Value
        $parts = [regex]::Match($token, '^(\w+)(?:\*([0-9.]+))?$')
        $value = if ($parts.Success) { $original.dataValues.PSObject.Properties[$parts.Groups[1].Value] } else { $null }
        if ($null -ne $value) {
            $factor = if ($parts.Groups[2].Success) { [double]::Parse($parts.Groups[2].Value,[Globalization.CultureInfo]::InvariantCulture) } else { 1 }
            $numbers = @($value.Value | ForEach-Object { [math]::Round(([double]$_ * $factor),3) } | Select-Object -Unique)
            return ($numbers -join ' / ')
        }
        $unresolved.Add($token)
        return '(상황에 따라 변동)'
    })
    $text = $text -replace '\{\{[^}]+\}\}', '(팀 구성에 따라 효과가 달라집니다)' -replace '%i:[^%]+%', '' -replace '(?i)<br\s*/?>', "`n" -replace '<[^>]+>', ''
    [ordered]@{id=$entry.id;name=$original.name;icon="imgs/augments/$($entry.icon)";rarity=$entry.rarity;stats='';effects=[Net.WebUtility]::HtmlDecode($text).Trim();descriptionHtml=$original.desc;tooltipHtml=$original.tooltip;dataValues=$original.dataValues;unresolvedTokens=@($unresolved)}
}
$db = [ordered]@{locale='ko_KR';updatedAtUtc=[DateTime]::UtcNow.ToString('o');source=$source;augments=@($rows)}
$db | ConvertTo-Json -Depth 15 | Set-Content (Join-Path $root 'data/augment-descriptions.ko.json') -Encoding utf8NoBOM
Write-Host "Saved $(@($rows).Count) Korean augment descriptions."
node (Join-Path $PSScriptRoot 'apply-augment-wiki.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Failed to apply wiki augment overlay.' }
