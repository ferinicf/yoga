"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useCurrentUser, useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { cancelAllReminders } from "@/lib/native";
import { toast } from "@/components/toast";
import { Button, Card, Field, Input } from "@/components/ui";

const CONFIRM_WORD = "ELIMINAR";

/** Qué pasa al eliminar la cuenta (mismo comportamiento que supabase/migrations/0008_eliminar_cuenta.sql). */
const CONSECUENCIAS = [
  "Se borran tu nombre, correo, teléfono y cumpleaños, y ya no podrás iniciar sesión.",
  "Se cancelan tus reservaciones y tus lugares en lista de espera de clases que aún no empiezan, sin devolver los créditos.",
  "Pierdes tus paquetes y los créditos que te queden.",
  "El estudio conserva el registro de tus compras y asistencias, ya sin tus datos personales, para su contabilidad.",
];

/** Quita la sesión guardada de Supabase aunque el servidor ya no reconozca al usuario. */
function clearStoredSession() {
  try {
    for (const k of Object.keys(localStorage)) if (/^sb-.+-auth-token/.test(k)) localStorage.removeItem(k);
  } catch {
    // Almacenamiento no disponible: no hay nada que limpiar.
  }
}

/**
 * Eliminar la cuenta desde la app (App Store 5.1.1(v) y Google Play). Va al final de Mi perfil.
 * La confirmación es en la misma página: hay que escribir ELIMINAR.
 */
export function DeleteAccount() {
  const user = useCurrentUser();
  const isLive = useStore((s) => s.mode) === "live";
  const logout = useStore((s) => s.logout);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const confirmed = word.trim().toUpperCase() === CONFIRM_WORD;

  if (!user) return null;

  const remove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmed || busy) return;
    setBusy(true);
    let message = "No pudimos eliminar tu cuenta. Inténtalo más tarde o pide ayuda en recepción.";
    try {
      const { data, error } = await supabase().rpc("delete_my_account");
      const r = data as { ok?: boolean; message?: string } | null;
      if (!error && r?.ok) {
        await cancelAllReminders();
        await logout().catch(() => {});
        clearStoredSession();
        toast(r.message || "Tu cuenta fue eliminada.");
        router.replace("/");
        return;
      }
      if (error && /fetch|network/i.test(error.message)) message = "Sin conexión con el servidor. Revisa tu internet.";
      else if (r?.message) message = r.message;
    } catch {
      message = "Sin conexión con el servidor. Revisa tu internet.";
    }
    setBusy(false);
    toast(message, false);
  };

  return (
    <section aria-labelledby="eliminar-cuenta">
      <h2 id="eliminar-cuenta" className="mb-3 font-semibold">
        Eliminar cuenta
      </h2>
      <Card className="p-5">
        {!isLive ? (
          <p className="text-sm text-muted">
            En el modo demo no hay una cuenta real que eliminar: los datos de ejemplo viven solo en este navegador. Con tu cuenta
            de Marea podrás eliminarla desde aquí.
          </p>
        ) : user.role !== "student" ? (
          <p className="text-sm text-muted">Pide a la administración que dé de baja tu cuenta.</p>
        ) : !open ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">
              Borra tu cuenta y tus datos personales de Marea. Esta acción no se puede deshacer.
            </p>
            <Button type="button" variant="outline" className="text-red-700" onClick={() => setOpen(true)}>
              <Trash2 size={16} /> Eliminar mi cuenta
            </Button>
          </div>
        ) : (
          <form onSubmit={remove} className="space-y-4">
            <div>
              <p className="font-medium text-red-700">¿Seguro que quieres eliminar tu cuenta?</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                {CONSECUENCIAS.map((c) => (
                  <li key={c}>{c}</li>
                ))}
                <li className="font-medium text-ink">Esta acción no se puede deshacer.</li>
              </ul>
            </div>
            <Field label={`Escribe ${CONFIRM_WORD} para confirmar`}>
              <Input
                value={word}
                onChange={(e) => setWord(e.target.value)}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck={false}
                enterKeyHint="done"
                placeholder={CONFIRM_WORD}
                disabled={busy}
              />
            </Field>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setOpen(false);
                  setWord("");
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="danger" disabled={!confirmed || busy}>
                <Trash2 size={16} /> {busy ? "Eliminando…" : "Eliminar mi cuenta definitivamente"}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </section>
  );
}
