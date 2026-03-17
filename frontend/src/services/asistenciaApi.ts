import { DEPARTAMENTOS } from "@/config/departamentos";
import type {
  ResumenResponse,
  EventosResponse,
  MetadataResponse,
  CatalogosResponse,
  ResumenQueryParams,
  MetricasAsistencia,
  RankingEmpleado,
  PatronSemanal,
  ResumenDiarioItem,
} from "@/types/asistencia";

const API_BASE = "https://api.tuempresa.com";
const USE_MOCK = true;

async function fetchApi<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  if (USE_MOCK) return fetchMock<T>(endpoint, params);
  const url = new URL(`${API_BASE}${endpoint}`);
  if (params) Object.entries(params).forEach(([k, v]) => { if (v) url.searchParams.set(k, v); });
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

// ---- PUBLIC API ----

export async function getResumenDiario(params: ResumenQueryParams): Promise<ResumenResponse> {
  const q: Record<string, string> = { from: params.from, to: params.to };
  if (params.departamento) q.departamento = params.departamento;
  if (params.grupo) q.grupo = params.grupo;
  if (params.turno) q.turno = params.turno;
  if (params.personaId) q.personaId = params.personaId;
  if (params.search) q.search = params.search;
  if (params.semaforoEntrada) q.semaforoEntrada = params.semaforoEntrada;
  if (params.semaforoAlmuerzo) q.semaforoAlmuerzo = params.semaforoAlmuerzo;
  if (params.soloAlertas) q.soloAlertas = "true";
  if (params.soloAsistenciaPerfecta) q.soloAsistenciaPerfecta = "true";
  if (params.page) q.page = String(params.page);
  if (params.pageSize) q.pageSize = String(params.pageSize);
  if (params.sortBy) q.sortBy = params.sortBy;
  if (params.sortDir) q.sortDir = params.sortDir;
  return fetchApi<ResumenResponse>("/api/v1/asistencia/resumen", q);
}

export async function getEventos(params: Record<string, string>): Promise<EventosResponse> {
  return fetchApi<EventosResponse>("/api/v1/asistencia/eventos", params);
}

export async function getMetadata(): Promise<MetadataResponse> {
  return fetchApi<MetadataResponse>("/api/v1/asistencia/metadata");
}

export async function getCatalogos(): Promise<CatalogosResponse> {
  return fetchApi<CatalogosResponse>("/api/v1/asistencia/catalogos");
}

// ---- COMPUTED METRICS ----

export function calcularMetricas(items: ResumenDiarioItem[]): MetricasAsistencia {
  if (!items.length) {
    return {
      asistenciaPerfecta: 0,
      puntualidadGeneral: 0,
      jornadasPuntuales: 0,
      horasPromedioTrabajadas: 0,
      tiempoTotalTardanzas: 0,
      tiempoSalidasAnticipadas: 0,
      horasExtrasPotenciales: 0,
      adherenciaJornada: 0,
      promedioAsistenciaDiaria: 0,
    };
  }

  const perfectos = items.filter(
    (i) => i.semaforo_entrada === "verde" && i.semaforo_salida === "verde" && (i.semaforo_almuerzo === "verde" || i.semaforo_almuerzo === "sin_datos") && i.marcas_faltantes === 0
  );

  const tardanzaMinutos = items.reduce((sum, i) => sum + (i.entrada_tarde_segundos || 0) / 60, 0);
  const salidasAnticipadas = items.reduce((sum, i) => sum + (i.salida_anticipada_segundos || 0) / 60, 0);

  const jornadasPuntuales = items.filter((i) => i.semaforo_entrada === "verde").length;
  const puntualidadGeneral = (jornadasPuntuales / items.length) * 100;

  let totalHorasTrabajadas = 0;
  let countHorasTrabajadas = 0;

  items.forEach((i) => {
    if (i.horas_en_planta != null) {
      let almuerzoHoras = 0;
      if (i.duracion_almuerzo_segundos != null) {
        // Regla UI: considerar 1h de almuerzo estándar cuando existe almuerzo
        almuerzoHoras = 1;
      } else if (i.semaforo_almuerzo !== "sin_datos") {
        almuerzoHoras = 1;
      } else {
        // Sin datos de almuerzo: asumimos que no se descontará tiempo
        almuerzoHoras = 0;
      }
      const efectivas = Math.max(i.horas_en_planta - almuerzoHoras, 0);
      totalHorasTrabajadas += efectivas;
      countHorasTrabajadas += 1;
    }
  });

  const horasPromedioTrabajadas =
    countHorasTrabajadas > 0
      ? Math.round((totalHorasTrabajadas / countHorasTrabajadas) * 10) / 10
      : 0;

  const horasExtras = items.reduce((sum, i) => {
    if (!i.ultimo_registro || !i.jornada_fin_programada) return sum;
    const fin = new Date(i.jornada_fin_programada).getTime();
    const salida = new Date(i.ultimo_registro).getTime();
    const diff = (salida - fin) / 3600000;
    return sum + (diff > 0 ? diff : 0);
  }, 0);

  const tiempoTeorico = 12;
  const tiempoRealPromedio = items.reduce((sum, i) => sum + (i.horas_en_planta || 0), 0) / items.length;
  const adherencia = (tiempoRealPromedio / tiempoTeorico) * 100;

  const fechasUnicas = new Set(items.map((i) => i.fecha));
  const promedioAsistencia = items.length / fechasUnicas.size;

  return {
    asistenciaPerfecta: (perfectos.length / items.length) * 100,
    puntualidadGeneral,
    jornadasPuntuales,
    horasPromedioTrabajadas,
    tiempoTotalTardanzas: Math.round(tardanzaMinutos * 10) / 10,
    tiempoSalidasAnticipadas: Math.round(salidasAnticipadas * 10) / 10,
    horasExtrasPotenciales: Math.round(horasExtras * 10) / 10,
    adherenciaJornada: Math.min(Math.round(adherencia * 10) / 10, 100),
    promedioAsistenciaDiaria: Math.round(promedioAsistencia * 10) / 10,
  };
}

