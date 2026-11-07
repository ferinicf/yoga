"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, LifeBuoy, ShieldCheck, Trash2 } from "lucide-react";
import { useCurrentUser, useDB, useSettings, useStore } from "@/lib/store";
import type { Role } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { cancelAllReminders } from "@/lib/native";
import { CONTACT_EMAIL, PRIVACY_PATH, STUDIO_NAME, SUPPORT_PATH, mailtoHref } from "@/lib/legal";
import { toast } from "@/components/toast";
import { Button, Card, Field, Input } from "@/components/ui";

const CONFIRM_WORD = "ELIMINAR";

interface Copy {
  /** Frase junto al botón, antes de abrir la confirmación. */
  intro: string;
  /** Qué pasa al eliminarla (mismo comportamiento que supabase/migrations/0008_eliminar_cuenta.sql). */
  consequences: string[];
  /** Última línea de la lista, en negritas. */
  final: string;
}

function copyFor(role: Role, studio: string): Copy {
  if (role === "student")
    return {
      intro: `Borra tu cuenta y tus datos personales de ${studio}. Esta acción no se puede deshacer.`,
      consequences: [
        "Se borran tu nombre, correo, teléfono, cumpleaños y tu código de acceso, y ya no podrás iniciar sesión.",
        "Se cancelan tus reservaciones y tus lugares en lista de espera (también los de tus invitados) en clases que aún no empiezan, sin devolver los créditos.",
        "Pierdes tus paquetes y los créditos que te queden. Los paquetes apartados que aún no pagas se anulan.",
        "El estudio conserva el registro de tus compras y asistencias, ya sin tus datos personales, para su contabilidad.",
      ],
      final: "Esta acción no se puede deshacer.",
    };
  if (role === "teacher")
    return {
      intro: `Borra tu acceso a ${studio}: ya no podrás iniciar sesión.`,
      consequences: [
        "Se borra tu usuario: ya no podrás iniciar sesión y se cierran tus sesiones en todos tus dispositivos.",
        "Tu nombre se queda en el historial de las clases que diste y en el registro de tus pagos, porque el estudio lo necesita para su contabilidad.",
        "Las clases que tienes programadas siguen en el horario hasta que la administración las reasigne.",
        "Lo que el estudio te deba por clases ya dadas no se pierde: la administración lo sigue viendo para pagártelo.",
        "Si algún día vuelves a dar clases aquí, la administración puede reactivar tu perfil y tendrás que crear tu cuenta otra vez.",
      ],
      final: "Tu usuario se borra en cuanto confirmes.",
    };
  return {
    intro: `Borra tu acceso al panel de administración de ${studio}.`,
    consequences: [
      "Se borra tu usuario: ya no podrás iniciar sesión y se cierran tus sesiones en todos tus dispositivos.",
      "Tu correo sale de la lista de administradores de Configuración.",
      "Tu nombre se queda en el historial del estudio (ventas, pagos a profesores y clases) para su contabilidad.",
      "El estudio, sus alumnos y sus datos siguen igual: lo administran las demás personas con acceso de administración.",
      "Si después quieres volver, otra persona administradora tiene que reactivar tu perfil y tendrás que crear tu cuenta otra vez.",
    ],
    final: "Tu usuario se borra en cuanto confirmes.",
  };
}

/** Quita la sesión guardada de Supabase aunque el servidor ya no reconozca al usuario. */
function clearStoredSession() {
  try {
    for (const k of Object.keys(localStorage)) if (/^sb-.+-auth-token/.test(k)) localStorage.removeItem(k);
  } catch {
    // Almacenamiento no disponible: no hay nada que limpiar.
  }
}

/** Estilo del título de cada sección; la página puede pasar el suyo para que coincida con sus otros títulos. */
const TITLE_CLASS = "mb-3 font-semibold";

const INFO_LINKS = [
  {
    href: PRIVACY_PATH,
    icon: ShieldCheck,
    title: "Aviso de privacidad",
    text: "Qué datos guardamos, para qué y cómo ejercer tus derechos.",
  },
  { href: SUPPORT_PATH, icon: LifeBuoy, title: "Ayuda y soporte", text: "Preguntas frecuentes y cómo contactarnos." },
];

/**
 * Enlaces al aviso de privacidad (App Store 5.1.1(i) y Google Play lo piden dentro de la app) y a
 * la ayuda. Son páginas de la propia app: también se abren sin internet dentro de la app de iOS/Android.
 */
export function PrivacyLink({ titleClassName = TITLE_CLASS }: { titleClassName?: string }) {
  return (
    <section aria-labelledby="privacidad-titulo">
      <h2 id="privacidad-titulo" className={titleClassName}>
        Privacidad y ayuda
      </h2>
      <Card className="divide-y divide-line">
        {INFO_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="flex min-h-14 items-center gap-3 px-5 py-3 transition first:rounded-t-2xl last:rounded-b-2xl hover:bg-bg"
          >
            <l.icon size={20} className="shrink-0 text-brand-text" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{l.title}</span>
              <span className="block text-sm text-muted">{l.text}</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
          </Link>
        ))}
      </Card>
    </section>
  );
}

/**
 * Eliminar la cuenta desde la app (App Store 5.1.1(v) y Google Play), para alumnos, profesores y
 * administradores. Va al final de Mi perfil (alumno y profesor) y de Admin → Mi cuenta.
 * La confirmación es en la misma página: hay que escribir ELIMINAR.
 */
