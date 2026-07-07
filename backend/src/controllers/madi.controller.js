// ==========================================================================
// ARCHIVO: madi.controller.js
// PROYECTO: Aroma & Grano — Sistema de Gestión para Restaurante
// CAPA: Controlador (Controller) — Patrón MVC
// ==========================================================================
//
// ¿QUÉ ES MADI?
// ---------------
// MADI = Módulo de Análisis y Desempeño Interno
//
// MADI es un módulo propio de Aroma & Grano que analiza el rendimiento
// del personal (especialmente meseros) y automatiza la asignación de
// bonificaciones basándose en métricas de ventas y productividad.
//
// COMPONENTES DE MADI:
// --------------------
//   1. CONFIGURACIÓN GENERAL: Parámetros globales del módulo
//      (ej: período de evaluación, umbral mínimo de ventas, etc.)
//
//   2. REGLAS DE BONOS: Definiciones de bonificaciones automáticas
//      (ej: "Si un mesero vende más de $5,000 en la semana, recibe un bono de $500")
//      Cada regla es un registro CRUD independiente con sus propios umbrales.
//
//   3. VERIFICACIÓN DE PROGRESO: Motor de cálculo que evalúa el desempeño
//      de un empleado específico contra las reglas configuradas y determina
//      qué bonos ha alcanzado y cuáles le faltan.
//
// CONTEXTO DE NEGOCIO:
// --------------------
// En la industria restaurantera, la motivación del personal de servicio
// es clave para la satisfacción del cliente. MADI automatiza el proceso
// de evaluación que tradicionalmente se hace de forma manual, eliminando
// sesgos y asegurando transparencia en la asignación de incentivos.
//
// PATRÓN FACHADA (FACADE PATTERN):
// ---------------------------------
// Cada función del controlador:
//   1. Recibe la solicitud HTTP (request)
//   2. Extrae parámetros (params, body)
//   3. Delega al servicio de MADI
//   4. Retorna la respuesta formateada
//   5. Maneja errores de forma uniforme con try/catch
//
// SEMÁNTICA HTTP UTILIZADA:
// -------------------------
// - 200 OK:         Lectura o actualización exitosa
// - 201 Created:    Nueva regla de bono creada exitosamente
// - 400 Bad Request: Error del cliente (datos inválidos, regla duplicada)
// - 500 Internal:   Error inesperado del servidor
//
// ==========================================================================

// ==========================================================================
// SECCIÓN 1: IMPORTACIONES (IMPORTS)
// ==========================================================================

/**
 * Importación con namespace del módulo de servicios de MADI.
 *
 * El módulo `madi.service.js` contiene toda la lógica de negocio del
 * Módulo de Análisis y Desempeño Interno: gestión de configuración,
 * CRUD de reglas de bonos, y algoritmo de verificación de progreso.
 *
 * Funciones disponibles a través de `madiService`:
 *   - madiService.getConfiguracionMadiService()
 *   - madiService.actualizarConfiguracionMadiService()
 *   - madiService.getReglasBonosService()
 *   - madiService.crearReglaBonoService()
 *   - madiService.actualizarReglaBonoService()
 *   - madiService.eliminarReglaBonoService()
 *   - madiService.verificarProgresoPersonalService()
 */
import * as madiService from "../services/madi.service.js";

// ==========================================================================
// SECCIÓN 2: CONFIGURACIÓN GENERAL DE MADI
// ==========================================================================
// La configuración MADI contiene los parámetros globales del módulo,
// como el período de evaluación, umbrales base, y preferencias del
// administrador para el cálculo de bonificaciones.
// ==========================================================================

