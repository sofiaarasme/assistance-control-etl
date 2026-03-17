import type { MetricasAsistencia } from "@/types/asistencia";
import { CheckCircle2, Clock, Timer, Target } from "lucide-react";

interface MetricsCardsProps {
  metricas: MetricasAsistencia;
  totalRegistros: number;
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel?: string;
  accent?: boolean;
}

function MetricCard({ icon, label, value, sublabel, accent }: MetricCardProps) {
  return (
    <div className={`rounded-md border p-4 transition-shadow hover:shadow-md ${accent ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className={`text-2xl font-bold ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
          {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
        </div>
        <div className={`rounded-lg p-2 ${accent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export function MetricsCards({ metricas, totalRegistros }: MetricsCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <MetricCard
        icon={<CheckCircle2 className="h-5 w-5" />}
        label="Asistencia perfecta"
        value={`${metricas.asistenciaPerfecta.toFixed(1)}%`}
        sublabel={`de ${totalRegistros} jornadas`}
        accent
      />
      <MetricCard
        icon={<Clock className="h-5 w-5" />}
        label="Puntualidad general"
        value={`${metricas.puntualidadGeneral.toFixed(1)}%`}
        sublabel={`${metricas.jornadasPuntuales} jornadas a tiempo`}
      />
      <MetricCard
        icon={<Timer className="h-5 w-5" />}
        label="Horas promedio trabajadas"
        value={`${metricas.horasPromedioTrabajadas.toFixed(1)} h`}
        sublabel="por jornada (neto sin almuerzo)"
      />
      <MetricCard
        icon={<Target className="h-5 w-5" />}
        label="% Adherencia a la jornada"
        value={`${metricas.adherenciaJornada}%`}
        sublabel="real vs. teórico"
      />
    </div>
  );
}
