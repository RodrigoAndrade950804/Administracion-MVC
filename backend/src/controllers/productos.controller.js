// ==========================================================================
// ARCHIVO: productos.controller.js
// PROYECTO: Aroma & Grano — Sistema de Gestión para Restaurante
// CAPA: Controlador (Controller) — Patrón MVC
// ==========================================================================
//
// CONTEXTO DE NEGOCIO:
// --------------------
// Este controlador gestiona el catálogo de productos (platillos y bebidas)
// del restaurante Aroma & Grano. Los productos son los artículos que aparecen
// en el menú y pueden ser agregados a los pedidos de cada mesa.
//
// OPERACIONES CRUD COMPLETAS:
// ---------------------------
// Este archivo implementa las 4 operaciones CRUD básicas:
//   - C (Create)  → crearProducto      — POST   — Alta de un nuevo platillo/bebida
//   - R (Read)    → getProductos        — GET    — Consulta del catálogo completo
//   - U (Update)  → actualizarProducto  — PUT    — Modificación de datos del producto
//   - D (Delete)  → eliminarProducto    — DELETE — Eliminación de un producto
//
// PATRÓN FACHADA (FACADE PATTERN):
// ---------------------------------
// Cada función actúa como una fachada simplificada: recibe HTTP, delega al
// servicio, y responde. Esto mantiene el controlador delgado (thin controller)
// y concentra la lógica de negocio en la capa de servicios.
//
// SEMÁNTICA HTTP UTILIZADA:
// -------------------------
// - 200 OK:         Operación de lectura/actualización/eliminación exitosa
// - 201 Created:    Producto creado exitosamente
// - 400 Bad Request: Error del cliente (datos inválidos, producto duplicado, etc.)
// - 500 Internal:   Error inesperado del servidor
//
// ==========================================================================

// ==========================================================================
// SECCIÓN 1: IMPORTACIONES (IMPORTS)
// ==========================================================================

/**
 * Importación con namespace del módulo de servicios de productos.
 *
 * El módulo `productos.service.js` contiene la lógica de negocio para
 * el manejo del catálogo: validaciones de campos obligatorios, verificación
 * de productos duplicados, y operaciones CRUD contra Supabase.
 *
 * Al importar con `* as productosService`, todas las funciones exportadas
 * están disponibles como métodos del objeto `productosService`:
 *   - productosService.getProductosService()
 *   - productosService.crearProductoService()
 *   - productosService.actualizarProductoService()
 *   - productosService.eliminarProductoService()
 */
import * as productosService from "../services/productos.service.js";

// ==========================================================================
// SECCIÓN 2: OPERACIONES CRUD — LEER (READ)
// ==========================================================================

/**
 * Controlador para obtener todos los productos del catálogo.
 *
 * Recupera la lista completa de productos (platillos y bebidas) del
 * restaurante. Esta información se usa en:
 *   - El menú del punto de venta (POS)
 *   - La vista de administración de productos
 *   - La selección de productos al agregar a un pedido
 *
 * Ruta típica: GET /api/productos
 *
 * @async
 * @function getProductos
 * @param {import('express').Request} req - Objeto de solicitud HTTP de Express.
 *   (No requiere parámetros — retorna el catálogo completo)
 * @param {import('express').Response} res - Objeto de respuesta HTTP de Express.
 * @returns {void} Envía una respuesta JSON al cliente:
 *   - Éxito: HTTP 200 con un arreglo de objetos producto
 *   - Error: HTTP 500 (Internal Server Error)
 */
export const getProductos = async (req, res) => {
  try {
    // Llamamos al servicio para obtener todos los productos de la BD.
    // El resultado es un arreglo de objetos, cada uno representando un producto
    // con campos como: id, nombre, precio, categoria, stock, activo, etc.
    const data = await productosService.getProductosService();

    // HTTP 200 OK (implícito) — retornamos el catálogo de productos.
    // `res.json()` establece automáticamente Content-Type: application/json
    // y serializa el objeto/arreglo JavaScript a formato JSON.
    res.json(data);
  } catch (error) {
    // Para operaciones de lectura, usamos HTTP 500 (Internal Server Error)
    // porque si una consulta simple falla, es un problema del servidor.
    console.error(error);
    res.status(500).json({ error: error.message || "Error al obtener productos" });
  }
};

// ==========================================================================
// SECCIÓN 3: OPERACIONES CRUD — CREAR (CREATE)
// ==========================================================================

/**
 * Controlador para crear un nuevo producto en el catálogo.
 *
 * Registra un nuevo platillo o bebida en la base de datos. El servicio
 * se encarga de validar los campos obligatorios (nombre, precio, categoría)
 * y de insertar el registro en Supabase.
 *
 * Ruta típica: POST /api/productos
 *
 * @async
 * @function crearProducto
 * @param {import('express').Request} req - Objeto de solicitud HTTP de Express.
 *   - req.body {Object} — Datos del nuevo producto:
 *     - req.body.nombre {string} — Nombre del platillo/bebida
 *     - req.body.precio {number} — Precio unitario en moneda local
 *     - req.body.categoria {string} — Categoría (ej: "bebidas", "comida", "postres")
 *     - req.body.stock {number} — Cantidad inicial en inventario
 *     - req.body.descripcion {string} — Descripción opcional del producto
 * @param {import('express').Response} res - Objeto de respuesta HTTP de Express.
 * @returns {void} Envía una respuesta JSON al cliente:
 *   - Éxito: HTTP 201 (Created) con los datos del producto creado
 *   - Error: HTTP 400 (Bad Request) por datos inválidos o incompletos
 */
