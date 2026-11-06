"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { LogOut } from "lucide-react";
import { useCurrentUser, useDB, useStore } from "@/lib/store";
import { creditsLeft } from "@/lib/rules";
import { fmt, formatMoney, PAYMENT_LABEL } from "@/lib/utils";
import { toastResult } from "@/components/toast";
import { Avatar, Badge, Button, Card, Field, Input, PageHeader } from "@/components/ui";

export default function ProfilePage() {
  const db = useDB();
  const user = useCurrentUser()!;
  const upsertUser = useStore((s) => s.upsertUser);
  const logout = useStore((s) => s.logout);
  const isLive = useStore((s) => s.mode) === "live";
  const router = useRouter();
  const [form, setForm] = useState({ name: user.name, email: user.email, phone: user.phone, birthday: user.birthday ?? "" });

  const mems = db.memberships
    .filter((m) => m.userId === user.id)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const sales = db.sales.filter((s) => s.userId === user.id).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  return (
    <div className="space-y-6">
      <PageHeader title="Mi perfil" />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="p-5">
          <div className="mb-5 flex items-center gap-4">
            <Avatar name={user.name} color={user.color} size={64} />
            <div>
              <p className="text-lg font-semibold">{user.name}</p>
              <p className="text-sm text-muted">Alumno desde {fmt(user.createdAt, "MMMM yyyy")}</p>
            </div>
          </div>
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              toastResult(upsertUser({ ...user, ...form }));
            }}
          >
            <Field label="Nombre">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Field>
            <Field label="Correo">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                readOnly={isLive}
                className={isLive ? "bg-bg text-muted" : undefined}
              />
            </Field>
            <Field label="Teléfono">
              <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Cumpleaños">
              <Input type="date" value={form.birthday} onChange={(e) => setForm({ ...form, birthday: e.target.value })} />
            </Field>
            <div className="flex gap-2 md:col-span-2">
              <Button type="submit">Guardar cambios</Button>
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  await logout();
                  router.replace("/");
                }}
              >
                <LogOut size={16} /> Cerrar sesión
              </Button>
            </div>
          </form>
        </Card>

        <Card className="flex flex-col items-center p-5 text-center">
          <p className="font-semibold">Tu código de acceso</p>
          <p className="mb-4 text-sm text-muted">Muéstralo en recepción o a tu profesor para hacer check-in.</p>
          <div className="rounded-2xl bg-white p-3 ring-1 ring-line">
            <QRCodeSVG value={`yoga:${user.code}`} size={168} />
          </div>
          <p className="mt-3 font-mono text-3xl font-semibold tracking-[0.3em]">{user.code}</p>
        </Card>
      </div>

      <section>
        <h2 className="mb-3 font-semibold">Historial de paquetes</h2>
        <Card className="divide-y divide-line">
          {mems.length === 0 && <p className="p-4 text-sm text-muted">Sin paquetes todavía.</p>}
          {mems.map((m) => {
            const expired = new Date(m.expiresAt) < new Date();
            return (
              <div key={m.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{m.planName}</p>
                  <p className="text-sm text-muted">
                    {fmt(m.startsAt, "d MMM yyyy")} – {fmt(m.expiresAt, "d MMM yyyy")} ·{" "}
                    {m.credits === null ? "ilimitado" : `${m.creditsUsed} de ${m.credits} usadas`}
                  </p>
                </div>
                {m.status === "cancelled" ? (
                  <Badge tone="red">Cancelado</Badge>
                ) : m.status === "pending_payment" ? (
                  <Badge tone="amber">Pendiente</Badge>
                ) : expired ? (
                  <Badge>Vencido</Badge>
                ) : creditsLeft(m) === 0 ? (
                  <Badge>Agotado</Badge>
                ) : (
                  <Badge tone="green">Activo</Badge>
                )}
              </div>
            );
          })}
        </Card>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Mis compras</h2>
        <Card className="divide-y divide-line">
          {sales.length === 0 && <p className="p-4 text-sm text-muted">Sin compras.</p>}
          {sales.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 p-4 text-sm">
              <div>
                <p className="font-medium">{s.concept}</p>
                <p className="text-muted">
                  {fmt(s.createdAt, "d MMM yyyy")} · {PAYMENT_LABEL[s.method]}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium tabular-nums">{formatMoney(s.total)}</p>
                {s.status === "pending" && <Badge tone="amber">Pendiente</Badge>}
                {s.status === "refunded" && <Badge tone="red">Reembolsado</Badge>}
              </div>
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}
