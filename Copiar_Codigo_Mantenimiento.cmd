@echo off
powershell -Command "Get-Content 'C:\Tienda_lismar\cloudflare_worker_mantenimiento.js' -Raw -Encoding UTF8 | Set-Clipboard"
echo.
echo ============================================================
echo  CODIGO COPIADO AL PORTAPAPELES CON EXITO!
echo  Solo ve a Cloudflare y presiona: Ctrl + V
echo ============================================================
echo.
pause
