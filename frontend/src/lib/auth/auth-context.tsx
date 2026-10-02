"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isCustomer } from "@/lib/utils/auth-helpers";

interface AuthContextValue {
  user: User | null;
  isCustomerUser: boolean;
  loading: boolean;
  refreshAuth: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isCustomerUser: false,
  loading: true,
  refreshAuth: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);
  const lastPathnameRef = useRef(pathname);

  const syncUser = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!isMountedRef.current) return;
      setUser(currentUser);
    } catch {
      if (isMountedRef.current) {
        setUser(null);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    const supabase = createClient();

    // 1. Initial user check
    syncUser();

    // 2. Real-time auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMountedRef.current) return;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // 3. Window focus sync for multi-tab consistency
    const handleWindowFocus = () => {
      if (isMountedRef.current) {
        void syncUser();
      }
    };
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      isMountedRef.current = false;
      subscription?.unsubscribe();
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [syncUser]);

  // 4. Re-sync user on route transitions (e.g. after server action redirect from /login or /signup)
  useEffect(() => {
    if (lastPathnameRef.current !== pathname) {
      lastPathnameRef.current = pathname;
      void syncUser();
    }
  }, [pathname, syncUser]);

  const signOut = useCallback(async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      if (isMountedRef.current) {
        setUser(null);
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("Sign out error:", err);
    }
  }, [router]);

  const isCustomerUser = isCustomer(user);

  return (
    <AuthContext.Provider
      value={{
        user,
        isCustomerUser,
        loading,
        refreshAuth: syncUser,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
