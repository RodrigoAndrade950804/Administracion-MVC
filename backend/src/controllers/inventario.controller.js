import * as inventarioService from "../services/inventario.service.js";

/**
 * Controlador para descontar el stock de los productos involucrados en un pedido específico.
 */
export const descontarInventarioPedido = async (req, res) => {
  try {
    const { idPedido } = req.params;
    await inventarioService.descontarInventarioPedidoService(idPedido);
    res.json({ message: "Inventario actualizado" });
  } catch (error) {
    console.error(error);
    const status = error.status || 400;
    res.status(status).json(error);
  }
};

/**
 * Controlador para registrar movimientos o ajustes manuales de inventario.
 */
export const registrarMovimientoInventario = async (req, res) => {
  try {
    const result = await inventarioService.registrarMovimientoInventarioService(req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    const status = error.status || 400;
    res.status(status).json(error);
  }
};