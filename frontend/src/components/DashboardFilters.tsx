import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { CalendarIcon, Search, Filter, X } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { CatalogosResponse } from "@/types/asistencia";

export interface FilterValues {
  from: Date;
  to: Date;
  departamento: string;
  grupo: string;
  turno: string;
  search: string;
  semaforoEntrada: string;
  semaforoAlmuerzo: string;
  soloAlertas: boolean;
  personaId: string;
}

interface DashboardFiltersProps {
  filters: FilterValues;
  onFilterChange: (filters: FilterValues) => void;
  catalogos?: CatalogosResponse;
  hideDepartamento?: boolean;
}

export function DashboardFilters({ filters, onFilterChange, catalogos, hideDepartamento }: DashboardFiltersProps) {
  const [rangeOpen, setRangeOpen] = useState(false);
  const [rangeStart, setRangeStart] = useState<Date | undefined>(undefined);
  const update = (partial: Partial<FilterValues>) => {
    onFilterChange({ ...filters, ...partial });
  };

  const hasActiveFilters = filters.grupo || filters.turno || filters.semaforoEntrada || filters.semaforoAlmuerzo || filters.soloAlertas || filters.personaId || filters.departamento;

  const clearFilters = () => {
    onFilterChange({
      ...filters,
      departamento: "",
      grupo: "",
      turno: "",
      search: "",
      semaforoEntrada: "",
      semaforoAlmuerzo: "",
      soloAlertas: false,
      personaId: "",
    });
  };

  return (
    <div className="space-y-3 rounded-md border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Filter className="h-4 w-4 text-primary" />
          Filtros
        </div>
        {hasActiveFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" /> Limpiar
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {/* Date Range */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Período</label>
          <Popover open={rangeOpen} onOpenChange={(open) => { setRangeOpen(open); if (!open) setRangeStart(undefined); }}>
            <PopoverTrigger asChild>
              <button className="flex h-9 items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm">
                <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                {format(filters.from, "dd/MM", { locale: es })} — {format(filters.to, "dd/MM/yy", { locale: es })}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={rangeStart ? { from: rangeStart, to: undefined } : { from: filters.from, to: filters.to }}
                onSelect={(range) => {
                  if (!rangeStart) {
                    // First click: set start, keep open
                    setRangeStart(range?.from);
                  } else {
                    // Second click: set full range and close
                    if (range?.from && range?.to) {
                      update({ from: range.from, to: range.to });
                      setRangeStart(undefined);
                      setRangeOpen(false);
                    } else if (range?.from) {
                      // Clicked same day or before start
                      update({ from: range.from, to: range.from });
                      setRangeStart(undefined);
                      setRangeOpen(false);
                    }
                  }
                }}
                numberOfMonths={2}
                locale={es}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Search */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Buscar empleado</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Nombre..." value={filters.search} onChange={(e) => update({ search: e.target.value })} className="h-9 w-48 pl-8 text-sm" />
          </div>
        </div>

        {/* Departamento - only for admin */}
        {!hideDepartamento && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Departamento</label>
            <Select value={filters.departamento || "all"} onValueChange={(v) => update({ departamento: v === "all" ? "" : v })}>
              <SelectTrigger className="h-9 w-36 text-sm">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {catalogos?.departamentos?.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Grupo */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Grupo</label>
          <Select value={filters.grupo || "all"} onValueChange={(v) => update({ grupo: v === "all" ? "" : v })}>
            <SelectTrigger className="h-9 w-32 text-sm">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {catalogos?.grupos.map((g) => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Turno */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Turno</label>
          <Select value={filters.turno || "all"} onValueChange={(v) => update({ turno: v === "all" ? "" : v })}>
            <SelectTrigger className="h-9 w-32 text-sm">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="diurno">Diurno</SelectItem>
              <SelectItem value="nocturno">Nocturno</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Semáforo Entrada */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Semáforo Entrada</label>
          <Select value={filters.semaforoEntrada || "all"} onValueChange={(v) => update({ semaforoEntrada: v === "all" ? "" : v })}>
            <SelectTrigger className="h-9 w-32 text-sm">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="verde">🟢 Verde</SelectItem>
              <SelectItem value="amarillo">🟡 Amarillo</SelectItem>
              <SelectItem value="rojo">🔴 Rojo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Semáforo Almuerzo */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Semáforo Almuerzo</label>
          <Select value={filters.semaforoAlmuerzo || "all"} onValueChange={(v) => update({ semaforoAlmuerzo: v === "all" ? "" : v })}>
            <SelectTrigger className="h-9 w-36 text-sm">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="verde">🟢 Verde</SelectItem>
              <SelectItem value="amarillo">🟡 Amarillo</SelectItem>
              <SelectItem value="rojo">🔴 Rojo</SelectItem>
              <SelectItem value="sin_datos">⚪ Sin datos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Solo alertas */}
        <button
          onClick={() => update({ soloAlertas: !filters.soloAlertas })}
          className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors ${
            filters.soloAlertas
              ? "border-destructive bg-destructive/10 text-destructive"
              : "border-input bg-background text-foreground hover:bg-accent"
          }`}
        >
          ⚠️ Solo alertas
        </button>
      </div>
    </div>
  );
}