/**
 * Controlador para obtener la configuración actual del módulo MADI.
 *
 * Recupera los parámetros de configuración global del módulo, que definen
 * cómo se evalúa el desempeño del personal. Estos parámetros incluyen
 * configuraciones como período de evaluación, habilitación del módulo, etc.
 *
 * Ruta típica: GET /api/madi/configuracion
 *
 * @async
 * @function getConfiguracionMadi
 * @param {import('express').Request} req - Objeto de solicitud HTTP de Express.
 *   (No requiere parámetros — retorna la configuración única)
 * @param {import('express').Response} res - Objeto de respuesta HTTP de Express.
 * @returns {void} Envía una respuesta JSON al cliente:
 *   - Éxito: HTTP 200 con el objeto de configuración MADI
 *   - Error: HTTP 500 (Internal Server Error)
 */
export const getConfiguracionMadi = async (req, res) => {
  try {
    // Consultamos al servicio la configuración actual de MADI.
    // Generalmente es un único registro (singleton) en la BD.
    const data = await madiService.getConfiguracionMadiService();

    // HTTP 200 OK (implícito) — retornamos la configuración.
    res.json(data);
  } catch (error) {
    // HTTP 500: si la lectura de configuración falla, es un error del servidor.
    console.error(error);
    res.status(500).json({ error: error.message || "Error al obtener config MADI" });
  }
};

/**
 * Controlador para actualizar la configuración del módulo MADI.
 *
 * Permite al administrador modificar los parámetros globales del módulo.
 * Como la configuración es un singleton (un solo registro), se necesita
 * el ID del registro existente para actualizarlo.
 *
 * Ruta típica: PUT /api/madi/configuracion/:id
 *
 * @async
 * @function actualizarConfiguracionMadi
 * @param {import('express').Request} req - Objeto de solicitud HTTP de Express.
 *   - req.params.id {string} — UUID del registro de configuración a actualizar
 *   - req.body {Object} — Nuevos valores de configuración MADI
 * @param {import('express').Response} res - Objeto de respuesta HTTP de Express.
 * @returns {void} Envía una respuesta JSON al cliente:
 *   - Éxito: HTTP 200 con mensaje de confirmación
 *   - Error: HTTP 400 (Bad Request) por datos inválidos
 */
export const actualizarConfiguracionMadi = async (req, res) => {
  try {
    // Extraemos el ID del registro de configuración desde la URL.
    const { id } = req.params;

    // Delegamos la actualización al servicio, pasando el ID y los nuevos datos.
    // El servicio valida y aplica los cambios en Supabase.
    await madiService.actualizarConfiguracionMadiService(id, req.body);

    // HTTP 200 OK — confirmamos la actualización exitosa.
    res.json({ message: "Configuración MADI actualizada" });
  } catch (error) {
    // HTTP 400: error de validación del lado del cliente.
    console.error(error);
    res.status(400).json({ error: error.message || "Error al actualizar MADI" });
  }
};

// ==========================================================================
// SECCIÓN 3: REGLAS DE BONOS — OPERACIONES CRUD
// ==========================================================================
// Las reglas de bonos definen los criterios que un empleado debe cumplir
// para recibir una bonificación. Cada regla tiene un umbral (meta de ventas)
// y un monto de bono. Este sistema permite al administrador crear múltiples
// niveles de bonificación.
//
// Ejemplo de reglas:
//   Regla 1: "Ventas ≥ $3,000 → Bono de $200"
//   Regla 2: "Ventas ≥ $5,000 → Bono de $500"
//   Regla 3: "Ventas ≥ $10,000 → Bono de $1,000"
// ==========================================================================

/**
 * Controlador para obtener todas las reglas de bonos configuradas.
 *
 * Retorna la lista completa de reglas de bonificación que el administrador
 * ha definido. Cada regla contiene: umbral mínimo de ventas, monto del bono,
 * descripción, y estado (activa/inactiva).
 *
 * Ruta típica: GET /api/madi/reglas
 *
 * @async
 * @function getReglasBonos
 * @param {import('express').Request} req - Objeto de solicitud HTTP de Express.
 *   (No requiere parámetros — retorna todas las reglas)
 * @param {import('express').Response} res - Objeto de respuesta HTTP de Express.
 * @returns {void} Envía una respuesta JSON al cliente:
 *   - Éxito: HTTP 200 con un arreglo de reglas de bonos
 *   - Error: HTTP 500 (Internal Server Error)
 */
