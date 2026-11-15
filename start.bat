@echo off
rem Double-click this file to start the Crew Health tablet. It opens in your browser by itself.
cd /d "%~dp0"
python run.py %*
rem If the "python" command is not found, try the Python launcher that the Windows installer adds.
if errorlevel 9009 py run.py %*
if errorlevel 1 pause
