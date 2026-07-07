// ==========================================================================
// ARCHIVO: happy_hour.controller.js
// PROYECTO: Aroma & Grano — Sistema de Gestión para Restaurante
// CAPA: Controlador (Controller) — Patrón MVC
// ==========================================================================
//
// ¿QUÉ ES HAPPY HOUR?
// ---------------------
// Happy Hour es un módulo promocional de Aroma & Grano que permite
// configurar descuentos automáticos en productos durante horarios
// específicos o cuando se cumplen ciertos criterios de ventas semanales.
//
// El concepto de "Happy Hour" (hora feliz) es una práctica común en
// restaurantes y bares donde se ofrecen precios reducidos en bebidas
// y/o alimentos durante un período determinado para atraer más clientes
// en horarios de baja demanda.
//
// COMPONENTES DEL MÓDULO:
// -----------------------
//   1. CONFIGURACIÓN: Define los parámetros del Happy Hour:
//      - Horario de inicio y fin (ej: 16:00 a 19:00)
//      - Días de la semana habilitados (ej: lunes a viernes)
//      - Porcentaje de descuento aplicable
//      - Umbral de ventas semanales para activación automática
//      - Estado general (habilitado/deshabilitado)
//
//   2. VERIFICACIÓN DE ACTIVACIÓN: Motor que evalúa si el Happy Hour
//      debe estar activo en el momento actual, considerando:
//      - La hora del día
//      - El día de la semana
//      - Las ventas acumuladas de la semana
//
//   3. VENTAS SEMANALES: Cálculo del total de ventas de la semana
//      actual, utilizado como criterio de activación del Happy Hour.
//
// RELACIÓN CON OTROS MÓDULOS:
// ---------------------------
//   - PEDIDOS: Cuando Happy Hour está activo, los precios de los productos
//     en nuevos pedidos se calculan con el descuento configurado.
//   - MADI: Ambos módulos comparten métricas de ventas del personal.
//
// PATRÓN FACHADA (FACADE PATTERN):
// ---------------------------------
// Cada función del controlador actúa como fachada:
//   1. Recibe la solicitud HTTP del cliente
//   2. Extrae los datos necesarios (params, body)
//   3. Delega la lógica de negocio al servicio de Happy Hour
//   4. Formatea y envía la respuesta HTTP apropiada
//   5. Captura y maneja errores con try/catch uniforme
//
// SEMÁNTICA HTTP UTILIZADA:
// -------------------------
// - 200 OK:         Lectura exitosa o actualización confirmada
// - 400 Bad Request: Error del cliente (datos de configuración inválidos)
// - 500 Internal:   Error inesperado del servidor
//
// ==========================================================================

// ==========================================================================
// SECCIÓN 1: IMPORTACIONES (IMPORTS)
// ==========================================================================

/**
 * Importación con namespace del módulo de servicios de Happy Hour.
 *
 * El módulo `happy_hour.service.js` contiene toda la lógica de negocio
 * del módulo de Happy Hour: gestión de configuración, algoritmo de
 * verificación de activación, y cálculo de ventas semanales.
 *
 * Funciones disponibles a través de `happyHourService`:
 *   - happyHourService.getConfiguracionHappyHourService()     — Leer configuración
 *   - happyHourService.actualizarConfiguracionHappyHourService() — Actualizar config
 *   - happyHourService.verificarActivacionHappyHourService()  — Verificar si está activo
 *   - happyHourService.calcularVentasSemanalesService()       — Total ventas semana
 */
import * as happyHourService from "../services/happy_hour.service.js";

// ==========================================================================
// SECCIÓN 2: CONFIGURACIÓN DEL HAPPY HOUR
// ==========================================================================

/**
 * Controlador para obtener la configuración actual del Happy Hour.
 *
 * Recupera todos los parámetros de configuración del módulo Happy Hour,
 * incluyendo horarios, días activos, porcentaje de descuento, y umbrales.
 * La configuración es un singleton (un único registro en la BD).
 *
 * Ruta típica: GET /api/happy-hour/configuracion
 *
 * @async
 * @function getConfiguracionHappyHour
 * @param {import('express').Request} req - Objeto de solicitud HTTP de Express.
 *   (No requiere parámetros — retorna la configuración única)
 * @param {import('express').Response} res - Objeto de respuesta HTTP de Express.
 * @returns {void} Envía una respuesta JSON al cliente:
 *   - Éxito: HTTP 200 con el objeto de configuración de Happy Hour
 *   - Error: HTTP 500 (Internal Server Error)
 */
export const getConfiguracionHappyHour = async (req, res) => {
  try {
    // Consultamos al servicio la configuración actual del Happy Hour.
    // El resultado es un objeto con todas las propiedades configurables.
    const data = await happyHourService.getConfiguracionHappyHourService();

    // HTTP 200 OK (implícito) — retornamos la configuración.
    res.json(data);
  } catch (error) {
    // HTTP 500: error interno al leer la configuración.
    console.error(error);
    res.status(500).json({ error: error.message || "Error al obtener config Happy Hour" });
  }
};

