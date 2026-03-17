import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CalendarIcon, Search, Filter, X, SlidersHorizontal } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
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
  soloAsistenciaPerfecta: boolean;
  personaId: string;
}

interface FiltersSidebarProps {
  filters: FilterValues;
  onFilterChange: (filters: FilterValues) => void;
  catalogos?: CatalogosResponse;
  hideDepartamento?: boolean;
}

export function FiltersSidebar({ filters, onFilterChange, catalogos, hideDepartamento }: FiltersSidebarProps) {
  const [open, setOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: filters.from, to: filters.to });

  const update = (partial: Partial<FilterValues>) => {
    onFilterChange({ ...filters, ...partial });
  };

  const handleDateSelect = (range: DateRange | undefined) => {
    setDateRange(range);
    if (range?.from && range?.to) {
      update({ from: range.from, to: range.to });
    }
  };

  const hasActiveFilters = filters.grupo || filters.turno || filters.semaforoEntrada || filters.semaforoAlmuerzo || filters.soloAlertas || filters.soloAsistenciaPerfecta || filters.personaId || filters.departamento;
  const activeCount = [filters.grupo, filters.turno, filters.semaforoEntrada, filters.semaforoAlmuerzo, filters.soloAlertas, filters.soloAsistenciaPerfecta, filters.departamento].filter(Boolean).length;

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
      soloAsistenciaPerfecta: false,
      personaId: "",
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-white/5 px-1.5 py-1 text-[10px] font-medium text-white hover:bg-white/10">
          <SlidersHorizontal className="h-3 w-3" />
          {activeCount > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
              {activeCount}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[320px] sm:w-[380px] overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" />
              Filtros
            </SheetTitle>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" /> Limpiar
              </button>
            )}
          </div>
        </SheetHeader>

        <div className="space-y-6">
          {/* Date Range Calendar */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Período</label>
            <div className="flex items-center gap-2 rounded-lg border border-input bg-muted/30 px-3 py-2 text-sm">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <span>
                {format(filters.from, "dd MMM", { locale: es })} — {format(filters.to, "dd MMM yyyy", { locale: es })}
              </span>
            </div>
            <div className="rounded-lg border border-border p-2">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={handleDateSelect}
                numberOfMonths={1}
                locale={es}
                className="pointer-events-auto"
              />
            </div>
          </div>

          {/* Search */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Buscar empleado</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder="Nombre..." 
                value={filters.search} 
                onChange={(e) => update({ search: e.target.value })} 
                className="pl-10" 
              />
            </div>
          </div>

          {/* Departamento - only for admin */}
          {!hideDepartamento && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Departamento</label>
              <Select value={filters.departamento || "all"} onValueChange={(v) => update({ departamento: v === "all" ? "" : v })}>
                <SelectTrigger>
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
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Grupo</label>
            <Select value={filters.grupo || "all"} onValueChange={(v) => update({ grupo: v === "all" ? "" : v })}>
              <SelectTrigger>
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
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Turno</label>
            <Select value={filters.turno || "all"} onValueChange={(v) => update({ turno: v === "all" ? "" : v })}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="diurno">☀️ Diurno</SelectItem>
                <SelectItem value="nocturno">🌙 Nocturno</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Semáforo Entrada */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Semáforo Entrada</label>
            <Select value={filters.semaforoEntrada || "all"} onValueChange={(v) => update({ semaforoEntrada: v === "all" ? "" : v })}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="verde">🟢 A tiempo</SelectItem>
                <SelectItem value="amarillo">🟡 Tolerancia</SelectItem>
                <SelectItem value="rojo">🔴 Tarde</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Semáforo Almuerzo */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Semáforo Almuerzo</label>
            <Select value={filters.semaforoAlmuerzo || "all"} onValueChange={(v) => update({ semaforoAlmuerzo: v === "all" ? "" : v })}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="verde">🟢 Normal</SelectItem>
                <SelectItem value="amarillo">🟡 Extendido</SelectItem>
                <SelectItem value="rojo">🔴 Excedido</SelectItem>
                <SelectItem value="sin_datos">⚪ Sin datos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Solo alertas */}
          <div className="space-y-2">
            <button
              onClick={() => update({ soloAlertas: !filters.soloAlertas, soloAsistenciaPerfecta: filters.soloAlertas ? filters.soloAsistenciaPerfecta : false })}
              className={`flex w-full items-center justify-center gap-2 rounded-lg border py-3 text-sm font-medium transition-colors ${
                filters.soloAlertas
                  ? "border-destructive bg-destructive/10 text-destructive"
                  : "border-input bg-background text-foreground hover:bg-accent"
              }`}
            >
              ⚠️ Solo mostrar alertas
            </button>

            <button
              onClick={() => update({ soloAsistenciaPerfecta: !filters.soloAsistenciaPerfecta, soloAlertas: filters.soloAsistenciaPerfecta ? filters.soloAlertas : false })}
              className={`flex w-full items-center justify-center gap-2 rounded-lg border py-3 text-sm font-medium transition-colors ${
                filters.soloAsistenciaPerfecta
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input bg-background text-foreground hover:bg-accent"
              }`}
            >
              ✅ Solo asistencia perfecta
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
