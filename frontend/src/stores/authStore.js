import { defineStore } from "pinia";
import { ref } from "vue";
import { supabase } from "../services/supabase"; // Importamos el cliente de Supabase para habilitar Realtime

// 'auth' es el identificador único que Pinia utiliza para registrar este Store en la infraestructura global.
export const useAuthStore = defineStore("auth", () => {
  
  // ==========================================
  // ESTADO REACTIVO (STATE)
  // ==========================================
  // ref(null) / ref(false) aseguran que cualquier cambio en estas variables
  // redibuje automáticamente las pantallas del frontend que dependan de ellas.
  
  const user = ref(null);             // Almacena el objeto con los datos del usuario (id, nombre, correo, etc.)
  const role = ref(null);             // Almacena el rol actual del usuario en formato de texto (ej. "admin", "mesero")
  const isAuthenticated = ref(false); // Bandera booleana rápida para saber si el usuario pasó por el Login de forma exitosa

  // ==========================================
  // ACCIÓN: CONFIGURAR USUARIO (SET USER)
  // ==========================================
  /**
   * Guarda los datos de autenticación en la memoria reactiva de la app
   * y los escribe de forma persistente en el navegador.
   * * @param {Object} userData - Datos del usuario provenientes de la base de datos.
   * @param {string} userRole - Rol asignado y validado.
   */
  const setUser = (userData, userRole) => {
    user.value = userData;
    role.value = userRole;
    isAuthenticated.value = true;

    // Serializamos el objeto a texto JSON para guardarlo en el almacenamiento del navegador.
    // Esto sobrevive a los cierres de pestañas o recargas de página (F5).
    localStorage.setItem(
      "auth",
      JSON.stringify({
        user: userData,
        role: userRole,
      })
    );
  };

  // ==========================================
  // ACCIÓN: CÓMPUTO DE CARGA (LOAD SESSION)
  // ==========================================
  /**
   * Se ejecuta al arrancar la app (desde main.js). Recupera la cadena JSON 
   * de localStorage, la deserializa y reconstruye el estado del usuario.
   */
  const loadSession = () => {
    const savedAuth = localStorage.getItem("auth");

    if (savedAuth) {
      const parsedAuth = JSON.parse(savedAuth);
      user.value = parsedAuth.user;
      role.value = parsedAuth.role;
      isAuthenticated.value = true;
    }
  };

  // ==========================================
  // ACCIÓN: CIERRE DE SESIÓN (LOGOUT)
  // ==========================================
  /**
   * Limpia por completo tanto las variables reactivas de memoria (Pinia)
   * como el disco local del navegador (localStorage).
   */
  const logout = () => {
    user.value = null;
    role.value = null;
    isAuthenticated.value = false;

    localStorage.removeItem("auth"); // Elimina la llave para que en la próxima recarga el usuario deba loguearse.
    supabase.auth.signOut(); // Limpia la sesión de JWT local
  };

  // ==========================================
  // ACCIÓN SEGURIDAD CRÍTICA: REALTIME USER MONITOR
  // ==========================================
  /**
   * Abre un canal WebSocket bidireccional permanente con Supabase.
   * Monitorea específicamente la fila del usuario logueado en la tabla 'users'.
   */
  const iniciarRealtimeUsuario = () => {
    // Salvaguarda: Si por alguna razón la función se ejecuta sin un usuario en memoria, se aborta silenciosamente.
    if (!user.value) return;

    const channelName = `user-${user.value.id_user}`;

    // Evitar suscribirse doblemente al mismo canal y causar el error "cannot add postgres_changes"
    const existingChannel = supabase.getChannels().find(c => c.topic === `realtime:${channelName}`);
    if (existingChannel) return existingChannel;

    // Creamos y retornamos la suscripción al canal de Supabase.
    return supabase
      // Definimos un nombre único para el canal WebSockets usando el ID del usuario (ej. "user-14")
      .channel(channelName)
      
      // Configuramos el listener para capturar los cambios en la base de datos (PostgreSQL)
      .on(
        "postgres_changes",
        {
          event: "UPDATE", // ESCUCHA ÚNICAMENTE: Modificaciones de datos (Ignora inserciones y eliminaciones)
          schema: "public", // El esquema por defecto de la base de datos relacional
          table: "users",   // La tabla física donde se alojan los empleados del restaurante
          // FILTRO DE SEGURIDAD EXTREMA: Evita sobrecargar la app.
          // Solo nos enviará información si la fila modificada coincide exactamente con el ID del usuario actual.
          filter: `id_user=eq.${user.value.id_user}`
        },
        
        // FUNCIÓN CALLBACK (PAYLOAD): Se dispara el milisegundo exacto en que la base de datos procesa el UPDATE
        (payload) => {
          // payload.new contiene la fila de la base de datos con los nuevos valores ya modificados
          const nuevoUsuario = payload.new;

          console.log("CAMBIO DETECTADO EN TIEMPO REAL PARA EL USUARIO ACTIVO");
          console.log(nuevoUsuario);

          // ESCENARIO A: El administrador cambió el campo 'active' a 'false' (Desactivación)
          if (!nuevoUsuario.active) {
            // Se le notifica de inmediato al empleado mediante una alerta visual en pantalla
            alert("Tu cuenta ha sido desactivada por un administrador.");

            // Se ejecutan los protocolos de limpieza de variables y almacenamiento local
            logout();

            // Forzamos el redireccionamiento al Home de manera física (reseteando el estado del navegador por completo)
            window.location.href = "/";
            return;
          }

          // ESCENARIO B: El usuario sigue activo, pero sufrió otra modificación (ej. cambio de Rol, Cambio de Contraseña, Cambio de Nombre)
          // Lógica de blindaje: Si el administrador cambió su rol (ej: de mesero a supervisor) o alteró sus datos,
          // lo expulsamos momentáneamente de la sesión para obligarlo a re-autenticarse.
          // Esto garantiza que el usuario adquiera sus nuevos permisos de manera limpia y segura sin corromper el flujo.
          logout();
          window.location.href = "/";
        }
      )
      // Activa finalmente la conexión del socket hacia el servidor en la nube de Supabase
      .subscribe();
  };

  // Exportamos los estados y las acciones para que puedan ser leídos/ejecutados desde cualquier componente Vue
  return {
    user,
    role,
    isAuthenticated,
    setUser,
    loadSession,
    logout,
    iniciarRealtimeUsuario
  };
});