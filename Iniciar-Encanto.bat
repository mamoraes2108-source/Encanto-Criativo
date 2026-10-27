@echo off
setlocal
cd /d "%~dp0"
if not defined DATA_DIR set "DATA_DIR=%~dp0data"
if not exist "%DATA_DIR%\encanto.sqlite" (
 echo Banco anterior nao encontrado nesta pasta nova.
 echo Pare o sistema e copie a pasta data INTEIRA da instalacao anterior.
 echo Nenhum banco ficticio sera criado por este atalho.
 pause
 exit /b 1
)
where node >nul 2>&1
if errorlevel 1 (
 echo Instale o Node.js 24 pelo site oficial e abra este arquivo novamente.
 pause
 exit /b 1
)
node -e "if(process.versions.node.split('.')[0]!=='24'){console.error('Use Node.js 24.');process.exit(1)}"
if errorlevel 1 (pause & exit /b 1)
if not exist node_modules\pdfkit\package.json (
 call npm ci
 if errorlevel 1 (pause & exit /b 1)
)
echo Abra seu navegador e digite: http://127.0.0.1:3000
echo Mantenha esta janela aberta. Para parar, pressione Ctrl+C.
call npm start
pause
