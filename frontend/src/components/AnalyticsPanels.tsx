import type { RankingEmpleado, PatronSemanal, ResumenDiarioItem } from "@/types/asistencia";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, LineChart, Line, CartesianGrid } from "recharts";
import { Trophy, Calendar, PieChart as PieIcon, TrendingUp, BarChart3 } from "lucide-react";
import { useMemo } from "react";

interface RankingPanelProps {
  ranking: RankingEmpleado[];
}

interface PatronesPanelProps {
  patrones: PatronSemanal[];
}

interface SemaforoDistributionProps {
  items: ResumenDiarioItem[];
}

interface TendenciaDiariaProps {
  items: ResumenDiarioItem[];
}

const COLORS = {
  verde: "hsl(152, 58%, 42%)",
  amarillo: "hsl(45, 93%, 47%)",
  rojo: "hsl(0, 72%, 55%)",
  sin_datos: "hsl(215, 14%, 60%)",
};

export function RankingPanel({ ranking }: RankingPanelProps) {
  if (!ranking.length) return null;

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
        <Trophy className="h-3.5 w-3.5 text-primary" />
        Ranking de Reincidencia
      </div>
      <div className="space-y-1.5">
        {ranking.slice(0, 5).map((emp, idx) => (
          <div key={emp.persona_id} className="flex items-center justify-between rounded-lg bg-muted/50 px-2 py-1.5">
            <div className="flex items-center gap-2">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                idx === 0 ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"
              }`}>
                {idx + 1}
              </span>
              <div>
                <span className="text-[11px] font-medium">{emp.nombre}</span>
                <div className="flex gap-2 text-[9px] text-muted-foreground">
                  <span>{emp.tardanzas} tard.</span>
                  <span>{emp.salidasTempranas} sal.</span>
                </div>
              </div>
            </div>
            <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold text-destructive">
              {emp.incidencias}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PatronesPanel({ patrones }: PatronesPanelProps) {
  if (!patrones.length) return null;

  const data = patrones.map((p) => ({
    dia: p.dia.substring(0, 3),
    tardanzas: p.tardanzas,
    faltas: p.faltas,
  }));

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
        <Calendar className="h-3.5 w-3.5 text-primary" />
        Patrones Semanales
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} barGap={2}>
          <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "hsl(215, 10%, 50%)" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "hsl(215, 10%, 50%)" }} axisLine={false} tickLine={false} width={25} />
          <Tooltip contentStyle={{ background: "hsl(0, 0%, 100%)", border: "1px solid hsl(210, 15%, 90%)", borderRadius: "8px", fontSize: "11px" }} />
          <Bar dataKey="tardanzas" name="Tardanzas" fill={COLORS.amarillo} radius={[4, 4, 0, 0]} />
          <Bar dataKey="faltas" name="Faltas" fill={COLORS.rojo} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SemaforoDistribution({ items }: SemaforoDistributionProps) {
  const data = useMemo(() => {
    const counts = { verde: 0, amarillo: 0, rojo: 0, sin_datos: 0 };
    items.forEach((item) => {
      const key = item.semaforo_entrada as keyof typeof counts;
      if (key in counts) counts[key]++;
    });
    return [
      { name: "A tiempo", value: counts.verde, fill: COLORS.verde },
      { name: "Tolerancia", value: counts.amarillo, fill: COLORS.amarillo },
      { name: "Tarde", value: counts.rojo, fill: COLORS.rojo },
      { name: "Sin datos", value: counts.sin_datos, fill: COLORS.sin_datos },
    ].filter((d) => d.value > 0);
  }, [items]);

  if (!data.length) return null;

  return (
    <div data-chart-id="semaforo" className="rounded-md border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
        <PieIcon className="h-3.5 w-3.5 text-primary" />
        Distribución Semáforo Entrada
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value" stroke="none">
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ background: "hsl(0, 0%, 100%)", border: "1px solid hsl(210, 15%, 90%)", borderRadius: "8px", fontSize: "11px" }} />
          <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: "10px" }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function IncidenciasBarChart({ items }: SemaforoDistributionProps) {
  const data = useMemo(() => {
    const byGroup: Record<string, { tardanzas: number; tempranas: number }> = {};
    items.forEach((item) => {
      if (!item.grupo) return;
      if (!byGroup[item.grupo]) byGroup[item.grupo] = { tardanzas: 0, tempranas: 0 };
      if (item.semaforo_entrada === "rojo") byGroup[item.grupo].tardanzas++;
      if (item.semaforo_salida === "rojo") byGroup[item.grupo].tempranas++;
    });
    return Object.entries(byGroup)
      .map(([grupo, vals]) => ({ grupo: grupo.substring(0, 16), ...vals }))
      .sort((a, b) => {
        const numA = parseInt(a.grupo.replace(/\D/g, ""), 10);
        const numB = parseInt(b.grupo.replace(/\D/g, ""), 10);
        if (!Number.isNaN(numA) && !Number.isNaN(numB)) return numA - numB;
        return a.grupo.localeCompare(b.grupo, "es");
      });
  }, [items]);

  if (!data.length) return null;

  return (
    <div data-chart-id="incidencias" className="rounded-md border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
        <BarChart3 className="h-3.5 w-3.5 text-primary" />
        Incidencias por Grupos
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} layout="vertical" barGap={2}>
          <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(215, 10%, 50%)" }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="grupo" tick={{ fontSize: 9, fill: "hsl(215, 10%, 50%)" }} axisLine={false} tickLine={false} width={80} />
          <Tooltip contentStyle={{ background: "hsl(0, 0%, 100%)", border: "1px solid hsl(210, 15%, 90%)", borderRadius: "8px", fontSize: "11px" }} />
          <Bar dataKey="tardanzas" name="Tardanzas" fill={COLORS.rojo} radius={[0, 4, 4, 0]} stackId="a" />
          <Bar dataKey="tempranas" name="Salidas Ant." fill={COLORS.amarillo} radius={[0, 4, 4, 0]} stackId="a" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TendenciaDiaria({ items }: TendenciaDiariaProps) {
  const data = useMemo(() => {
    const byDate: Record<string, { total: number; onTime: number }> = {};
    items.forEach((item) => {
      if (!byDate[item.fecha]) byDate[item.fecha] = { total: 0, onTime: 0 };
      byDate[item.fecha].total++;
      if (item.semaforo_entrada === "verde") byDate[item.fecha].onTime++;
    });
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, { total, onTime }]) => ({
        fecha: new Date(fecha + "T12:00:00").toLocaleDateString("es-VE", { day: "2-digit", month: "short" }),
        puntualidad: total > 0 ? Math.round((onTime / total) * 100) : 0,
        empleados: total,
      }));
  }, [items]);

  if (!data.length) return null;

  return (
    <div data-chart-id="tendencia" className="rounded-md border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
        <TrendingUp className="h-3.5 w-3.5 text-primary" />
        Tendencia de Puntualidad
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 15%, 90%)" />
          <XAxis dataKey="fecha" tick={{ fontSize: 9, fill: "hsl(215, 10%, 50%)" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 9, fill: "hsl(215, 10%, 50%)" }} axisLine={false} tickLine={false} width={30} domain={[0, 100]} unit="%" />
          <Tooltip contentStyle={{ background: "hsl(0, 0%, 100%)", border: "1px solid hsl(210, 15%, 90%)", borderRadius: "8px", fontSize: "11px" }} formatter={(value: number) => [`${value}%`, "Puntualidad"]} />
          <Line type="monotone" dataKey="puntualidad" stroke={COLORS.verde} strokeWidth={2} dot={{ r: 2.5, fill: COLORS.verde }} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
