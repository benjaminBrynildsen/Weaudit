/**
 * Auth hooks.
 *
 * useAuth() → { user, isLoading, isAuthenticated }
 *   Fetches /auth/me. Returns null for user if unauthenticated rather than
 *   throwing — lets the app render a login page without redirect loops.
 *
 * useLogout() → mutation, clears session + redirects to /login.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  picture?: string;
}

export function useAuth() {
  const { data, isLoading } = useQuery<AuthUser | null>({
    queryKey: ["/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 1000 * 60 * 5, // 5 min — avoid hammering /auth/me on every nav
  });

  return {
    user: data ?? null,
    isLoading,
    isAuthenticated: !!data,
  };
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("logout failed");
      return res.json();
    },
    onSuccess: () => {
      // Clear every cached query — we're logging out, nothing we have is
      // still authoritative. Redirect happens via caller.
      qc.clear();
    },
  });
}
