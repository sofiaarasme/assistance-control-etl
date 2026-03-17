import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import type { ResumenDiarioItem } from "@/types/asistencia";
import type { FilterValues } from "@/components/FiltersSidebar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { calcularMetricas } from "@/services/asistenciaApi";

const BRAND_PRIMARY: [number, number, number] = [60, 155, 130];
const BRAND_DARK: [number, number, number] = [38, 50, 56];
const BRAND_LIGHT: [number, number, number] = [220, 240, 235];

const SEMAFORO_COLORS: Record<string, [number, number, number]> = {
  verde: [34, 139, 94],
  amarillo: [217, 169, 12],
  rojo: [200, 60, 60],
  sin_datos: [140, 150, 160],
};

const SEMAFORO_LABELS: Record<string, string> = {
  verde: "A tiempo",
  amarillo: "Tolerancia",
  rojo: "Tarde",
  sin_datos: "Sin datos",
};

function semaforoLabel(color: string | null): string {
  if (!color) return "—";
  const map: Record<string, string> = { verde: "✓", amarillo: "~", rojo: "✗", sin_datos: "—" };
  return map[color] ?? color;
}

function semaforoText(color: string | null): string {
  if (!color) return "Sin datos";
  return SEMAFORO_LABELS[color] ?? color;
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
}

async function captureChart(selector: string): Promise<string | null> {
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return null;
  try {
    const canvas = await html2canvas(el, {
      backgroundColor: "#ffffff",
      scale: 2,
      logging: false,
      useCORS: true,
    });
    return canvas.toDataURL("image/png");
  } catch (e) {
    console.warn("Could not capture chart:", selector, e);
    return null;
  }
}

