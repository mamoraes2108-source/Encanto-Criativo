@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
 echo Instale o Node.js 24 pelo site oficial e abra este arquivo novamente.
 pause
 exit /b 1
)
node -e "if(process.versions.node.split('.')[0]!=='24'){console.error('Use Node.js 24.');process.exit(1)}"
if errorlevel 1 (pause & exit /b 1)
if not exist node_modules\express\package.json (
 call npm ci
 if errorlevel 1 (pause & exit /b 1)
)
echo Abra seu navegador e digite: http://127.0.0.1:3000
echo Mantenha esta janela aberta. Para parar, pressione Ctrl+C.
call npm start
pause
