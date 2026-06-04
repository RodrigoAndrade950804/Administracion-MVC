// Importación del cliente administrativo de Supabase con privilegios elevados (Bypass RLS).
import supabaseAdmin from "./supabaseAdmin.js";

/**
 * Servicio encargado de procesar el cierre definitivo y seguro de un pedido.
 * Centraliza la lógica de negocio en el backend para evitar alteraciones o manipulaciones 
 * malintencionadas de precios o montos desde el cliente (frontend).
 * * @param {string|number} idPedido - El identificador único del pedido que se va a clausurar.
 * @returns {Object} El objeto del pedido actualizado con su nuevo estado y montos consolidados.
 */
export const cerrarPedidoSeguroService = async (idPedido) => {
  
  // =========================================================================
  // 1️⃣ OBTENER DETALLES DEL PEDIDO
  // =========================================================================
  // Se realiza una consulta dirigida a la tabla 'detalle_pedidos' para extraer la información
  // crítica de cada artículo asociado: el ID del producto, las unidades y el subtotal acumulado.
  const { data: detalles, error: detallesError } = await supabaseAdmin
    .from("detalle_pedidos")
    .select("id_producto, cantidad, subtotal") // Selección estricta de columnas necesarias
    .eq("pedido_id", idPedido); // Filtro relacional condicional WHERE pedido_id = idPedido

  // Control de flujo: Si la consulta a la base de datos falla, se lanza el error inmediatamente
  // para que sea capturado por el bloque 'catch' del controlador que invoque este servicio.
  if (detallesError) throw detallesError;

  // Validación de integridad empresarial: Un pedido no puede ser cerrado/facturado si no tiene 
  // al menos un artículo registrado en su carrito de compras.
  if (!detalles || detalles.length === 0) {
    throw new Error("El pedido no tiene detalles");
  }

  // =========================================================================
  // 2️⃣ CALCULAR TOTAL EN BACKEND (VERIFICACIÓN DEL LADO DEL SERVIDOR)
  // =========================================================================
  // Inicialización del acumulador numérico en cero.
  let total = 0;
  
  // Ciclo imperativo 'for...of' que recorre secuencialmente cada uno de los artículos del listado.
  for (const item of detalles) {
    // 💡 NOTA DE AUDITORÍA DE CÓDIGO: Actualmente el bucle acumula las unidades físicas de los 
    // artículos (item.cantidad). Si tu intención es guardar el total monetario en la base de datos, 
    // la suma lógica debería apuntar a 'item.subtotal'.
    total += item.cantidad;
  }

  // =========================================================================
  // 3️⃣ ACTUALIZAR PEDIDO (PERSISTENCIA Y CAMBIO DE ESTADO)
  // =========================================================================
  // Se efectúa la mutación de datos en la tabla principal de 'pedidos'.
  // Se cambia el estado operativo a "cerrado" (evitando que se le sigan añadiendo productos)
  // y se estampa el valor total recalculado por el servidor.
  const { data: pedido, error: pedidoError } = await supabaseAdmin
    .from("pedidos")
    .update({
      total_amount: total, // Inyección del acumulador finalizado
      status: "cerrado",   // Transición de estado en el ciclo de vida del pedido
    })
    .eq("id", idPedido) // Restricción condicional de actualización WHERE id = idPedido
    .select() // Solicita explícitamente a PostgreSQL la devolución de la fila modificada
    .single(); // Configura la respuesta como un objeto plano único en lugar de una matriz

  // Control de flujo final: Si la actualización en la tabla 'pedidos' genera un conflicto o falla,
  // interrumpe la ejecución lanzando la excepción correspondiente.
  if (pedidoError) throw pedidoError;

  // Retorna con éxito el registro íntegro del pedido cerrado para su posterior uso o respuesta HTTP.
  return pedido;
};