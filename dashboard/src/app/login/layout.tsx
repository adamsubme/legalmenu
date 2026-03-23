import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login — Lex Legal',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
