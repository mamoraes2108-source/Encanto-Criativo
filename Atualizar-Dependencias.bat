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
echo Pare o sistema com Ctrl+C antes de continuar.
echo Execute na pasta NOVA, com a copia completa da pasta data anterior.
echo Este assistente nao importa pedidos nem executa limpeza.
pause
where node >nul 2>&1
if errorlevel 1 (
 echo Instale Node.js 24 pelo site oficial.
 pause
 exit /b 1
)
node -e "if(process.versions.node.split('.')[0]!=='24')process.exit(1)"
if errorlevel 1 (
 echo Esta versao requer Node.js 24.
 pause
 exit /b 1
)
rem Instalar dependencias nao abre nem altera o banco de dados.
call npm ci
if errorlevel 1 (pause & exit /b 1)
if not defined DATA_DIR set "DATA_DIR=%~dp0data"
if exist "%DATA_DIR%\encanto.sqlite" (
 call node scripts\backup.js create "%DATA_DIR%"
 if errorlevel 1 (
  echo Backup falhou. Nao inicie o sistema; preserve a pasta anterior.
  pause
  exit /b 1
 )
)
call npm test
if errorlevel 1 (
 echo Verificacao automatica falhou. Preserve a versao anterior.
 pause
 exit /b 1
)
echo Versao 3.0 preparada. Abra Iniciar-Encanto.bat.
echo Nenhum pedido foi importado ou limpo.
pause
