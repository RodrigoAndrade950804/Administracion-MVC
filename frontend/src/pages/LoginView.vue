<script setup>
import { ref } from "vue";
import { supabase } from "../services/supabase";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/authStore";

const router = useRouter();
const authStore = useAuthStore();

const email = ref("");
const password = ref("");
const loading = ref(false);
const errorMessage = ref("");

const login = async () => {

  try {

    loading.value = true;

    errorMessage.value = "";

    // =========================
    // LOGIN SUPABASE
    // =========================

    const { data, error } =
      await supabase.auth.signInWithPassword({

        email: email.value,

        password: password.value

      });

    if (error) {

      errorMessage.value =
        error.message;

      return;

    }

    // =========================
    // OBTENER UUID AUTH
    // =========================

    const userId =
      data.user.id;

    // =========================
    // USER + ROLE
    // =========================

    const {
      data: userData,
      error: userError
    } =
      await supabase
        .from("users")
        .select(`
          *,
          roles (
            role_name
          )
        `)
        .eq(
          "id_auth_user",
          userId
        )
        .single();

    if (userError) {

      errorMessage.value =
        userError.message;

      return;

    }

    // =========================
    // VALIDAR ACTIVO
    // =========================

    if (!userData.active) {

      await supabase
        .auth
        .signOut();

      errorMessage.value =
        "Usuario inactivo. Contacte al administrador.";

      return;

    }

    // =========================
    // STORE
    // =========================

    authStore.setUser(

      userData,

      userData.roles.role_name

    );

    // =========================
    // REDIRECT
    // =========================

    switch (
      userData.roles.role_name
    ) {

      case "admin":

        router.push(
          "/admin"
        );

        break;

      case "supervisor":

        router.push(
          "/supervisor"
        );

        break;

      case "mesero":

        router.push(
          "/mesero"
        );

        break;

      default:

        router.push("/");

    }

  } catch (error) {

    console.error(error);

    errorMessage.value =
      "Error inesperado";

  } finally {

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