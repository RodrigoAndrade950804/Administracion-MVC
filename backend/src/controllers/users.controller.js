import supabaseAdmin from "../services/supabaseAdmin.js";

export const crearUsuario =
async (req, res) => {

  try {

    const {
      email,
      password,
      first_name,
      last_name,
      base_salary,
      id_role
    } = req.body;

    // =====================
    // AUTH
    // =====================

    const {
      data: authData,
      error: authError
    } =
      await supabaseAdmin
        .auth.admin.createUser({

          email,

          password,

          email_confirm: true

        });

    if (authError) {

      return res.status(400)
        .json(authError);

    }

    // =====================
    // TABLA USERS
    // =====================

    const {
      data,
      error
    } =
      await supabaseAdmin
        .from("users")
        .insert([
          {
            email,
            first_name,
            last_name,
            base_salary,
            id_role,
            active: true,
            password:
              "managed_by_supabase",

            id_auth_user:
              authData.user.id
          }
        ])
        .select()
        .single();

    if (error) {

      return res.status(400)
        .json(error);

    }

    res.status(201)
      .json(data);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error:
        "Error interno"
    });

  }

};

export const actualizarUsuario =
async (req, res) => {

  try {

    const { id } = req.params;

    const {
      first_name,
      last_name,
      base_salary,
      id_role
    } = req.body;

    const { data, error } =
      await supabaseAdmin
        .from("users")
        .update({
          first_name,
          last_name,
          base_salary,
          id_role
        })
        .eq("id_user", id)
        .select()
        .single();

    if (error) {

      return res
        .status(400)
        .json(error);

    }

    res.json(data);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Error interno"
    });

  }

};

export const eliminarUsuario =
async (req, res) => {

  try {

    const { id } = req.params;

    // =====================
    // BUSCAR USUARIO
    // =====================

    const {
      data: usuario,
      error: buscarError
    } =
      await supabaseAdmin
        .from("users")
        .select("*")
        .eq("id_user", id)
        .single();

    if (
      buscarError ||
      !usuario
    ) {

      return res.status(404)
        .json({
          error:
            "Usuario no encontrado"
        });

    }

    // =====================
    // PROTEGER ADMIN
    // =====================

    if (
      usuario.id_role === 1
    ) {

      return res.status(400)
        .json({
          error:
            "No se puede eliminar un administrador"
        });

    }

    // =====================
    // ELIMINAR AUTH
    // =====================

    await supabaseAdmin
      .auth.admin.deleteUser(
        usuario.id_auth_user
      );

    // =====================
    // ELIMINAR USERS
    // =====================

    const { error } =
      await supabaseAdmin
        .from("users")
        .delete()
        .eq("id_user", id);

    if (error) {

      return res.status(400)
        .json(error);

    }

    res.json({
      message:
        "Usuario eliminado"
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error:
        "Error interno"
    });

  }

};

export const obtenerUsuarios =
async (req, res) => {

  try {

    const {
      data,
      error
    } =
      await supabaseAdmin
        .from("users")
        .select(`
          *,
          roles (
            role_name
          )
        `)
        .order("id_user");

    if (error) {

      return res
        .status(400)
        .json(error);

    }

    res.json(data);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error:
        "Error interno"
    });

  }

};

export const toggleUsuario =
async (req, res) => {

  try {

    const { id } =
      req.params;

    const { active } =
      req.body;

    const {
      data: usuario
    } =
      await supabaseAdmin
        .from("users")
        .select(`
          id_user,
          id_role
        `)
        .eq("id_user", id)
        .single();

    if (
      usuario?.id_role === 1 &&
      active === false
    ) {

      return res.status(400)
        .json({
          error:
            "No se puede desactivar un administrador"
        });

    }

    const {
      data,
      error
    } =
      await supabaseAdmin
        .from("users")
        .update({
          active
        })
        .eq("id_user", id)
        .select()
        .single();

    if (error) {

      return res
        .status(400)
        .json(error);

    }

    res.json(data);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error:
        "Error interno"
    });

  }

};