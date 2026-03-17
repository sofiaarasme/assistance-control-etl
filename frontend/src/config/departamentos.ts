// =============================================
// Lista de departamentos de Grupo Serimar
// Editar esta lista para agregar/quitar departamentos
// =============================================
export const DEPARTAMENTOS = [
  "Producción",
  "Calidad",
  "Mantenimiento",
] as const;

export type Departamento = (typeof DEPARTAMENTOS)[number];
