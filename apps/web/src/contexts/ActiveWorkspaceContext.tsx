"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  getWorkspaces,
  getDefaultWorkspace,
  WorkspaceItem,
  ApiError,
} from "@/lib/api";

const ACTIVE_WORKSPACE_KEY = "active-workspace-id";

interface ActiveWorkspaceContextValue {
  workspaces: WorkspaceItem[];
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string) => void;
  defaultWorkspaceId: string | null;
  defaultWorkspaceRole: string | null;
  isSupportAgent: boolean;
  loading: boolean;
  error: string | null;
}

const ActiveWorkspaceContext = createContext<ActiveWorkspaceContextValue | null>(
  null
);

export function ActiveWorkspaceProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(
    () =>
      typeof window !== "undefined"
        ? sessionStorage.getItem(ACTIVE_WORKSPACE_KEY)
        : null
  );
  const [defaultWorkspaceId, setDefaultWorkspaceId] = useState<string | null>(
    null
  );
  const [defaultWorkspaceRole, setDefaultWorkspaceRole] = useState<string | null>(null);
  const [isSupportAgent, setIsSupportAgent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDefaultWorkspace()
      .then((data) => {
        setDefaultWorkspaceId(data.workspaceId);
        setDefaultWorkspaceRole(data.role ?? null);
        const agent = data.isSupportAgent ?? false;
        setIsSupportAgent(agent);
        if (!agent) {
          setWorkspaces([
            {
              id: data.workspaceId,
              name: data.name,
              kind: "CUSTOMER",
              domain: null,
              role: data.role,
            },
          ]);
          setActiveWorkspaceIdState(data.workspaceId);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load workspace");
        setLoading(false);
      });
  }, [router]);

  useEffect(() => {
    if (!isSupportAgent || defaultWorkspaceId === null) return;
    getWorkspaces()
      .then((data) => {
        setWorkspaces(data.workspaces);
        if (data.workspaces.length > 0) {
          const saved = sessionStorage.getItem(ACTIVE_WORKSPACE_KEY);
          const validSaved =
            saved && data.workspaces.some((w) => w.id === saved);
          const supportOps = data.workspaces.find((w) => w.kind === "SUPPORT_OPS");
          const defaultId = supportOps?.id ?? data.workspaces[0].id;
          if (validSaved) {
            setActiveWorkspaceIdState(saved);
          } else {
            setActiveWorkspaceIdState(defaultId);
            sessionStorage.setItem(ACTIVE_WORKSPACE_KEY, defaultId);
          }
        }
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load workspaces");
      })
      .finally(() => setLoading(false));
  }, [router, isSupportAgent, defaultWorkspaceId]);

  const setActiveWorkspaceId = useCallback((id: string) => {
    setActiveWorkspaceIdState(id);
    sessionStorage.setItem(ACTIVE_WORKSPACE_KEY, id);
  }, []);

  const value: ActiveWorkspaceContextValue = {
    workspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    defaultWorkspaceId,
    defaultWorkspaceRole,
    isSupportAgent,
    loading,
    error,
  };

  return (
    <ActiveWorkspaceContext.Provider value={value}>
      {children}
    </ActiveWorkspaceContext.Provider>
  );
}

export function useActiveWorkspace(): ActiveWorkspaceContextValue {
  const ctx = useContext(ActiveWorkspaceContext);
  if (!ctx) {
    throw new Error("useActiveWorkspace must be used within ActiveWorkspaceProvider");
  }
  return ctx;
}
