// ==========================================================================
// ARCHIVO: pedidos.controller.js
// PROYECTO: Aroma & Grano — Sistema de Gestión para Restaurante
// CAPA: Controlador (Controller) — Patrón MVC
// ==========================================================================
//
// CONTEXTO DE NEGOCIO:
// --------------------
// Este controlador gestiona todo el ciclo de vida de los pedidos del
// restaurante. Un "pedido" representa una orden asociada a una mesa,
// que contiene uno o más "detalles" (productos individuales con cantidades).
//
// CICLO DE VIDA DE UN PEDIDO:
// ---------------------------
//   1. CREAR    → Se abre un nuevo pedido asociado a una mesa y un mesero
//   2. AGREGAR  → Se añaden productos (detalles) al pedido abierto
//   3. MODIFICAR → Se actualiza la cantidad de productos existentes
//   4. ELIMINAR → Se remueven productos individuales del pedido
//   5. CERRAR   → Se cierra el pedido (genera el total, libera la mesa)
//   6. CANCELAR → Se elimina el pedido completo si es necesario
//
// PATRÓN FACHADA (FACADE PATTERN):
// ---------------------------------
// Cada función del controlador actúa como una fachada simplificada que:
//   1. Extrae datos del request HTTP (params, body, query)
//   2. Delega la lógica de negocio al servicio correspondiente
//   3. Formatea y envía la respuesta HTTP apropiada
//   4. Captura y maneja errores de forma uniforme
//
// SEMÁNTICA HTTP UTILIZADA:
// -------------------------
// - 200 OK:              Operación exitosa (lectura, actualización, eliminación)
// - 201 Created:         Recurso creado exitosamente (nuevo pedido, nuevo detalle)
// - 500 Internal Server: Error inesperado del servidor (se usa como default)
//
// ==========================================================================

// ==========================================================================
// SECCIÓN 1: IMPORTACIONES (IMPORTS)
// ==========================================================================

/**
 * Importación con namespace de todos los servicios de pedidos.
 *
 * El módulo `pedidos.service.js` contiene toda la lógica de negocio
 * relacionada con pedidos: validaciones, cálculos de totales, verificación
 * de inventario, y operaciones CRUD contra la base de datos Supabase.
 *
 * Al usar `import * as pedidosService`, agrupamos todas las funciones
 * exportadas bajo el objeto `pedidosService`, facilitando la lectura
 * y el mantenimiento del código.
 */
import * as pedidosService from "../services/pedidos.service.js";

// ==========================================================================
// SECCIÓN 2: CREAR PEDIDO (CREATE ORDER)
// ==========================================================================

/**
 * Controlador para crear un nuevo pedido (abrir una cuenta en una mesa).
 *
 * Cuando un mesero abre una nueva cuenta en una mesa, el frontend envía
 * el ID de la mesa y el ID del mesero. El servicio se encarga de:
 *   - Verificar que la mesa no tenga ya un pedido abierto
 *   - Crear el registro del pedido en la base de datos
 *   - Cambiar el estado de la mesa a "ocupada"
 *
 * Ruta típica: POST /api/pedidos
 *
 * @async
 * @function crearPedido
 * @param {import('express').Request} req - Objeto de solicitud HTTP de Express.
 *   - req.body.id_mesa {string} — UUID de la mesa donde se abre el pedido
 *   - req.body.id_user {string} — UUID del mesero que atiende la mesa
 * @param {import('express').Response} res - Objeto de respuesta HTTP de Express.
 * @returns {void} Envía una respuesta JSON al cliente:
 *   - Éxito: HTTP 201 (Created) con los datos del pedido creado
 *   - Error: HTTP 500 o el código específico del error
 */
export const crearPedido = async (req, res) => {
  try {
    // Desestructuramos el cuerpo de la solicitud para extraer los campos necesarios.
    // `id_mesa`: identificador de la mesa física del restaurante.
    // `id_user`: identificador del mesero responsable del pedido.
    const { id_mesa, id_user } = req.body;

    // Delegamos la creación del pedido al servicio (patrón Fachada).
    // El servicio maneja la validación y la inserción en Supabase.
    const data = await pedidosService.crearPedidoService(id_mesa, id_user);

    // HTTP 201 Created: semántica correcta para la creación de un nuevo recurso.
    // Retornamos los datos del pedido recién creado (incluyendo su UUID generado).
    res.status(201).json(data);
  } catch (error) {
    // Registro del error en consola para depuración del lado servidor.
    console.error(error);

    // Determinamos el código de estado HTTP:
    // - error.status: código personalizado lanzado por el servicio
    // - 500: Internal Server Error como fallback para errores inesperados
    const status = error.status || 500;

    // Respondemos con el error en formato JSON uniforme.
    res.status(status).json({ error: error.message || "Error al crear pedido" });
  }
};