export async function exportAttendancePdf(items: ResumenDiarioItem[], filters: FilterValues, totalRegistros: number) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const metricas = calcularMetricas(items);

  // === HEADER BAR ===
  const drawHeader = () => {
    doc.setFillColor(...BRAND_DARK);
    doc.rect(0, 0, pageWidth, 22, "F");
    doc.setFillColor(...BRAND_PRIMARY);
    doc.rect(0, 22, pageWidth, 1.5, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("GRUPO SERIMAR C.A.", 14, 10);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Reporte de Control de Asistencia", 14, 16);

    const rangeStr = `${format(filters.from, "dd MMM yyyy", { locale: es })} — ${format(filters.to, "dd MMM yyyy", { locale: es })}`;
    doc.setFontSize(9);
    doc.text(rangeStr, pageWidth - 14, 10, { align: "right" });

    doc.setFontSize(7);
    doc.text(`Generado: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pageWidth - 14, 16, { align: "right" });
  };

  const drawFooter = () => {
    const pageNum = doc.getCurrentPageInfo().pageNumber;
    doc.setFillColor(...BRAND_PRIMARY);
    doc.rect(0, pageHeight - 8, pageWidth, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6.5);
    doc.text("Grupo Serimar C.A. — Control de Asistencia", 14, pageHeight - 3);
    doc.text(`Página ${pageNum}`, pageWidth - 14, pageHeight - 3, { align: "right" });
  };

  drawHeader();

  // === FILTER SUMMARY ===
  let yPos = 28;
  doc.setTextColor(...BRAND_DARK);
  doc.setFontSize(7.5);
  const filterParts: string[] = [];
  if (filters.departamento) filterParts.push(`Depto: ${filters.departamento}`);
  if (filters.grupo) filterParts.push(`Grupo: ${filters.grupo}`);
  if (filters.turno) filterParts.push(`Turno: ${filters.turno}`);
  if (filters.search) filterParts.push(`Búsqueda: "${filters.search}"`);
  if (filters.semaforoEntrada) filterParts.push(`Sem. Entrada: ${filters.semaforoEntrada}`);
  if (filters.semaforoAlmuerzo) filterParts.push(`Sem. Almuerzo: ${filters.semaforoAlmuerzo}`);
  if (filters.soloAlertas) filterParts.push("Solo alertas");

  if (filterParts.length > 0) {
    const leftX = 14;
    const maxWidth = pageWidth - 28;
    doc.setFont("helvetica", "bold");
    doc.text("Filtros aplicados:", leftX, yPos);
    yPos += 3.5;

    doc.setFont("helvetica", "normal");
    const filtersLine = filterParts.join("  |  ");
    const wrappedFilters = doc.splitTextToSize(filtersLine, maxWidth);
    doc.text(wrappedFilters, leftX, yPos);
    yPos += wrappedFilters.length * 3.4 + 1;
  }

  doc.setFont("helvetica", "normal");
  doc.text(`Total de registros: ${totalRegistros}`, 14, yPos);
  yPos += 6;

  // === KPI CARDS SECTION ===
  doc.setTextColor(...BRAND_DARK);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Resumen de KPIs", 14, yPos);
  yPos += 4;

  const kpiTotalWidth = pageWidth - 28;
  const kpiGap = 3;
  const kpiWidth = (kpiTotalWidth - kpiGap * 3) / 4;
  const kpiHeight = 16;

  const kpis = [
    {
      label: "Asistencia perfecta",
      value: `${metricas.asistenciaPerfecta.toFixed(1)}%`,
      sublabel: `de ${totalRegistros} jornadas`,
    },
    {
      label: "Puntualidad general",
      value: `${metricas.puntualidadGeneral.toFixed(1)}%`,
      sublabel: `${metricas.jornadasPuntuales} jornadas a tiempo`,
    },
    {
      label: "Horas promedio trabajadas",
      value: `${metricas.horasPromedioTrabajadas.toFixed(1)} h`,
      sublabel: "por jornada (neto sin almuerzo)",
    },
    {
      label: "% Adherencia a la jornada",
      value: `${metricas.adherenciaJornada.toFixed(1)}%`,
      sublabel: "real vs. teórico",
    },
  ];

  kpis.forEach((kpi, idx) => {
    const x = 14 + idx * (kpiWidth + kpiGap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(210, 220, 225);
    doc.roundedRect(x, yPos, kpiWidth, kpiHeight, 1.5, 1.5, "FD");

    doc.setTextColor(...BRAND_DARK);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(kpi.label, x + 2, yPos + 5);

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(kpi.value, x + 2, yPos + 11);

    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.text(kpi.sublabel, x + 2, yPos + 14);
  });

  yPos += kpiHeight + 6;

  // Check if we need a new page for the table
  if (yPos > pageHeight - 50) {
    drawFooter();
    doc.addPage();
    drawHeader();
    yPos = 28;
  }

  // === TABLE SECTION ===
  doc.setTextColor(...BRAND_DARK);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Detalle de Asistencia", 14, yPos);
  yPos += 4;

  const headers = ["Fecha", "Empleado", "Depto.", "Grupo", "Turno", "Entrada", "Almuerzo", "Salida", "Marcas", "Hrs Planta", "Horario"];

  const rows = items.map((item) => [
    item.fecha,
    item.nombre,
    item.departamento,
    item.grupo,
    item.turno === "diurno" ? "Diurno" : "Nocturno",
    semaforoText(item.semaforo_entrada) + (item.entrada_tarde_segundos ? ` +${Math.ceil(item.entrada_tarde_segundos / 60)}m` : ""),
    semaforoText(item.semaforo_almuerzo) + (item.duracion_almuerzo_minutos ? ` ${item.duracion_almuerzo_minutos.toFixed(1)}m` : ""),
    semaforoText(item.semaforo_salida) + (item.salida_anticipada_segundos ? ` -${Math.ceil(item.salida_anticipada_segundos / 60)}m` : ""),
    `${item.total_registros}/${item.marcas_esperadas}${item.marcas_faltantes > 0 ? ` (-${item.marcas_faltantes})` : ""}`,
    item.horas_en_planta != null ? `${item.horas_en_planta.toFixed(1)}h` : "—",
    `${formatTime(item.primer_registro)} - ${formatTime(item.ultimo_registro)}`,
  ]);

  // Map items for coloring semaphore columns
  const semaforoColumns = [5, 6, 7]; // Entrada, Almuerzo, Salida column indices

  autoTable(doc, {
    startY: yPos,
    head: [headers],
    body: rows,
    theme: "grid",
    styles: {
      fontSize: 6.7,
      cellPadding: 1.7,
      textColor: [40, 50, 56],
      lineColor: [200, 210, 215],
      lineWidth: 0.2,
      valign: "middle",
    },
    headStyles: {
      fillColor: BRAND_DARK,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7,
      halign: "center",
    },
    alternateRowStyles: {
      fillColor: BRAND_LIGHT,
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 35 },
      2: { cellWidth: 25 },
      3: { cellWidth: 18 },
      4: { cellWidth: 18 },
      5: { cellWidth: 25, halign: "center", fontStyle: "bold" },
      6: { cellWidth: 25, halign: "center", fontStyle: "bold" },
      7: { cellWidth: 25, halign: "center", fontStyle: "bold" },
      8: { cellWidth: 20, halign: "center" },
      9: { cellWidth: 20, halign: "center" },
      10: { cellWidth: 21, halign: "center" },
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const colIdx = data.column.index;
      if (!semaforoColumns.includes(colIdx)) return;

      const rowIdx = data.row.index;
      const item = items[rowIdx];
      if (!item) return;

      let color: string | null = null;
      if (colIdx === 5) color = item.semaforo_entrada;
      else if (colIdx === 6) color = item.semaforo_almuerzo;
      else if (colIdx === 7) color = item.semaforo_salida;

      if (color && SEMAFORO_COLORS[color]) {
        data.cell.styles.textColor = SEMAFORO_COLORS[color];
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fontSize = 7.7;
      }
    },
    didDrawPage: () => {
      drawFooter();
    },
  });

  const fileName = `asistencia_${format(filters.from, "yyyyMMdd")}_${format(filters.to, "yyyyMMdd")}.pdf`;
  doc.save(fileName);
}