export const crearProducto = async (req, res) => {
  try {
    // Delegamos la creación al servicio, pasando todo el cuerpo del request.
    // El servicio es responsable de extraer y validar cada campo.
    const data = await productosService.crearProductoService(req.body);

    // HTTP 201 Created: indica la creación exitosa de un nuevo recurso.
    // Retornamos el producto creado (incluyendo su UUID generado).
    res.status(201).json(data);
  } catch (error) {
    // HTTP 400 Bad Request: usamos este código porque los errores de creación
    // suelen ser del lado del cliente (campos faltantes, datos inválidos).
    console.error(error);
    res.status(400).json({ error: error.message || "Error al crear producto" });
  }
};

// ==========================================================================
// SECCIÓN 4: OPERACIONES CRUD — ACTUALIZAR (UPDATE)
// ==========================================================================

/**
 * Controlador para actualizar los datos de un producto existente.
 *
 * Modifica campos como nombre, precio, categoría, stock, etc., de un
 * producto identificado por su UUID. Este endpoint también recibe
 * opcionalmente el `id_user` del usuario que realiza la modificación
 * para fines de auditoría.
 *
 * Ruta típica: PUT /api/productos/:id
 *
 * @async
 * @function actualizarProducto
 * @param {import('express').Request} req - Objeto de solicitud HTTP de Express.
 *   - req.params.id {string} — UUID del producto a actualizar (desde la URL)
 *   - req.body {Object} — Campos a actualizar, puede incluir:
 *     - req.body.nombre {string} — Nuevo nombre del producto
 *     - req.body.precio {number} — Nuevo precio
 *     - req.body.categoria {string} — Nueva categoría
 *     - req.body.stock {number} — Nuevo nivel de stock
 *     - req.body.id_user {string} — UUID del usuario que modifica (para auditoría)
 * @param {import('express').Response} res - Objeto de respuesta HTTP de Express.
 * @returns {void} Envía una respuesta JSON al cliente:
 *   - Éxito: HTTP 200 con los datos actualizados del producto
 *   - Error: HTTP 400 (Bad Request) por datos inválidos
 */
export const actualizarProducto = async (req, res) => {
  try {
    // Extraemos el ID del producto desde los parámetros de la URL.
    const { id } = req.params;

    // Desestructuración con operador rest (...):
    // - `id_user`: se extrae aparte porque no es un dato del producto per se,
    //   sino un dato de auditoría (quién realizó el cambio).
    // - `...productoData`: captura TODOS los demás campos del body en un nuevo objeto.
    //   El operador rest (...) crea un objeto con todas las propiedades que NO fueron
    //   explícitamente desestructuradas. Así separamos datos de producto vs. metadatos.
    const { id_user, ...productoData } = req.body; // Extraer id_user si viene
    
    // Delegamos al servicio pasando:
    //   1. id: identificador del producto a actualizar
    //   2. productoData: solo los campos que pertenecen al producto
    //   3. id_user: referencia al usuario que hace el cambio (auditoría)
    const data = await productosService.actualizarProductoService(id, productoData, id_user);

    // HTTP 200 OK (implícito) — retornamos el producto actualizado.
    res.json(data);
  } catch (error) {
    // HTTP 400: error de validación o datos incorrectos del lado del cliente.
    console.error(error);
    res.status(400).json({ error: error.message || "Error al actualizar producto" });
  }
};

// ==========================================================================
// SECCIÓN 5: OPERACIONES CRUD — ELIMINAR (DELETE)
// ==========================================================================

/**
 * Controlador para eliminar un producto del catálogo.
 *
 * Elimina permanentemente un producto de la base de datos. Se debe usar
 * con precaución ya que puede afectar la integridad referencial si el
 * producto está referenciado en pedidos históricos.
 *
 * NOTA: En un sistema de producción más robusto, se implementaría
 * borrado lógico (soft delete) marcando el producto como inactivo
 * en lugar de eliminarlo físicamente, preservando así el historial
 * de pedidos.
 *
 * Ruta típica: DELETE /api/productos/:id
 *
 * @async
 * @function eliminarProducto
 * @param {import('express').Request} req - Objeto de solicitud HTTP de Express.
 *   - req.params.id {string} — UUID del producto a eliminar (desde la URL)
 * @param {import('express').Response} res - Objeto de respuesta HTTP de Express.
 * @returns {void} Envía una respuesta JSON al cliente:
 *   - Éxito: HTTP 200 con mensaje de confirmación
 *   - Error: HTTP 400 (Bad Request)
 */
export const eliminarProducto = async (req, res) => {
  try {
    // Extraemos el ID del producto desde los parámetros de la URL.
    const { id } = req.params;

    // Delegamos la eliminación al servicio.
    // `await` sin asignación: solo necesitamos que la operación se complete.
    await productosService.eliminarProductoService(id);

    // HTTP 200 OK con un mensaje de confirmación en formato JSON.
    // Mantenemos consistencia en el formato de respuesta de toda la API.
    res.json({ message: "Producto eliminado" });
  } catch (error) {
    // HTTP 400: error al eliminar (ej: producto no encontrado, restricción FK).
    console.error(error);
    res.status(400).json({ error: error.message || "Error al eliminar producto" });
  }
};
