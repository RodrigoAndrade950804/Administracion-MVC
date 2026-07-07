// ==========================================================================
// ARCHIVO: inventario.controller.js
// PROYECTO: Aroma & Grano — Sistema de Gestión para Restaurante
// CAPA: Controlador (Controller) — Patrón MVC
// ==========================================================================
//
// CONTEXTO DE NEGOCIO:
// --------------------
// Este controlador gestiona el inventario del restaurante Aroma & Grano.
// El inventario es el sistema que controla las existencias (stock) de cada
// producto. Sin un control de inventario adecuado, un restaurante puede:
//   - Vender productos que ya no tiene (sobreventa)
//   - No reponer productos a tiempo (desabasto)
//   - Perder dinero por desperdicio no registrado
//
// OPERACIONES DE INVENTARIO:
// --------------------------
// Este controlador expone dos operaciones principales:
//
//   1. DESCUENTO AUTOMÁTICO: Cuando se cierra un pedido, se descuentan
//      automáticamente las cantidades de cada producto consumido del stock.
//      Ejemplo: Si un pedido tiene 2 hamburguesas, se descuentan 2 del inventario.
//
//   2. MOVIMIENTO MANUAL: Permite a los administradores registrar ajustes
//      manuales de inventario (entradas por reabastecimiento, salidas por
//      merma/desperdicio, correcciones de conteo físico, etc.).
//
// PATRÓN FACHADA (FACADE PATTERN):
// ---------------------------------
// Las funciones de este controlador son fachadas que simplifican la
// interacción con la lógica de inventario. Internamente, el servicio
// de inventario puede:
//   - Consultar los detalles de un pedido para saber qué descontar
//   - Validar que haya suficiente stock antes de descontar
//   - Registrar movimientos en un historial de inventario
//   - Actualizar el campo `stock` de cada producto afectado
//
// SEMÁNTICA HTTP UTILIZADA:
// -------------------------
// - 200 OK:         Operación de inventario completada exitosamente
// - 400 Bad Request: Error de validación (ej: stock insuficiente, datos faltantes)
//
// ==========================================================================

// ==========================================================================
// SECCIÓN 1: IMPORTACIONES (IMPORTS)
// ==========================================================================

/**
 * Importación con namespace del módulo de servicios de inventario.
 *
 * El módulo `inventario.service.js` contiene toda la lógica de negocio
 * para el control de existencias: descuento automático por pedidos,
 * registro de movimientos manuales, y validaciones de stock mínimo.
 *
 * Funciones disponibles a través de `inventarioService`:
 *   - inventarioService.descontarInventarioPedidoService()
 *   - inventarioService.registrarMovimientoInventarioService()
 */
import * as inventarioService from "../services/inventario.service.js";

// ==========================================================================
// SECCIÓN 2: DESCUENTO AUTOMÁTICO DE INVENTARIO POR PEDIDO
// ==========================================================================

/**
 * Controlador para descontar el stock de los productos involucrados en un pedido específico.
 *
 * Esta función se invoca cuando se cierra (cobra) un pedido. El proceso es:
 *   1. Se recibe el ID del pedido cerrado
 *   2. El servicio consulta todos los detalles del pedido (productos y cantidades)
 *   3. Para cada detalle, se resta la cantidad del stock del producto correspondiente
 *   4. Se registra el movimiento en el historial de inventario
 *
 * EJEMPLO PRÁCTICO:
 *   Pedido #ABC tiene: 2 Hamburguesas, 3 Refrescos, 1 Postre
 *   → Se descuentan 2 del stock de Hamburguesa
 *   → Se descuentan 3 del stock de Refresco
 *   → Se descuenta 1 del stock de Postre
 *
 * Ruta típica: POST /api/inventario/descontar/:idPedido
 *
 * @async
 * @function descontarInventarioPedido
 * @param {import('express').Request} req - Objeto de solicitud HTTP de Express.
 *   - req.params.idPedido {string} — UUID del pedido cuyos productos se van a descontar
 * @param {import('express').Response} res - Objeto de respuesta HTTP de Express.
 * @returns {void} Envía una respuesta JSON al cliente:
 *   - Éxito: HTTP 200 con mensaje "Inventario actualizado"
 *   - Error: HTTP 400 o el código específico del error (ej: stock insuficiente)
 */