export function calcularRanking(items: ResumenDiarioItem[]): RankingEmpleado[] {
  const map = new Map<string, RankingEmpleado>();
  items.forEach((i) => {
    const existing = map.get(i.persona_id) || { persona_id: i.persona_id, nombre: i.nombre, incidencias: 0, tardanzas: 0, salidasTempranas: 0 };
    if (i.semaforo_entrada === "rojo" || i.semaforo_entrada === "amarillo") { existing.tardanzas++; existing.incidencias++; }
    if (i.salida_anticipada_segundos && i.salida_anticipada_segundos > 0) { existing.salidasTempranas++; existing.incidencias++; }
    map.set(i.persona_id, existing);
  });
  return Array.from(map.values()).sort((a, b) => b.incidencias - a.incidencias).slice(0, 10);
}

export function calcularPatronesSemanal(items: ResumenDiarioItem[]): PatronSemanal[] {
  const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const stats = dias.map((dia) => ({ dia, tardanzas: 0, faltas: 0, total: 0 }));
  items.forEach((i) => {
    const dayIndex = new Date(i.fecha + "T12:00:00").getDay();
    stats[dayIndex].total++;
    if (i.semaforo_entrada === "rojo" || i.semaforo_entrada === "amarillo") stats[dayIndex].tardanzas++;
    if (i.marcas_faltantes >= 3) stats[dayIndex].faltas++;
  });
  return stats;
}

// ---- MOCK DATA ----

const MOCK_NOMBRES: { nombre: string; depto: string }[] = [
  { nombre: "Gregorio Lobo", depto: "Producción" },
  { nombre: "María González", depto: "Producción" },
  { nombre: "Carlos Pérez", depto: "Producción" },
  { nombre: "Ana Rodríguez", depto: "Calidad" },
  { nombre: "José Martínez", depto: "Calidad" },
  { nombre: "Luis Hernández", depto: "Calidad" },
  { nombre: "Carmen López", depto: "Mantenimiento" },
  { nombre: "Pedro Ramírez", depto: "Mantenimiento" },
  { nombre: "Rosa Torres", depto: "Producción" },
  { nombre: "Miguel Flores", depto: "Producción" },
  { nombre: "Diana Morales", depto: "Calidad" },
  { nombre: "Andrés Vargas", depto: "Mantenimiento" },
  { nombre: "Patricia Reyes", depto: "Producción" },
  { nombre: "Fernando Díaz", depto: "Producción" },
  { nombre: "Sofía Cruz", depto: "Calidad" },
  { nombre: "Roberto Mendoza", depto: "Mantenimiento" },
  { nombre: "Isabella Navarro", depto: "Producción" },
  { nombre: "Juan Castillo", depto: "Mantenimiento" },
  { nombre: "Valentina Rivas", depto: "Calidad" },
  { nombre: "David Paredes", depto: "Producción" },
];

const MOCK_GRUPOS = ["Grupo 1", "Grupo 2", "Grupo 3", "Grupo 4"];

