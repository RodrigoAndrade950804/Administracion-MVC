import * as productosService from "../services/productos.service.js";

export const getProductos = async (req, res) => {
  try {
    const data = await productosService.getProductosService();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Error al obtener productos" });
  }
};

export const crearProducto = async (req, res) => {
  try {
    const data = await productosService.crearProductoService(req.body);
    res.status(201).json(data);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message || "Error al crear producto" });
  }
};

export const actualizarProducto = async (req, res) => {
  try {
    const { id } = req.params;
    const { id_user, ...productoData } = req.body; // Extraer id_user si viene
    
    const data = await productosService.actualizarProductoService(id, productoData, id_user);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message || "Error al actualizar producto" });
  }
};

export const eliminarProducto = async (req, res) => {
  try {
    const { id } = req.params;
    await productosService.eliminarProductoService(id);
    res.json({ message: "Producto eliminado" });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message || "Error al eliminar producto" });
  }
};
