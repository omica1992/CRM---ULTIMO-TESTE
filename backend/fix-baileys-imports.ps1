# Script para substituir todos os imports de 'baileys' por '@whiskeysockets/baileys'

$files = Get-ChildItem -Path "src" -Recurse -Include *.ts,*.tsx,*.js,*.jsx

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    if ($content -match 'from "baileys"' -or $content -match "from 'baileys'") {
        Write-Host "Corrigindo: $($file.FullName)"
        $content = $content -replace 'from "baileys"', 'from "@whiskeysockets/baileys"'
        $content = $content -replace "from 'baileys'", "from '@whiskeysockets/baileys'"
        Set-Content -Path $file.FullName -Value $content -NoNewline
    }
}

Write-Host "`n✅ Todos os imports de baileys foram corrigidos!"
