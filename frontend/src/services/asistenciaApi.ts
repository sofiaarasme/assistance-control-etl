import Papa from "papaparse";

import type {
  CatalogosResponse,
  EventosResponse,
  MetadataResponse,
  MetricasAsistencia,
  PatronSemanal,
  RankingEmpleado,
  ResumenDiarioItem,
  ResumenQueryParams,
  ResumenResponse,
  SemaforoAlmuerzo,
  SemaforoColor,
  SemaforoSalida,
  Turno,
  TipoEvento,
} from "@/types/asistencia";

type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
};

type GoogleTokenClient = {
  requestAccessToken: (options?: { prompt?: string }) => void;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: GoogleTokenResponse & { error?: string }) => void;
            error_callback?: () => void;
          }) => GoogleTokenClient;
        };
      };
    };
  }
}

type RawCsvRow = {
  "ID de persona"?: string;
  "Nombre"?: string;
  "Departamento"?: string;
  "Hora"?: string;
  "Punto de verificación de asistencia"?: string;
};

type InternalEvent = {
  persona_id: string;
  nombre: string;
  departamento: string;
  grupo: string;
  fecha_hora: Date;
  fecha: string;
  hora: string;
  turno: Turno;
  jornada_fecha: string;
  jornada_inicio_programada: Date;
  jornada_fin_programada: Date;
  tipo_evento: TipoEvento;
  orden_jornada: number;
  punto_verificacion: string;
  source_file_name: string;
  periodo_inicio: string;
  periodo_fin: string;
};

type Dataset = {
  events: InternalEvent[];
  resumen: ResumenDiarioItem[];
  metadata: MetadataResponse;
};

const GOOGLE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3/files";
const DRIVE_IDS = (import.meta.env.VITE_GOOGLE_DRIVE_FILE_IDS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const DRIVE_FOLDER_ID = (import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID || "").trim();

let scriptPromise: Promise<void> | null = null;
let tokenClient: GoogleTokenClient | null = null;
let accessToken: string | null = null;
let tokenExpiresAt = 0;
let tokenPromise: Promise<string> | null = null;

let cache: Dataset | null = null;
let cachePromise: Promise<Dataset> | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

function assertConfig() {
  if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) {
    throw new Error("Falta VITE_GOOGLE_CLIENT_ID en frontend/.env");
  }
  if (!DRIVE_IDS.length && !DRIVE_FOLDER_ID) {
    throw new Error("Debes definir VITE_GOOGLE_DRIVE_FOLDER_ID o VITE_GOOGLE_DRIVE_FILE_IDS");
  }
}

function loadGoogleScript(): Promise<void> {
  if (scriptPromise) {
    return scriptPromise;
  }

  scriptPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar Google Identity Services"));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

async function ensureTokenClient(): Promise<GoogleTokenClient> {
  await loadGoogleScript();

  if (tokenClient) {
    return tokenClient;
  }

  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) {
    throw new Error("Google Identity Services no está disponible");
  }

  tokenClient = oauth2.initTokenClient({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    scope: GOOGLE_SCOPE,
    callback: () => {},
  });

  return tokenClient;
}

async function getGoogleAccessToken(forceConsent = false): Promise<string> {
  const now = Date.now();
  if (!forceConsent && accessToken && now < tokenExpiresAt) {
    return accessToken;
  }

  if (tokenPromise) {
    return tokenPromise;
  }

  tokenPromise = (async () => {
    const client = await ensureTokenClient();
    const token = await new Promise<string>((resolve, reject) => {
      const wrappedClient = window.google?.accounts?.oauth2?.initTokenClient({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        scope: GOOGLE_SCOPE,
        callback: (response) => {
          if (!response || response.error || !response.access_token) {
            reject(new Error("No se pudo obtener token de Google Drive"));
            return;
          }
          accessToken = response.access_token;
          tokenExpiresAt = Date.now() + (response.expires_in - 30) * 1000;
          resolve(response.access_token);
        },
        error_callback: () => reject(new Error("Google OAuth cancelado o bloqueado")),
      });

      if (!wrappedClient) {
        reject(new Error("No se pudo inicializar Google OAuth"));
        return;
      }

      wrappedClient.requestAccessToken({ prompt: forceConsent ? "consent" : "" });
    });

    tokenClient = client;
    return token;
  })();

  try {
    return await tokenPromise;
  } finally {
    tokenPromise = null;
  }
}

