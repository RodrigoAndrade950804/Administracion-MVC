import supabaseAdmin from "./supabaseAdmin.js";

export const cerrarPedidoSeguroService = async (idPedido) => {
  // 1️⃣ Obtener detalles del pedido
  const { data: detalles, error: detallesError } = await supabaseAdmin
    .from("detalle_pedidos")
    .select("id_producto, cantidad, subtotal")
    .eq("pedido_id", idPedido);

  if (detallesError) throw detallesError;

  if (!detalles || detalles.length === 0) {
    throw new Error("El pedido no tiene detalles");
  }

  // 2️⃣ Calcular total EN BACKEND
  let total = 0;
  for (const item of detalles) {
    total += item.cantidad;
  }

  // 3️⃣ Actualizar pedido
  const { data: pedido, error: pedidoError } = await supabaseAdmin
    .from("pedidos")
    .update({
      total_amount: total,
      status: "cerrado",
    })
    .eq("id", idPedido)
    .select()
    .single();

  if (pedidoError) throw pedidoError;

  return pedido;
};