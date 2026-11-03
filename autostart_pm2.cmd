@echo off
set PATH=C:\Program Files\nodejs;%APPDATA%\npm;C:\Tienda_lismar;%PATH%
cd /d C:\Tienda_lismar
call pm2 resurrect
