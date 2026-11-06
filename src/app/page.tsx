"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, GraduationCap, ShieldCheck, User as UserIcon } from "lucide-react";
import { useCurrentUser, useDB, useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import type { Role } from "@/lib/types";
import { Avatar, Button, Card, Field, Input, Segmented, phoneError, phoneInputProps, textLinkClass } from "@/components/ui";
import { toast } from "@/components/toast";

const HOME: Record<Role, string> = { admin: "/admin", teacher: "/profesor", student: "/alumno" };

export default function LoginPage() {
  const db = useDB();
  const user = useCurrentUser();
  const mode = useStore((s) => s.mode);
  const router = useRouter();

  useEffect(() => {
    if (user) router.replace(HOME[user.role]);
  }, [user, router]);

  return (
    // El área segura (notch / barra de inicio) se suma al margen de 40 px arriba y abajo.
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 pb-safe-10 pt-safe-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-brand text-2xl font-bold text-brand-ink">
            {db.settings.studioName.charAt(0)}
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">{db.settings.studioName}</h1>
          <p className="mt-1 text-muted">{db.settings.tagline}</p>
        </div>
        {mode === "live" ? <LiveLogin /> : <DemoLogin />}
      </div>
    </div>
  );
}

/* ---------------- Acceso real (Supabase Auth) ---------------- */

function authError(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return "Correo o contraseña incorrectos.";
  if (/email not confirmed/i.test(msg)) return "Confirma tu correo: te enviamos un enlace al registrarte.";
  if (/already registered|already been registered/i.test(msg)) return "Ya existe una cuenta con ese correo. Inicia sesión.";
  if (/password should be at least/i.test(msg)) return "La contraseña debe tener al menos 6 caracteres.";
  if (/rate limit|too many/i.test(msg)) return "Demasiados intentos. Espera unos minutos y vuelve a intentar.";
  if (/fetch/i.test(msg)) return "Sin conexión con el servidor.";
  return msg;
}

function LiveLogin() {
  const setMode = useStore((s) => s.setMode);
  const refresh = useStore((s) => s.refresh);
  const [tab, setTab] = useState<"in" | "up" | "reset">("in");
  const [form, setForm] = useState({ name: "", phone: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const sb = supabase();
    const email = form.email.trim().toLowerCase();
    try {
      if (tab === "in") {
        const { error } = await sb.auth.signInWithPassword({ email, password: form.password });
        if (error) return toast(authError(error.message), false);
        await refresh();
      } else if (tab === "up") {
        if (!form.name.trim()) return toast("Escribe tu nombre.", false);
        const phoneMsg = phoneError(form.phone);
        if (phoneMsg) return toast(phoneMsg, false);
        const { data, error } = await sb.auth.signUp({
          email,
          password: form.password,
          options: {
            data: { name: form.name.trim(), phone: form.phone.trim() },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) return toast(authError(error.message), false);
        if (data.session) await refresh();
        else setSent(`Te enviamos un correo a ${email}. Abre el enlace para confirmar tu cuenta y luego inicia sesión.`);
      } else {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/restablecer` });
        if (error) return toast(authError(error.message), false);
        setSent(`Si existe una cuenta con ${email}, te llegará un correo para crear una nueva contraseña.`);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card className="p-5">
        {sent ? (
          <div className="space-y-4 text-center">
            <p className="text-sm">{sent}</p>
            <Button variant="outline" onClick={() => { setSent(null); setTab("in"); }}>
              Volver a iniciar sesión
            </Button>
          </div>
        ) : (
          <>
            {tab !== "reset" && (
              <div className="mb-5 flex justify-center">
                <Segmented
                  value={tab}
                  onChange={setTab}
                  options={[
                    { value: "in", label: "Iniciar sesión" },
                    { value: "up", label: "Crear cuenta" },
                  ]}
                />
              </div>
            )}
            {tab === "reset" && <p className="mb-4 text-sm text-muted">Escribe tu correo y te enviaremos un enlace para crear una nueva contraseña.</p>}
            <form onSubmit={submit} className="space-y-4">
              {tab === "up" && (
                <>
                  <Field label="Nombre completo">
                    <Input value={form.name} onChange={set("name")} autoComplete="name" required />
                  </Field>
                  <Field label="Teléfono (opcional)">
                    <Input {...phoneInputProps} value={form.phone} onChange={set("phone")} />
                  </Field>
                </>
              )}
              <Field label="Correo">
                <Input type="email" value={form.email} onChange={set("email")} autoComplete="email" required />
              </Field>
              {tab !== "reset" && (
                <Field label="Contraseña" hint={tab === "up" ? "Mínimo 6 caracteres." : undefined}>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={set("password")}
                    autoComplete={tab === "up" ? "new-password" : "current-password"}
                    minLength={6}
                    required
                  />
                </Field>
              )}
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? "Un momento…" : tab === "in" ? "Entrar" : tab === "up" ? "Crear mi cuenta" : "Enviar enlace"}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm">
              {tab === "in" ? (
                <button type="button" className={`${textLinkClass} px-2 text-muted underline`} onClick={() => setTab("reset")}>
                  ¿Olvidaste tu contraseña?
                </button>
              ) : tab === "reset" ? (
                <button type="button" className={`${textLinkClass} px-2 text-muted underline`} onClick={() => setTab("in")}>
                  Volver
                </button>
              ) : null}
            </div>
          </>
        )}
      </Card>
      <p className="mt-6 text-center text-sm text-muted">
        ¿Solo quieres conocer la app?{" "}
        <button type="button" className={`${textLinkClass} px-1 font-medium text-brand-text underline`} onClick={() => setMode("demo")}>
          Ver demo con datos de ejemplo
        </button>
      </p>
    </>
  );
}

/* ---------------- Demo ---------------- */

function DemoLogin() {
  const db = useDB();
  const login = useStore((s) => s.login);
  const setMode = useStore((s) => s.setMode);
  const refresh = useStore((s) => s.refresh);
  const ensureSessions = useStore((s) => s.ensureSessions);
  const router = useRouter();
  const [role, setRole] = useState<Role>("student");

  useEffect(() => {
    ensureSessions();
  }, [ensureSessions]);

  const people = db.users.filter((u) => u.role === role && u.active);
  const icon = role === "admin" ? <ShieldCheck size={18} /> : role === "teacher" ? <GraduationCap size={18} /> : <UserIcon size={18} />;

  return (
    <>
      <Card className="p-5">
        <p className="mb-1 text-sm font-medium">Modo demo</p>
        <p className="mb-4 text-sm text-muted">Datos de ejemplo guardados solo en este navegador. Elige un perfil para entrar.</p>
        <div className="mb-4 flex justify-center">
          <Segmented
            value={role}
            onChange={setRole}
            options={[
              { value: "student", label: "Alumno" },
              { value: "teacher", label: "Profesor" },
              { value: "admin", label: "Admin" },
            ]}
          />
        </div>
        <ul className="max-h-[50dvh] divide-y divide-line overflow-y-auto">
          {people.map((u) => (
            <li key={u.id}>
              <button
                onClick={() => {
                  login(u.id);
                  router.push(HOME[u.role]);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-black/5"
              >
                <Avatar name={u.name} color={u.color} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{u.name}</span>
                  <span className="flex items-center gap-1 text-xs text-muted">
                    {icon} {u.email}
                  </span>
                </span>
                <ChevronRight size={18} className="text-muted" />
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <p className="mt-6 text-center text-sm text-muted">
        <button
          type="button"
          className={`${textLinkClass} px-2 font-medium text-brand-text underline`}
          onClick={async () => {
            setMode("live");
            await refresh().catch(() => toast("No pudimos conectar con el servidor.", false));
          }}
        >
          Ir al acceso real
        </button>
      </p>
    </>
  );
}
