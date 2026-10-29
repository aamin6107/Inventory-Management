import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function checkConnectivity(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1500);

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'GET',
      headers: {
        apikey: supabaseAnonKey,
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return res.ok || res.status === 401; // 401 Unauthorized means the server is reachable and active
  } catch (err) {
    clearTimeout(timeoutId);
    return false;
  }
}