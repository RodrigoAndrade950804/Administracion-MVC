import * as pedidosService from "../services/pedidos.service.js";

export const crearPedido = async (req, res) => {
  try {
    const { id_mesa, id_user } = req.body;
    const data = await pedidosService.crearPedidoService(id_mesa, id_user);
    res.status(201).json(data);
  } catch (error) {
    console.error(error);
    const status = error.status || 500;
    res.status(status).json({ error: error.message || "Error al crear pedido" });
  }
};

export const obtenerPedidoMesa = async (req, res) => {
  try {
    const { idMesa } = req.params;
    const data = await pedidosService.obtenerPedidoMesaService(idMesa);
    res.json(data || { message: "No hay pedido abierto" });
  } catch (error) {
    console.error(error);
    const status = error.status || 500;
    res.status(status).json({ error: error.message || "Error interno del servidor" });
  }
};

export const eliminarPedido = async (req, res) => {
  try {
    const { idPedido } = req.params;
    await pedidosService.eliminarPedidoService(idPedido);
    res.json({ message: "Pedido eliminado" });
  } catch (error) {
    console.error(error);
    const status = error.status || 500;
    res.status(status).json({ error: error.message || "Error al eliminar pedido" });
  }
};

export const cerrarPedido = async (req, res) => {
  try {
    const { idPedido } = req.params;
    const data = await pedidosService.cerrarPedidoSeguroService(idPedido);
    res.json(data);
  } catch (error) {
    console.error(error);
    const status = error.status || 500;
    res.status(status).json({ error: error.message || "Error al cerrar pedido" });
  }
};

export const agregarProductoPedido = async (req, res) => {
  try {
    const { idPedido } = req.params;
    const { id_producto, quantity = 1 } = req.body;
    const result = await pedidosService.agregarProductoPedidoService(idPedido, id_producto, quantity);
    res.status(201).json({
      message: "Producto agregado correctamente",
      ...result
    });
  } catch (error) {
    console.error(error);
    const status = error.status || 500;
    res.status(status).json({ error: error.message || "Error interno del servidor", disponible: error.disponible });
  }
};

export const actualizarCantidadDetalle = async (req, res) => {
  try {
    const { idPedido, idDetalle } = req.params;
    const { quantity } = req.body;
    const nuevoTotal = await pedidosService.actualizarCantidadDetalleService(idPedido, idDetalle, quantity);
    res.json({
      message: "Cantidad actualizada correctamente",
      nuevoTotal
    });
  } catch (error) {
    console.error(error);
    const status = error.status || 500;
    res.status(status).json({ error: error.message || "Error al actualizar cantidad", disponible: error.disponible });
  }
};

export const eliminarDetalle = async (req, res) => {
  try {
    const { idPedido, idDetalle } = req.params;
    const result = await pedidosService.eliminarDetalleService(idPedido, idDetalle);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al eliminar detalle" });
  }
};