export const descontarInventarioPedido = async (req, res) => {
  try {
    // Extraemos el ID del pedido desde los parámetros de la URL.
    // Este ID se usa para buscar todos los productos y cantidades del pedido.
    const { idPedido } = req.params;

    // Delegamos el descuento al servicio (patrón Fachada).
    // El servicio itera sobre cada detalle del pedido y actualiza el stock.
    // `await` sin asignación: solo necesitamos confirmar que la operación terminó.
    await inventarioService.descontarInventarioPedidoService(idPedido);

    // HTTP 200 OK — confirmamos que el inventario fue actualizado exitosamente.
    res.json({ message: "Inventario actualizado" });
  } catch (error) {
    // Registro del error en consola para depuración del lado servidor.
    console.error(error);

    // Determinamos el código de estado HTTP apropiado:
    // - error.status: código personalizado del servicio (ej: 400 por stock insuficiente)
    // - 400: Bad Request como fallback para errores de validación
    const status = error.status || 400;

    // NOTA: Aquí se envía el objeto `error` completo como respuesta JSON.
    // Esto funciona porque el servicio puede lanzar objetos planos con
    // propiedades como { message, status, detalles } en lugar de instancias Error.
    // En producción, se debería serializar de forma más controlada.
    res.status(status).json(error);
  }
};

// ==========================================================================
// SECCIÓN 3: REGISTRO MANUAL DE MOVIMIENTOS DE INVENTARIO
// ==========================================================================

/**
 * Controlador para registrar movimientos o ajustes manuales de inventario.
 *
 * Los movimientos manuales de inventario cubren situaciones que no son
 * parte del flujo normal de pedidos, como:
 *
 *   - ENTRADA (reabastecimiento): Llega un pedido de proveedor con 50 hamburguesas
 *   - SALIDA (merma): Se echan a perder 5 kilogramos de carne
 *   - AJUSTE (corrección): El conteo físico difiere del sistema
 *   - DEVOLUCIÓN: Un proveedor acepta la devolución de producto defectuoso
 *
 * Cada movimiento queda registrado en un historial para fines de auditoría
 * y trazabilidad, permitiendo reconstruir cómo cambió el stock a lo largo
 * del tiempo.
 *
 * Ruta típica: POST /api/inventario/movimiento
 *
 * @async
 * @function registrarMovimientoInventario
 * @param {import('express').Request} req - Objeto de solicitud HTTP de Express.
 *   - req.body {Object} — Datos del movimiento de inventario:
 *     - req.body.id_producto {string} — UUID del producto afectado
 *     - req.body.tipo {string} — Tipo de movimiento ("entrada", "salida", "ajuste")
 *     - req.body.cantidad {number} — Cantidad del movimiento (positiva)
 *     - req.body.motivo {string} — Razón del movimiento (para auditoría)
 *     - req.body.id_user {string} — UUID del usuario que registra el movimiento
 * @param {import('express').Response} res - Objeto de respuesta HTTP de Express.
 * @returns {void} Envía una respuesta JSON al cliente:
 *   - Éxito: HTTP 200 con los datos del movimiento registrado
 *   - Error: HTTP 400 o el código específico del error
 */
export const registrarMovimientoInventario = async (req, res) => {
  try {
    // Delegamos al servicio pasando todo el cuerpo del request.
    // El servicio es responsable de:
    //   1. Validar los campos obligatorios
    //   2. Calcular el nuevo stock (sumar/restar según tipo)
    //   3. Actualizar el stock del producto en la BD
    //   4. Insertar el registro del movimiento en la tabla de historial
    const result = await inventarioService.registrarMovimientoInventarioService(req.body);

    // HTTP 200 OK — retornamos los datos del movimiento registrado.
    res.json(result);
  } catch (error) {
    // Registro del error para diagnóstico y respuesta con código apropiado.
    console.error(error);
    const status = error.status || 400;

    // Enviamos el objeto error completo como JSON (ver nota en función anterior).
    res.status(status).json(error);
  }
};