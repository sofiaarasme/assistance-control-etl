import type { SemaforoColor, SemaforoAlmuerzo } from "@/types/asistencia";

interface SemaforoBadgeProps {
  color: SemaforoColor | SemaforoAlmuerzo;
  label?: string;
  size?: "sm" | "md";
}

const colorConfig: Record<string, { bg: string; text: string; ring: string; dot: string; label: string }> = {
  verde: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-400",
    ring: "ring-emerald-200 dark:ring-emerald-800",
    dot: "bg-emerald-500",
    label: "A tiempo",
  },
  amarillo: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-400",
    ring: "ring-amber-200 dark:ring-amber-800",
    dot: "bg-amber-500",
    label: "Tolerancia",
  },
  rojo: {
    bg: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-700 dark:text-rose-400",
    ring: "ring-rose-200 dark:ring-rose-800",
    dot: "bg-rose-500",
    label: "Tarde",
  },
  sin_datos: {
    bg: "bg-slate-50 dark:bg-slate-900/40",
    text: "text-slate-500 dark:text-slate-400",
    ring: "ring-slate-200 dark:ring-slate-700",
    dot: "bg-slate-400",
    label: "Sin datos",
  },
};

export function SemaforoBadge({ color, label, size = "sm" }: SemaforoBadgeProps) {
  const config = colorConfig[color] || colorConfig.sin_datos;
  const sizeClasses = size === "md" ? "px-3 py-1.5 text-xs gap-2" : "px-2 py-0.5 text-[10px] gap-1.5";
  const dotSize = size === "md" ? "h-2.5 w-2.5" : "h-2 w-2";

  return (
    <span className={`inline-flex items-center rounded-full font-semibold ring-1 ring-inset ${sizeClasses} ${config.bg} ${config.text} ${config.ring}`}>
      <span className={`inline-block rounded-full ${dotSize} ${config.dot} ${color !== "sin_datos" ? "animate-pulse-dot" : ""}`} />
      {label || config.label}
    </span>
  );
}

// Compact dot-only version for tight spaces
export function SemaforoDot({ color }: { color: SemaforoColor | SemaforoAlmuerzo }) {
  const config = colorConfig[color] || colorConfig.sin_datos;
  return (
    <span className={`inline-block h-3 w-3 rounded-full ring-2 ring-inset ${config.dot} ${config.ring}`} 
      title={config.label} />
  );
}
