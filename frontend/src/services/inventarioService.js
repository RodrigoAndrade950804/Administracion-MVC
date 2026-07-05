import { fetchWithAuth } from "../api/apiClient";

/**
 * Registra una entrada de inventario (compra o ingreso) en el backend.
 * * @param {string} id_producto - ID del producto a actualizar.
 * @param {number} cantidad - Cantidad a sumar al stock.
 * @param {string} id_user - ID del usuario responsable del registro.
 * @returns {Promise<Object>} Respuesta del servidor con el nuevo estado del inventario.
 */
export const registrarEntradaStock = async (id_producto, cantidad, id_user) => {
  // Realiza una petición POST al endpoint de inventario de tu backend.
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  const response = await fetchWithAuth(`${apiUrl}/api/inventario/entrada`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json" // Especifica que el cuerpo es un JSON.
    },
    // El cuerpo de la solicitud contiene los datos necesarios para la transacción.
    body: JSON.stringify({
      id_producto,
      cantidad,
      id_user
    })
  });

  // Retorna el resultado (por ejemplo, { success: true, new_stock: 50 }).
  return await response.json();
};