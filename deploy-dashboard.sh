#!/bin/bash
set -e

MC_DIR="/root/mission-control"

echo "[1/6] Installing new dependencies..."
cd "$MC_DIR"
npm install --save tailwind-merge class-variance-authority 2>/dev/null || true

echo "[2/6] Backing up existing files..."
cp -r src/app/page.tsx src/app/page.tsx.bak 2>/dev/null || true
cp -r src/app/layout.tsx src/app/layout.tsx.bak 2>/dev/null || true
cp -r src/app/globals.css src/app/globals.css.bak 2>/dev/null || true

echo "[3/6] Deploying new UI components..."
mkdir -p src/components/ui
mkdir -p src/components/layout

echo "[4/6] Creating page directories..."
mkdir -p src/app/cases
mkdir -p src/app/agents
mkdir -p src/app/escalations
mkdir -p src/app/costs
mkdir -p src/app/knowledge
mkdir -p "src/app/case/[id]"

echo "[5/6] Files ready for copy"
echo "[6/6] Rebuild will happen after file copy"
