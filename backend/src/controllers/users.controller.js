// ==========================================================================
// ARCHIVO: users.controller.js
// PROYECTO: Aroma & Grano — Sistema de Gestión para Restaurante
// CAPA: Controlador (Controller) — Patrón MVC
// ==========================================================================
//
// ¿QUÉ ES UN CONTROLADOR?
// ------------------------
// En la arquitectura MVC (Modelo-Vista-Controlador), el controlador actúa
// como el intermediario entre las solicitudes HTTP del cliente (frontend)
// y la lógica de negocio encapsulada en la capa de servicios (Service Layer).
//
// PATRÓN FACHADA (FACADE PATTERN):
// ---------------------------------
// Este controlador implementa el patrón Fachada. En lugar de contener
// lógica de negocio directamente, orquesta llamadas a uno o más servicios
// (en este caso `usersService`). Esto proporciona:
//   1. Separación de responsabilidades — el controlador solo maneja HTTP
//   2. Reutilización — los servicios pueden ser usados desde otros lugares
//   3. Testabilidad — se puede probar la lógica de negocio sin HTTP
//   4. Mantenibilidad — cambiar la lógica no afecta al controlador
//
// FLUJO DE UNA SOLICITUD HTTP:
// ----------------------------
// Cliente (React) → Ruta (Express Router) → Controlador → Servicio → Base de Datos (Supabase)
//                                                ↑ ESTAMOS AQUÍ
//
// SEMÁNTICA HTTP UTILIZADA EN ESTE ARCHIVO:
// ------------------------------------------
// - 200 OK:         Operación exitosa (lectura, actualización, eliminación)
// - 201 Created:    Recurso creado exitosamente (alta de usuario)
// - 400 Bad Request: Error del cliente (datos inválidos, duplicados, etc.)
// - 404 Not Found:  Recurso no encontrado (usuario inexistente)
// - 500 Internal:   Error inesperado del servidor
//
// ==========================================================================

// ==========================================================================
// SECCIÓN 1: IMPORTACIONES (IMPORTS)
// ==========================================================================

/**
 * Importación con namespace del módulo de servicios de usuarios.
 *
 * La sintaxis `import * as usersService` importa TODAS las exportaciones
 * nombradas del archivo `users.service.js` y las agrupa bajo el objeto
 * `usersService`. Esto permite acceder a cada función del servicio como:
 *   - usersService.crearUsuarioService()
 *   - usersService.actualizarUsuarioService()
 *   - usersService.eliminarUsuarioService()
 *   - etc.
 *
 * Ventajas de esta sintaxis:
 *   1. Claridad — se ve inmediatamente de qué módulo viene cada función
 *   2. Autocompletado — los IDEs pueden sugerir métodos del objeto
 *   3. Evita colisiones — no hay conflicto con nombres locales
 */
import * as usersService from "../services/users.service.js";

// ==========================================================================
// SECCIÓN 2: OPERACIONES CRUD — CREAR (CREATE)
// ==========================================================================

/**
 * Controlador para dar de alta a un nuevo empleado/usuario en el sistema.
 *
 * Este endpoint recibe los datos del nuevo usuario desde el cuerpo de la
 * solicitud HTTP (req.body) y delega la creación al servicio correspondiente.
 * El servicio se encarga de la validación, la interacción con Supabase Auth
 * y la inserción en la tabla de perfiles.
 *
 * Ruta típica: POST /api/users
 *
 * @async
 * @function crearUsuario
 * @param {import('express').Request} req - Objeto de solicitud HTTP de Express.
 *   - req.body {Object} — Contiene los datos del nuevo usuario:
 *     - req.body.email {string} — Correo electrónico del empleado
 *     - req.body.password {string} — Contraseña temporal asignada
 *     - req.body.nombre {string} — Nombre completo del empleado
 *     - req.body.role {string} — Rol asignado (mesero, cocinero, admin, etc.)
 * @param {import('express').Response} res - Objeto de respuesta HTTP de Express.
 * @returns {void} Envía una respuesta JSON al cliente:
 *   - Éxito: HTTP 201 (Created) con los datos del usuario creado
 *   - Error: HTTP 400 (Bad Request) o el código que indique el error
 */
