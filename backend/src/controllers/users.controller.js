// Importación del cliente administrativo de Supabase.
// Es mandatorio usar la versión "admin" (Service Role Key) porque las operaciones de creación,
// desactivación y eliminación forzada de usuarios de Auth requieren privilegios de superusuario.
import supabaseAdmin from "../services/supabaseAdmin.js";

/**
 * Controlador para dar de alta a un nuevo empleado/usuario en el sistema.
 * Aplica un patrón de doble registro: primero en el módulo de autenticación y luego en la base de datos relacional.
 */
export const crearUsuario =
async (req, res) => {

  try {
    // Extracción de los parámetros necesarios enviados desde el formulario del frontend
    const {
      email,
      password,
      first_name,
      last_name,
      base_salary,
      id_role
    } = req.body;

    // =========================================================================
    // 1. AUTH (MÓDULO DE AUTENTICACIÓN CENTRALIZADO)
    // =========================================================================
    // Registra al usuario en el sistema seguro de Supabase Auth usando la API de administración.
    // Esto evita que el usuario tenga que confirmar su correo manualmente por email si no lo deseamos.
    const {
      data: authData,
      error: authError
    } =
      await supabaseAdmin
        .auth.admin.createUser({
          email,
          password,
          email_confirm: true // Auto-confirma el correo para que pueda iniciar sesión de inmediato
        });

    // Si las credenciales fallan (ej. contraseña muy corta o correo ya registrado en Auth),
    // detiene el proceso y retorna un error HTTP 400.
    if (authError) {

      return res.status(400)
        .json(authError);

    }

    // =========================================================================
    // 2. TABLA USERS (PERFIL COMERCIAL EN BASE DE DATOS)
    // =========================================================================
    // Una vez creado el usuario en Auth, procedemos a insertar su perfil en nuestra tabla pública 'users'.
    // Vinculamos de forma relacional ambos mundos usando el UUID generado por Auth ('authData.user.id').
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
            active: true, // El usuario se crea habilitado por defecto
            
            // Buena práctica de seguridad: No guardamos la contraseña real en nuestra tabla abierta.
            // Colocamos un marcador de posición ya que Supabase Auth se encarga de la encriptación real.
            password:
              "managed_by_supabase",

            // CLAVE FORÁNEA CLAVE: Conexión directa con el registro del módulo de autenticación
            id_auth_user:
              authData.user.id
          }
        ])
        .select() // Solicita que la base de datos devuelva la fila recién insertada
        .single(); // Transforma el arreglo de respuesta en un único objeto directo

    // Si hay un error de base de datos (ej. violación de llave foránea o tipos de datos erróneos),
    // se maneja el error devolviendo HTTP 400.
    if (error) {

      return res.status(400)
        .json(error);

    }

    // Respuesta exitosa HTTP 201 (Created) enviando el objeto de perfil recién creado al frontend
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

/**
 * Controlador para actualizar los datos administrativos de un usuario existente.
 * Modifica exclusivamente la tabla relacional de la base de datos (nombres, salarios, roles).
 */
export const actualizarUsuario =
async (req, res) => {

  try {
    // Se captura el ID del usuario desde los parámetros de la URL de la petición
    const { id } = req.params;

    // Se desestructuran las variables permitidas para modificación manual desde el panel
    const {
      first_name,
      last_name,
      base_salary,
      id_role
    } = req.body;

    // Ejecuta la actualización física en la tabla 'users'
    const { data, error } =
      await supabaseAdmin
        .from("users")
        .update({
          first_name,
          last_name,
          base_salary,
          id_role
        })
        .eq("id_user", id) // Condición de filtrado WHERE id_user = id
        .select()
        .single();

    // Captura fallas en la base de datos durante la actualización
    if (error) {

      return res
        .status(400)
        .json(error);

    }

    // Retorna el perfil del usuario con sus modificaciones consolidadas
    res.json(data);

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error interno"
    });

  }

};

/**
 * Controlador de borrado absoluto. Elimina al usuario tanto del catálogo
 * comercial como del core de autenticación de Supabase de manera permanente.
 */
