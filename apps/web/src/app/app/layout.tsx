"use client";

import { ActiveWorkspaceProvider } from "@/contexts/ActiveWorkspaceContext";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ActiveWorkspaceProvider>{children}</ActiveWorkspaceProvider>;
}
