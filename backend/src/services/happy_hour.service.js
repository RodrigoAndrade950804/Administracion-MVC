import supabaseAdmin from "./supabaseAdmin.js";

// =========================
// CONFIGURACION HAPPY HOUR
// =========================

export const getConfiguracionHappyHourService = async () => {
  const { data, error } = await supabaseAdmin
    .from("configuracion_happy_hour")
    .select("*")
    .single();

  // Si la tabla es nueva y está vacía, devuelve defaults para evitar crasheos
  if (error && error.code === 'PGRST116') {
    return { is_active: false, discount_percentage: 0, waiter_multiplier: 1.0 };
  }
  if (error) throw error;
  return data;
};

export const actualizarConfiguracionHappyHourService = async (id, configuracion) => {
  const { error } = await supabaseAdmin
    .from("configuracion_happy_hour")
    .update(configuracion)
    .eq("id_happy_hour", id);

  if (error) throw error;
  return true;
};

// =========================
// LÓGICA DE NEGOCIO AUTOMATIZADA
// =========================

export const calcularVentasSemanalesService = async () => {
  // Calcular inicio de semana (Lunes) y hoy
  const hoy = new Date();
  const diaSemana = hoy.getDay(); // 0 = Domingo, 1 = Lunes...
  const distanciaLunes = diaSemana === 0 ? -6 : 1 - diaSemana;
  
  const inicioSemana = new Date(hoy);
  inicioSemana.setDate(hoy.getDate() + distanciaLunes);
  inicioSemana.setHours(0, 0, 0, 0);

  const { data, error } = await supabaseAdmin
    .from("pedidos")
    .select("total_amount")
    .eq("status", "cerrado")
    .gte("pedido_date", inicioSemana.toISOString());

  if (error) {
    // Si la columna pedido_date falla (porque era created_at en la db original), probar con fallback
    const { data: d2, error: e2 } = await supabaseAdmin
      .from("pedidos")
      .select("total_amount")
      .eq("status", "cerrado");
      // Omitiendo filtro de fecha si la estructura difiere para no romper
    if (e2) throw e2;
    return d2.reduce((total, pedido) => total + Number(pedido.total_amount || 0), 0);
  }

  return data.reduce((total, pedido) => total + Number(pedido.total_amount), 0);
};

export const verificarActivacionHappyHourService = async () => {
  const config = await getConfiguracionHappyHourService();
  
  if (config.is_active) {
    return { activated: true, message: "Happy Hour ya estaba activo" };
  }

  const ventas = await calcularVentasSemanalesService();
  const meta = Number(config.weekly_sales_trigger);
  
  const diasIngles = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const hoyStr = diasIngles[new Date().getDay()];

  if (ventas >= meta && hoyStr === config.activation_day && !config.is_active) {
    await actualizarConfiguracionHappyHourService(config.id_happy_hour, { is_active: true });
    return { activated: true, message: "Happy Hour activado automáticamente (Modo Neón ON)" };
  }

  return { activated: false, message: `No requiere activación (Ventas: $${ventas} / Meta: $${meta} | Hoy: ${hoyStr} / Req: ${config.activation_day})` };
};