async function driveFetch(path: string): Promise<Response> {
  let token = await getGoogleAccessToken(false);
  let response = await fetch(path, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401 || response.status === 403) {
    token = await getGoogleAccessToken(true);
    response = await fetch(path, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  return response;
}

async function fetchDriveFileMeta(fileId: string): Promise<{ id: string; name: string }> {
  const response = await driveFetch(`${DRIVE_API_BASE}/${fileId}?fields=id,name`);
  if (!response.ok) {
    throw new Error(`No se pudo leer metadata de archivo ${fileId}`);
  }
  return response.json();
}

async function listDriveCsvFilesInFolder(folderId: string): Promise<Array<{ id: string; name: string }>> {
  const query = `'${folderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`;
  const encodedQuery = encodeURIComponent(query);
  const fields = encodeURIComponent("files(id,name),nextPageToken");

  let pageToken: string | null = null;
  const output: Array<{ id: string; name: string }> = [];

  do {
    const tokenParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
    const response = await driveFetch(
      `${DRIVE_API_BASE}?q=${encodedQuery}&fields=${fields}&pageSize=200&orderBy=name asc${tokenParam}`
    );

    if (!response.ok) {
      throw new Error("No se pudo listar archivos de la carpeta de Google Drive");
    }

    const payload = (await response.json()) as {
      files?: Array<{ id: string; name: string }>;
      nextPageToken?: string;
    };

    const csvFiles = (payload.files || []).filter((file) => file.name.toLowerCase().endsWith(".csv"));
    output.push(...csvFiles);
    pageToken = payload.nextPageToken || null;
  } while (pageToken);

  return output;
}

async function fetchDriveFileText(fileId: string): Promise<string> {
  const response = await driveFetch(`${DRIVE_API_BASE}/${fileId}?alt=media`);
  if (!response.ok) {
    throw new Error(`No se pudo descargar CSV ${fileId}`);
  }
  return response.text();
}

function normalizePersonId(rawValue?: string): string {
  return String(rawValue || "")
    .replace(/'/g, "")
    .replace(/\D/g, "")
    .trim();
}

function toYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toIsoWithoutMs(date: Date): string {
  return date.toISOString().slice(0, 19);
}

function parsePeriodoFromFilename(filename: string): { inicio: string; fin: string } {
  const match = filename.match(/^asistencia_(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})\.csv$/i);
  if (!match) {
    return { inicio: "", fin: "" };
  }
  return { inicio: match[1], fin: match[2] };
}

function extractDepartamentoYGrupo(raw: string): { departamento: string; grupo: string } {
  const parts = String(raw || "")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) {
    return { departamento: "", grupo: "" };
  }

  const grupo = parts.length >= 1 ? parts[parts.length - 1] : "";
  const depCandidate = parts.length >= 2 ? parts[parts.length - 2] : parts[parts.length - 1];
  const departamento = depCandidate.replace(/^\d+\s*/, "").trim();

  return { departamento, grupo };
}

function classifyShift(date: Date): { turno: Turno; jornadaInicio: Date; jornadaFin: Date; jornadaFecha: string } {
  const base = new Date(date);
  const hour = base.getHours();

  if (hour >= 19) {
    const jornadaInicio = new Date(base);
    jornadaInicio.setHours(19, 0, 0, 0);
    const jornadaFin = new Date(jornadaInicio.getTime() + 12 * 60 * 60 * 1000);
    return { turno: "nocturno", jornadaInicio, jornadaFin, jornadaFecha: toYmd(jornadaInicio) };
  }

  if (hour < 7) {
    const prev = new Date(base);
    prev.setDate(prev.getDate() - 1);
    prev.setHours(19, 0, 0, 0);
    const jornadaFin = new Date(prev.getTime() + 12 * 60 * 60 * 1000);
    return { turno: "nocturno", jornadaInicio: prev, jornadaFin, jornadaFecha: toYmd(prev) };
  }

  const jornadaInicio = new Date(base);
  jornadaInicio.setHours(7, 0, 0, 0);
  const jornadaFin = new Date(jornadaInicio.getTime() + 12 * 60 * 60 * 1000);
  return { turno: "diurno", jornadaInicio, jornadaFin, jornadaFecha: toYmd(jornadaInicio) };
}

function entrySemaforo(delaySeconds: number): SemaforoColor {
  if (delaySeconds <= 0) return "verde";
  if (delaySeconds <= 59) return "amarillo";
  return "rojo";
}

function lunchSemaforo(seconds: number): SemaforoAlmuerzo {
  if (seconds <= 3599) return "verde";
  if (seconds <= 3659) return "amarillo";
  return "rojo";
}

function exitSemaforo(earlySeconds: number): SemaforoSalida {
  if (earlySeconds <= 0) return "verde";
  if (earlySeconds <= 59) return "amarillo";
  return "rojo";
}

function parseCsvRows(csvText: string): RawCsvRow[] {
  const parsed = Papa.parse<RawCsvRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  if (parsed.errors.length) {
    const firstError = parsed.errors[0];
    throw new Error(`Error parseando CSV: ${firstError.message}`);
  }

  return parsed.data;
}

function buildEventsFromFile(rows: RawCsvRow[], filename: string): InternalEvent[] {
  const { inicio, fin } = parsePeriodoFromFilename(filename);

  const baseEvents: Omit<InternalEvent, "tipo_evento" | "orden_jornada">[] = rows
    .map((row) => {
      const personaId = normalizePersonId(row["ID de persona"]);
      const nombre = String(row["Nombre"] || "").trim();
      const rawDepartamento = String(row["Departamento"] || "").trim();
      const dateRaw = String(row["Hora"] || "").trim();
      const punto = String(row["Punto de verificación de asistencia"] || "").trim();

      if (!personaId || !dateRaw) {
        return null;
      }

      const parsedDate = new Date(dateRaw);
      if (Number.isNaN(parsedDate.getTime())) {
        return null;
      }

      const { departamento, grupo } = extractDepartamentoYGrupo(rawDepartamento);
      const shift = classifyShift(parsedDate);

      return {
        persona_id: personaId,
        nombre,
        departamento,
        grupo,
        fecha_hora: parsedDate,
        fecha: toYmd(parsedDate),
        hora: toIsoWithoutMs(parsedDate).split("T")[1],
        turno: shift.turno,
        jornada_fecha: shift.jornadaFecha,
        jornada_inicio_programada: shift.jornadaInicio,
        jornada_fin_programada: shift.jornadaFin,
        punto_verificacion: punto,
        source_file_name: filename,
        periodo_inicio: inicio,
        periodo_fin: fin,
      };
    })
    .filter(Boolean) as Omit<InternalEvent, "tipo_evento" | "orden_jornada">[];

  baseEvents.sort((a, b) => a.fecha_hora.getTime() - b.fecha_hora.getTime());

  const grouped = new Map<string, Omit<InternalEvent, "tipo_evento" | "orden_jornada">[]>();
  for (const event of baseEvents) {
    const key = `${event.persona_id}|${event.jornada_fecha}|${event.turno}`;
    const bucket = grouped.get(key) ?? [];
    bucket.push(event);
    grouped.set(key, bucket);
  }

  const output: InternalEvent[] = [];
  for (const list of grouped.values()) {
    list.sort((a, b) => a.fecha_hora.getTime() - b.fecha_hora.getTime());

    list.forEach((event, index) => {
      let tipo: TipoEvento = "movimiento";
      if (index === 0) tipo = "entrada";
      else if (index === 1) tipo = "salida_almuerzo";
      else if (index === 2) tipo = "regreso_almuerzo";
      else if (index === 3) tipo = "salida";
      else if (index > 3) tipo = "adicional";

      output.push({ ...event, tipo_evento: tipo, orden_jornada: index + 1 });
    });
  }

  return output;
}

function deduplicateEvents(events: InternalEvent[]): InternalEvent[] {
  const map = new Map<string, InternalEvent>();
  for (const event of events) {
    const key = `${event.persona_id}|${event.fecha_hora.toISOString()}|${event.punto_verificacion}`;
    if (!map.has(key)) {
      map.set(key, event);
    }
  }

  return Array.from(map.values()).sort((a, b) => a.fecha_hora.getTime() - b.fecha_hora.getTime());
}

function buildSummary(events: InternalEvent[]): ResumenDiarioItem[] {
  if (!events.length) {
    return [];
  }

  const groups = new Map<string, InternalEvent[]>();
  for (const event of events) {
    const key = `${event.persona_id}|${event.nombre}|${event.departamento}|${event.grupo}|${event.turno}|${event.jornada_fecha}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(event);
    groups.set(key, bucket);
  }

  const resumen: ResumenDiarioItem[] = [];

  for (const [key, list] of groups.entries()) {
    list.sort((a, b) => a.fecha_hora.getTime() - b.fecha_hora.getTime());

    const [persona_id, nombre, departamento, grupo, turno, jornadaFecha] = key.split("|");
    const first = list[0].fecha_hora;
    const last = list[list.length - 1].fecha_hora;
    const total = list.length;

    const jornadaInicio = list[0].jornada_inicio_programada;
    const jornadaFin = list[0].jornada_fin_programada;

    const entryDelaySeconds = Math.max(0, Math.round((first.getTime() - jornadaInicio.getTime()) / 1000));
    const semaforoEntrada = entrySemaforo(entryDelaySeconds);

    let salidaAlmuerzo: Date | null = null;
    let regresoAlmuerzo: Date | null = null;
    let duracionAlmuerzoSegundos: number | null = null;
    let semaforoAlmuerzo: SemaforoAlmuerzo = "sin_datos";

    if (total >= 3) {
      salidaAlmuerzo = list[1].fecha_hora;
      regresoAlmuerzo = list[2].fecha_hora;
      const diff = Math.round((regresoAlmuerzo.getTime() - salidaAlmuerzo.getTime()) / 1000);
      if (diff >= 0) {
        duracionAlmuerzoSegundos = diff;
        semaforoAlmuerzo = lunchSemaforo(diff);
      }
    }

    const marcasEsperadas = 4;
    const marcasFaltantes = Math.max(0, marcasEsperadas - total);
    const alertaMarcas: SemaforoColor = marcasFaltantes > 0 ? "rojo" : "verde";

    const salidaAnticipadaSegundos = Math.max(0, Math.round((jornadaFin.getTime() - last.getTime()) / 1000));
    const semaforoSalida = exitSemaforo(salidaAnticipadaSegundos);

    const alertaGeneral =
      marcasFaltantes > 0 || semaforoEntrada !== "verde" || semaforoSalida !== "verde" || semaforoAlmuerzo !== "verde";

    const horasEnPlanta = Math.round(((last.getTime() - first.getTime()) / (1000 * 60 * 60)) * 100) / 100;

    resumen.push({
      persona_id,
      nombre,
      fecha: jornadaFecha,
      departamento,
      grupo,
      turno: turno as Turno,
      jornada_inicio_programada: toIsoWithoutMs(jornadaInicio),
      jornada_fin_programada: toIsoWithoutMs(jornadaFin),
      primer_registro: toIsoWithoutMs(first),
      ultimo_registro: toIsoWithoutMs(last),
      total_registros: total,
      marcas_esperadas: marcasEsperadas,
      marcas_faltantes: marcasFaltantes,
      alerta_marcas: alertaMarcas,
      entrada_tarde_segundos: entryDelaySeconds,
      semaforo_entrada: semaforoEntrada,
      salida_anticipada_segundos: salidaAnticipadaSegundos,
      semaforo_salida: semaforoSalida,
      salida_almuerzo: salidaAlmuerzo ? toIsoWithoutMs(salidaAlmuerzo) : null,
      regreso_almuerzo: regresoAlmuerzo ? toIsoWithoutMs(regresoAlmuerzo) : null,
      duracion_almuerzo_segundos: duracionAlmuerzoSegundos,
      duracion_almuerzo_minutos: duracionAlmuerzoSegundos != null ? Math.round((duracionAlmuerzoSegundos / 60) * 100) / 100 : null,
      semaforo_almuerzo: semaforoAlmuerzo,
      alerta_general: alertaGeneral,
      horas_en_planta: horasEnPlanta,
      source_file_name: list[0].source_file_name,
      periodo_inicio: list[0].periodo_inicio,
      periodo_fin: list[0].periodo_fin,
    });
  }

  return resumen.sort((a, b) => {
    if (a.fecha === b.fecha) return a.persona_id.localeCompare(b.persona_id);
    return a.fecha.localeCompare(b.fecha);
  });
}

async function buildDataset(): Promise<Dataset> {
  assertConfig();

  const targetFiles = DRIVE_FOLDER_ID
    ? await listDriveCsvFilesInFolder(DRIVE_FOLDER_ID)
    : await Promise.all(DRIVE_IDS.map((fileId) => fetchDriveFileMeta(fileId)));

  if (!targetFiles.length) {
    throw new Error("No se encontraron CSV en Google Drive para procesar");
  }

  const filePayloads = await Promise.all(
    targetFiles.map(async (file) => {
      const csvText = await fetchDriveFileText(file.id);
      return {
        id: file.id,
        name: file.name,
        text: csvText,
      };
    })
  );

  const allEvents = filePayloads.flatMap((file) => {
    const rows = parseCsvRows(file.text);
    return buildEventsFromFile(rows, file.name);
  });

  const events = deduplicateEvents(allEvents);
  const resumen = buildSummary(events);

  const fechaMin = events.length ? toIsoWithoutMs(events[0].fecha_hora) : "";
  const fechaMax = events.length ? toIsoWithoutMs(events[events.length - 1].fecha_hora) : "";

  return {
    events,
    resumen,
    metadata: {
      processed_at_utc: new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z",
      source_files_count: filePayloads.length,
      records_eventos_historico: events.length,
      records_resumen_historico: resumen.length,
      fecha_min: fechaMin,
      fecha_max: fechaMax,
      required_filename_format: "asistencia_YYYY-MM-DD_YYYY-MM-DD.csv",
    },
  };
}

async function loadDataset(force = false): Promise<Dataset> {
  const now = Date.now();
  if (!force && cache && now - new Date(cache.metadata.processed_at_utc.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, "$1-$2-$3T$4:$5:$6Z")).getTime() < CACHE_TTL_MS) {
    return cache;
  }

  if (cachePromise) {
    return cachePromise;
  }

  cachePromise = buildDataset();
  try {
    cache = await cachePromise;
    return cache;
  } finally {
    cachePromise = null;
  }
}

function paginate<T>(items: T[], page: number, pageSize: number): { items: T[]; total: number; totalPages: number } {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  return { items: items.slice(start, end), total, totalPages };
}

function applyResumenFilters(rows: ResumenDiarioItem[], params: ResumenQueryParams): ResumenDiarioItem[] {
  let filtered = rows.filter((row) => row.fecha >= params.from && row.fecha <= params.to);

  if (params.departamento) filtered = filtered.filter((row) => row.departamento.toLowerCase() === params.departamento!.toLowerCase());
  if (params.grupo) filtered = filtered.filter((row) => row.grupo.toLowerCase() === params.grupo!.toLowerCase());
  if (params.turno) filtered = filtered.filter((row) => row.turno === params.turno);
  if (params.personaId) filtered = filtered.filter((row) => row.persona_id === params.personaId);
  if (params.search) filtered = filtered.filter((row) => row.nombre.toLowerCase().includes(params.search!.toLowerCase()));
  if (params.semaforoEntrada) filtered = filtered.filter((row) => row.semaforo_entrada === params.semaforoEntrada);
  if (params.semaforoAlmuerzo) filtered = filtered.filter((row) => row.semaforo_almuerzo === params.semaforoAlmuerzo);
  if (params.soloAlertas) filtered = filtered.filter((row) => row.alerta_general);
  if (params.soloAsistenciaPerfecta) {
    filtered = filtered.filter(
      (row) => row.semaforo_entrada === "verde" && row.semaforo_almuerzo === "verde" && row.semaforo_salida === "verde" && row.marcas_faltantes === 0
    );
  }

  const sortBy = params.sortBy || "fecha";
  const sortDir = params.sortDir || "asc";
  filtered.sort((a, b) => {
    const aVal = (a as unknown as Record<string, unknown>)[sortBy];
    const bVal = (b as unknown as Record<string, unknown>)[sortBy];
    const cmp = String(aVal ?? "").localeCompare(String(bVal ?? ""), "es", { numeric: true });
    return sortDir === "asc" ? cmp : -cmp;
  });

  return filtered;
}

export async function getResumenDiario(params: ResumenQueryParams): Promise<ResumenResponse> {
  const dataset = await loadDataset();
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 50;
  const filtered = applyResumenFilters(dataset.resumen, params);
  const paged = paginate(filtered, page, pageSize);

  return {
    items: paged.items,
    pagination: {
      page,
      pageSize,
      total: paged.total,
      totalPages: paged.totalPages,
    },
  };
}

export async function getEventos(params: Record<string, string>): Promise<EventosResponse> {
  const dataset = await loadDataset();
  const from = params.from || "0000-01-01";
  const to = params.to || "9999-12-31";

  let filtered = dataset.events.filter((row) => row.fecha >= from && row.fecha <= to);

  if (params.departamento) filtered = filtered.filter((row) => row.departamento.toLowerCase() === params.departamento!.toLowerCase());
  if (params.grupo) filtered = filtered.filter((row) => row.grupo.toLowerCase() === params.grupo!.toLowerCase());
  if (params.turno) filtered = filtered.filter((row) => row.turno === params.turno);
  if (params.personaId) filtered = filtered.filter((row) => row.persona_id === params.personaId);
  if (params.tipoEvento) filtered = filtered.filter((row) => row.tipo_evento === params.tipoEvento);

  filtered.sort((a, b) => a.fecha_hora.getTime() - b.fecha_hora.getTime());

  const page = Number(params.page || 1);
  const pageSize = Number(params.pageSize || 200);
  const paged = paginate(filtered, page, pageSize);

  return {
    items: paged.items.map((event) => ({
      persona_id: event.persona_id,
      nombre: event.nombre,
      fecha: event.fecha,
      hora: event.hora,
      tipo_evento: event.tipo_evento,
      departamento: event.departamento,
      grupo: event.grupo,
      turno: event.turno,
    })),
    pagination: {
      page,
      pageSize,
      total: paged.total,
      totalPages: paged.totalPages,
    },
  };
}

export async function getMetadata(): Promise<MetadataResponse> {
  const dataset = await loadDataset();
  return dataset.metadata;
}

export async function getCatalogos(): Promise<CatalogosResponse> {
  const dataset = await loadDataset();
  const rows = dataset.resumen;

  const departamentos = Array.from(new Set(rows.map((row) => row.departamento).filter(Boolean))).sort((a, b) => a.localeCompare(b, "es"));
  const grupos = Array.from(new Set(rows.map((row) => row.grupo).filter(Boolean))).sort((a, b) => a.localeCompare(b, "es"));
  const turnos = Array.from(new Set(rows.map((row) => row.turno))).sort((a, b) => a.localeCompare(b, "es")) as Turno[];

  const personas = Array.from(
    new Map(rows.map((row) => [row.persona_id, { persona_id: row.persona_id, nombre: row.nombre }])).values()
  ).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return {
    departamentos,
    grupos,
    turnos,
    personas,
  };
}

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
    (i) =>
      i.semaforo_entrada === "verde" &&
      i.semaforo_salida === "verde" &&
      (i.semaforo_almuerzo === "verde" || i.semaforo_almuerzo === "sin_datos") &&
      i.marcas_faltantes === 0
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
      if (i.duracion_almuerzo_segundos != null) almuerzoHoras = 1;
      else if (i.semaforo_almuerzo !== "sin_datos") almuerzoHoras = 1;
      const efectivas = Math.max(i.horas_en_planta - almuerzoHoras, 0);
      totalHorasTrabajadas += efectivas;
      countHorasTrabajadas += 1;
    }
  });

  const horasPromedioTrabajadas = countHorasTrabajadas > 0 ? Math.round((totalHorasTrabajadas / countHorasTrabajadas) * 10) / 10 : 0;

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
    const existing = map.get(i.persona_id) || {
      persona_id: i.persona_id,
      nombre: i.nombre,
      incidencias: 0,
      tardanzas: 0,
      salidasTempranas: 0,
    };
    if (i.semaforo_entrada === "rojo" || i.semaforo_entrada === "amarillo") {
      existing.tardanzas++;
      existing.incidencias++;
    }
    if (i.salida_anticipada_segundos && i.salida_anticipada_segundos > 0) {
      existing.salidasTempranas++;
      existing.incidencias++;
    }
    map.set(i.persona_id, existing);
  });
  return Array.from(map.values())
    .sort((a, b) => b.incidencias - a.incidencias)
    .slice(0, 10);
}

export function calcularPatronesSemanal(items: ResumenDiarioItem[]): PatronSemanal[] {
  const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const stats = dias.map((dia) => ({ dia, tardanzas: 0, faltas: 0, total: 0 }));
  items.forEach((i) => {
    const dayIndex = new Date(`${i.fecha}T12:00:00`).getDay();
    stats[dayIndex].total++;
    if (i.semaforo_entrada === "rojo" || i.semaforo_entrada === "amarillo") stats[dayIndex].tardanzas++;
    if (i.marcas_faltantes >= 3) stats[dayIndex].faltas++;
  });
  return stats;
}
