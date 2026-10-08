@echo off
REM Starts the IMS React frontend on http://localhost:5174
cd /d "%~dp0"
if not exist node_modules ( call npm install )
call npm run dev
