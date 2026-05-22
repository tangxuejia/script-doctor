'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * AuthProvider — 确保 Supabase 认证状态在页面加载后正确初始化。
 *
 * 在静态导出模式（GitHub Pages）下，页面是完全的客户端渲染，
 * Supabase 的 session 需要从 localStorage/cookie 中恢复。
 * onAuthStateChange 监听器确保在 getUser() 被调用前，
 * 客户端已完成认证状态的初始化。
 */
export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // 监听认证状态变化，确保 session 被正确加载
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, _session) => {
        // 认证状态已同步到内存，getUser() 现在可以正常工作
      },
    );

    // 触发初始 session 加载
    supabase.auth.getSession().catch(() => {
      // 静默处理 — 用户可能未登录，这是正常的
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return <>{children}</>;
}
