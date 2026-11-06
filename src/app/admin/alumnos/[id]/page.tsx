"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, CalendarPlus, Mail, Minus, Pencil, Phone, Plus, ShoppingBag } from "lucide-react";
import { useDB, useStore } from "@/lib/store";
import { creditsLeft } from "@/lib/rules";
import type { Membership } from "@/lib/types";
import { fmt, formatMoney, PAYMENT_LABEL, timeOf } from "@/lib/utils";
import { ReservationStatusBadge } from "@/components/domain";
import { toastDone } from "@/components/toast";
import { Avatar, Badge, Button, Card, Empty, PageHeader, Segmented } from "@/components/ui";
import { PersonFormModal } from "@/components/admin/person-form";
import { SellModal } from "@/components/admin/sell-modal";

function membershipState(m: Membership, now: Date): { label: string; tone: "green" | "amber" | "red" | "gray" } {
  if (m.status === "cancelled") return { label: "Cancelada", tone: "gray" };
  if (m.status === "pending_payment") return { label: "Pago pendiente", tone: "amber" };
  if (new Date(m.expiresAt) < now) return { label: "Vencida", tone: "gray" };
  if (creditsLeft(m) <= 0) return { label: "Sin créditos", tone: "red" };
  return { label: "Vigente", tone: "green" };
}

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const db = useDB();
  const adjustCredits = useStore((s) => s.adjustCredits);
  const extendMembership = useStore((s) => s.extendMembership);
  const [editing, setEditing] = useState(0);
  const [selling, setSelling] = useState(0);
  const [tab, setTab] = useState<"reservas" | "compras">("reservas");

  const user = db.users.find((u) => u.id === id && u.role === "student");
  if (!user) {
    return (
      <Empty
        title="Alumno no encontrado"
        action={
          <Link href="/admin/alumnos">
            <Button variant="secondary">Volver</Button>
          </Link>
        }
      />
    );
  }
  const now = new Date();
  const memberships = db.memberships
    .filter((m) => m.userId === user.id)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const current = memberships.filter((m) => m.status !== "cancelled" && new Date(m.expiresAt) >= now);
  const past = memberships.filter((m) => !current.includes(m));
  const reservations = db.reservations
    .filter((r) => r.userId === user.id)
    .map((r) => ({ r, s: db.sessions.find((x) => x.id === r.sessionId) }))
    .filter((x) => x.s)
    .sort((a, b) => +new Date(b.s!.startsAt) - +new Date(a.s!.startsAt));
  const sales = db.sales.filter((s) => s.userId === user.id).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const attended = reservations.filter((x) => x.r.status === "attended").length;
  const noShows = reservations.filter((x) => x.r.status === "no_show").length;
  const spent = sales.filter((s) => s.status === "paid").reduce((a, s) => a + s.total, 0);

  const renderMembership = (m: Membership) => {
    const st = membershipState(m, now);
    const left = creditsLeft(m);
    const editable = m.status !== "cancelled";
    return (
      <Card key={m.id} className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold">{m.planName}</p>
            <p className="text-xs text-muted">
              {fmt(m.startsAt, "d MMM")} – {fmt(m.expiresAt, "d MMM yyyy")}
            </p>
          </div>
          <Badge tone={st.tone}>{st.label}</Badge>
        </div>
        <div className="mt-3 flex items-end justify-between gap-2">
          <div>
            <p className="text-2xl font-semibold tabular-nums">{m.credits === null ? "∞" : left}</p>
            <p className="text-xs text-muted">{m.credits === null ? `Ilimitado · ${m.creditsUsed} usadas` : `de ${m.credits} créditos`}</p>
          </div>
          {editable && (
            <div className="flex gap-1">
              {m.credits !== null && (
                <>
                  <Button variant="outline" size="sm" className="h-11 w-11 px-0" aria-label="Quitar crédito" disabled={left <= 0} title={left <= 0 ? "Este paquete ya no tiene créditos" : undefined} onClick={() => { toastDone(adjustCredits(m.id, -1), "Crédito retirado."); }}>
                    <Minus size={16} />
                  </Button>
                  <Button variant="outline" size="sm" className="h-11 w-11 px-0" aria-label="Agregar crédito" onClick={() => { toastDone(adjustCredits(m.id, 1), "Crédito agregado."); }}>
                    <Plus size={16} />
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" className="h-11" onClick={() => { toastDone(extendMembership(m.id, 7), "Vigencia extendida 7 días."); }}>
                <CalendarPlus size={16} /> +7 días
              </Button>
            </div>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div>
      <Link href="/admin/alumnos" className="mb-4 inline-flex h-11 items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} /> Alumnos
      </Link>
      <PageHeader
        title={user.name}
        subtitle={`Código ${user.code} · alumno desde ${fmt(user.createdAt, "MMMM 'de' yyyy")}`}
        actions={
          <>
            <Button variant="outline" onClick={() => setEditing((n) => n + 1)}>
              <Pencil size={16} /> Editar
            </Button>
            <Button onClick={() => setSelling((n) => n + 1)}>
              <ShoppingBag size={16} /> Vender paquete
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <Avatar name={user.name} color={user.color} size={56} />
              <div className="min-w-0 text-sm">
                <a href={`mailto:${user.email}`} className="flex min-h-10 min-w-0 items-center gap-2 hover:underline">
                  <Mail size={14} className="shrink-0 text-muted" /> <span className="truncate">{user.email}</span>
                </a>
                {user.phone && (
                  <a href={`tel:${user.phone.replace(/\s/g, "")}`} className="flex min-h-10 items-center gap-2 hover:underline">
                    <Phone size={14} className="shrink-0 text-muted" /> {user.phone}
                  </a>
                )}
                {!user.active && <Badge>Inactivo</Badge>}
              </div>
            </div>
            {user.notes && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{user.notes}</p>}
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-bg p-2">
                <p className="text-lg font-semibold tabular-nums">{attended}</p>
                <p className="text-xs text-muted">Asistencias</p>
              </div>
              <div className="rounded-xl bg-bg p-2">
                <p className="text-lg font-semibold tabular-nums">{noShows}</p>
                <p className="text-xs text-muted">Faltas</p>
              </div>
              <div className="rounded-xl bg-bg p-2">
                <p className="text-lg font-semibold tabular-nums">{formatMoney(spent)}</p>
                <p className="text-xs text-muted">Total pagado</p>
              </div>
            </div>
          </Card>

          <h2 className="pt-2 font-semibold">Paquetes vigentes</h2>
          {current.length === 0 ? (
            <Empty title="Sin paquete vigente" action={<Button variant="secondary" onClick={() => setSelling((n) => n + 1)}>Vender paquete</Button>} />
          ) : (
            current.map((m) => renderMembership(m))
          )}
          {past.length > 0 && (
            <details className="rounded-2xl border border-line bg-surface px-4 py-1">
              <summary className="cursor-pointer py-3 text-sm font-medium">Historial de paquetes ({past.length})</summary>
              <ul className="mb-3 divide-y divide-line text-sm">
                {past.map((m) => (
                  <li key={m.id} className="flex justify-between gap-2 py-2">
                    <span>{m.planName}</span>
                    <span className="text-muted">{fmt(m.expiresAt, "d MMM yyyy")}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="mb-3">
            <Segmented
              value={tab}
              onChange={setTab}
              options={[
                { value: "reservas", label: `Reservaciones (${reservations.length})` },
                { value: "compras", label: `Compras (${sales.length})` },
              ]}
            />
          </div>
          {tab === "reservas" ? (
            reservations.length === 0 ? (
              <Empty title="Sin reservaciones" />
            ) : (
              <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
                {reservations.slice(0, 60).map(({ r, s }) => {
                  const d = db.disciplines.find((x) => x.id === s!.disciplineId);
                  return (
                    <li key={r.id}>
                      <Link href={`/admin/clase/${s!.id}`} className="flex items-center gap-3 p-3 hover:bg-bg">
                        <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: d?.color }} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {d?.name}
                            {r.guestName && <span className="text-muted"> · invitado: {r.guestName}</span>}
                          </p>
                          <p className="text-xs text-muted">
                            {fmt(s!.startsAt, "EEE d MMM")} · {timeOf(s!.startsAt)}
                            {r.spot && ` · lugar ${r.spot}`}
                          </p>
                        </div>
                        <ReservationStatusBadge status={r.status} late={r.lateCancel} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )
          ) : sales.length === 0 ? (
            <Empty title="Sin compras" />
          ) : (
            <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
              {sales.map((s) => (
                <li key={s.id} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.concept}</p>
                    <p className="text-xs text-muted">
                      {fmt(s.createdAt, "d MMM yyyy")} · {PAYMENT_LABEL[s.method]}
                      {s.couponCode && ` · cupón ${s.couponCode}`}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{formatMoney(s.total)}</span>
                  <Badge tone={s.status === "paid" ? "green" : s.status === "pending" ? "amber" : "gray"}>
                    {s.status === "paid" ? "Pagado" : s.status === "pending" ? "Pendiente" : "Reembolsado"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {editing > 0 && <PersonFormModal key={editing} open role="student" user={user} onClose={() => setEditing(0)} />}
      {selling > 0 && <SellModal key={selling} open userId={user.id} onClose={() => setSelling(0)} />}
    </div>
  );
}
