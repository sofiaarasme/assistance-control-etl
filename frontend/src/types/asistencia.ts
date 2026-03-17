// Types for the attendance API

export type SemaforoColor = "verde" | "amarillo" | "rojo";
export type SemaforoAlmuerzo = SemaforoColor | "sin_datos";
export type SemaforoSalida = SemaforoColor;
export type Turno = "diurno" | "nocturno";
export type TipoEvento = "entrada" | "salida_almuerzo" | "regreso_almuerzo" | "salida" | "movimiento" | "adicional";

export interface ResumenDiarioItem {
  persona_id: string;
  nombre: string;
  fecha: string;
  departamento: string;
  grupo: string;
  turno: Turno;
  jornada_inicio_programada: string;
  jornada_fin_programada: string;
  primer_registro: string | null;
  ultimo_registro: string | null;
  total_registros: number;
  marcas_esperadas: number;
  marcas_faltantes: number;
  alerta_marcas: SemaforoColor;
  entrada_tarde_segundos: number | null;
  semaforo_entrada: SemaforoColor;
  salida_anticipada_segundos: number | null;
  semaforo_salida: SemaforoSalida;
  salida_almuerzo: string | null;
  regreso_almuerzo: string | null;
  duracion_almuerzo_segundos: number | null;
  duracion_almuerzo_minutos: number | null;
  semaforo_almuerzo: SemaforoAlmuerzo;
  alerta_general: boolean;
  horas_en_planta: number | null;
  source_file_name: string;
  periodo_inicio: string;
  periodo_fin: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ResumenResponse {
  items: ResumenDiarioItem[];
  pagination: Pagination;
}

export interface EventoItem {
  persona_id: string;
  nombre: string;
  fecha: string;
  hora: string;
  tipo_evento: TipoEvento;
  departamento: string;
  grupo: string;
  turno: Turno;
}

export interface EventosResponse {
  items: EventoItem[];
  pagination: Pagination;
}

export interface MetadataResponse {
  processed_at_utc: string;
  source_files_count: number;
  records_eventos_historico: number;
  records_resumen_historico: number;
  fecha_min: string;
  fecha_max: string;
  required_filename_format: string;
}

export interface PersonaCatalogo {
  persona_id: string;
  nombre: string;
}

export interface CatalogosResponse {
  grupos: string[];
  departamentos: string[];
  turnos: Turno[];
  personas: PersonaCatalogo[];
}

export interface ResumenQueryParams {
  from: string;
  to: string;
  departamento?: string;
  grupo?: string;
  turno?: Turno;
  personaId?: string;
  search?: string;
  semaforoEntrada?: SemaforoColor;
  semaforoAlmuerzo?: SemaforoAlmuerzo;
  soloAlertas?: boolean;
  soloAsistenciaPerfecta?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

// Computed metrics types
export interface MetricasAsistencia {
  asistenciaPerfecta: number;
  puntualidadGeneral: number;
  jornadasPuntuales: number;
  horasPromedioTrabajadas: number;
  tiempoTotalTardanzas: number;
  tiempoSalidasAnticipadas: number;
  horasExtrasPotenciales: number;
  adherenciaJornada: number;
  promedioAsistenciaDiaria: number;
}

export interface RankingEmpleado {
  persona_id: string;
  nombre: string;
  incidencias: number;
  tardanzas: number;
  salidasTempranas: number;
}

export interface PatronSemanal {
  dia: string;
  tardanzas: number;
  faltas: number;
  total: number;
}
