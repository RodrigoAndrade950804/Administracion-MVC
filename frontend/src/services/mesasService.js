import { supabase } from "./supabase";

// =========================
// OBTENER MESAS
// =========================

/**
 * Recupera la lista completa de mesas registradas en el sistema.
 * * - .select("*"): Trae todos los campos (id, número, estado, etc.).
 * - .order("id_mesa"): Asegura que el listado siempre tenga el mismo orden (numérico),
 * lo cual es crucial para que la interfaz mantenga una consistencia visual 
 * al renderizar la cuadrícula de mesas.
 * * @returns {Promise<Array>} Lista de objetos con los datos de las mesas.
 */
export const getMesas = async () => {
  const { data, error } = await supabase
    .from("mesas")
    .select("*")
    .order("id_mesa");

  if (error) {
    // Si la consulta falla (ej. problemas de permisos RLS o conexión),
    // propagamos el error para que sea manejado por el componente que llama al servicio.
    throw error;
  }

  return data;
};

// =========================
// ACTUALIZAR STATUS
// =========================

/**
 * Modifica el estado de una mesa específica (ej. de 'libre' a 'ocupada').
 * * Esta función es fundamental cuando:
 * 1. Un mesero abre un pedido (cambia a 'ocupada').
 * 2. Se finaliza un pago (cambia a 'libre').
 * * @param {number|string} idMesa - El identificador único de la mesa en la tabla.
 * @param {string} status - El nuevo valor de estado (ej: 'libre', 'ocupada', 'reservada').
 */
export const updateMesaStatus = async (idMesa, status) => {
  const { error } = await supabase
    .from("mesas")
    .update({
      status, // Sintaxis abreviada de JS para { status: status }
    })
    .eq("id_mesa", idMesa); // Filtra por el ID para actualizar solo el registro correcto.

  if (error) {
    throw error;
  }
};