export const eliminarUsuario =
async (req, res) => {

  try {
    const { id } = req.params;

    // =========================================================================
    // 1. BUSCAR USUARIO (VERIFICACIÓN PREVIA)
    // =========================================================================
    // Buscamos los datos completos del usuario en la base de datos antes de proceder con el borrado,
    // ya que requerimos imperativamente su identificador de autenticación ('id_auth_user') y su rol.
    const {
      data: usuario,
      error: buscarError
    } =
      await supabaseAdmin
        .from("users")
        .select("*")
        .eq("id_user", id)
        .single();

    // Si el usuario no existe en los registros, se interrumpe y se envía un error HTTP 404
    if (buscarError || !usuario) {

      return res.status(404)
        .json({
          error:
            "Usuario no encontrado"
        });

    }

    // =========================================================================
    // 2. PROTEGER ADMIN (REGLA CRÍTICA DE SEGURIDAD)
    // =========================================================================
    // Bloqueo duro a nivel de backend: Si detecta que el usuario a eliminar posee el ID de rol '1'
    // (correspondiente al Administrador Maestro), el sistema niega la petición para prevenir un bloqueo accidental del sistema.
    if (
      usuario.id_role === 1
    ) {

      return res.status(400)
        .json({
          error:
            "No se puede eliminar un administrador"
        });

    }

    // =========================================================================
    // 3. ELIMINAR ENTIDAD AUTH
    // =========================================================================
    // Mandamos la orden al servicio de autenticación de Supabase para borrar permanentemente la cuenta
    // usando su UUID único. Una vez hecho esto, el usuario ya no podrá loguearse bajo ninguna circunstancia.
    await supabaseAdmin
      .auth.admin.deleteUser(
        usuario.id_auth_user
      );

    // =========================================================================
    // 4. ELIMINAR FILA DE BASE DE DATOS
    // =========================================================================
    // Remueve la fila correspondiente de la tabla de perfiles 'users' de forma limpia.
    const { error } =
      await supabaseAdmin
        .from("users")
        .delete()
        .eq("id_user", id);

    // Manejo de errores en la eliminación física de la tabla relacional
    if (error) {

      return res.status(400)
        .json(error);

    }

    // Notificación de éxito absoluto
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

/**
 * Controlador para leer y listar a todo el personal registrado en la base de datos.
 * Utiliza sintaxis relacional avanzada para traer información detallada del rol.
 */
export const obtenerUsuarios =
async (req, res) => {

  try {
    // Consulta masiva a la tabla de usuarios.
    // Usando la sintaxis `*, roles (...)`, PostgREST (el motor detrás de Supabase) entiende
    // automáticamente la relación de llave foránea existente y realiza un JOIN implícito con la tabla 'roles'.
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
        .order("id_user"); // Ordena secuencialmente el listado por el ID autoincremental de menor a mayor

    if (error) {

      return res
        .status(400)
        .json(error);

    }

    // Retorna la matriz/arreglo completo de usuarios con sus respectivos sub-objetos de roles anidados
    res.json(data);

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error:
        "Error interno"
    });

  }

};

/**
 * Controlador de conmutación de estado (Habilitar / Deshabilitar).
 * Permite congelar cuentas de usuarios o reincorporarlos sin necesidad de borrar sus datos del historial del negocio.
 */
export const toggleUsuario =
async (req, res) => {

  try {
    // Captura parámetros: El id del afectado viene de la URL y el nuevo estado booleano (true/false) viene del body
    const { id } = req.params;
    const { active } = req.body;

    // 1. Consulta previa para conocer la jerarquía del usuario que se pretende alterar
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

    // 2. Control de seguridad recurrente: Evita que el administrador maestro sea desactivado accidentalmente,
    // lo cual dejaría al sistema desamparado y sin posibilidad de gestión de personal.
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

    // 3. Si la regla pasa, se procede a inyectar el nuevo estado binario en la columna 'active'
    const {
      data,
      error
    } =
      await supabaseAdmin
        .from("users")
        .update({
          active // Se asigna el valor booleano entrante (true o false)
        })
        .eq("id_user", id)
        .select()
        .single();

    if (error) {

      return res
        .status(400)
        .json(error);

    }

    // Devuelve el objeto modificado confirmando el cambio de estado operacional
    res.json(data);

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error:
        "Error interno"
    });

  }

};