@echo off
set "JAVA_HOME=C:\Users\bmokoka\.jdks\temurin-17\jdk-17.0.17+10"
set "PATH=%JAVA_HOME%\bin;C:\Users\bmokoka\.maestro\maestro\bin;%PATH%"
call maestro.bat %*