export const crearUsuario = async (req, res) => {
  try {
    // Delegamos la creación completa al servicio (patrón Fachada).
    // El servicio maneja: validación, Supabase Auth, perfil en BD.
    // req.body contiene todos los campos enviados en el cuerpo JSON de la solicitud POST.
    const data = await usersService.crearUsuarioService(req.body);

    // HTTP 201 Created: indica que se creó un nuevo recurso exitosamente.
    // Retornamos los datos del usuario creado como respuesta JSON.
    res.status(201).json(data);
  } catch (error) {
    // Registramos el error completo en la consola del servidor para depuración.
    // En producción, esto debería ser reemplazado por un logger estructurado (ej: Winston, Pino).
    console.error(error);

    // Determinamos el código de estado HTTP apropiado:
    // - Si el error tiene una propiedad `status` (lanzado intencionalmente por el servicio), la usamos.
    // - Si no, usamos 400 (Bad Request) como código por defecto para errores de validación.
    const status = error.status || 400;

    // Extraemos el mensaje legible del error:
    // - `error.message` es la propiedad estándar de objetos Error de JavaScript.
    // - Si no existe, usamos el error completo como fallback (puede ser un string directo).
    const msg = error.message || error;

    // Respondemos con el código de estado y un JSON con el mensaje de error.
    res.status(status).json({ error: msg });
  }
};

// ==========================================================================
// SECCIÓN 3: OPERACIONES CRUD — ACTUALIZAR (UPDATE)
// ==========================================================================

/**
 * Controlador para actualizar los datos administrativos de un usuario existente.
 *
 * Actualiza campos como nombre, rol, salario, etc., de un usuario identificado
 * por su ID de perfil (UUID). No modifica las credenciales de autenticación
 * (email/contraseña), solo los datos del perfil.
 *
 * Ruta típica: PUT /api/users/:id
 *
 * @async
 * @function actualizarUsuario
 * @param {import('express').Request} req - Objeto de solicitud HTTP de Express.
 *   - req.params.id {string} — UUID del usuario a actualizar (extraído de la URL)
 *   - req.body {Object} — Campos a actualizar (nombre, role, salario, etc.)
 * @param {import('express').Response} res - Objeto de respuesta HTTP de Express.
 * @returns {void} Envía una respuesta JSON al cliente:
 *   - Éxito: HTTP 200 (OK) con los datos actualizados del usuario
 *   - Error: HTTP 400 (Bad Request) o el código específico del error
 */
export const actualizarUsuario = async (req, res) => {
  try {
    // Desestructuración de req.params para extraer el `id` de la URL.
    // En una ruta como PUT /api/users/abc-123, req.params.id === "abc-123".
    // Usamos destructuring { id } para obtener directamente el valor.
    const { id } = req.params;

    // req.body contiene los datos que el cliente desea actualizar.
    // Solo se envían los campos que cambiaron (actualización parcial).
    const updateData = req.body;
    
    // Delegamos al servicio la lógica de actualización.
    // El servicio validará que el usuario exista y aplicará los cambios.
    const data = await usersService.actualizarUsuarioService(id, updateData);

    // HTTP 200 OK (implícito al usar res.json sin status explícito).
    // Retornamos el registro actualizado como confirmación.
    res.json(data);
  } catch (error) {
    // Registro del error en consola para diagnóstico del lado servidor.
    console.error(error);

    // Estrategia de manejo de errores: código HTTP dinámico.
    const status = error.status || 400;
    const msg = error.message || error;
    res.status(status).json({ error: msg });
  }
};

// ==========================================================================
// SECCIÓN 4: OPERACIONES CRUD — ELIMINAR (DELETE)
// ==========================================================================

/**
 * Controlador de borrado absoluto.
 *
 * Elimina permanentemente un usuario del sistema, tanto de Supabase Auth
 * como de la tabla de perfiles. Esta operación es IRREVERSIBLE.
 *
 * NOTA DE DISEÑO: En sistemas de producción, se recomienda implementar
 * borrado lógico (soft delete) en lugar de borrado físico. El borrado
 * lógico marca el registro como inactivo sin eliminarlo realmente,
 * permitiendo auditoría y recuperación. Ver `toggleUsuario` para una
 * alternativa más segura.
 *
 * Ruta típica: DELETE /api/users/:id
 *
 * @async
 * @function eliminarUsuario
 * @param {import('express').Request} req - Objeto de solicitud HTTP de Express.
 *   - req.params.id {string} — UUID del usuario a eliminar
 * @param {import('express').Response} res - Objeto de respuesta HTTP de Express.
 * @returns {void} Envía una respuesta JSON al cliente:
 *   - Éxito: HTTP 200 con mensaje de confirmación
 *   - Error: HTTP 404 si el usuario no existe, HTTP 400 para otros errores
 */
