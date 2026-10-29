// /Users/aaminarsath/Desktop/Whouse/src/app/not-found.tsx
'use client';

import Link from 'next/link';

export default function GlobalNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] p-8 text-center animate-in fade-in duration-500">
      {/* Visual Indicator */}
      <div className="w-24 h-24 bg-slate-100 rounded-3xl flex items-center justify-center text-5xl mb-8 shadow-inner border border-slate-200">
        🚧
      </div>

      {/* Error Message */}
      <div className="space-y-3 mb-10">
        <h2 className="text-4xl font-black text-slate-900 italic tracking-tighter">404 - Entry Not Found</h2>
        <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">System Routing Error</p>
        <p className="text-slate-500 max-w-sm mx-auto font-medium">
          The ledger entry or page you are looking for does not exist in the current warehouse database.
        </p>
      </div>

      {/* Action Button */}
      <Link
        href="/"
        className="bg-emerald-600 hover:bg-emerald-700 text-white px-10 py-3.5 rounded-full font-black text-sm shadow-xl shadow-emerald-100 transition-all active:scale-95"
      >
        Return to Dashboard
      </Link>
    </div>
  );
}
