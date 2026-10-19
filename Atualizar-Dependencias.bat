@echo off
setlocal
cd /d "%~dp0"
echo Antes de continuar, pare o sistema com Ctrl+C na outra janela.
echo Este arquivo nao baixa codigo nem substitui o banco.
pause
if exist data\encanto.sqlite (
 call node scripts\backup.js create
 if errorlevel 1 (
  echo Backup falhou. Atualizacao interrompida. Nao apague a pasta data.
  pause
  exit /b 1
 )
)
call npm ci
if errorlevel 1 (pause & exit /b 1)
call npm test
if errorlevel 1 (pause & exit /b 1)
echo Dependencias atualizadas e testes aprovados. Abra Iniciar-Encanto.bat.
pause
