"use client";

import { useState } from "react";
import { useDB, useStore } from "@/lib/store";
import { DEFAULT_TEACHER_SHARE, hasRate } from "@/lib/payouts";
import type { Role, User } from "@/lib/types";
import { fmt, formatMoneyCents, uid } from "@/lib/utils";
import { toast, toastDone } from "@/components/toast";
import { Button, Field, Input, Modal, Textarea, Toggle, phoneError, phoneInputProps } from "@/components/ui";

export const PERSON_COLORS = ["#7C9A92", "#C98B6B", "#8E7CC3", "#D4A373", "#6B9AC4", "#B5838D", "#6D8B74", "#E09F7D"];

/** Código de 4 dígitos único (para check-in). */
export function uniqueCode(users: User[], role: Role): string {
  const used = new Set(users.map((u) => u.code));
  const base = role === "teacher" ? 2000 : 3000;
  for (let i = 1; i < 7000; i++) {
    const c = String(base + i);
    if (!used.has(c)) return c;
  }
  return String(Math.floor(1000 + Math.random() * 8999));
}

/** Alta/edición de alumno o profesor. */
export function PersonFormModal({
  open,
  onClose,
  role,
  user,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  role: Role;
  user?: User;
  onSaved?: (id: string) => void;
}) {
  const db = useDB();
  const upsertUser = useStore((s) => s.upsertUser);
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [birthday, setBirthday] = useState(user?.birthday ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [notes, setNotes] = useState(user?.notes ?? "");
  const [color, setColor] = useState(user?.color ?? PERSON_COLORS[db.users.length % PERSON_COLORS.length]);
  const [active, setActive] = useState(user?.active ?? true);
  // Texto tal cual se escribe: vacío (o 0) = sin precio definido.
  const [rateText, setRateText] = useState(user && hasRate(user) ? String(user.rate) : "");
  const share = db.settings.teacherShare ?? DEFAULT_TEACHER_SHARE;
  const rateValue = rateText.trim() === "" ? undefined : Number(rateText);
  const rateChanged = !!user && (user.rate ?? 0) !== (rateValue ?? 0);
  const today = fmt(new Date(), "yyyy-MM-dd");

  const save = async () => {
    if (!name.trim()) return toast("El nombre es obligatorio.", false);
    const mail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(mail)) return toast("Escribe un correo válido.", false);
    if (db.users.some((u) => u.email.toLowerCase() === mail && u.id !== user?.id))
      return toast("Ya existe una persona con ese correo.", false);
    const phoneMsg = phoneError(phone);
    if (phoneMsg) return toast(phoneMsg, false);
    if (birthday && birthday > today) return toast("La fecha de cumpleaños no puede ser futura.", false);
    if (role === "teacher" && rateValue !== undefined && !(Number.isFinite(rateValue) && rateValue >= 0))
      return toast("El precio por alumno debe ser un número de 0 en adelante.", false);
    const id = user?.id ?? uid("u");
    const r = await toastDone(upsertUser({
      id,
      name: name.trim(),
      email: mail,
      phone: phone.trim(),
      role,
      code: user?.code ?? uniqueCode(db.users, role),
      color,
      bio: bio.trim() || undefined,
      notes: notes.trim() || undefined,
      birthday: birthday || undefined,
      active,
      createdAt: user?.createdAt ?? new Date().toISOString(),
      // Sin precio se guarda como 0 (en modo real un null no cambiaría el precio anterior).
      rate: role === "teacher" ? Math.round((rateValue ?? 0) * 100) / 100 : user?.rate,
    }), user ? "Datos actualizados." : role === "teacher" ? "Profesor agregado." : "Alumno registrado.");
    if (!r.ok) return;
    onSaved?.(id);
    onClose();
  };

  const title = user ? "Editar datos" : role === "teacher" ? "Nuevo profesor" : "Nuevo alumno";
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <Button className="w-full" size="lg" onClick={save}>
          Guardar
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Nombre completo">
          <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Correo">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          <Field label="Teléfono / WhatsApp">
            <Input {...phoneInputProps} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
        </div>
        {role === "student" && (
          <Field label="Cumpleaños (opcional)">
            <Input type="date" max={today} value={birthday} onChange={(e) => setBirthday(e.target.value)} />
          </Field>
        )}
        {role === "teacher" && (
          <div>
            <Field
              label="Precio por alumno (MXN)"
              hint={`Lo que se cobra por cada alumno en sus clases; le toca el ${share}%${
                rateValue !== undefined && Number.isFinite(rateValue) && rateValue > 0
                  ? ` (${formatMoneyCents((rateValue * share) / 100)} por alumno)`
                  : ""
              }.`}
            >
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={rateText}
                onChange={(e) => setRateText(e.target.value)}
                placeholder="Ej. 200"
              />
            </Field>
            {user && (
              <p
                className={
                  rateChanged
                    ? "mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200"
                    : "mt-1 text-xs text-muted"
                }
                role={rateChanged ? "status" : undefined}
              >
                Cambiar el precio solo afecta las clases que aún no empiezan; las que ya dio conservan su precio.
              </p>
            )}
          </div>
        )}
        {role === "teacher" && (
          <Field label="Biografía" hint="Se muestra a los alumnos al reservar.">
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} />
          </Field>
        )}
        <Field label="Notas internas" hint="Solo visibles para el estudio (lesiones, preferencias…).">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div>
          <span className="mb-1.5 block text-sm font-medium">Color</span>
          <div className="flex flex-wrap gap-2">
            {PERSON_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="h-11 w-11 rounded-full ring-offset-2 transition"
                style={{ background: c, boxShadow: color === c ? `0 0 0 3px white, 0 0 0 5px ${c}` : undefined }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>
        {user && <Toggle checked={active} onChange={setActive} label="Activo" hint="Las personas inactivas no pueden entrar ni aparecer en listas." />}
      </div>
    </Modal>
  );
}
