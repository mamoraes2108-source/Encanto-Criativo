@echo off
setlocal
cd /d "%~dp0"
call node scripts\backup.js create
if errorlevel 1 (pause & exit /b 1)
echo Copie o ZIP criado em data\backups para um local privado fora desta pasta.
echo Para testar a restauracao, use o menu Backup e restauracao no sistema.
pause