export const eliminarUsuario = async (req, res) => {
  try {
    // Extraemos el ID del usuario desde los parámetros de la URL.
    const { id } = req.params;

    // Delegamos la eliminación al servicio.
    // El `await` sin asignación indica que no necesitamos el valor de retorno,
    // solo esperamos a que la operación se complete exitosamente.
    await usersService.eliminarUsuarioService(id);

    // HTTP 200 OK con un mensaje de confirmación JSON.
    // Enviamos un objeto con clave `message` para mantener consistencia
    // en el formato de respuesta de toda la API.
    res.json({ message: "Usuario eliminado" });
  } catch (error) {
    // Registro del error en consola del servidor.
    console.error(error);

    // Extraemos el mensaje de error.
    const msg = error.message || error;

    // Lógica condicional para determinar el código de estado HTTP:
    // - Si el mensaje es exactamente "Usuario no encontrado", devolvemos 404 (Not Found).
    //   Esto es semántica HTTP correcta: el recurso solicitado no existe.
    // - Para cualquier otro error, usamos 400 (Bad Request) como fallback.
    const status = msg === "Usuario no encontrado" ? 404 : 400;

    res.status(status).json({ error: msg });
  }
};

// ==========================================================================
// SECCIÓN 5: OPERACIONES CRUD — LEER (READ)
// ==========================================================================

/**
 * Controlador para leer y listar a todo el personal.
 *
 * Obtiene la lista completa de usuarios/empleados registrados en el sistema.
 * Esta operación no recibe parámetros — retorna TODOS los usuarios.
 * En un sistema más grande, se implementaría paginación (limit/offset).
 *
 * Ruta típica: GET /api/users
 *
 * @async
 * @function obtenerUsuarios
 * @param {import('express').Request} req - Objeto de solicitud HTTP de Express.
 *   (No se utilizan parámetros del request en esta función)
 * @param {import('express').Response} res - Objeto de respuesta HTTP de Express.
 * @returns {void} Envía una respuesta JSON al cliente:
 *   - Éxito: HTTP 200 con un arreglo de objetos de usuario
 *   - Error: HTTP 500 (Internal Server Error) si algo falla
 */
