/**
 * Cliente de Supabase para frontend (Auth y posibles features de Storage/Realtime).
 * El backend corre por separado en server/ y usa Prisma contra Postgres (Supabase).
 * Si no hay URL/key en .env, no se crea el cliente (evita pantalla en blanco).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();
const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export { isSupabaseConfigured };
