import { fetchWithAuth } from "../api/apiClient";
const API_URL = import.meta.env.VITE_API_URL + "/api/pedidos";

export const crearPedido = async (idMesa, idUser) => {
  const response = await fetchWithAuth(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_mesa: idMesa, id_user: idUser })
  });
  if (!response.ok) throw new Error("Error al crear pedido");
  return await response.json();
};

export const obtenerPedidoAbiertoMesa = async (idMesa) => {
  const response = await fetchWithAuth(`${API_URL}/mesa/${idMesa}`);
  if (!response.ok) throw new Error("Error obteniendo pedido de mesa");
  const data = await response.json();
  if (data.message === "No hay pedido abierto") return null;
  return data;
};

export const agregarProductoPedido = async (idPedido, producto) => {
  const response = await fetchWithAuth(`${API_URL}/${idPedido}/agregar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_producto: producto.id_producto, quantity: 1 }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Error al agregar producto");
  return data;
};

export const actualizarDetallePedido = async (idPedido, idDetalle, quantity) => {
  const response = await fetchWithAuth(`${API_URL}/${idPedido}/detalle/${idDetalle}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quantity }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Error al actualizar cantidad");
  return data;
};

export const eliminarDetallePedido = async (idPedido, idDetalle) => {
  const response = await fetchWithAuth(`${API_URL}/${idPedido}/detalle/${idDetalle}`, {
    method: "DELETE",
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Error al eliminar detalle");
  return data;
};

export const eliminarPedido = async (idPedido) => {
  const response = await fetchWithAuth(`${API_URL}/${idPedido}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Error al eliminar pedido");
  return await response.json();
};

export const cerrarPedido = async (idPedido) => {
  const response = await fetchWithAuth(`${API_URL}/${idPedido}/cerrar`, {
    method: "POST",
  });
  if (!response.ok) throw new Error("Error al cerrar pedido");
  return await response.json();
};

export const descontarInventarioPedido = async (idPedido) => {
  const response = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/api/inventario/pedido/${idPedido}`, {
    method: "POST",
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Error actualizando inventario");
  return data;
};