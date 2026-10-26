@echo off
setlocal
cd /d "%~dp0"
echo Pare o sistema antes de continuar. Nao ha importacao de pedidos.
node scripts\limpar-demonstracao.js
if errorlevel 1 echo Operacao nao concluida. Preserve os arquivos e leia a mensagem acima.
pause
