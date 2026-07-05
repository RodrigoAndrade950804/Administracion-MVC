import * as usersService from "../services/users.service.js";

/**
 * Controlador para dar de alta a un nuevo empleado/usuario en el sistema.
 */
export const crearUsuario = async (req, res) => {
  try {
    const data = await usersService.crearUsuarioService(req.body);
    res.status(201).json(data);
  } catch (error) {
    console.error(error);
    // Verificar si es un error de Supabase o un Error lanzado
    const status = error.status || 400;
    const msg = error.message || error;
    res.status(status).json({ error: msg });
  }
};

/**
 * Controlador para actualizar los datos administrativos de un usuario existente.
 */
export const actualizarUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const data = await usersService.actualizarUsuarioService(id, updateData);
    res.json(data);
  } catch (error) {
    console.error(error);
    const status = error.status || 400;
    const msg = error.message || error;
    res.status(status).json({ error: msg });
  }
};

/**
 * Controlador de borrado absoluto.
 */
export const eliminarUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    await usersService.eliminarUsuarioService(id);
    res.json({ message: "Usuario eliminado" });
  } catch (error) {
    console.error(error);
    const msg = error.message || error;
    const status = msg === "Usuario no encontrado" ? 404 : 400;
    res.status(status).json({ error: msg });
  }
};

/**
 * Controlador para leer y listar a todo el personal.
 */
export const obtenerUsuarios = async (req, res) => {
  try {
    const data = await usersService.obtenerUsuariosService();
    res.json(data);
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    res.status(500).json({ error: error.message });
  }
};

export const obtenerPerfilPorAuthId = async (req, res) => {
  try {
    const { authId } = req.params;
    const data = await usersService.obtenerPerfilPorAuthIdService(authId);
    res.json(data);
  } catch (error) {
    console.error("Error al obtener perfil:", error);
    res.status(404).json({ error: "Perfil no encontrado" });
  }
};

/**
 * Controlador de conmutación de estado (Habilitar / Deshabilitar).
 */
export const toggleUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    const data = await usersService.toggleUsuarioService(id, active);
    res.json(data);
  } catch (error) {
    console.error(error);
    const status = error.status || 400;
    res.status(status).json({ error: error.message || error });
  }
};

/**
 * Controlador para obtener métricas de meseros.
 */
export const getMeserosConVentas = async (req, res) => {
  try {
    const data = await usersService.getMeserosConVentasService();
    res.json(data);
  } catch (error) {
    console.error(error);
    const status = error.status || 400;
    res.status(status).json({ error: error.message || error });
  }
};