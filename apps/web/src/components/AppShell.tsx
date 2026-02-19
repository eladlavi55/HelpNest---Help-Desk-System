import type { ReactNode } from "react";
import { AppHeader } from "./AppHeader";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