export const obtenerUsuarios = async (req, res) => {
  try {
    // Llamamos al servicio que consulta Supabase para obtener todos los usuarios.
    // El resultado es un arreglo de objetos con los datos de cada empleado.
    const data = await usersService.obtenerUsuariosService();

    // HTTP 200 OK (implícito) — retornamos el arreglo de usuarios como JSON.
    res.json(data);
  } catch (error) {
    // Para operaciones de lectura, usamos 500 (Internal Server Error)
    // porque si la lectura falla, generalmente es un problema del servidor
    // (BD no disponible, error de conexión, etc.), no del cliente.
    console.error("Error al obtener usuarios:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Controlador para obtener el perfil de un usuario a partir de su Auth ID.
 *
 * Este endpoint es utilizado principalmente después del login para recuperar
 * los datos del perfil del usuario autenticado. El Auth ID es el UUID que
 * Supabase Auth asigna al usuario al registrarse, diferente del ID del perfil.
 *
 * Diferencia entre IDs:
 *   - Auth ID (auth_id): UUID generado por Supabase Auth al crear la cuenta
 *   - Profile ID (id): UUID de la fila en la tabla de perfiles
 *
 * Ruta típica: GET /api/users/perfil/:authId
 *
 * @async
 * @function obtenerPerfilPorAuthId
 * @param {import('express').Request} req - Objeto de solicitud HTTP de Express.
 *   - req.params.authId {string} — UUID de autenticación de Supabase Auth
 * @param {import('express').Response} res - Objeto de respuesta HTTP de Express.
 * @returns {void} Envía una respuesta JSON al cliente:
 *   - Éxito: HTTP 200 con los datos del perfil del usuario
 *   - Error: HTTP 404 (Not Found) si el perfil no existe
 */
export const obtenerPerfilPorAuthId = async (req, res) => {
  try {
    // Extraemos el authId de los parámetros de la URL.
    const { authId } = req.params;

    // Buscamos el perfil del usuario usando su Auth ID de Supabase.
    const data = await usersService.obtenerPerfilPorAuthIdService(authId);

    // HTTP 200 OK — retornamos los datos del perfil encontrado.
    res.json(data);
  } catch (error) {
    // Si el perfil no existe, respondemos con 404 (Not Found).
    // HTTP 404: el servidor no pudo encontrar el recurso solicitado.
    // Este es el código correcto semánticamente para "perfil no existe".
    console.error("Error al obtener perfil:", error);
    res.status(404).json({ error: "Perfil no encontrado" });
  }
};

// ==========================================================================
// SECCIÓN 6: OPERACIONES ESPECIALES — CONMUTACIÓN DE ESTADO
// ==========================================================================

/**
 * Controlador de conmutación de estado (Habilitar / Deshabilitar).
 *
 * Implementa borrado lógico (soft delete) al cambiar el estado `active`
 * de un usuario sin eliminarlo de la base de datos. Esto permite:
 *   - Deshabilitar temporalmente a un empleado sin perder su historial
 *   - Reactivar empleados que regresan
 *   - Mantener integridad referencial con pedidos y ventas pasadas
 *
 * Ruta típica: PATCH /api/users/:id/toggle
 *
 * @async
 * @function toggleUsuario
 * @param {import('express').Request} req - Objeto de solicitud HTTP de Express.
 *   - req.params.id {string} — UUID del usuario cuyo estado se va a conmutar
 *   - req.body.active {boolean} — Nuevo estado: true (activo) o false (inactivo)
 * @param {import('express').Response} res - Objeto de respuesta HTTP de Express.
 * @returns {void} Envía una respuesta JSON al cliente:
 *   - Éxito: HTTP 200 con los datos actualizados del usuario
 *   - Error: HTTP 400 o el código específico del error
 */
export const toggleUsuario = async (req, res) => {
  try {
    // Extraemos el ID del usuario desde la URL.
    const { id } = req.params;

    // Extraemos el nuevo valor de `active` desde el cuerpo de la solicitud.
    // `active` es un booleano: true para habilitar, false para deshabilitar.
    const { active } = req.body;

    // Delegamos al servicio la actualización del estado.
    const data = await usersService.toggleUsuarioService(id, active);

    // HTTP 200 OK — retornamos el usuario con su estado actualizado.
    res.json(data);
  } catch (error) {
    // Registro del error y respuesta con código apropiado.
    console.error(error);
    const status = error.status || 400;
    res.status(status).json({ error: error.message || error });
  }
};

// ==========================================================================
// SECCIÓN 7: OPERACIONES DE NEGOCIO — MÉTRICAS DE MESEROS
// ==========================================================================

/**
 * Controlador para obtener métricas de meseros.
 *
 * Recupera datos de rendimiento de los meseros, incluyendo sus ventas
 * totales acumuladas. Esta información es utilizada por el módulo MADI
 * (Módulo de Análisis y Desempeño Interno) para calcular bonos y
 * evaluar el desempeño del personal.
 *
 * Ruta típica: GET /api/users/meseros/ventas
 *
 * @async
 * @function getMeserosConVentas
 * @param {import('express').Request} req - Objeto de solicitud HTTP de Express.
 *   (No requiere parámetros — retorna métricas de todos los meseros)
 * @param {import('express').Response} res - Objeto de respuesta HTTP de Express.
 * @returns {void} Envía una respuesta JSON al cliente:
 *   - Éxito: HTTP 200 con un arreglo de meseros y sus métricas de venta
 *   - Error: HTTP 400 o el código específico del error
 */
export const getMeserosConVentas = async (req, res) => {
  try {
    // Obtenemos la lista de meseros junto con sus totales de venta.
    // El servicio realiza la consulta agregada a la base de datos.
    const data = await usersService.getMeserosConVentasService();

    // HTTP 200 OK — retornamos las métricas de los meseros.
    res.json(data);
  } catch (error) {
    // Manejo estándar de errores con código HTTP dinámico.
    console.error(error);
    const status = error.status || 400;
    res.status(status).json({ error: error.message || error });
  }
};