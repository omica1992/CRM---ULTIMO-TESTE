# Script para remover provider === "beta" da detecção de API Oficial

$files = Get-ChildItem -Path "src" -Recurse -Include *.ts,*.tsx

$pattern = 'whatsapp\.provider === "beta" \|\|\s+'
$replacement = ''

$pattern2 = 'whatsapp\.provider === "beta" \|\|'  
$replacement2 = ''

$pattern3 = 'provider === "beta" \|\|\s+'
$replacement3 = ''

$pattern4 = 'provider === "beta" \|\|'
$replacement4 = ''

$count = 0

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    
    # Remover todas as variações
    $content = $content -replace $pattern, $replacement
    $content = $content -replace $pattern2, $replacement2
    $content = $content -replace $pattern3, $replacement3
    $content = $content -replace $pattern4, $replacement4
    
    if ($content -ne $originalContent) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        Write-Host "Corrigido: $($file.FullName)"
        $count++
    }
}

Write-Host "`n✅ Total de arquivos corrigidos: $count"
