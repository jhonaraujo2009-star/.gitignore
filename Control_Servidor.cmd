@echo off
title Control del Servidor - Luckathys Shop
color 0B
set PATH=C:\Program Files\nodejs;%APPDATA%\npm;C:\Tienda_lismar;%USERPROFILE%\.local\mingit\cmd;%PATH%

:menu
cls
echo ============================================================
echo           LUCKATHYS SHOP - CONTROL DEL SERVIDOR
echo                   https://lkth91ofertas.com
echo ============================================================
echo.
echo  Estado actual de los procesos:
echo  ------------------------------------------------------------
call pm2 status
echo  ------------------------------------------------------------
echo.
echo  Opciones:
echo   [1] REINICIAR TODO (Tienda + Tunel)
echo   [2] ENCENDER TODO
echo   [3] APAGAR TODO (Detener temporalmente)
echo   [4] ABRIR TIENDA EN EL NAVEGADOR
echo   [5] SALIR
echo.
set /p op="Elige una opcion (1-5): "

if "%op%"=="1" (
    echo.
    echo Reiniciando servicios...
    cd /d C:\Tienda_lismar
    call pm2 restart all
    call pm2 save
    pause
    goto menu
)
if "%op%"=="2" (
    echo.
    echo Encendiendo servicios...
    cd /d C:\Tienda_lismar
    call pm2 start all
    call pm2 save
    pause
    goto menu
)
if "%op%"=="3" (
    echo.
    echo Apagando servicios...
    call pm2 stop all
    pause
    goto menu
)
if "%op%"=="4" (
    start https://lkth91ofertas.com
    goto menu
)
if "%op%"=="5" exit
goto menu
