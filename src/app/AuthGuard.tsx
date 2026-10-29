'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const isAuth = localStorage.getItem('inv_auth') === 'true';
    if (!isAuth && !isLoginPage) {
      router.replace('/login');
    } else {
      setChecked(true);
    }
  }, [pathname, router, isLoginPage]);

  // Login page: render immediately without auth check spinner
  if (isLoginPage) {
    return <>{children}</>;
  }

  if (!checked) {
    return (
      <div className="flex items-center justify-center h-screen w-full bg-slate-900">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return <>{children}</>;
}
