import supabaseAdmin from "./supabaseAdmin.js";

/**
 * Servicio para gestionar la lógica de negocio de los usuarios.
 */
export const crearUsuarioService = async (userData) => {
  const { email, password, first_name, last_name, base_salary, id_role } = userData;

  // 1. Auth centralizado
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) throw authError;

  // 2. Tabla users relacional
  const { data, error } = await supabaseAdmin
    .from("users")
    .insert([
      {
        email,
        first_name,
        last_name,
        base_salary,
        id_role,
        active: true,
        password: "managed_by_supabase",
        id_auth_user: authData.user.id,
      },
    ])
    .select()
    .single();

  if (error) {
    // Intentar rollback en Auth si falla en la DB pública
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    throw error;
  }

  return data;
};

export const actualizarUsuarioService = async (id, updateData) => {
  const { data, error } = await supabaseAdmin
    .from("users")
    .update(updateData)
    .eq("id_user", id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const eliminarUsuarioService = async (id) => {
  const { data: usuario, error: buscarError } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id_user", id)
    .single();

  if (buscarError || !usuario) throw new Error("Usuario no encontrado");
  if (usuario.id_role === 1) throw new Error("No se puede eliminar un administrador");

  // Eliminar en auth
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(usuario.id_auth_user);
  if (authError) throw authError;

  // Eliminar en DB relacional
  const { error } = await supabaseAdmin.from("users").delete().eq("id_user", id);
  if (error) throw error;

  return true;
};

export const obtenerUsuariosService = async () => {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select(`
      *,
      roles (
        role_name
      )
    `)
    .order("id_user");

  if (error) throw error;
  return data;
};

export const obtenerPerfilPorAuthIdService = async (authId) => {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select(`
      *,
      roles (
        role_name
      )
    `)
    .eq("id_auth_user", authId)
    .single();

  if (error) throw error;
  return data;
};

export const toggleUsuarioService = async (id, active) => {
  const { data: usuario } = await supabaseAdmin
    .from("users")
    .select("id_user, id_role")
    .eq("id_user", id)
    .single();

  if (usuario?.id_role === 1 && active === false) {
    throw new Error("No se puede desactivar un administrador");
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .update({ active })
    .eq("id_user", id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getMeserosConVentasService = async () => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data, error } = await supabaseAdmin
    .from("users")
    .select(`
      *,
      roles(*),
      pedidos(
        total_amount,
        pedido_date
      )
    `)
    .eq("id_role", 3); // 3 = mesero

  if (error) throw error;
  
  // Filtramos para asegurar que el Ranking del Supervisor solo tome en cuenta las ventas de HOY
  const dataFiltrada = data.map(user => {
    if (user.pedidos && Array.isArray(user.pedidos)) {
      user.pedidos = user.pedidos.filter(pedido => {
        const pDate = new Date(pedido.pedido_date);
        return pDate >= startOfDay;
      });
    } else {
      user.pedidos = [];
    }
    return user;
  });

  return dataFiltrada;
};