function generateMockItems(from: string, to: string, filters?: Record<string, string>): ResumenDiarioItem[] {
  const items: ResumenDiarioItem[] = [];
  const startDate = new Date(from + "T00:00:00");
  const endDate = new Date(to + "T00:00:00");

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const fecha = d.toISOString().split("T")[0];
    const dayOfYear = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);

    MOCK_NOMBRES.forEach(({ nombre, depto }, idx) => {
      const cycleDay = (dayOfYear + idx * 2) % 8;
      if (cycleDay >= 4) return;

      const turno = cycleDay < 2 ? "diurno" : "nocturno";
      const grupo = MOCK_GRUPOS[idx % 4];
      const personaId = String(14678330 + idx);

      if (filters?.departamento && filters.departamento !== depto) return;
      if (filters?.grupo && filters.grupo !== grupo) return;
      if (filters?.turno && filters.turno !== turno) return;
      if (filters?.personaId && filters.personaId !== personaId) return;
      if (filters?.search && !nombre.toLowerCase().includes(filters.search.toLowerCase())) return;

      const seed = (idx * 31 + dayOfYear * 7) % 100;
      let entradaTardeSegundos = 0;
      let semaforoEntrada: "verde" | "amarillo" | "rojo" = "verde";

      if (seed < 60) { entradaTardeSegundos = 0; semaforoEntrada = "verde"; }
      else if (seed < 80) { entradaTardeSegundos = (seed % 59) + 1; semaforoEntrada = "amarillo"; }
      else { entradaTardeSegundos = 60 + (seed % 300); semaforoEntrada = "rojo"; }

      if (filters?.semaforoEntrada && filters.semaforoEntrada !== semaforoEntrada) return;

      const totalRegistros = seed < 10 ? 2 : seed < 20 ? 3 : 4;
      const marcasFaltantes = 4 - totalRegistros;
      const alertaMarcas = marcasFaltantes >= 2 ? "rojo" : marcasFaltantes === 1 ? "amarillo" : "verde";

      // Semáforo almuerzo
      let semaforoAlmuerzo: "verde" | "amarillo" | "rojo" | "sin_datos" = "verde";
      let duracionAlmuerzoSegundos: number | null = null;
      let salidaAlm: string | null = null;
      let regresoAlm: string | null = null;

      if (totalRegistros >= 4) {
        const almBase = turno === "diurno" ? 12 : 0;
        const almSeed = (seed * 13) % 100;
        if (almSeed < 70) { duracionAlmuerzoSegundos = 2400 + (almSeed % 1200); semaforoAlmuerzo = "verde"; }
        else if (almSeed < 85) { duracionAlmuerzoSegundos = 3600 + (almSeed % 59); semaforoAlmuerzo = "amarillo"; }
        else { duracionAlmuerzoSegundos = 3660 + (almSeed % 600); semaforoAlmuerzo = "rojo"; }
        salidaAlm = `${fecha}T${String(almBase).padStart(2, "0")}:30:00`;
        const regresoMin = Math.floor(duracionAlmuerzoSegundos / 60);
        regresoAlm = `${fecha}T${String(almBase).padStart(2, "0")}:${String(30 + regresoMin).padStart(2, "0")}:00`;
      } else {
        semaforoAlmuerzo = "sin_datos";
      }

      if (filters?.semaforoAlmuerzo && filters.semaforoAlmuerzo !== semaforoAlmuerzo) return;
      if (filters?.soloAlertas === "true" && semaforoEntrada === "verde" && semaforoAlmuerzo !== "rojo" && marcasFaltantes === 0) return;

      // Jornada times
      const jornadaInicio = turno === "diurno" ? `${fecha}T07:00:00` : `${fecha}T19:00:00`;
      const nextDay = new Date(d); nextDay.setDate(nextDay.getDate() + 1);
      const nextFecha = nextDay.toISOString().split("T")[0];
      const jornadaFin = turno === "diurno" ? `${fecha}T19:00:00` : `${nextFecha}T07:00:00`;

      // Primer registro
      const baseHour = turno === "diurno" ? 7 : 19;
      const primerReg = `${fecha}T${String(baseHour).padStart(2, "0")}:${String(Math.floor(entradaTardeSegundos / 60)).padStart(2, "0")}:${String(entradaTardeSegundos % 60).padStart(2, "0")}`;

      // Salida: calculate exit semaphore (tolerance for leaving EARLY)
      // verde: salió a su hora o después
      // amarillo: salió entre -1 y -59 segundos antes de su hora
      // rojo: salió 60+ segundos antes de su hora
      const salidaSeed = (seed * 17) % 100;
      let salidaAnticipadaSegundos = 0;
      let semaforoSalida: "verde" | "amarillo" | "rojo" = "verde";

      if (salidaSeed < 65) {
        salidaAnticipadaSegundos = 0;
        semaforoSalida = "verde";
      } else if (salidaSeed < 80) {
        salidaAnticipadaSegundos = (salidaSeed % 59) + 1;
        semaforoSalida = "amarillo";
      } else {
        salidaAnticipadaSegundos = 60 + (salidaSeed % 900);
        semaforoSalida = "rojo";
      }

      if (filters?.soloAsistenciaPerfecta === "true" && !(semaforoEntrada === "verde" && semaforoAlmuerzo === "verde" && semaforoSalida === "verde")) return;

      const salidaHour = turno === "diurno" ? 19 : 7;
      const salidaFecha = turno === "diurno" ? fecha : nextFecha;
      const finTime = new Date(`${salidaFecha}T${String(salidaHour).padStart(2, "0")}:00:00`);
      const ultimoRegTime = new Date(finTime.getTime() - salidaAnticipadaSegundos * 1000 + (salidaSeed < 65 ? (salidaSeed % 600) * 1000 : 0));
      const ultimoReg = ultimoRegTime.toISOString().replace("Z", "").split(".")[0];

      const horasEnPlanta = totalRegistros >= 2
        ? Math.round((ultimoRegTime.getTime() - new Date(primerReg).getTime()) / 3600000 * 100) / 100
        : null;

      items.push({
        persona_id: personaId,
        nombre,
        fecha,
        departamento: depto,
        grupo,
        turno: turno as "diurno" | "nocturno",
        jornada_inicio_programada: jornadaInicio,
        jornada_fin_programada: jornadaFin,
        primer_registro: primerReg,
        ultimo_registro: ultimoReg,
        total_registros: totalRegistros,
        marcas_esperadas: 4,
        marcas_faltantes: marcasFaltantes,
        alerta_marcas: alertaMarcas as "verde" | "amarillo" | "rojo",
        entrada_tarde_segundos: entradaTardeSegundos > 0 ? entradaTardeSegundos : null,
        semaforo_entrada: semaforoEntrada,
        salida_anticipada_segundos: salidaAnticipadaSegundos > 0 ? salidaAnticipadaSegundos : null,
        semaforo_salida: semaforoSalida,
        salida_almuerzo: salidaAlm,
        regreso_almuerzo: regresoAlm,
        duracion_almuerzo_segundos: duracionAlmuerzoSegundos,
        duracion_almuerzo_minutos: duracionAlmuerzoSegundos ? Math.round(duracionAlmuerzoSegundos / 60 * 10) / 10 : null,
        semaforo_almuerzo: semaforoAlmuerzo,
        alerta_general: semaforoEntrada !== "verde" || semaforoSalida !== "verde" || semaforoAlmuerzo === "rojo" || marcasFaltantes > 0,
        horas_en_planta: horasEnPlanta,
        source_file_name: `asistencia_${from}_${to}.csv`,
        periodo_inicio: from,
        periodo_fin: to,
      });
    });
  }
  return items;
}

