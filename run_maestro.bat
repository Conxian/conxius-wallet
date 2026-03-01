@echo off
REM Maestro Helper Script
REM Adjust JAVA_HOME if it's not already set in your environment

if "%JAVA_HOME%"=="" (
    echo [WARNING] JAVA_HOME is not set. Maestro requires JDK 21+.
    echo [INFO] Attempting to find default JDK...
    set "JAVA_HOME=C:\Program Files\Java\jdk-21"
)

set "PATH=%JAVA_HOME%\bin;%USERPROFILE%\.maestro\maestro\bin;%PATH%"

echo [MAESTRO] Using JAVA_HOME: %JAVA_HOME%
call maestro.bat %*
