"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDefaultWorkspace, ApiError } from "@/lib/api";

export function useDefaultWorkspace(): {
  workspaceId: string | null;
  role: string | null;
  loading: boolean;
  error: string | null;
} {
  const router = useRouter();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDefaultWorkspace()
      .then((data) => {
        setWorkspaceId(data.workspaceId);
        setRole(data.role ?? null);
        setError(null);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load workspace");
      })
      .finally(() => setLoading(false));
  }, [router]);

  return { workspaceId, role, loading, error };
}
