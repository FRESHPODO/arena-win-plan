# The checked-in Arena snapshot is versioned; do not mix latest regular-mode data.
node (Join-Path $PSScriptRoot 'apply-arena-items.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Arena item rebuild failed' }