// ==========================================================================
// SECCIÓN 3: OBTENER PEDIDO DE UNA MESA (READ ORDER BY TABLE)
// ==========================================================================

/**
 * Controlador para obtener el pedido abierto de una mesa específica.
 *
 * Busca si existe un pedido con estado "abierto" asociado a la mesa indicada.
 * Si existe, retorna el pedido con todos sus detalles (productos y cantidades).
 * Si no existe, retorna un mensaje indicando que no hay pedido abierto.
 *
 * Ruta típica: GET /api/pedidos/mesa/:idMesa
 *
 * @async
 * @function obtenerPedidoMesa
 * @param {import('express').Request} req - Objeto de solicitud HTTP de Express.
 *   - req.params.idMesa {string} — UUID de la mesa a consultar (desde la URL)
 * @param {import('express').Response} res - Objeto de respuesta HTTP de Express.
 * @returns {void} Envía una respuesta JSON al cliente:
 *   - Éxito con pedido: HTTP 200 con los datos del pedido y sus detalles
 *   - Éxito sin pedido: HTTP 200 con mensaje "No hay pedido abierto"
 *   - Error: HTTP 500 o el código específico del error
 */
export const obtenerPedidoMesa = async (req, res) => {
  try {
    // Extraemos el ID de la mesa desde los parámetros de la URL.
    // En la ruta GET /api/pedidos/mesa/abc-123, req.params.idMesa === "abc-123".
    const { idMesa } = req.params;

    // Consultamos al servicio si existe un pedido abierto para esta mesa.
    const data = await pedidosService.obtenerPedidoMesaService(idMesa);

    // Operador OR lógico (||) como valor por defecto:
    // - Si `data` contiene el pedido, lo retornamos tal cual.
    // - Si `data` es null/undefined (no hay pedido abierto), retornamos
    //   un objeto con un mensaje informativo. HTTP 200 en ambos casos
    //   porque la consulta fue exitosa (simplemente no hay datos).
    res.json(data || { message: "No hay pedido abierto" });
  } catch (error) {
    console.error(error);
    const status = error.status || 500;
    res.status(status).json({ error: error.message || "Error interno del servidor" });
  }
};

// ==========================================================================
// SECCIÓN 4: ELIMINAR PEDIDO COMPLETO (DELETE ORDER)
// ==========================================================================

/**
 * Controlador para eliminar (cancelar) un pedido completo.
 *
 * Elimina el pedido y todos sus detalles asociados de la base de datos.
 * Esto se usa cuando un pedido fue creado por error o el cliente decide
 * no consumir nada. El servicio también libera la mesa asociada.
 *
 * Ruta típica: DELETE /api/pedidos/:idPedido
 *
 * @async
 * @function eliminarPedido
 * @param {import('express').Request} req - Objeto de solicitud HTTP de Express.
 *   - req.params.idPedido {string} — UUID del pedido a eliminar
 * @param {import('express').Response} res - Objeto de respuesta HTTP de Express.
 * @returns {void} Envía una respuesta JSON al cliente:
 *   - Éxito: HTTP 200 con mensaje de confirmación
 *   - Error: HTTP 500 o el código específico del error
 */
export const eliminarPedido = async (req, res) => {
  try {
    // Extraemos el ID del pedido desde los parámetros de la URL.
    const { idPedido } = req.params;

    // Delegamos la eliminación al servicio. `await` sin asignación porque
    // no necesitamos un valor de retorno — solo confirmar que se completó.
    await pedidosService.eliminarPedidoService(idPedido);

    // HTTP 200 OK con confirmación de la operación.
    res.json({ message: "Pedido eliminado" });
  } catch (error) {
    console.error(error);
    const status = error.status || 500;
    res.status(status).json({ error: error.message || "Error al eliminar pedido" });
  }
};

// ==========================================================================
// SECCIÓN 5: CERRAR PEDIDO (CLOSE ORDER / COBRAR)
// ==========================================================================

