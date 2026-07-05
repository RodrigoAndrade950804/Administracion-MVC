import supabaseAdmin from "./supabaseAdmin.js";

export const getMesasService = async () => {
  const { data, error } = await supabaseAdmin
    .from("mesas")
    .select("*")
    .order("id_mesa");

  if (error) throw error;
  return data;
};

export const updateMesaStatusService = async (idMesa, status) => {
  const { error } = await supabaseAdmin
    .from("mesas")
    .update({ status })
    .eq("id_mesa", idMesa);

  if (error) throw error;
  return true;
};