/**
 * Controlador para actualizar la configuración del Happy Hour.
 *
 * Permite al administrador modificar los parámetros del módulo:
 * horarios, días activos, descuento, umbrales, etc. Como la configuración
 * es un singleton, se necesita el ID del registro existente.
 *
 * Ruta típica: PUT /api/happy-hour/configuracion/:id
 *
 * @async
 * @function actualizarConfiguracionHappyHour
 * @param {import('express').Request} req - Objeto de solicitud HTTP de Express.
 *   - req.params.id {string} — UUID del registro de configuración a actualizar
 *   - req.body {Object} — Nuevos valores de configuración:
 *     - req.body.hora_inicio {string} — Hora de inicio del Happy Hour (ej: "16:00")
 *     - req.body.hora_fin {string} — Hora de fin del Happy Hour (ej: "19:00")
 *     - req.body.descuento_porcentaje {number} — Porcentaje de descuento (ej: 20)
 *     - req.body.dias_activos {string[]} — Días habilitados (ej: ["lunes", "martes"])
 *     - req.body.habilitado {boolean} — Si el módulo está activo
 *     - req.body.umbral_ventas_semana {number} — Ventas mínimas para activar
 * @param {import('express').Response} res - Objeto de respuesta HTTP de Express.
 * @returns {void} Envía una respuesta JSON al cliente:
 *   - Éxito: HTTP 200 con mensaje de confirmación
 *   - Error: HTTP 400 (Bad Request) por datos inválidos
 */
export const actualizarConfiguracionHappyHour = async (req, res) => {
  try {
    // Extraemos el ID del registro de configuración desde la URL.
    const { id } = req.params;

    // Delegamos la actualización al servicio, pasando el ID y los nuevos datos.
    // El servicio valida los datos y actualiza el registro en Supabase.
    // `await` sin asignación: solo necesitamos confirmar que se completó.
    await happyHourService.actualizarConfiguracionHappyHourService(id, req.body);

    // HTTP 200 OK — confirmamos que la configuración fue actualizada.
    res.json({ message: "Configuración Happy Hour actualizada" });
  } catch (error) {
    // HTTP 400: error de validación (datos inválidos del lado del cliente).
    console.error(error);
    res.status(400).json({ error: error.message || "Error al actualizar Happy Hour" });
  }
};

// ==========================================================================
// SECCIÓN 3: VERIFICACIÓN DE ACTIVACIÓN DEL HAPPY HOUR
// ==========================================================================

/**
 * Controlador para verificar si el Happy Hour está activo en este momento.
 *
 * Este endpoint es consultado periódicamente por el frontend para saber si
 * debe aplicar precios con descuento. El servicio evalúa múltiples criterios:
 *
 *   1. ¿El módulo está habilitado en la configuración?
 *   2. ¿Es un día de la semana donde el Happy Hour está activo?
 *   3. ¿La hora actual está dentro del rango configurado?
 *   4. ¿Se ha alcanzado el umbral de ventas semanales?
 *
 * Si TODOS los criterios se cumplen, el Happy Hour está activo y se
 * retorna la información del descuento aplicable.
 *
 * Ruta típica: GET /api/happy-hour/verificar
 *
 * @async
 * @function verificarActivacionHappyHour
 * @param {import('express').Request} req - Objeto de solicitud HTTP de Express.
 *   (No requiere parámetros — evalúa el momento actual)
 * @param {import('express').Response} res - Objeto de respuesta HTTP de Express.
 * @returns {void} Envía una respuesta JSON al cliente:
 *   - Éxito: HTTP 200 con un objeto que indica:
 *     - activo {boolean} — Si el Happy Hour está activo ahora
 *     - descuento {number} — Porcentaje de descuento (si está activo)
 *     - mensaje {string} — Descripción del estado actual
 *   - Error: HTTP 500 (Internal Server Error)
 */
export const verificarActivacionHappyHour = async (req, res) => {
  try {
    // Delegamos la verificación al servicio.
    // El servicio ejecuta el algoritmo de evaluación que considera
    // hora actual, día de la semana, configuración, y ventas semanales.
    const result = await happyHourService.verificarActivacionHappyHourService();

    // HTTP 200 OK — retornamos el resultado de la verificación.
    res.json(result);
  } catch (error) {
    // HTTP 500: error interno al evaluar la activación.
    console.error(error);
    res.status(500).json({ error: error.message || "Error al verificar Happy Hour" });
  }
};

// ==========================================================================
// SECCIÓN 4: CÁLCULO DE VENTAS SEMANALES
// ==========================================================================

/**
 * Controlador para obtener el total de ventas de la semana actual.
 *
 * Calcula la suma de todos los pedidos cerrados durante la semana en
 * curso (lunes a domingo). Este dato es utilizado por:
 *   - El módulo Happy Hour: como criterio de activación
 *   - El dashboard administrativo: para monitoreo de ventas
 *   - El módulo MADI: como referencia de desempeño global
 *
 * Ruta típica: GET /api/happy-hour/ventas-semanales
 *
 * @async
 * @function obtenerVentasSemanales
 * @param {import('express').Request} req - Objeto de solicitud HTTP de Express.
 *   (No requiere parámetros — calcula la semana actual automáticamente)
 * @param {import('express').Response} res - Objeto de respuesta HTTP de Express.
 * @returns {void} Envía una respuesta JSON al cliente:
 *   - Éxito: HTTP 200 con un objeto { total: number } conteniendo
 *     el monto total de ventas de la semana en moneda local
 *   - Error: HTTP 500 (Internal Server Error)
 */
export const obtenerVentasSemanales = async (req, res) => {
  try {
    // Delegamos el cálculo al servicio.
    // El servicio consulta Supabase sumando los totales de pedidos cerrados
    // cuya fecha de cierre esté dentro de la semana actual.
    const total = await happyHourService.calcularVentasSemanalesService();

    // HTTP 200 OK — retornamos el total envuelto en un objeto.
    // Usamos la propiedad `total` para mantener consistencia con el formato
    // de respuesta de la API. La sintaxis `{ total }` es shorthand property
    // de ES6, equivalente a `{ total: total }`.
    res.json({ total });
  } catch (error) {
    // HTTP 500: error interno al calcular las ventas.
    console.error(error);
    res.status(500).json({ error: error.message || "Error al obtener ventas semanales" });
  }
};
