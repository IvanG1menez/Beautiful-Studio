@echo off
REM Script para probar los endpoints de completar turnos masivo
REM Requiere tener el servidor Django corriendo en http://127.0.0.1:8000

echo ================================================
echo PRUEBAS - COMPLETAR TURNOS MASIVO
echo ================================================
echo.

REM Verificar que estamos en el directorio correcto
if not exist "manage.py" (
    echo ERROR: Ejecuta este script desde la carpeta backend/
    pause
    exit /b 1
)

echo [1/3] Verificando que el servidor Django esta corriendo...
curl -s http://127.0.0.1:8000/api/ >nul 2>&1
if errorlevel 1 (
    echo ERROR: El servidor Django no esta corriendo
    echo Por favor ejecuta: python manage.py runserver
    pause
    exit /b 1
)
echo OK - Servidor corriendo

echo.
echo [2/3] Configuracion del token...
echo IMPORTANTE: Debes editar el archivo Scripts/test_completar_turnos_masivo.py
echo y agregar tu TOKEN de profesional en la linea 9
echo.
echo Para obtener el token:
echo   1. Ve a http://127.0.0.1:8000/admin/authtoken/tokenproxy/
echo   2. Busca el usuario profesional
echo   3. Copia el token
echo   4. Pega el token en Scripts/test_completar_turnos_masivo.py
echo.
set /p continuar="Has configurado el token? (s/n): "
if /i not "%continuar%"=="s" (
    echo Cancelado por el usuario
    pause
    exit /b 0
)

echo.
echo [3/3] Ejecutando tests...
python Scripts\test_completar_turnos_masivo.py

echo.
echo ================================================
echo PRUEBAS COMPLETADAS
echo ================================================
pause
