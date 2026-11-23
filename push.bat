@echo off
title Push LabFlow to GitHub
cd /d "%~dp0"
echo ======================================================================
echo    PUSHING LABFLOW TO GITHUB REPOSITORY
echo    Repository: https://github.com/M-R-YOGANANDA/dsael.git
echo    Branch:     main
echo    Commit:     version 1
echo ======================================================================
echo.
git push -u origin main
echo.
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Project successfully pushed to GitHub!
) else (
    echo [INFO] If prompted above, please sign in via your browser or provide your GitHub Personal Access Token.
)
echo.
pause