export function DeleteAccount({ titleClassName = TITLE_CLASS }: { titleClassName?: string }) {
  const user = useCurrentUser();
  const db = useDB();
  const settings = useSettings();
  const isLive = useStore((s) => s.mode) === "live";
  const logout = useStore((s) => s.logout);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  /** Error que se queda a la vista (además del aviso). missing = la función aún no existe en el servidor. */
  const [error, setError] = useState<{ text: string; missing?: boolean } | null>(null);
  const confirmed = word.trim().toUpperCase() === CONFIRM_WORD;

  if (!user) return null;

  const studio = settings.studioName?.trim() || STUDIO_NAME;
  const copy = copyFor(user.role, studio);
  // El servidor también lo revisa; aquí solo se avisa antes (el admin ve a todo el personal).
  const lastAdmin = user.role === "admin" && !db.users.some((u) => u.role === "admin" && u.active && u.id !== user.id);

  const close = () => {
    setOpen(false);
    setWord("");
    setError(null);
  };

  const remove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmed || busy) return;
    setBusy(true);
    setError(null);
    let next: { text: string; missing?: boolean } = {
      text: "No pudimos eliminar tu cuenta. Inténtalo más tarde o escríbenos.",
    };
    try {
      const { data, error: rpcError } = await supabase().rpc("delete_my_account");
      const r = data as { ok?: boolean; message?: string } | null;
      if (!rpcError && r?.ok) {
        await cancelAllReminders().catch(() => {});
        await logout().catch(() => {});
        clearStoredSession();
        useStore.setState({ currentUserId: null });
        toast(r.message || "Tu cuenta fue eliminada.");
        router.replace("/");
        return;
      }
      if (rpcError?.code === "PGRST202")
        // La migración 0008 aún no está aplicada en el proyecto de Supabase.
        next = { text: "La eliminación de cuentas todavía no está activada. Escríbenos y la hacemos por ti.", missing: true };
      else if (rpcError && /fetch|network/i.test(rpcError.message)) next = { text: "Sin conexión con el servidor. Revisa tu internet." };
      else if (r?.message) next = { text: r.message };
    } catch {
      next = { text: "Sin conexión con el servidor. Revisa tu internet." };
    }
    setBusy(false);
    setError(next);
    toast(next.text, false);
  };

  const mailSubject = `Eliminar mi cuenta de ${studio}`;
  const mailBody = `Hola, quiero eliminar mi cuenta de ${studio}.\n\nNombre: ${user.name}\nCorreo de mi cuenta: ${user.email}\n`;

  return (
    <section aria-labelledby="eliminar-cuenta">
      <h2 id="eliminar-cuenta" className={titleClassName}>
        Eliminar cuenta
      </h2>
      <Card className="p-5">
        {!isLive ? (
          <div className="space-y-2 text-sm text-muted">
            <p>
              En el modo demo no hay una cuenta real que eliminar: los datos de ejemplo se guardan solo en este dispositivo.
              Con tu cuenta de {studio} puedes eliminarla aquí mismo, escribiendo {CONFIRM_WORD} para confirmar.
            </p>
            {user.role === "admin" && (
              <p>
                Para borrar los cambios del demo, usa <strong className="font-medium text-ink">Restablecer datos de demostración</strong> en{" "}
                <Link href="/admin/configuracion" className="font-medium text-brand-text underline underline-offset-2">
                  Configuración
                </Link>
                .
              </p>
            )}
          </div>
        ) : lastAdmin ? (
          <div className="space-y-2 text-sm">
            <p className="font-medium">Eres la única persona con acceso de administración.</p>
            <p className="text-muted">
              Antes de eliminar tu cuenta, agrega a alguien más: escribe su correo en{" "}
              <Link href="/admin/configuracion" className="font-medium text-brand-text underline underline-offset-2">
                Configuración → Administradores
              </Link>{" "}
              y pídele que cree su cuenta con ese correo. Así el estudio no se queda sin nadie que lo administre.
            </p>
          </div>
        ) : !open ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">{copy.intro}</p>
            <Button type="button" variant="outline" className="text-red-700" onClick={() => setOpen(true)}>
              <Trash2 size={16} aria-hidden /> Eliminar mi cuenta
            </Button>
          </div>
        ) : (
          <form onSubmit={remove} className="space-y-4">
            <div>
              <p className="font-medium text-red-700">¿Seguro que quieres eliminar tu cuenta?</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                {copy.consequences.map((c) => (
                  <li key={c}>{c}</li>
                ))}
                <li className="font-medium text-ink">{copy.final}</li>
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
            {error && (
              <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                {error.text}
                {error.missing && (
                  <>
                    {" "}
                    <a href={mailtoHref(mailSubject, mailBody)} className="break-words font-medium underline underline-offset-2">
                      {CONTACT_EMAIL}
                    </a>
                  </>
                )}
              </p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" disabled={busy} onClick={close}>
                No, conservar mi cuenta
              </Button>
              <Button type="submit" variant="danger" disabled={!confirmed || busy}>
                <Trash2 size={16} aria-hidden /> {busy ? "Eliminando…" : "Eliminar mi cuenta definitivamente"}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </section>
  );
}
