import { supabase } from "./supabase";

const API_URL = "http://localhost:3000/api/pedidos";

// =========================
// CREAR PEDIDO
// =========================
export const crearPedido = async (idMesa, idUser) => {
  const { data, error } = await supabase
    .from("pedidos")
    .insert([
      {
        id_mesa: idMesa,
        id_user: idUser,
        status: "abierto",
        total_amount: 0,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
};

// =========================
// OBTENER PEDIDO ABIERTO
// =========================
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
export const agregarProductoPedido = async (idPedido, producto) => {
  const response = await fetch(`${API_URL}/${idPedido}/agregar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id_producto: producto.id_producto,
      quantity: 1,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Error al agregar producto");
  }

  return data;
};

// =========================
// ACTUALIZAR CANTIDAD (Backend)
// =========================
export const actualizarDetallePedido = async (
  idPedido,
  idDetalle,
  quantity
) => {
  const response = await fetch(
    `${API_URL}/${idPedido}/detalle/${idDetalle}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Error al actualizar cantidad");
  }

  return data;
};

// =========================
// ELIMINAR DETALLE (Backend)
// =========================
export const eliminarDetallePedido = async (idPedido, idDetalle) => {
  const response = await fetch(
    `${API_URL}/${idPedido}/detalle/${idDetalle}`,
    {
      method: "DELETE",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Error al eliminar detalle");
  }

  return data;
};

// =========================
// ELIMINAR PEDIDO
// =========================
export const eliminarPedido = async (idPedido) => {
  const { error } = await supabase
    .from("pedidos")
    .delete()
    .eq("id_pedido", idPedido);

  if (error) throw error;
};

// =========================
// CERRAR PEDIDO
// =========================
export const cerrarPedido = async (idPedido) => {
  const { error } = await supabase
    .from("pedidos")
    .update({
      status: "cerrado",
    })
    .eq("id_pedido", idPedido);

  if (error) throw error;
};

// =========================
// DESCONTAR INVENTARIO
// =========================
export const descontarInventarioPedido = async (idPedido) => {
  const response = await fetch(
    `http://localhost:3000/api/inventario/pedido/${idPedido}`,
    {
      method: "POST",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Error actualizando inventario");
  }

  return data;
};