import * as mesasService from "../services/mesas.service.js";

export const getMesas = async (req, res) => {
  try {
    const data = await mesasService.getMesasService();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Error al obtener mesas" });
  }
};

export const updateMesaStatus = async (req, res) => {
  try {
    const { idMesa } = req.params;
    const { status } = req.body;
    await mesasService.updateMesaStatusService(idMesa, status);
    res.json({ message: "Estado de mesa actualizado" });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message || "Error al actualizar mesa" });
  }
};
