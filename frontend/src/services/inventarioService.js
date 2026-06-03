export const registrarEntradaStock = async (
  id_producto,
  cantidad,
  id_user
) => {

  const response =
    await fetch(
      "http://localhost:3000/api/inventario/entrada",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          id_producto,
          cantidad,
          id_user
        })
      }
    );

  return await response.json();
};