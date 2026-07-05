import supabaseAdmin from "./supabaseAdmin.js";

// =========================
// CONFIGURACION MADI
// =========================

export const getConfiguracionMadiService = async () => {
  const { data, error } = await supabaseAdmin
    .from("configuracion_madi")
    .select("*")
    .single();

  if (error) throw error;
  return data;
};

export const actualizarConfiguracionMadiService = async (id, configuracion) => {
  const { error } = await supabaseAdmin
    .from("configuracion_madi")
    .update(configuracion)
    .eq("id_madi", id);

  if (error) throw error;
  return true;
};

// =========================
// REGLAS BONOS (CRUD)
// =========================

export const getReglasBonosService = async () => {
  const { data, error } = await supabaseAdmin
    .from("reglas_bonos")
    .select("*")
    .order("id_reglas");

  if (error) throw error;
  return data;
};

export const crearReglaBonoService = async (regla) => {
  const { data, error } = await supabaseAdmin
    .from("reglas_bonos")
    .insert([regla])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const actualizarReglaBonoService = async (id, regla) => {
  const { error } = await supabaseAdmin
    .from("reglas_bonos")
    .update(regla)
    .eq("id_reglas", id);

  if (error) throw error;
  return true;
};

export const eliminarReglaBonoService = async (id) => {
  const { error } = await supabaseAdmin
    .from("reglas_bonos")
    .delete()
    .eq("id_reglas", id);

  if (error) throw error;
  return true;
};

// =========================
// LÓGICA DE NEGOCIO AUTOMATIZADA
// =========================

export const calcularVentasPersonalesService = async (idUser) => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const { data, error } = await supabaseAdmin
    .from("pedidos")
    .select("total_amount")
    .eq("id_user", idUser)
    .eq("status", "cerrado")
    .gte("pedido_date", hoy.toISOString());

  if (error) {
    // Fallback if pedido_date is not present (legacy schema)
    const { data: d2, error: e2 } = await supabaseAdmin
      .from("pedidos")
      .select("total_amount")
      .eq("id_user", idUser)
      .eq("status", "cerrado");
    if (e2) throw e2;
    return d2.reduce((total, pedido) => total + Number(pedido.total_amount || 0), 0);
  }

  return data.reduce((total, pedido) => total + Number(pedido.total_amount), 0);
};

export const verificarProgresoPersonalService = async (idUser) => {
  const config = await getConfiguracionMadiService();
  const ventasPersonales = await calcularVentasPersonalesService(idUser);
  const meta = Number(config.personal_daily_goal);
  
  const porcentaje = meta > 0 ? (ventasPersonales / meta) * 100 : 0;
  
  // Buscar la categoría correspondiente
  const reglas = await getReglasBonosService();
  let categoria = "Sin Bono";
  let factor_bono = 0;
  
  for (const regla of reglas) {
    if (porcentaje >= regla.min_percentage) {
      categoria = regla.level_name;
      factor_bono = Number(regla.bonus_factor);
    }
  }

  let bonoExtra = 0;
  if (ventasPersonales > meta && factor_bono > 0) {
    const excedente = ventasPersonales - meta;
    bonoExtra = excedente * (factor_bono / 100);
  }

  return {
    ventas: ventasPersonales,
    meta: meta,
    porcentaje: Math.min(100, porcentaje),
    categoria,
    bonoExtra
  };
};
