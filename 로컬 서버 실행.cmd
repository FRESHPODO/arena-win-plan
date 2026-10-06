@echo off
cd /d "%~dp0"
title Arena Local Server
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-local-server.ps1"
