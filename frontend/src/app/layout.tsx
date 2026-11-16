import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '../components/Providers';
import { Sidebar } from '../components/Sidebar';
import { Topbar } from '../components/Topbar';

export const metadata: Metadata = {
  title: 'Messaging Platform - Multi-Tenant Admin',
  description: 'Multi-Tenant Messaging Platform with Webhook Simulator and Concurrency Safety',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full bg-slate-50">
      <body className="h-full flex text-slate-900 antialiased font-sans bg-slate-50">
        <Providers>
          <div className="flex h-full w-full overflow-hidden bg-slate-50">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
              <Topbar />
              <main className="flex-1 overflow-y-auto p-6 lg:p-8 bg-slate-50">
                <div className="max-w-7xl mx-auto space-y-6">{children}</div>
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
