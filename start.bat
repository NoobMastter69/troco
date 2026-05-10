@echo off
echo Iniciando Troco...
start "Troco Server" /min cmd /c "node server.js"
timeout /t 2 /nobreak >nul
start "Troco Client" /min cmd /c "cd client && npm run dev"
timeout /t 4 /nobreak >nul
echo.
echo Servidor: http://localhost:3001
echo Cliente:  http://localhost:5173
echo.
start http://localhost:5173
echo Pressione qualquer tecla para encerrar tudo...
pause >nul
taskkill /f /im node.exe >nul 2>&1
