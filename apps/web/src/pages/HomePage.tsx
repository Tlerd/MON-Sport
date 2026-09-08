import { vi } from '../i18n/vi';

export function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 bg-slate-50 text-slate-900">
      <h1 className="text-3xl font-bold">{vi.appTitle}</h1>
      <p className="text-slate-600">{vi.appTagline}</p>
    </main>
  );
}