export const getReglasBonos = async (req, res) => {
  try {
    // Consultamos al servicio todas las reglas de bonos registradas.
    const data = await madiService.getReglasBonosService();

    // HTTP 200 OK — retornamos el arreglo de reglas.
    res.json(data);
  } catch (error) {
    // HTTP 500: error interno al consultar las reglas.
    console.error(error);
    res.status(500).json({ error: error.message || "Error al obtener reglas bonos" });
  }
};

/**
 * Controlador para crear una nueva regla de bono.
 *
 * Registra una nueva regla de bonificación en la base de datos.
 * El administrador define los criterios que un empleado debe cumplir
 * (umbral de ventas) y la recompensa (monto del bono).
 *
 * Ruta típica: POST /api/madi/reglas
 *
 * @async
 * @function crearReglaBono
 * @param {import('express').Request} req - Objeto de solicitud HTTP de Express.
 *   - req.body {Object} — Datos de la nueva regla:
 *     - req.body.descripcion {string} — Descripción de la regla
 *     - req.body.umbral_ventas {number} — Meta de ventas a alcanzar
 *     - req.body.monto_bono {number} — Monto del bono si se alcanza la meta
 *     - req.body.activa {boolean} — Si la regla está habilitada o no
 * @param {import('express').Response} res - Objeto de respuesta HTTP de Express.
 * @returns {void} Envía una respuesta JSON al cliente:
 *   - Éxito: HTTP 201 (Created) con los datos de la regla creada
 *   - Error: HTTP 400 (Bad Request) por datos inválidos
 */
export const crearReglaBono = async (req, res) => {
  try {
    // Delegamos la creación al servicio, pasando los datos del body.
    const data = await madiService.crearReglaBonoService(req.body);

    // HTTP 201 Created: se creó un nuevo recurso (regla de bono).
    res.status(201).json(data);
  } catch (error) {
    // HTTP 400: error de validación (datos faltantes, formato inválido).
    console.error(error);
    res.status(400).json({ error: error.message || "Error al crear regla bono" });
  }
};

/**
 * Controlador para actualizar una regla de bono existente.
 *
 * Modifica los criterios o la recompensa de una regla de bonificación.
 * Se identifica la regla por su UUID en los parámetros de la URL.
 *
 * Ruta típica: PUT /api/madi/reglas/:id
 *
 * @async
 * @function actualizarReglaBono
 * @param {import('express').Request} req - Objeto de solicitud HTTP de Express.
 *   - req.params.id {string} — UUID de la regla de bono a actualizar
 *   - req.body {Object} — Campos a actualizar (descripcion, umbral, monto, activa)
 * @param {import('express').Response} res - Objeto de respuesta HTTP de Express.
 * @returns {void} Envía una respuesta JSON al cliente:
 *   - Éxito: HTTP 200 con mensaje de confirmación
 *   - Error: HTTP 400 (Bad Request) por datos inválidos
 */
export const actualizarReglaBono = async (req, res) => {
  try {
    // Extraemos el ID de la regla desde los parámetros de la URL.
    const { id } = req.params;

    // Delegamos la actualización al servicio con el ID y los nuevos datos.
    await madiService.actualizarReglaBonoService(id, req.body);

    // HTTP 200 OK — confirmamos la actualización exitosa.
    res.json({ message: "Regla actualizada" });
  } catch (error) {
    // HTTP 400: error de validación del lado del cliente.
    console.error(error);
    res.status(400).json({ error: error.message || "Error al actualizar regla" });
  }
};

