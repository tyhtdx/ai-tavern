@echo off
pushd %~dp0

echo Testing Google AI API with cURL...
echo If you see a list of models (like gemini-pro), the test is successful.
echo =======================================================================

rem The -k flag is the same as NODE_TLS_REJECT_UNAUTHORIZED=0
rem The -v flag provides verbose output for debugging
curl -v -k --proxy http://127.0.0.1:10808 "https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyDfKmIezjuiN6MCl_-2FukFyNzxh6r6SHY"

echo =======================================================================
echo Test finished.
pause
popd