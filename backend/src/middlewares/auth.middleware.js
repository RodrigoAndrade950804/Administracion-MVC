import supabaseAdmin from "../services/supabaseAdmin.js";

/**
 * Middleware de seguridad para validar JSON Web Tokens (JWT).
 * 
 * Este middleware intercepta las peticiones entrantes, extrae el token
 * del encabezado 'Authorization' y le pide a Supabase que valide su firma matemática.
 * Si es válido, inyecta los datos del usuario en req.user para que los controladores
 * puedan saber exactamente quién hizo la solicitud.
 */
export const verifyToken = async (req, res, next) => {
  try {
    // 1. Extraer el encabezado de autorización
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No autorizado. Token no proporcionado o formato inválido." });
    }

    // 2. Extraer el token crudo
    const token = authHeader.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({ error: "No autorizado. Token vacío." });
    }

    // 3. Validar criptográficamente el token con Supabase Auth
    // Al usar getUser(), Supabase no solo decodifica el token, sino que valida
    // que la firma coincida con el secreto del proyecto (JWT Secret) y que no haya expirado.
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data.user) {
      console.error("JWT Error:", error?.message);
      return res.status(401).json({ error: "No autorizado. Token inválido o expirado." });
    }

    // 4. Adjuntar la identidad del usuario a la petición
    // Esto permite que los siguientes middlewares o controladores sepan quién es el usuario.
    req.user = data.user;

    // 5. Dejar pasar la petición al siguiente bloque
    next();
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    return res.status(500).json({ error: "Error interno verificando la sesión." });
  }
};
