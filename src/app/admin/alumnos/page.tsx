"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { addDays } from "date-fns";
import { ChevronRight, Plus, Search, Users } from "lucide-react";
import { useDB } from "@/lib/store";
import { creditsLeft, currentMemberships } from "@/lib/rules";
import { fmt } from "@/lib/utils";
import { Avatar, Badge, Button, Empty, Input, PageHeader, Segmented } from "@/components/ui";
import { PersonFormModal } from "@/components/admin/person-form";

type Filter = "all" | "active" | "none" | "expiring";

export default function StudentsPage() {
  const db = useDB();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [creating, setCreating] = useState(0);

  const rows = useMemo(() => {
    const now = new Date();
    const soon = addDays(now, 7);
    return db.users
      .filter((u) => u.role === "student")
      .map((u) => {
        const ms = currentMemberships(db, u.id, now);
        const active = ms.filter((m) => m.status === "active");
        const pending = ms.some((m) => m.status === "pending_payment");
        const credits = active.reduce((a, m) => a + creditsLeft(m), 0);
        const nextExp = active[0]?.expiresAt;
        return { u, active, pending, credits, nextExp, expiring: !!nextExp && new Date(nextExp) <= soon };
      })
      .filter(({ u }) => {
        const s = q.trim().toLowerCase();
        return !s || u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s) || u.code.includes(s);
      })
      .filter((r) =>
        filter === "active" ? r.active.length > 0 : filter === "none" ? r.active.length === 0 : filter === "expiring" ? r.expiring : true,
      )
      .sort((a, b) => a.u.name.localeCompare(b.u.name));
  }, [db, q, filter]);

  const creditLabel = (n: number) => (n === Infinity ? "Ilimitado" : `${n} crédito${n === 1 ? "" : "s"}`);

  return (
    <div>
      <PageHeader
        title="Alumnos"
        subtitle={`${db.users.filter((u) => u.role === "student").length} registrados`}
        actions={
          <Button onClick={() => setCreating((n) => n + 1)}>
            <Plus size={18} /> Nuevo alumno
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input className="pl-10" placeholder="Buscar por nombre, correo o código" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="no-scrollbar overflow-x-auto">
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "Todos" },
              { value: "active", label: "Activos" },
              { value: "none", label: "Sin paquete" },
              { value: "expiring", label: "Por vencer" },
            ]}
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <Empty icon={<Users size={28} />} title="Sin resultados" text="Prueba con otra búsqueda o filtro." />
      ) : (
        <>
          {/* Celular: tarjetas */}
          <ul className="space-y-2 md:hidden">
            {rows.map(({ u, active, pending, credits, nextExp }) => (
              <li key={u.id}>
                <Link href={`/admin/alumnos/${u.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
                  <Avatar name={u.name} color={u.color} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{u.name}</p>
                    <p className="truncate text-xs text-muted">
                      {active.length ? `${creditLabel(credits)} · vence ${fmt(nextExp!, "d MMM")}` : "Sin paquete vigente"}
                    </p>
                    <div className="mt-1 flex gap-1">
                      {!u.active && <Badge>Inactivo</Badge>}
                      {pending && <Badge tone="amber">Pago pendiente</Badge>}
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-muted" />
                </Link>
              </li>
            ))}
          </ul>

          {/* iPad / escritorio: tabla */}
          <div className="hidden overflow-hidden rounded-2xl border border-line bg-surface md:block">
            <table className="w-full text-sm">
              <thead className="bg-bg text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Alumno</th>
                  <th className="px-4 py-3 font-medium">Código</th>
                  <th className="px-4 py-3 font-medium">Paquete</th>
                  <th className="px-4 py-3 font-medium">Créditos</th>
                  <th className="px-4 py-3 font-medium">Vence</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ u, active, pending, credits, nextExp, expiring }) => (
                  <tr key={u.id} className="hover:bg-bg">
                    <td className="px-4 py-2">
                      <Link href={`/admin/alumnos/${u.id}`} className="flex min-h-11 items-center gap-3">
                        <Avatar name={u.name} color={u.color} size={36} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{u.name}</span>
                          <span className="block truncate text-xs text-muted">{u.email}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-2 tabular-nums text-muted">{u.code}</td>
                    <td className="px-4 py-2">{active.map((m) => m.planName).join(", ") || <span className="text-muted">—</span>}</td>
                    <td className="px-4 py-2 tabular-nums">{active.length ? creditLabel(credits) : "—"}</td>
                    <td className="px-4 py-2 tabular-nums">
                      {nextExp ? <span className={expiring ? "font-medium text-amber-700" : ""}>{fmt(nextExp, "d MMM yyyy")}</span> : "—"}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {!u.active ? (
                          <Badge>Inactivo</Badge>
                        ) : active.length ? (
                          <Badge tone="green">Activo</Badge>
                        ) : (
                          <Badge>Sin paquete</Badge>
                        )}
                        {pending && <Badge tone="amber">Pago pendiente</Badge>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {creating > 0 && <PersonFormModal key={creating} open role="student" onClose={() => setCreating(0)} />}
    </div>
  );
}
