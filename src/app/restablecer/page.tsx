"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useSettings } from "@/lib/store";
import { Button, Card, Field, Input, textLinkClass } from "@/components/ui";
import { toast } from "@/components/toast";
import { emailLinkOrigin } from "@/app/_lib/enlaces";

/** checking: revisando el enlace · ready: hay sesión de recuperación · missing: se abrió sin enlace · expired: el enlace ya no sirve. */
type LinkState = "checking" | "ready" | "missing" | "expired";

function authError(msg: string): string {
  if (/session/i.test(msg)) return "El enlace venció o ya se usó. Pide uno nuevo.";
  if (/should be different/i.test(msg)) return "La nueva contraseña debe ser distinta de la anterior.";
  if (/at least/i.test(msg)) return "La contraseña debe tener al menos 6 caracteres.";
  if (/rate limit|too many/i.test(msg)) return "Demasiados intentos. Espera unos minutos y vuelve a intentar.";
  if (/fetch/i.test(msg)) return "Sin conexión con el servidor.";
  return msg;
}

/** Destino del enlace "olvidé mi contraseña": Supabase abre una sesión de recuperación. */
export default function ResetPasswordPage() {
  const router = useRouter();
  const settings = useSettings();
  const [state, setState] = useState<LinkState>("checking");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase lee el enlace (#access_token… o ?code=…) al iniciar y avisa con la sesión que quedó.
    // Si el enlace venció o ya se usó, regresa con #error_code=otp_expired (o error=access_denied).
    const { data } = supabase().auth.onAuthStateChange((_event, session) => {
      if (session) return setState("ready");
      const url = window.location.hash + window.location.search;
      setState(/error_code=|error=access_denied/.test(url) ? "expired" : "missing");
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase().auth.updateUser({ password });
    setBusy(false);
    if (error) {
      if (/session/i.test(error.message)) setState("expired");
      return toast(authError(error.message), false);
    }
    toast("Contraseña actualizada.");
    router.replace("/");
  };

  const requestLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const mail = email.trim().toLowerCase();
    setBusy(true);
    const { error } = await supabase().auth.resetPasswordForEmail(mail, { redirectTo: `${emailLinkOrigin()}/restablecer` });
    setBusy(false);
    if (error) return toast(authError(error.message), false);
    setSent(`Si existe una cuenta con ${mail}, te llegará un correo con un enlace nuevo. Ábrelo en este mismo dispositivo.`);
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 pb-safe-10 pt-safe-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-brand text-2xl font-bold text-brand-ink">
            {settings.studioName.charAt(0)}
          </span>
          <p className="text-2xl font-semibold tracking-tight">{settings.studioName}</p>
        </div>
        <Card className="p-5">
          {state === "checking" ? (
            <p className="py-6 text-center text-sm text-muted">Revisando tu enlace…</p>
          ) : state === "ready" ? (
            <>
              <h1 className="mb-4 text-xl font-semibold">Nueva contraseña</h1>
              <form onSubmit={savePassword} className="space-y-4">
                <Field label="Contraseña" hint="Mínimo 6 caracteres.">
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required autoComplete="new-password" />
                </Field>
                <Button type="submit" size="lg" className="w-full" disabled={busy}>
                  {busy ? "Un momento…" : "Guardar"}
                </Button>
              </form>
            </>
          ) : sent ? (
            <p className="text-center text-sm">{sent}</p>
          ) : (
            <>
              <h1 className="mb-2 text-xl font-semibold">{state === "expired" ? "El enlace ya no sirve" : "Restablecer contraseña"}</h1>
              <p className="mb-4 text-sm text-muted">
                {state === "expired"
                  ? "El enlace venció o ya se usó. Escribe tu correo y te enviamos uno nuevo."
                  : "Para crear una nueva contraseña abre el enlace que te enviamos por correo. Si no lo tienes o ya venció, pide uno nuevo aquí."}
              </p>
              <form onSubmit={requestLink} className="space-y-4">
                <Field label="Correo">
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
                </Field>
                <Button type="submit" size="lg" className="w-full" disabled={busy}>
                  {busy ? "Un momento…" : "Pedir un enlace nuevo"}
                </Button>
              </form>
            </>
          )}
        </Card>
        <p className="mt-6 text-center text-sm">
          <Link href="/" className={`${textLinkClass} px-2 font-medium text-brand-text underline`}>
            Volver a iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
