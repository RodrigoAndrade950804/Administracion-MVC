import { supabase } from "./supabase";

const API_URL = import.meta.env.VITE_API_URL + "/api/madi";

// =========================
// CONFIGURACION MADI
// =========================

export const getConfiguracionMadi = async () => {
  const response = await fetch(`${API_URL}/config`);
  if (!response.ok) throw new Error("Error obteniendo config MADI");
  return await response.json();
};

export const actualizarConfiguracionMadi = async (id, configuracion) => {
  const response = await fetch(`${API_URL}/config/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(configuracion)
  });
  if (!response.ok) throw new Error("Error actualizando MADI");
  return await response.json();
};

/**
 * Mantiene la conexión a Supabase solo para funcionalidad de tiempo real.
 */
export const suscribirConfiguracionMadi = (callback) => {
  return supabase
    .channel("madi-config-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "configuracion_madi" }, callback)
    .subscribe();
};

// =========================
// REGLAS BONOS (CRUD)
// =========================

export const getReglasBonos = async () => {
  const response = await fetch(`${API_URL}/reglas`);
  if (!response.ok) throw new Error("Error obteniendo reglas");
  return await response.json();
};

export const crearReglaBono = async (regla) => {
  const response = await fetch(`${API_URL}/reglas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(regla)
  });
  if (!response.ok) throw new Error("Error creando regla");
  return await response.json();
};

export const actualizarReglaBono = async (id, regla) => {
  const response = await fetch(`${API_URL}/reglas/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(regla)
  });
  if (!response.ok) throw new Error("Error actualizando regla");
  return await response.json();
};

export const eliminarReglaBono = async (id) => {
  const response = await fetch(`${API_URL}/reglas/${id}`, {
    method: "DELETE"
  });
  if (!response.ok) throw new Error("Error eliminando regla");
  return await response.json();
};

// =========================
// LÓGICA DE NEGOCIO AUTOMATIZADA
// =========================
// Mueve el cálculo pesado y verificaciones lógicas al backend,
// previniendo concurrencia innecesaria en el cliente.

export const verificarProgresoPersonal = async (idUser) => {
  const response = await fetch(`${API_URL}/progreso/${idUser}`, {
    method: "GET"
  });
  if (!response.ok) throw new Error("Error verificando MADI");
  return await response.json();
};