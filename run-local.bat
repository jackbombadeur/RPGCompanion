@echo off
echo SESSION_SECRET=demo-secret-key > .env
echo NODE_ENV=development >> .env
echo Starting Nerve Combat TTRPG...
echo Reading environment from .env file...
node_modules\.bin\tsx server\index.ts
pause