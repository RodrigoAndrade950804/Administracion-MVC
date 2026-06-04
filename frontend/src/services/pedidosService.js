import { supabase } from "./supabase";

const API_URL = "http://localhost:3000/api/pedidos";

// =========================
// CREAR PEDIDO
// =========================
/**
 * Inicia un nuevo registro en la tabla 'pedidos' con estado 'abierto'.
 * Se utiliza Supabase directamente porque es una inserción simple.
 */
export const crearPedido = async (idMesa, idUser) => {
  const { data, error } = await supabase
    .from("pedidos")
    .insert([{ id_mesa: idMesa, id_user: idUser, status: "abierto", total_amount: 0 }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

// =========================
// OBTENER PEDIDO ABIERTO
// =========================
/**
 * Consulta el pedido activo de una mesa específica.
 * Realiza un 'Join' (cargado de relaciones) para obtener:
 * 1. El pedido.
 * 2. Sus detalles asociados.
 * 3. Los datos de los productos dentro de esos detalles.
 * .maybeSingle() evita errores si la mesa no tiene un pedido activo (retorna null en vez de error).
 */
export const obtenerPedidoAbiertoMesa = async (idMesa) => {
  const { data, error } = await supabase
    .from("pedidos")
    .select(`
      *,
      detalle_pedidos (
        *,
        productos (*)
      )
    `)
    .eq("id_mesa", idMesa)
    .eq("status", "abierto")
    .maybeSingle();

  if (error) throw error;
  return data;
};

// =========================
// AGREGAR PRODUCTO (Backend)
// =========================
/**
 * Envía la solicitud al Backend para añadir un ítem. 
 * Se usa 'fetch' hacia el API porque el servidor debe verificar si hay stock 
 * disponible antes de permitir la inserción en 'detalle_pedidos'.
 */
export const agregarProductoPedido = async (idPedido, producto) => {
  const response = await fetch(`${API_URL}/${idPedido}/agregar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_producto: producto.id_producto, quantity: 1 }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Error al agregar producto");
  return data;
};

// =========================
// ACTUALIZAR CANTIDAD (Backend)
// =========================
/**
 * Actualiza el número de unidades de un producto en el pedido.
 * Requiere backend para recalcular el 'total_amount' del pedido 
 * y re-validar el stock disponible.
 */
export const actualizarDetallePedido = async (idPedido, idDetalle, quantity) => {
  const response = await fetch(`${API_URL}/${idPedido}/detalle/${idDetalle}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quantity }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Error al actualizar cantidad");
  return data;
};

// =========================
// ELIMINAR DETALLE (Backend)
// =========================
/**
 * Elimina un producto del pedido. 
 * El backend se encarga de verificar si al eliminar el último detalle 
 * debe también eliminar el pedido completo (limpieza de huérfanos).
 */
export const eliminarDetallePedido = async (idPedido, idDetalle) => {
  const response = await fetch(`${API_URL}/${idPedido}/detalle/${idDetalle}`, {
    method: "DELETE",
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Error al eliminar detalle");
  return data;
};

// =========================
// ELIMINAR PEDIDO
// =========================
/**
 * Elimina el registro del pedido de Supabase. 
 * Usado principalmente como rollback si un pedido temporal falla.
 */
export const eliminarPedido = async (idPedido) => {
  const { error } = await supabase.from("pedidos").delete().eq("id_pedido", idPedido);
  if (error) throw error;
};

// =========================
// CERRAR PEDIDO
// =========================
/**
 * Cambia el estado a 'cerrado'. 
 * Una vez cerrado, el pedido ya no aparece en el POS del mesero.
 */
export const cerrarPedido = async (idPedido) => {
  const { error } = await supabase.from("pedidos").update({ status: "cerrado" }).eq("id_pedido", idPedido);
  if (error) throw error;
};

// =========================
// DESCONTAR INVENTARIO
// =========================
/**
 * Operación crítica: al cerrar el pedido, esta función dispara la 
 * reducción real del stock en bodega en el servidor (Backend).
 */
export const descontarInventarioPedido = async (idPedido) => {
  const response = await fetch(`http://localhost:3000/api/inventario/pedido/${idPedido}`, {
    method: "POST",
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Error actualizando inventario");
  return data;
};