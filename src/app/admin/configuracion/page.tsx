"use client";

import { useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { useSettings, useStore } from "@/lib/store";
import type { Settings } from "@/lib/types";
import { toast, toastDone } from "@/components/toast";
import { Button, Card, Field, Input, PageHeader, Toggle } from "@/components/ui";

const BRAND_PRESETS = ["#5B7F6E", "#7A6A8F", "#B0705A", "#4F6D8A", "#8A7354", "#3F6B6B", "#A15C73", "#2F3E36"];

function LimitField({ label, hint, value, onChange }: { label: string; hint: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="rounded-2xl border border-line p-3">
      <Toggle checked={value !== null} onChange={(on) => onChange(on ? 2 : null)} label={label} hint={value === null ? "Sin límite" : hint} />
      {value !== null && (
        <Input type="number" min={1} value={value} onChange={(e) => onChange(Math.max(1, Number(e.target.value)))} className="mt-2" />
      )}
    </div>
  );
}

export default function SettingsPage() {
  const settings = useSettings();
  const update = useStore((s) => s.updateSettings);
  const resetDemo = useStore((s) => s.resetDemo);
  const isLive = useStore((s) => s.mode) === "live";
  const [s, setS] = useState<Settings>(settings);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((prev) => ({ ...prev, [k]: v }));
  const dirty = JSON.stringify(s) !== JSON.stringify(settings);

  const save = () => {
    if (!s.studioName.trim()) return toast("El nombre del estudio es obligatorio.", false);
    if (!/^#[0-9a-fA-F]{6}$/.test(s.brandColor)) return toast("El color debe tener formato #RRGGBB.", false);
    toastDone(update({ ...s, studioName: s.studioName.trim() }), "Configuración guardada.");
  };

  return (
    <div>
      <PageHeader
        title="Configuración"
        subtitle="Datos del estudio, marca y políticas de reserva"
        actions={
          <Button onClick={save} disabled={!dirty}>
            <Save size={18} /> Guardar cambios
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-5">
          <h2 className="text-lg font-semibold">Estudio</h2>
          <Field label="Nombre del estudio">
            <Input value={s.studioName} onChange={(e) => set("studioName", e.target.value)} />
          </Field>
          <Field label="Frase / eslogan">
            <Input value={s.tagline} onChange={(e) => set("tagline", e.target.value)} />
          </Field>
          <Field label="Dirección">
            <Input value={s.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Teléfono">
              <Input type="tel" value={s.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
            <Field label="WhatsApp">
              <Input type="tel" value={s.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
            </Field>
            <Field label="Instagram">
              <Input value={s.instagram} onChange={(e) => set("instagram", e.target.value.replace(/^@/, ""))} placeholder="usuario" />
            </Field>
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium">Color de marca</span>
            <div className="flex flex-wrap items-center gap-2">
              {BRAND_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set("brandColor", c)}
                  className="h-11 w-11 rounded-full"
                  style={{ background: c, boxShadow: s.brandColor.toLowerCase() === c.toLowerCase() ? `0 0 0 3px white, 0 0 0 5px ${c}` : undefined }}
                  aria-label={`Color ${c}`}
                />
              ))}
              <label className="flex h-11 items-center gap-2 rounded-xl border border-line px-2">
                <input type="color" value={s.brandColor} onChange={(e) => set("brandColor", e.target.value)} className="h-8 w-8 cursor-pointer border-0 bg-transparent" aria-label="Elegir color" />
                <span className="font-mono text-sm">{s.brandColor.toUpperCase()}</span>
              </label>
            </div>
            <div className="mt-3 flex items-center gap-3 rounded-2xl bg-bg p-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl text-lg font-bold text-white" style={{ background: s.brandColor }}>
                {s.studioName.charAt(0)}
              </span>
              <span className="rounded-xl px-4 py-2 text-sm font-medium text-white" style={{ background: s.brandColor }}>
                Reservar
              </span>
              <span className="text-xs text-muted">Vista previa</span>
            </div>
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <h2 className="text-lg font-semibold">Políticas de reserva</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Cancelar sin penalización hasta" hint="Horas antes de la clase. Después se pierde el crédito.">
              <Input type="number" min={0} value={s.cancelHours} onChange={(e) => set("cancelHours", Math.max(0, Number(e.target.value)))} />
            </Field>
            <Field label="Reservar con anticipación máxima" hint="Días hacia adelante que se ven en el horario.">
              <Input type="number" min={1} max={42} value={s.bookingWindowDays} onChange={(e) => set("bookingWindowDays", Math.max(1, Number(e.target.value)))} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <LimitField label="Límite por día" hint="Reservaciones por alumno al día" value={s.dayLimit} onChange={(v) => set("dayLimit", v)} />
            <LimitField label="Límite por semana" hint="Reservaciones por alumno a la semana" value={s.weekLimit} onChange={(v) => set("weekLimit", v)} />
          </div>
          <div className="divide-y divide-line">
            <Toggle checked={s.waitlistEnabled} onChange={(v) => set("waitlistEnabled", v)} label="Lista de espera" hint="Si alguien cancela, el primero de la lista entra automáticamente." />
            <Toggle checked={s.spotSelection} onChange={(v) => set("spotSelection", v)} label="Elegir lugar en el salón" hint="El alumno escoge su tapete en el mapa del salón." />
            <Toggle checked={s.allowGuests} onChange={(v) => set("allowGuests", v)} label="Reservar para un amigo" hint="El alumno usa uno de sus créditos para un invitado." />
            <Toggle checked={s.allowPayAtStudio} onChange={(v) => set("allowPayAtStudio", v)} label="Pagar en el estudio" hint="El alumno aparta un paquete en la app y paga en recepción." />
            <Toggle checked={s.noShowPenalty} onChange={(v) => set("noShowPenalty", v)} label="Penalizar inasistencia" hint="Si no asiste, el crédito no se devuelve." />
          </div>
        </Card>

        {isLive ? (
        <Card className="space-y-3 p-5 lg:col-span-2">
          <h2 className="text-lg font-semibold">Administradores</h2>
          <p className="text-sm text-muted">
            Quien se registre (y confirme su correo) con uno de estos correos entra como administrador. Uno por línea.
          </p>
          <textarea
            className="min-h-24 w-full rounded-xl border border-line bg-surface px-3 py-2 text-[16px] outline-none ring-brand focus:border-transparent focus:ring-2 md:text-sm"
            value={(s.adminEmails ?? []).join("\n")}
            onChange={(e) => set("adminEmails", e.target.value.split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean))}
            aria-label="Correos de administradores"
          />
        </Card>
        ) : (
        <Card className="p-5 lg:col-span-2">
          <h2 className="text-lg font-semibold">Datos de demostración</h2>
          <p className="mt-1 text-sm text-muted">
            Todo se guarda solo en este navegador. Restablecer borra tus cambios y vuelve a cargar alumnos, clases y ventas de ejemplo.
          </p>
          <Button
            variant="outline"
            className="mt-4 text-red-600"
            onClick={async () => {
              if (!confirm("¿Restablecer todos los datos de demostración? Se perderán tus cambios.")) return;
              await resetDemo();
              setS(useStore.getState().db.settings);
              toast("Datos de demostración restablecidos.");
            }}
          >
            <RotateCcw size={16} /> Restablecer datos demo
          </Button>
        </Card>
        )}
      </div>

      {dirty && (
        <div className="pb-safe fixed inset-x-0 bottom-16 z-20 flex justify-center px-4 md:bottom-6">
          <Button size="lg" className="shadow-lg" onClick={save}>
            <Save size={18} /> Guardar cambios
          </Button>
        </div>
      )}
    </div>
  );
}
