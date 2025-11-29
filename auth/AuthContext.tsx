"use client";

import {
  ReactNode,
  useState,
  useEffect,
  createContext,
  useContext,
} from "react";
import type { AuthUser } from "@/lib/api/auth";
import { fetchMe } from "@/lib/api/auth";
import { setAuthToken } from "@/lib/api/http";

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: Error | null;
}

interface AuthContextValue extends AuthState {
  loginWithToken(token: string, user: AuthUser): void;
  logout(): void;
}

const TOKEN_STORAGE_KEY = "lune.auth.token";
const USER_STORAGE_KEY = "lune.auth.user";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function loadStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const token = typeof window !== "undefined"
      ? window.localStorage.getItem(TOKEN_STORAGE_KEY)
      : null;
    const storedUser = loadStoredUser();

    if (token) {
      setAuthToken(token);
    }

    if (!token) {
      setLoading(false);
      return;
    }

    // Optimistically set stored user
    if (storedUser) {
      setUser(storedUser);
    }

    const validateSession = async () => {
      try {
        const me = await fetchMe();
        setUser(me);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(me));
        }
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to load session"));
        handleLogout();
      } finally {
        setLoading(false);
      }
    };

    validateSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      window.localStorage.removeItem(USER_STORAGE_KEY);
    }
    setAuthToken(null);
    setUser(null);
    setError(null);
  };

  const loginWithToken = (token: string, authUser: AuthUser) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
      window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(authUser));
    }
    setAuthToken(token);
    setUser(authUser);
    setError(null);
    setLoading(false);
  };

  const value: AuthContextValue = {
    user,
    loading,
    error,
    loginWithToken,
    logout: handleLogout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
}
