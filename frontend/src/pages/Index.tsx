import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { format, subDays } from "date-fns";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardHeader } from "@/components/DashboardHeader";
import { FiltersSidebar, type FilterValues } from "@/components/FiltersSidebar";
import { MetricsCards } from "@/components/MetricsCards";
import { AttendanceTable } from "@/components/AttendanceTable";
import { RankingPanel, PatronesPanel, SemaforoDistribution, TendenciaDiaria, IncidenciasBarChart } from "@/components/AnalyticsPanels";
import { exportAttendancePdf } from "@/utils/exportPdf";
import {
  getResumenDiario,
  getMetadata,
  getCatalogos,
  calcularMetricas,
  calcularRanking,
  calcularPatronesSemanal,
} from "@/services/asistenciaApi";
import type { ResumenResponse, MetadataResponse, CatalogosResponse } from "@/types/asistencia";

const Index = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const userDepartamento = user?.departamento || "";
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [sidebarHeight, setSidebarHeight] = useState<number>(0);

  const [filters, setFilters] = useState<FilterValues>({
    from: subDays(new Date(), 7),
    to: new Date(),
    departamento: isAdmin ? "" : userDepartamento,
    grupo: "",
    turno: "",
    search: "",
    semaforoEntrada: "",
    semaforoAlmuerzo: "",
    soloAlertas: false,
    soloAsistenciaPerfecta: false,
    personaId: "",
  });

  const [resumen, setResumen] = useState<ResumenResponse | null>(null);
  const [allItems, setAllItems] = useState<ResumenResponse | null>(null);
  const [metadata, setMetadata] = useState<MetadataResponse | null>(null);
  const [catalogos, setCatalogos] = useState<CatalogosResponse | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [sortBy, setSortBy] = useState("fecha");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const effectiveDepartamento = isAdmin ? filters.departamento : userDepartamento;

  const fetchData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const params = {
        from: format(filters.from, "yyyy-MM-dd"),
        to: format(filters.to, "yyyy-MM-dd"),
        departamento: effectiveDepartamento || undefined,
        grupo: filters.grupo || undefined,
        turno: (filters.turno as "diurno" | "nocturno") || undefined,
        search: filters.search || undefined,
        semaforoEntrada: (filters.semaforoEntrada as "verde" | "amarillo" | "rojo") || undefined,
        semaforoAlmuerzo: (filters.semaforoAlmuerzo as "verde" | "amarillo" | "rojo" | "sin_datos") || undefined,
        soloAlertas: filters.soloAlertas || undefined,
        soloAsistenciaPerfecta: filters.soloAsistenciaPerfecta || undefined,
        personaId: filters.personaId || undefined,
        page,
        pageSize: 50,
        sortBy,
        sortDir,
      };

      const [res, allRes] = await Promise.all([
        getResumenDiario(params),
        getResumenDiario({ ...params, page: 1, pageSize: 500 }),
      ]);
      setResumen(res);
      setAllItems(allRes);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [filters, page, sortBy, sortDir, effectiveDepartamento, user]);

  useEffect(() => {
    if (!user) return;
    Promise.all([getMetadata(), getCatalogos()]).then(([meta, cat]) => {
      setMetadata(meta);
      setCatalogos(cat);
    });
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (sidebarRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setSidebarHeight(entry.contentRect.height);
        }
      });
      resizeObserver.observe(sidebarRef.current);
      return () => resizeObserver.disconnect();
    }
  }, []);

  const metricas = useMemo(() => calcularMetricas(allItems?.items || []), [allItems]);
  const ranking = useMemo(() => calcularRanking(allItems?.items || []), [allItems]);
  const patrones = useMemo(() => calcularPatronesSemanal(allItems?.items || []), [allItems]);

  const handleSort = (field: string) => {
    if (sortBy === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(field); setSortDir("desc"); }
    setPage(1);
  };

  const handleFilterChange = (newFilters: FilterValues) => {
    setFilters(newFilters);
    setPage(1);
  };

  if (!user) return <Navigate to="/login" replace />;

  const filterButton = (
    <FiltersSidebar
      filters={filters}
      onFilterChange={handleFilterChange}
      catalogos={catalogos}
      hideDepartamento={!isAdmin}
    />
  );

  return (
    <div className="flex h-screen flex-col bg-background">
      <DashboardHeader
        lastUpdated={metadata?.processed_at_utc}
        onRefresh={fetchData}
        isLoading={isLoading}
        filterSlot={filterButton}
        dateRangeLabel={`${format(filters.from, "dd MMM yyyy")} — ${format(filters.to, "dd MMM yyyy")}`}
        onExportPdf={() => { exportAttendancePdf(allItems?.items || [], filters, allItems?.pagination.total || 0); }}
      />

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-[1600px] space-y-3 p-3 md:p-4">
          <MetricsCards metricas={metricas} totalRegistros={allItems?.pagination.total || 0} />

          {/* Charts row - 3 columns */}
          <div className="grid gap-3 md:grid-cols-3">
            <SemaforoDistribution items={allItems?.items || []} />
            <IncidenciasBarChart items={allItems?.items || []} />
            <TendenciaDiaria items={allItems?.items || []} />
          </div>

          {/* Table and sidebar */}
          <div className="grid gap-3 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <AttendanceTable
                items={resumen?.items || []}
                pagination={resumen?.pagination || { page: 1, pageSize: 50, total: 0, totalPages: 0 }}
                onPageChange={setPage}
                onSort={handleSort}
                sortBy={sortBy}
                sortDir={sortDir}
                isLoading={isLoading}
                maxHeight={sidebarHeight > 0 ? sidebarHeight : undefined}
              />
            </div>
            <div ref={sidebarRef} className="space-y-3">
              <RankingPanel ranking={ranking} />
              <PatronesPanel patrones={patrones} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
