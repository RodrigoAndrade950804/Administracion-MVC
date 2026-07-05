import * as happyHourService from "../services/happy_hour.service.js";

export const getConfiguracionHappyHour = async (req, res) => {
  try {
    const data = await happyHourService.getConfiguracionHappyHourService();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Error al obtener config Happy Hour" });
  }
};

export const actualizarConfiguracionHappyHour = async (req, res) => {
  try {
    const { id } = req.params;
    await happyHourService.actualizarConfiguracionHappyHourService(id, req.body);
    res.json({ message: "Configuración Happy Hour actualizada" });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message || "Error al actualizar Happy Hour" });
  }
};

export const verificarActivacionHappyHour = async (req, res) => {
  try {
    const result = await happyHourService.verificarActivacionHappyHourService();
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Error al verificar Happy Hour" });
  }
};

export const obtenerVentasSemanales = async (req, res) => {
  try {
    const total = await happyHourService.calcularVentasSemanalesService();
    res.json({ total });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Error al obtener ventas semanales" });
  }
};