/**
 * Controlador para cerrar un pedido (procesar el cobro).
 *
 * Cerrar un pedido implica:
 *   1. Calcular el total final (incluyendo descuentos si aplican)
 *   2. Cambiar el estado del pedido a "cerrado"
 *   3. Registrar la fecha y hora de cierre
 *   4. Liberar la mesa (cambiar su estado a "disponible")
 *   5. Descontar el inventario de los productos consumidos
 *
 * Este es un proceso SEGURO — el servicio `cerrarPedidoSeguroService`
 * incluye validaciones para evitar cerrar un pedido vacío o ya cerrado.
 *
 * Ruta típica: PATCH /api/pedidos/:idPedido/cerrar
 *
 * @async
 * @function cerrarPedido
 * @param {import('express').Request} req - Objeto de solicitud HTTP de Express.
 *   - req.params.idPedido {string} — UUID del pedido a cerrar
 * @param {import('express').Response} res - Objeto de respuesta HTTP de Express.
 * @returns {void} Envía una respuesta JSON al cliente:
 *   - Éxito: HTTP 200 con los datos del pedido cerrado (total, fecha, etc.)
 *   - Error: HTTP 500 o el código específico del error
 */
export const cerrarPedido = async (req, res) => {
  try {
    // Extraemos el ID del pedido a cerrar desde los parámetros de la URL.
    const { idPedido } = req.params;

    // Delegamos al servicio seguro de cierre de pedido.
    // "Seguro" porque valida precondiciones antes de ejecutar el cierre.
    const data = await pedidosService.cerrarPedidoSeguroService(idPedido);

    // HTTP 200 OK — retornamos los datos del pedido cerrado.
    res.json(data);
  } catch (error) {
    console.error(error);
    const status = error.status || 500;
    res.status(status).json({ error: error.message || "Error al cerrar pedido" });
  }
};

// ==========================================================================
// SECCIÓN 6: AGREGAR PRODUCTO A PEDIDO (ADD ITEM TO ORDER)
// ==========================================================================

/**
 * Controlador para agregar un producto al detalle de un pedido.
 *
 * Cuando un mesero añade un platillo o bebida a la cuenta, este endpoint
 * recibe el ID del producto y la cantidad deseada. El servicio se encarga de:
 *   - Verificar que el producto exista y esté activo
 *   - Verificar que haya suficiente inventario disponible
 *   - Crear el registro de detalle (línea de pedido)
 *   - Recalcular el total del pedido
 *
 * Ruta típica: POST /api/pedidos/:idPedido/detalles
 *
 * @async
 * @function agregarProductoPedido
 * @param {import('express').Request} req - Objeto de solicitud HTTP de Express.
 *   - req.params.idPedido {string} — UUID del pedido al que se agrega el producto
 *   - req.body.id_producto {string} — UUID del producto a agregar
 *   - req.body.quantity {number} — Cantidad del producto (por defecto 1)
 * @param {import('express').Response} res - Objeto de respuesta HTTP de Express.
 * @returns {void} Envía una respuesta JSON al cliente:
 *   - Éxito: HTTP 201 (Created) con mensaje de confirmación y datos del detalle
 *   - Error: HTTP 500 o el código específico (puede incluir `disponible` con stock restante)
 */
export const agregarProductoPedido = async (req, res) => {
  try {
    // Extraemos el ID del pedido desde los parámetros de la URL.
    const { idPedido } = req.params;

    // Desestructuramos el cuerpo de la solicitud:
    // - `id_producto`: UUID del producto a agregar
    // - `quantity`: cantidad solicitada, con valor por defecto de 1 (default parameter)
    //   El operador `= 1` proporciona un valor por defecto si quantity no viene en el body.
    const { id_producto, quantity = 1 } = req.body;

    // Delegamos la adición del producto al servicio.
    const result = await pedidosService.agregarProductoPedidoService(idPedido, id_producto, quantity);

    // HTTP 201 Created: se creó un nuevo recurso (detalle de pedido).
    // Usamos el operador spread (...result) para incluir todos los datos
    // del resultado junto con el mensaje de confirmación.
    res.status(201).json({
      message: "Producto agregado correctamente",
      ...result
    });
  } catch (error) {
    console.error(error);
    const status = error.status || 500;

    // Nota: `error.disponible` es una propiedad personalizada que el servicio
    // agrega al error cuando la cantidad solicitada excede el stock disponible.
    // Esto permite al frontend mostrar cuántas unidades quedan realmente.
    res.status(status).json({ error: error.message || "Error interno del servidor", disponible: error.disponible });
  }
};

