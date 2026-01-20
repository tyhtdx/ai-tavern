@echo off
pushd %~dp0
set NODE_ENV=production
call npm install --no-audit --no-fund --loglevel=error --no-progress --omit=dev
set HTTP_PROXY=http://127.0.0.1:10808
set HTTPS_PROXY=http://127.0.0.1:10808
set NODE_TLS_REJECT_UNAUTHORIZED=0
node server.js %*
pause
popd
