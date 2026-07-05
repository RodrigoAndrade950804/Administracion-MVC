const API_URL = import.meta.env.VITE_API_URL + "/api/productos";

export const getProductos = async () => {
  const response = await fetch(API_URL);
  if (!response.ok) throw new Error("Error obteniendo productos");
  return await response.json();
};

export const crearProducto = async (producto) => {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(producto)
  });
  if (!response.ok) throw new Error("Error creando producto");
  return await response.json();
};

export const actualizarProducto = async (idProducto, producto, idUser = null) => {
  const payload = { ...producto, id_user: idUser };
  const response = await fetch(`${API_URL}/${idProducto}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Error actualizando producto");
  return await response.json();
};

export const eliminarProducto = async (idProducto) => {
  const response = await fetch(`${API_URL}/${idProducto}`, {
    method: "DELETE"
  });
  if (!response.ok) throw new Error("Error eliminando producto");
  return await response.json();
};