import { supabase } from "./supabase";

// =========================
// CONFIGURACION MADI
// =========================

/**
 * Recupera la configuración actual de MADI. 
 * El uso de .single() garantiza obtener el único registro de configuración.
 */
export const getConfiguracionMadi = async () => {
  const { data, error } = await supabase
    .from("configuracion_madi")
    .select("*")
    .single();

  if (error) throw error;
  return data;
};

/**
 * Implementa Realtime para escuchar cambios en la tabla de configuración.
 * Permite que, si alguien cambia una meta desde el panel administrativo, 
 * todos los usuarios (meseros/supervisores) vean el cambio al instante.
 */
export const suscribirConfiguracionMadi = (callback) => {
  return supabase
    .channel("madi-config-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "configuracion_madi" }, callback)
    .subscribe();
};

/**
 * Actualiza parámetros específicos como el multiplicador de Happy Hour 
 * o el estado de activación ('is_active').
 */
export const actualizarConfiguracionMadi = async (id, configuracion) => {
  const { error } = await supabase
    .from("configuracion_madi")
    .update(configuracion)
    .eq("id_madi", id);

  if (error) throw error;
};

// =========================
// REGLAS BONOS (CRUD)
// =========================
// Este conjunto de funciones gestiona el catálogo de reglas que determinan 
// qué bonificación recibe un mesero según su rendimiento.

export const getReglasBonos = async () => {
  const { data, error } = await supabase
    .from("reglas_bonos")
    .select("*")
    .order("id_reglas"); // Ordena para presentar reglas de menor a mayor exigencia.

  if (error) throw error;
  return data;
};

export const crearReglaBono = async (regla) => {
  const { data, error } = await supabase
    .from("reglas_bonos")
    .insert([regla])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const actualizarReglaBono = async (id, regla) => {
  const { error } = await supabase
    .from("reglas_bonos")
    .update(regla)
    .eq("id_reglas", id);

  if (error) throw error;
};

export const eliminarReglaBono = async (id) => {
  const { error } = await supabase
    .from("reglas_bonos")
    .delete()
    .eq("id_reglas", id);

  if (error) throw error;
};

// =========================
// LÓGICA DE NEGOCIO AUTOMATIZADA
// =========================

/**
 * Suma el total de todos los pedidos que ya han sido pagados ('cerrado').
 * Es la base para calcular si se ha alcanzado la meta diaria.
 */
export const calcularVentasTotales = async () => {
  const { data, error } = await supabase
    .from("pedidos")
    .select("total_amount")
    .eq("status", "cerrado");

  if (error) throw error;

  // Reduce el array de pedidos a una suma aritmética del monto total.
  return data.reduce((total, pedido) => total + Number(pedido.total_amount), 0);
};

/**
 * Función clave de automatización:
 * 1. Obtiene la configuración (meta).
 * 2. Calcula las ventas reales acumuladas.
 * 3. Si ventas >= meta y MADI está apagado, lo enciende automáticamente.
 * Esto elimina la necesidad de intervención manual del supervisor.
 */
export const verificarActivacionMadi = async () => {
  const config = await getConfiguracionMadi();
  const ventas = await calcularVentasTotales();
  const meta = Number(config.daily_sales_goal);

  console.log("VENTAS:", ventas, "META:", meta, "ACTIVO:", config.is_active);

  if (ventas >= meta && !config.is_active) {
    console.log("ACTIVANDO MADI");
    await actualizarConfiguracionMadi(config.id_madi, { is_active: true });
  }
};