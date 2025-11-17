@echo off
REM Script para verificar y resetear usuarios
REM Ejecutar desde la carpeta backend/

echo ================================================
echo SOLUCIONAR PROBLEMA DE LOGIN
echo ================================================
echo.

if not exist "manage.py" (
    echo ERROR: Ejecuta este script desde la carpeta backend/
    pause
    exit /b 1
)

:menu
echo.
echo Que deseas hacer?
echo.
echo 1. Verificar usuarios y probar contraseña
echo 2. Resetear contraseña de un usuario
echo 3. Ver logs del servidor
echo 4. Salir
echo.
set /p option="Elige una opcion (1-4): "

if "%option%"=="1" goto check
if "%option%"=="2" goto reset
if "%option%"=="3" goto logs
if "%option%"=="4" goto end

echo Opcion invalida
goto menu

:check
echo.
echo ================================================
echo VERIFICANDO USUARIOS...
echo ================================================
echo.
python Scripts\check_users.py
pause
goto menu

:reset
echo.
echo ================================================
echo RESETEAR CONTRASEÑA
echo ================================================
echo.
python Scripts\reset_password.py
pause
goto menu

:logs
echo.
echo ================================================
echo ULTIMOS LOGS DEL SERVIDOR
echo ================================================
echo.
echo Buscando errores de autenticacion...
echo.
findstr /C:"Unauthorized" /C:"401" /C:"login" nul 2>nul
if errorlevel 1 (
    echo No se encontraron logs recientes
) else (
    echo Ver la consola del servidor Django para mas detalles
)
echo.
pause
goto menu

:end
echo.
echo Saliendo...
exit /b 0