// ==========================================================================
// SECCIÓN 7: ACTUALIZAR CANTIDAD DE DETALLE (UPDATE ITEM QUANTITY)
// ==========================================================================

/**
 * Controlador para actualizar la cantidad de un producto en un pedido.
 *
 * Permite al mesero modificar cuántas unidades de un producto específico
 * están en la orden. El servicio verifica que haya suficiente inventario
 * para la nueva cantidad y recalcula el total del pedido.
 *
 * Ruta típica: PATCH /api/pedidos/:idPedido/detalles/:idDetalle
 *
 * @async
 * @function actualizarCantidadDetalle
 * @param {import('express').Request} req - Objeto de solicitud HTTP de Express.
 *   - req.params.idPedido {string} — UUID del pedido que contiene el detalle
 *   - req.params.idDetalle {string} — UUID del detalle (línea de pedido) a modificar
 *   - req.body.quantity {number} — Nueva cantidad deseada
 * @param {import('express').Response} res - Objeto de respuesta HTTP de Express.
 * @returns {void} Envía una respuesta JSON al cliente:
 *   - Éxito: HTTP 200 con mensaje de confirmación y el nuevo total del pedido
 *   - Error: HTTP 500 o código específico (puede incluir `disponible`)
 */
export const actualizarCantidadDetalle = async (req, res) => {
  try {
    // Extraemos ambos IDs desde los parámetros de la URL.
    // Una ruta como PATCH /api/pedidos/abc/detalles/xyz produce:
    //   req.params.idPedido === "abc"
    //   req.params.idDetalle === "xyz"
    const { idPedido, idDetalle } = req.params;

    // Extraemos la nueva cantidad del cuerpo de la solicitud.
    const { quantity } = req.body;

    // Delegamos la actualización al servicio, que retorna el nuevo total.
    const nuevoTotal = await pedidosService.actualizarCantidadDetalleService(idPedido, idDetalle, quantity);

    // HTTP 200 OK — confirmamos la operación e incluimos el nuevo total
    // para que el frontend pueda actualizar la interfaz sin otra consulta.
    res.json({
      message: "Cantidad actualizada correctamente",
      nuevoTotal
    });
  } catch (error) {
    console.error(error);
    const status = error.status || 500;

    // Incluimos `error.disponible` para informar del stock restante si aplica.
    res.status(status).json({ error: error.message || "Error al actualizar cantidad", disponible: error.disponible });
  }
};

// ==========================================================================
// SECCIÓN 8: ELIMINAR DETALLE (REMOVE ITEM FROM ORDER)
// ==========================================================================

/**
 * Controlador para eliminar un detalle (producto) de un pedido.
 *
 * Remueve una línea de pedido específica. Esto ocurre cuando el cliente
 * decide que ya no quiere un producto antes de cerrar la cuenta.
 * El servicio recalcula el total del pedido después de la eliminación.
 *
 * Ruta típica: DELETE /api/pedidos/:idPedido/detalles/:idDetalle
 *
 * @async
 * @function eliminarDetalle
 * @param {import('express').Request} req - Objeto de solicitud HTTP de Express.
 *   - req.params.idPedido {string} — UUID del pedido que contiene el detalle
 *   - req.params.idDetalle {string} — UUID del detalle a eliminar
 * @param {import('express').Response} res - Objeto de respuesta HTTP de Express.
 * @returns {void} Envía una respuesta JSON al cliente:
 *   - Éxito: HTTP 200 con los datos del resultado de la eliminación
 *   - Error: HTTP 500 (Internal Server Error)
 */
export const eliminarDetalle = async (req, res) => {
  try {
    // Extraemos los IDs del pedido y del detalle desde los parámetros de la URL.
    const { idPedido, idDetalle } = req.params;

    // Delegamos la eliminación del detalle al servicio.
    // El servicio retorna información sobre la operación (ej: nuevo total).
    const result = await pedidosService.eliminarDetalleService(idPedido, idDetalle);

    // HTTP 200 OK — retornamos el resultado de la eliminación.
    res.json(result);
  } catch (error) {
    // Para esta operación, usamos 500 directamente sin revisar error.status.
    // Esto simplifica el manejo asumiendo que cualquier error es del servidor.
    console.error(error);
    res.status(500).json({ error: "Error al eliminar detalle" });
  }
};