/**
 * Controlador para eliminar una regla de bono.
 *
 * Elimina permanentemente una regla de bonificación de la base de datos.
 * Se identifica la regla por su UUID en los parámetros de la URL.
 *
 * Ruta típica: DELETE /api/madi/reglas/:id
 *
 * @async
 * @function eliminarReglaBono
 * @param {import('express').Request} req - Objeto de solicitud HTTP de Express.
 *   - req.params.id {string} — UUID de la regla de bono a eliminar
 * @param {import('express').Response} res - Objeto de respuesta HTTP de Express.
 * @returns {void} Envía una respuesta JSON al cliente:
 *   - Éxito: HTTP 200 con mensaje de confirmación
 *   - Error: HTTP 400 (Bad Request) si la regla no existe u otro error
 */
export const eliminarReglaBono = async (req, res) => {
  try {
    // Extraemos el ID de la regla a eliminar desde la URL.
    const { id } = req.params;

    // Delegamos la eliminación al servicio.
    // `await` sin asignación: solo confirmamos que se completó la operación.
    await madiService.eliminarReglaBonoService(id);

    // HTTP 200 OK — confirmamos la eliminación exitosa.
    res.json({ message: "Regla eliminada" });
  } catch (error) {
    // HTTP 400: error al eliminar (regla no encontrada, etc.).
    console.error(error);
    res.status(400).json({ error: error.message || "Error al eliminar regla" });
  }
};

// ==========================================================================
// SECCIÓN 4: LÓGICA DE NEGOCIO AUTOMATIZADA — VERIFICACIÓN DE PROGRESO
// ==========================================================================
// Esta sección contiene el endpoint más complejo de MADI: el motor de
// evaluación que calcula el progreso de un empleado frente a las reglas
// de bonificación configuradas. Es el "cerebro" del módulo MADI.
// ==========================================================================

/**
 * Controlador para verificar el progreso de un empleado respecto a las metas MADI.
 *
 * Evalúa el desempeño de un empleado específico comparando sus ventas
 * acumuladas contra las reglas de bonificación configuradas. El resultado
 * incluye:
 *   - Ventas totales del empleado en el período actual
 *   - Lista de bonos alcanzados (metas cumplidas)
 *   - Lista de bonos pendientes (metas por alcanzar)
 *   - Porcentaje de progreso hacia la siguiente meta
 *
 * Este endpoint es llamado desde:
 *   - El dashboard del mesero (para ver su propio progreso)
 *   - El panel administrativo (para revisar el desempeño del equipo)
 *
 * Ruta típica: GET /api/madi/progreso/:idUser
 *
 * @async
 * @function verificarProgresoPersonal
 * @param {import('express').Request} req - Objeto de solicitud HTTP de Express.
 *   - req.params.idUser {string} — UUID del empleado cuyo progreso se evalúa
 * @param {import('express').Response} res - Objeto de respuesta HTTP de Express.
 * @returns {void} Envía una respuesta JSON al cliente:
 *   - Éxito: HTTP 200 con el análisis de progreso del empleado
 *   - Error: HTTP 500 (Internal Server Error) si el cálculo falla
 */
export const verificarProgresoPersonal = async (req, res) => {
  try {
    // Extraemos el ID del usuario/empleado desde los parámetros de la URL.
    const { idUser } = req.params;

    // Delegamos la verificación al servicio MADI.
    // El servicio ejecuta el algoritmo de evaluación:
    //   1. Obtiene las ventas acumuladas del empleado
    //   2. Carga las reglas de bonos activas
    //   3. Compara ventas vs. umbrales de cada regla
    //   4. Genera el reporte de progreso
    const result = await madiService.verificarProgresoPersonalService(idUser);

    // HTTP 200 OK — retornamos el análisis de progreso.
    res.json(result);
  } catch (error) {
    // HTTP 500: si el cálculo de progreso falla, es un error interno del servidor.
    console.error(error);
    res.status(500).json({ error: error.message || "Error al verificar progreso" });
  }
};
