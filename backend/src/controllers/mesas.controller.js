// ==========================================================================
// ARCHIVO: mesas.controller.js
// PROYECTO: Aroma & Grano — Sistema de Gestión para Restaurante
// CAPA: Controlador (Controller) — Patrón MVC
// ==========================================================================
//
// CONTEXTO DE NEGOCIO:
// --------------------
// Este controlador gestiona las mesas físicas del restaurante Aroma & Grano.
// Las mesas son un recurso fundamental en un sistema de punto de venta (POS)
// para restaurantes, ya que representan el espacio donde los clientes
// se sientan y consumen los productos.
//
// ESTADOS DE UNA MESA:
// --------------------
// Cada mesa tiene un estado que refleja su disponibilidad:
//   - "disponible" → La mesa está vacía y lista para recibir clientes
//   - "ocupada"    → Hay un pedido abierto en la mesa (clientes consumiendo)
//   - "reservada"  → La mesa está reservada para un cliente específico
//   - "cerrada"    → La mesa no está en uso (mantenimiento, fuera de servicio)
//
// El flujo típico es:
//   disponible → ocupada (se abre pedido) → disponible (se cierra pedido)
//
// OPERACIONES EXPUESTAS:
// ----------------------
// Este controlador es deliberadamente simple, con solo dos operaciones:
//   1. LISTAR MESAS: Obtener todas las mesas y sus estados actuales
//   2. ACTUALIZAR ESTADO: Cambiar el estado de una mesa específica
//
// PATRÓN FACHADA (FACADE PATTERN):
// ---------------------------------
// Las funciones actúan como fachadas delgadas que:
//   1. Reciben la solicitud HTTP
//   2. Extraen los datos necesarios (params, body)
//   3. Delegan la lógica al servicio de mesas
//   4. Retornan la respuesta HTTP formateada
//
// SEMÁNTICA HTTP UTILIZADA:
// -------------------------
// - 200 OK:              Operación completada exitosamente
// - 400 Bad Request:     Error del cliente (estado inválido, mesa no encontrada)
// - 500 Internal Server: Error inesperado del servidor (BD no disponible)
//
// ==========================================================================

// ==========================================================================
// SECCIÓN 1: IMPORTACIONES (IMPORTS)
// ==========================================================================

/**
 * Importación con namespace del módulo de servicios de mesas.
 *
 * El módulo `mesas.service.js` contiene la lógica de negocio para
 * la gestión de mesas: consultas a la base de datos, validación de
 * estados permitidos, y actualización de registros en Supabase.
 *
 * Funciones disponibles a través de `mesasService`:
 *   - mesasService.getMesasService()         — Listar todas las mesas
 *   - mesasService.updateMesaStatusService() — Actualizar estado de una mesa
 */
import * as mesasService from "../services/mesas.service.js";

// ==========================================================================
// SECCIÓN 2: LISTAR MESAS (READ ALL)
// ==========================================================================

/**
 * Controlador para obtener todas las mesas del restaurante.
 *
 * Retorna la lista completa de mesas con sus propiedades:
 * identificador, nombre/número, capacidad de asientos, y estado actual.
 *
 * Esta información es usada por el frontend para renderizar el mapa
 * visual del restaurante, donde cada mesa se muestra con un color
 * que indica su estado (verde=disponible, rojo=ocupada, etc.).
 *
 * Ruta típica: GET /api/mesas
 *
 * @async
 * @function getMesas
 * @param {import('express').Request} req - Objeto de solicitud HTTP de Express.
 *   (No requiere parámetros — retorna todas las mesas)
 * @param {import('express').Response} res - Objeto de respuesta HTTP de Express.
 * @returns {void} Envía una respuesta JSON al cliente:
 *   - Éxito: HTTP 200 con un arreglo de objetos mesa
 *   - Error: HTTP 500 (Internal Server Error)
 */
export const getMesas = async (req, res) => {
  try {
    // Consultamos al servicio todas las mesas registradas en la BD.
    // El resultado es un arreglo de objetos, cada uno con:
    //   { id, nombre, capacidad, status, ... }
    const data = await mesasService.getMesasService();

    // HTTP 200 OK (implícito al usar res.json sin status explícito).
    // `res.json(data)` serializa el arreglo JavaScript a formato JSON
    // y establece el header Content-Type: application/json automáticamente.
    res.json(data);
  } catch (error) {
    // HTTP 500 Internal Server Error: usamos este código porque si la
    // lectura de mesas falla, es un problema del servidor (BD no disponible,
    // error de conexión, etc.), no un error del cliente.
    console.error(error);
    res.status(500).json({ error: error.message || "Error al obtener mesas" });
  }
};

// ==========================================================================
// SECCIÓN 3: ACTUALIZAR ESTADO DE UNA MESA (UPDATE STATUS)
// ==========================================================================

/**
 * Controlador para actualizar el estado de una mesa específica.
 *
 * Cambia el estado de una mesa identificada por su UUID. Este endpoint
 * es invocado automáticamente por otros procesos del sistema:
 *   - Al ABRIR un pedido → la mesa pasa a "ocupada"
 *   - Al CERRAR un pedido → la mesa pasa a "disponible"
 *   - Al RESERVAR → la mesa pasa a "reservada"
 *
 * También puede ser invocado manualmente por un administrador para
 * forzar un cambio de estado (ej: marcar mesa en mantenimiento).
 *
 * Ruta típica: PATCH /api/mesas/:idMesa
 *
 * @async
 * @function updateMesaStatus
 * @param {import('express').Request} req - Objeto de solicitud HTTP de Express.
 *   - req.params.idMesa {string} — UUID de la mesa a actualizar (desde la URL)
 *   - req.body.status {string} — Nuevo estado de la mesa
 *     (valores válidos: "disponible", "ocupada", "reservada", "cerrada")
 * @param {import('express').Response} res - Objeto de respuesta HTTP de Express.
 * @returns {void} Envía una respuesta JSON al cliente:
 *   - Éxito: HTTP 200 con mensaje de confirmación
 *   - Error: HTTP 400 (Bad Request) por estado inválido o mesa no encontrada
 */
export const updateMesaStatus = async (req, res) => {
  try {
    // Extraemos el ID de la mesa desde los parámetros de la URL.
    // En una ruta como PATCH /api/mesas/abc-123, req.params.idMesa === "abc-123".
    const { idMesa } = req.params;

    // Extraemos el nuevo estado desde el cuerpo de la solicitud.
    // El frontend envía un JSON como: { "status": "ocupada" }
    const { status } = req.body;

    // Delegamos la actualización al servicio, que:
    //   1. Valida que el estado proporcionado sea válido
    //   2. Verifica que la mesa exista
    //   3. Actualiza el registro en Supabase
    // `await` sin asignación: solo necesitamos que se complete la operación.
    await mesasService.updateMesaStatusService(idMesa, status);

    // HTTP 200 OK — confirmamos que el estado fue actualizado.
    res.json({ message: "Estado de mesa actualizado" });
  } catch (error) {
    // HTTP 400 Bad Request: usamos este código porque los errores más
    // comunes son del lado del cliente (estado inválido, mesa no encontrada).
    console.error(error);
    res.status(400).json({ error: error.message || "Error al actualizar mesa" });
  }
};
