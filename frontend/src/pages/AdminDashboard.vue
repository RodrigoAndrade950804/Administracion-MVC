<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/authStore";

import { supabase } from "../services/supabase";

import ProductosManager from "../components/admin/ProductosManager.vue";
import UsuariosManager from "../components/admin/UsuariosManager.vue";
import MadiManager from "../components/admin/MadiManager.vue";

const router = useRouter();
const authStore = useAuthStore();

// 🔑 clave reactiva para forzar refresh
const productosKey = ref(0);

let canalProductos = null;

// =========================
// LOGOUT
// =========================

const logout = () => {
  authStore.logout();
  router.push("/");
};

// =========================
// REALTIME PRODUCTOS
// =========================

const iniciarRealtimeProductos = () => {
  canalProductos = supabase
    .channel("admin-productos-realtime")
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "productos",
      },
      (payload) => {
        console.log("Admin realtime productos:", payload);

        // 🔄 fuerza recarga de ProductosManager
        productosKey.value++;
      }
    )
    .subscribe();
};

onMounted(() => {
  iniciarRealtimeProductos();
});

onUnmounted(() => {
  if (canalProductos) {
    supabase.removeChannel(canalProductos);
  }
});
</script>

<template>
  <div class="min-h-screen bg-[#111111] text-white p-8">

    <!-- HEADER -->
    <div class="flex justify-between items-center mb-8">
      <h1 class="text-4xl font-bold">
        Dashboard Admin
      </h1>

      <button
        @click="logout"
        class="bg-red-600 hover:bg-red-500 px-5 py-3 rounded-2xl font-bold"
      >
        Cerrar Sesión
      </button>
    </div>

    <!-- USUARIOS -->
    <div class="mt-8">
      <UsuariosManager />
    </div>

    <!-- PRODUCTOS -->
    <!-- 🔑 key reactivo para refrescar stock -->
    <ProductosManager :key="productosKey" />

    <!-- MADI -->
    <div class="mt-8">
      <MadiManager />
    </div>

  </div>
</template>