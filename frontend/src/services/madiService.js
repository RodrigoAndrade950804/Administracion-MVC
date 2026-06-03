import { supabase } from "./supabase";

// =========================
// CONFIGURACION MADI
// =========================

export const getConfiguracionMadi =
async () => {

  const {
    data,
    error
  } =
    await supabase
      .from("configuracion_madi")
      .select("*")
      .single();

  if (error) throw error;

  return data;

};

export const suscribirConfiguracionMadi =
(callback) => {

  return supabase
    .channel(
      "madi-config-realtime"
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "configuracion_madi"
      },
      callback
    )
    .subscribe();

};

export const actualizarConfiguracionMadi =
async (
  id,
  configuracion
) => {

  const {
    error
  } =
    await supabase
      .from("configuracion_madi")
      .update(configuracion)
      .eq(
        "id_madi",
        id
      );

  if (error) throw error;

};

// =========================
// REGLAS BONOS
// =========================

export const getReglasBonos =
async () => {

  const {
    data,
    error
  } =
    await supabase
      .from("reglas_bonos")
      .select("*")
      .order("id_reglas");

  if (error) throw error;

  return data;

};

export const crearReglaBono =
async (regla) => {

  const {
    data,
    error
  } =
    await supabase
      .from("reglas_bonos")
      .insert([regla])
      .select()
      .single();

  if (error) throw error;

  return data;

};

export const actualizarReglaBono =
async (
  id,
  regla
) => {

  const {
    error
  } =
    await supabase
      .from("reglas_bonos")
      .update(regla)
      .eq(
        "id_reglas",
        id
      );

  if (error) throw error;

};

export const eliminarReglaBono =
async (id) => {

  const {
    error
  } =
    await supabase
      .from("reglas_bonos")
      .delete()
      .eq(
        "id_reglas",
        id
      );

  if (error) throw error;

};

export const calcularVentasTotales = async () => {

  const { data, error } =
    await supabase
      .from("pedidos")
      .select("total_amount")
      .eq("status", "cerrado"); //fecha_actual queda mejor para bi

  if (error) throw error;

  return data.reduce(
    (total, pedido) =>
      total +
      Number(
        pedido.total_amount
      ),
    0
  );

};

export const verificarActivacionMadi =
async () => {

  const config =
    await getConfiguracionMadi();

  const ventas =
    await calcularVentasTotales();

  const meta =
    Number(
      config.daily_sales_goal
    );

  console.log("VENTAS:", ventas);
  console.log("META:", meta);
  console.log("ACTIVO:", config.is_active);

  if (
    ventas >= meta &&
    !config.is_active
  ) {

    console.log(
      "ACTIVANDO MADI"
    );

    await actualizarConfiguracionMadi(
      config.id_madi,
      {
        is_active: true
      }
    );

  }

};