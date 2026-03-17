import type { ResumenDiarioItem, Pagination } from "@/types/asistencia";
import { SemaforoBadge } from "@/components/SemaforoBadge";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";

interface AttendanceTableProps {
  items: ResumenDiarioItem[];
  pagination: Pagination;
  onPageChange: (page: number) => void;
  onSort: (field: string) => void;
  sortBy: string;
  sortDir: "asc" | "desc";
  isLoading: boolean;
  maxHeight?: number;
}

const columns = [
  { key: "fecha", label: "Fecha", width: "w-24" },
  { key: "nombre", label: "Empleado", width: "w-40" },
  { key: "departamento", label: "Depto.", width: "w-28" },
  { key: "grupo", label: "Grupo", width: "w-20" },
  { key: "turno", label: "Turno", width: "w-24" },
  { key: "semaforo_entrada", label: "Entrada", width: "w-24" },
  { key: "semaforo_almuerzo", label: "Almuerzo", width: "w-24" },
  { key: "semaforo_salida", label: "Salida", width: "w-24" },
  { key: "marcas_faltantes", label: "Marcas", width: "w-20" },
  { key: "horas_en_planta", label: "Hrs Planta", width: "w-20" },
];

function formatTime(isoStr: string | null) {
  if (!isoStr) return "—";
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
}

function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("es-VE", { day: "2-digit", month: "short" });
  } catch { return dateStr; }
}

export function AttendanceTable({ items, pagination, onPageChange, onSort, sortBy, sortDir, isLoading, maxHeight }: AttendanceTableProps) {
  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return <ChevronUp className="h-3 w-3 opacity-0 group-hover:opacity-30" />;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3 text-primary" /> : <ChevronDown className="h-3 w-3 text-primary" />;
  };

  const tableHeight = maxHeight ? `${maxHeight}px` : "500px";

  return (
    <div 
      className="flex flex-col rounded-md border border-border bg-card overflow-hidden" 
      style={{ height: tableHeight, minHeight: "400px" }}
    >
      {/* Scrollable table area */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b border-border bg-muted/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`group cursor-pointer px-2 py-2 text-left text-[10px] font-semibold text-muted-foreground hover:text-foreground ${col.width}`}
                  onClick={() => onSort(col.key)}
                >
                  <div className="flex items-center gap-0.5">
                    {col.label}
                    <SortIcon field={col.key} />
                  </div>
                </th>
              ))}
              <th className="px-2 py-2 text-left text-[10px] font-semibold text-muted-foreground w-16">Horario</th>
            </tr>
          </thead>
          <tbody className={isLoading ? "opacity-50" : ""}>
            {items.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-12 text-center text-muted-foreground text-xs">
                  No se encontraron registros con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              items.map((item, idx) => (
                <tr
                  key={`${item.persona_id}-${item.fecha}-${idx}`}
                  className={`border-b border-border/50 transition-colors hover:bg-accent/30 ${item.alerta_general ? "bg-destructive/[0.03]" : ""}`}
                >
                  <td className="px-2 py-1.5 font-medium">{formatDate(item.fecha)}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-1">
                      {item.alerta_general && <AlertTriangle className="h-2.5 w-2.5 flex-shrink-0 text-destructive" />}
                      <span className="font-medium truncate max-w-[120px]">{item.nombre}</span>
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <span className="inline-flex items-center rounded bg-secondary px-1 py-0.5 text-[9px] font-medium text-secondary-foreground">
                      {item.departamento}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground">{item.grupo}</td>
                  <td className="px-2 py-1.5">
                    <span className={`inline-flex items-center gap-0.5 whitespace-nowrap rounded px-1 py-0.5 text-[9px] font-medium ${
                      item.turno === "diurno" ? "bg-accent text-accent-foreground" : "bg-foreground/10 text-foreground"
                    }`}>
                      {item.turno === "diurno" ? "☀️Diurno" : "🌙Nocturno"}
                    </span>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-1">
                      <SemaforoBadge color={item.semaforo_entrada} />
                      {item.entrada_tarde_segundos != null && item.entrada_tarde_segundos > 0 && (
                        <span className="text-[9px] text-muted-foreground">+{Math.ceil(item.entrada_tarde_segundos / 60)}m</span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-1">
                      <SemaforoBadge color={item.semaforo_almuerzo} />
                      {item.duracion_almuerzo_minutos != null && (
                        <span className="text-[9px] text-muted-foreground">{item.duracion_almuerzo_minutos}m</span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-1">
                      <SemaforoBadge color={item.semaforo_salida} label={
                        item.semaforo_salida === "verde" ? "OK" : item.semaforo_salida === "amarillo" ? "Tol" : "Ant"
                      } />
                      {item.salida_anticipada_segundos != null && item.salida_anticipada_segundos > 0 && (
                        <span className="text-[9px] text-muted-foreground">-{Math.ceil(item.salida_anticipada_segundos / 60)}m</span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-1">
                      <span className={`font-semibold ${item.marcas_faltantes > 0 ? "text-destructive" : "text-foreground"}`}>
                        {item.total_registros}/{item.marcas_esperadas}
                      </span>
                      {item.marcas_faltantes > 0 && (
                        <span className="rounded bg-destructive/10 px-0.5 text-[8px] font-medium text-destructive">
                          -{item.marcas_faltantes}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 font-mono">
                    {item.horas_en_planta != null ? `${item.horas_en_planta.toFixed(1)}h` : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-[9px] text-muted-foreground">
                    <div>{formatTime(item.primer_registro)}</div>
                    <div>{formatTime(item.ultimo_registro)}</div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Fixed pagination */}
      <div className="flex items-center justify-between border-t border-border px-4 py-2.5 bg-card">
        <span className="text-xs text-muted-foreground">
          {pagination.total} registros · Pág. {pagination.page}/{pagination.totalPages}
        </span>
        <div className="flex items-center gap-1">
          <button disabled={pagination.page <= 1} onClick={() => onPageChange(pagination.page - 1)}
            className="rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button disabled={pagination.page >= pagination.totalPages} onClick={() => onPageChange(pagination.page + 1)}
            className="rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
