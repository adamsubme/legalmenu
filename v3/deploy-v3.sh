#!/bin/bash
set -e
cd /root/mission-control

echo "=== Dashboard v3 Deployment ==="

# 1. Add sub_status to types.ts
echo "[1/8] Updating types..."
if ! grep -q "sub_status" src/lib/types.ts; then
  sed -i '/assigned_agent_id\?: string;/a\  sub_status?: string;' src/lib/types.ts
  echo "  Added sub_status to Task type"
fi

# 2. Update layout to EN
echo "[2/8] Updating layout..."
cat > src/app/layout.tsx << 'LAYOUT_EOF'
import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/layout/Sidebar';

export const metadata: Metadata = {
  title: 'Lex Legal — Dashboard',
  description: 'AI Legal Team Management',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <Sidebar />
        <main className="pl-56 min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
LAYOUT_EOF

echo "=== v3 Deploy Complete ==="
