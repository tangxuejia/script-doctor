'use client';

import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  userId: string | null;
  email: string | null;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthState>({
  user: null, userId: null, email: null,
  loading: true, error: null,
});

export function useAuth() {
  return useContext(AuthContext);
}

/**
 * AuthProvider — 全局认证状态管理。
 *
 * 页面加载时从 localStorage 恢复 Supabase session。
 * 所有子组件通过 useAuth() 获取当前用户状态。
 * 这样 analyzeScript 不需要自己调 getUser/getSession。
 */
export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({
    user: null, userId: null, email: null,
    loading: true, error: null,
  });
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    let cancelled = false;

    async function initAuth() {
      try {
        // 先触发 session 从 localStorage 恢复
        const { data: { session } } = await supabase.auth.getSession();

        if (cancelled) return;

        if (session?.user) {
          setAuth({
            user: session.user,
            userId: session.user.id,
            email: session.user.email ?? null,
            loading: false,
            error: null,
          });
        } else {
          setAuth({
            user: null, userId: null, email: null,
            loading: false,
            error: null,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setAuth({
            user: null, userId: null, email: null,
            loading: false,
            error: `认证初始化失败: ${(err as Error).message}`,
          });
        }
      }
    }

    initAuth();

    // 监听后续认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setAuth({
            user: session.user,
            userId: session.user.id,
            email: session.user.email ?? null,
            loading: false,
            error: null,
          });
        } else {
          setAuth({
            user: null, userId: null, email: null,
            loading: false,
            error: null,
          });
        }
      },
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}
