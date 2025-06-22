@echo off
echo SESSION_SECRET=demo-secret-key > .env
echo Starting Nerve Combat TTRPG...
set NODE_ENV=development
node_modules\.bin\tsx server\index.ts
pause