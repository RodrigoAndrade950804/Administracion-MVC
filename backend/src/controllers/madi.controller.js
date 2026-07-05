import * as madiService from "../services/madi.service.js";

// =========================
// CONFIGURACION MADI
// =========================
export const getConfiguracionMadi = async (req, res) => {
  try {
    const data = await madiService.getConfiguracionMadiService();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Error al obtener config MADI" });
  }
};

export const actualizarConfiguracionMadi = async (req, res) => {
  try {
    const { id } = req.params;
    await madiService.actualizarConfiguracionMadiService(id, req.body);
    res.json({ message: "Configuración MADI actualizada" });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message || "Error al actualizar MADI" });
  }
};

// =========================
// REGLAS BONOS (CRUD)
// =========================
export const getReglasBonos = async (req, res) => {
  try {
    const data = await madiService.getReglasBonosService();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Error al obtener reglas bonos" });
  }
};

export const crearReglaBono = async (req, res) => {
  try {
    const data = await madiService.crearReglaBonoService(req.body);
    res.status(201).json(data);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message || "Error al crear regla bono" });
  }
};

export const actualizarReglaBono = async (req, res) => {
  try {
    const { id } = req.params;
    await madiService.actualizarReglaBonoService(id, req.body);
    res.json({ message: "Regla actualizada" });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message || "Error al actualizar regla" });
  }
};

export const eliminarReglaBono = async (req, res) => {
  try {
    const { id } = req.params;
    await madiService.eliminarReglaBonoService(id);
    res.json({ message: "Regla eliminada" });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message || "Error al eliminar regla" });
  }
};

// =========================
// LÓGICA DE NEGOCIO AUTOMATIZADA
// =========================
export const verificarProgresoPersonal = async (req, res) => {
  try {
    const { idUser } = req.params;
    const result = await madiService.verificarProgresoPersonalService(idUser);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Error al verificar progreso" });
  }
};
