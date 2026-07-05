const API_URL = import.meta.env.VITE_API_URL + "/api/mesas";

export const getMesas = async () => {
  const response = await fetch(API_URL);
  if (!response.ok) throw new Error("Error obteniendo mesas");
  return await response.json();
};

export const updateMesaStatus = async (idMesa, status) => {
  const response = await fetch(`${API_URL}/${idMesa}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });
  if (!response.ok) throw new Error("Error actualizando mesa");
  return await response.json();
};