import { supabase } from "./supabase";

// =========================
// OBTENER MESAS
// =========================

export const getMesas = async () => {

  const { data, error } =
    await supabase
      .from("mesas")
      .select("*")
      .order("id_mesa");

  if (error) {
    throw error;
  }

  return data;

};

// =========================
// ACTUALIZAR STATUS
// =========================

export const updateMesaStatus = async (
  idMesa,
  status
) => {

  const { error } =
    await supabase
      .from("mesas")
      .update({
        status,
      })
      .eq("id_mesa", idMesa);

  if (error) {
    throw error;
  }

};