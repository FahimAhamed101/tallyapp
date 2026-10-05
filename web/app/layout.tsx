import type { Metadata } from 'next';
import './globals.css';
import StoreProvider from '@/store/StoreProvider';

export const metadata: Metadata = {
  title: 'টালিখাতা অ্যাডমিন',
  description:
    'TallyKhata clone — Next.js API + superadmin panel. Every endpoint of the Android backend, reimplemented as App Router route handlers.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn">
      <body>
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
