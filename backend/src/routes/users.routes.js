// Importación de Express para estructurar el enrutamiento modular del sistema de usuarios.
import express from "express";

// Importación por desestructuración de las 5 funciones controladoras que gestionan
// la lógica empresarial de los usuarios (CRUD, seguridad y asignación de roles).
import { crearUsuario, actualizarUsuario, obtenerUsuarios, obtenerPerfilPorAuthId, toggleUsuario, eliminarUsuario, getMeserosConVentas }
from "../controllers/users.controller.js";

// Inicialización del enrutador modular para el catálogo de personal/usuarios.
const router =
  express.Router();

router.get("/meseros-ventas", getMeserosConVentas);
router.get("/perfil/:authId", obtenerPerfilPorAuthId);

// =========================================================================
// RUTA 1: LEER/LISTAR TODOS LOS USUARIOS
// =========================================================================
/**
 * RUTA: GET /
 * PROPÓSITO: Recupera de la base de datos la lista de todos los empleados y sus roles.
 * EXPLICACIÓN SEMÁNTICA:
 * - Método GET: Es el estándar absoluto para consultas de lectura de datos. No altera el servidor.
 * Ejemplo de uso real: GET https://aromagranosystem.onrender.com/api/users
 */
router.get(
  "/",
  obtenerUsuarios
);

// =========================================================================
// RUTA 2: CREAR UN NUEVO USUARIO/EMPLEADO
// =========================================================================
/**
 * RUTA: POST /
 * PROPÓSITO: Da de alta un nuevo usuario ejecutando el flujo dual (Supabase Auth + Tabla 'users').
 * EXPLICACIÓN SEMÁNTICA:
 * - Método POST: Diseñado para enviar entidades al servidor, provocando una inserción o creación.
 * - Los datos sensibles (email, password, salario) viajan protegidos en el cuerpo JSON (req.body).
 * Ejemplo de uso real: POST https://aromagranosystem.onrender.com/api/users
 */
router.post(
  "/",
  crearUsuario
);

// =========================================================================
// RUTA 3: ACTUALIZAR DATOS DEL USUARIO (EDICIÓN INTEGRAL)
// =========================================================================
/**
 * RUTA: PUT /:id
 * PROPÓSITO: Sobrescribe o actualiza los metadatos de un perfil existente (nombres, roles, salarios).
 * EXPLICACIÓN SEMÁNTICA:
 * - Método PUT: Reemplaza o actualiza por completo el estado del recurso objetivo.
 * - Parámetro ':id': Identificador numérico dinámico de la base de datos (id_user).
 * Ejemplo de uso real: PUT https://aromagranosystem.onrender.com/api/users/8
 */
router.put(
  "/:id",
  actualizarUsuario
);

// =========================================================================
// RUTA 4: CONMUTAR ESTADO OPERATIVO (Habilitar / Deshabilitar)
// =========================================================================
/**
 * RUTA: PATCH /:id/status
 * PROPÓSITO: Activa o desactiva de forma lógica la cuenta de un empleado (columna 'active').
 * EXPLICACIÓN SEMÁNTICA:
 * - Método PATCH: Es la mejor práctica en REST cuando solo se desea aplicar una modificación parcial 
 * a un recurso (en este caso, cambiar únicamente la bandera booleana, sin tocar salarios ni nombres).
 * - Cuenta con la regla de seguridad interna que impide auto-desactivar al Administrador Maestro (id_role 1).
 * Ejemplo de uso real: PATCH https://aromagranosystem.onrender.com/api/users/8/status
 */
router.patch(
  "/:id/status",
  toggleUsuario
);

// =========================================================================
// RUTA 5: ELIMINACIÓN ABSOLUTA DE UN USUARIO
// =========================================================================
/**
 * RUTA: DELETE /:id
 * PROPÓSITO: Remueve permanentemente al usuario del ecosistema (Base de datos + Supabase Auth).
 * EXPLICACIÓN SEMÁNTICA:
 * - Método DELETE: Indica la remoción física y destrucción total del recurso identificado por el ':id'.
 * - Cuenta con candados severos para evitar que un administrador maestro sea purgado del sistema.
 * Ejemplo de uso real: DELETE https://aromagranosystem.onrender.com/api/users/8
 */
router.delete(
  "/:id",
  eliminarUsuario
);

// Exportación del bloque de rutas listo para ser consumido e indexado por la app principal.
export default router;