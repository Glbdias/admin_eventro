.PHONY: install dev clean

install:
	@if not exist ".env.local" copy /Y ".env.example" ".env.local"
	npm install

dev:
	if exist .next rmdir /S /Q .next
	npm run build && npm run start -- --port 3001

clean:
	powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -Recurse -Force -Directory -Include .next,node_modules | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue"
