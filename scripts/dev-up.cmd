@echo off
rem CamerMove launcher - routes to Git Bash explicitly because the WSL 'bash'
rem stub on PATH often has no distro installed.
set "BASH_EXE=C:\Program Files\Git\bin\bash.exe"
if not exist "%BASH_EXE%" set "BASH_EXE=%ProgramFiles%\Git\usr\bin\bash.exe"
if not exist "%BASH_EXE%" (
  echo [dev-up] ERROR: Git Bash not found - install Git for Windows.
  exit /b 1
)
"%BASH_EXE%" "%~dp0dev-up.sh" %*
