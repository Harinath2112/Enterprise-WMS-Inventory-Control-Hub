#!/usr/bin/env bash
# Starts the IMS React frontend on http://localhost:5174
cd "$(dirname "$0")"
[ -d node_modules ] || npm install
npm run dev
