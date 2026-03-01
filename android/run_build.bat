@echo off
set "JAVA_HOME=C:\Users\bmokoka\.jdks\temurin-21\jdk-21.0.6+7"
set "PATH=%JAVA_HOME%\bin;%PATH%"
echo Using JAVA_HOME: %JAVA_HOME%
call gradlew.bat %*
