<script setup>
import { ref } from "vue";
import { supabase } from "../services/supabase";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/authStore";

// Instanciamos las herramientas globales
const router = useRouter();       // Para navegar programáticamente entre pantallas
const authStore = useAuthStore(); // Para acceder y modificar el estado global del usuario

// ==========================================
// ESTADOS REACTIVOS (Variables de la interfaz)
// ==========================================
// Utilizamos 'ref' para que cualquier cambio en estas variables se refleje
// inmediatamente en el HTML (por ejemplo, mostrando el loader o un texto de error).
const email = ref("");
const password = ref("");
const loading = ref(false);       // Controla el estado del botón (cargando...)
const errorMessage = ref("");     // Almacena y muestra errores visuales al usuario

// ==========================================
// FLUJO PRINCIPAL DE AUTENTICACIÓN
// ==========================================
const login = async () => {
  try {
    // 0. Preparación: Bloqueamos el botón y limpiamos errores previos
    loading.value = true;
    errorMessage.value = "";

    // =========================
    // 1. LOGIN SUPABASE (Auth)
    // =========================
    // Delegamos la validación del email y la contraseña al microservicio de
    // autenticación nativo de Supabase. Esto es súper seguro porque nunca
    // manejamos ni comparamos contraseñas manualmente.
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value
    });

    // Si las credenciales son incorrectas, detenemos la ejecución y mostramos el error.
    if (error) {
      errorMessage.value = error.message;
      return;
    }

    // Extraemos el Identificador Único Universal (UUID) que Supabase Auth le asignó.
    const userId = data.user.id;

    // =========================
    // 2. OBTENER PERFIL Y ROL (Base de Datos)
    // =========================
    // Supabase Auth solo maneja el "acceso". Ahora cruzamos ese UUID con nuestra
    // tabla pública 'users' para obtener los datos de negocio (nombre, estado, rol).
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select(`
        *,
        roles (
          role_name
        )
      `)
      .eq("id_auth_user", userId) // Buscamos al usuario que coincida con el UUID de Auth
      .single();                  // Garantizamos que solo nos devuelva un único objeto

    // Si hubo un error leyendo la base de datos (ej. usuario borrado), lo mostramos.
    if (userError) {
      errorMessage.value = userError.message;
      return;
    }

    // =========================
    // 3. VALIDAR ESTADO (Seguridad)
    // =========================
    // Control interno de RRHH: Si el administrador marcó a este usuario como inactivo,
    // destruimos inmediatamente la sesión que Supabase Auth acaba de crear y lo bloqueamos.
    if (!userData.active) {
      await supabase.auth.signOut();
      errorMessage.value = "Usuario inactivo. Contacte al administrador.";
      return;
    }

    // =========================
    // 4. GUARDAR EN STORE Y ACTIVAR SEGURIDAD
    // =========================
    // El usuario es válido y está activo. Guardamos su perfil y su nombre de rol
    // (ej. "admin") en Pinia para que toda la aplicación sepa quién está navegando.
    authStore.setUser(
      userData,
      userData.roles.role_name
    );

    // Activamos la escucha en tiempo real. A partir de este momento, si un admin
    // lo desactiva en la base de datos, el sistema lo expulsará automáticamente.
    authStore.iniciarRealtimeUsuario();

    // =========================
    // 5. REDIRECCIÓN SEGÚN ROL (RBAC)
    // =========================
    // Actuamos como un "semáforo", enviando a cada empleado a su área de trabajo
    // correspondiente según el rol extraído de la base de datos.
    switch (userData.roles.role_name) {
      case "admin":
        router.push("/admin");
        break;
      case "supervisor":
        router.push("/supervisor");
        break;
      case "mesero":
        router.push("/mesero");
        break;
      default:
        // Si por error de DB el rol es desconocido, lo devolvemos al inicio
        router.push("/");
    }
  } catch (error) {
    // Captura errores catastróficos (ej. caída de internet a mitad del proceso)
    console.error(error);
    errorMessage.value = "Error inesperado";
  } finally {
    // Independientemente del resultado (éxito o fallo), desbloqueamos el botón de login
    loading.value = false;
  }
};
</script>

<template>
  <div
    class="min-h-screen bg-cover bg-center flex items-center justify-center"
    style="
      background-image:
      linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)),
      url('https://images.unsplash.com/photo-1495474472287-4d71bcdd2085');
    "
  >
    <div
      class="w-[400px] backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-10 shadow-2xl"
    >
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold text-white mb-2">
          Aroma & Grano
        </h1>

        <p class="text-gray-300 text-sm">
          Plataforma Operativa & BI
        </p>
      </div>

      <div class="space-y-5">

        <input
          v-model="email"
          type="email"
          placeholder="Correo electrónico"
          class="w-full p-4 rounded-xl bg-white/10 border border-white/20 text-white outline-none"
        />

        <input
          v-model="password"
          type="password"
          placeholder="Contraseña"
          class="w-full p-4 rounded-xl bg-white/10 border border-white/20 text-white outline-none"
        />

        <button
          @click="login"
          class="w-full p-4 rounded-xl bg-amber-700 hover:bg-amber-600 transition text-white font-bold"
        >
          Iniciar Sesión
        </button>

        <p v-if="errorMessage" class="text-red-400 text-sm text-center">
          {{ errorMessage }}
        </p>

      </div>

      <div class="mt-6 text-center text-sm text-green-400">
        🔒 Conexión Segura SSL
      </div>
    </div>
  </div>
</template>