"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Proyecto Supabase "Marea". La URL y la llave publicable son públicas por diseño
 * (la seguridad la dan las políticas RLS y las funciones de la base), así que pueden
 * vivir en el código. Se pueden sobrescribir con variables de entorno.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://xdojstptndarxjprxyna.supabase.co";
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_CsUqelArcLPGvBB5QwpxKg_ElhzWZmO";

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, detectSessionInUrl: true } });
  return client;
}