async function fetchMock<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  await new Promise((r) => setTimeout(r, 300));

  if (endpoint.includes("/catalogos")) {
    return {
      grupos: MOCK_GRUPOS,
      departamentos: [...DEPARTAMENTOS],
      turnos: ["diurno", "nocturno"],
      personas: MOCK_NOMBRES.map(({ nombre }, idx) => ({ persona_id: String(14678330 + idx), nombre })),
    } as T;
  }

  if (endpoint.includes("/metadata")) {
    return {
      processed_at_utc: new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z",
      source_files_count: 12,
      records_eventos_historico: 8302,
      records_resumen_historico: 1875,
      fecha_min: "2026-01-01 06:30:00",
      fecha_max: "2026-03-31 20:05:00",
      required_filename_format: "asistencia_YYYY-MM-DD_YYYY-MM-DD.csv",
    } as T;
  }

  if (endpoint.includes("/resumen")) {
    const from = params?.from || "2026-03-01";
    const to = params?.to || "2026-03-08";
    const allItems = generateMockItems(from, to, params);
    const page = parseInt(params?.page || "1");
    const pageSize = parseInt(params?.pageSize || "50");
    const sortBy = params?.sortBy || "fecha";
    const sortDir = params?.sortDir || "desc";
    allItems.sort((a, b) => {
      const aVal = (a as unknown as Record<string, unknown>)[sortBy];
      const bVal = (b as unknown as Record<string, unknown>)[sortBy];
      const cmp = String(aVal ?? "").localeCompare(String(bVal ?? ""));
      return sortDir === "asc" ? cmp : -cmp;
    });
    const start = (page - 1) * pageSize;
    const paged = allItems.slice(start, start + pageSize);
    return { items: paged, pagination: { page, pageSize, total: allItems.length, totalPages: Math.ceil(allItems.length / pageSize) } } as T;
  }

  return { items: [], pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 } } as T;
}
