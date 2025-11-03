# Script para actualizar rutas de dashboard-admin a dashboard-propietario
# y dashboard-empleado a dashboard-profesional

$propietarioPath = "C:\Users\ivang\Beautiful-Studio\frontend\src\app\dashboard-propietario"
$profesionalPath = "C:\Users\ivang\Beautiful-Studio\frontend\src\app\dashboard-profesional"

Write-Host "Actualizando rutas en dashboard-propietario..." -ForegroundColor Yellow

# Actualizar todas las referencias en archivos .tsx del dashboard-propietario
Get-ChildItem -Path $propietarioPath -Filter *.tsx -Recurse | ForEach-Object {
    $file = $_
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $newContent = $content -replace '/dashboard-propietario', '/dashboard-propietario'
    
    if ($content -ne $newContent) {
        [System.IO.File]::WriteAllText($file.FullName, $newContent, [System.Text.Encoding]::UTF8)
        Write-Host "  ✓ Actualizado: $($file.Name)" -ForegroundColor Green
    }
}

Write-Host "`nActualizando rutas en dashboard-profesional..." -ForegroundColor Yellow

# Actualizar todas las referencias en archivos .tsx del dashboard-profesional
Get-ChildItem -Path $profesionalPath -Filter *.tsx -Recurse | ForEach-Object {
    $file = $_
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $newContent = $content -replace '/dashboard-empleado', '/dashboard-profesional'
    
    if ($content -ne $newContent) {
        [System.IO.File]::WriteAllText($file.FullName, $newContent, [System.Text.Encoding]::UTF8)
        Write-Host "  ✓ Actualizado: $($file.Name)" -ForegroundColor Green
    }
}

Write-Host "`n✅ Actualización completada!" -ForegroundColor Green
