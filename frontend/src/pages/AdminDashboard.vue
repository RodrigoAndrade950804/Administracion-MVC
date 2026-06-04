<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/authStore";

// Importación del cliente de Supabase para funcionalidades de tiempo real (Realtime).
import { supabase } from "../services/supabase";

// Importación de componentes hijos para la gestión administrativa.
import ProductosManager from "../components/admin/ProductosManager.vue";
import UsuariosManager from "../components/admin/UsuariosManager.vue";
import MadiManager from "../components/admin/MadiManager.vue";

const router = useRouter();
const authStore = useAuthStore();

// 🔑 'productosKey' actúa como un disparador reactivo: 
// Al incrementar este valor, Vue destruye y recrea el componente <ProductosManager>,
// forzando una recarga de los datos cuando hay cambios en la base de datos.
const productosKey = ref(0);

// Referencia al canal de suscripción de Supabase para limpieza posterior.
let canalProductos = null;

// =========================
// LOGOUT
// =========================

// Cierra la sesión del usuario en el store global y redirige al inicio.
const logout = () => {
  authStore.logout();
  router.push("/");
};

// =========================
// REALTIME PRODUCTOS
// =========================

// Configura un canal de escucha en la tabla 'productos' de Supabase.
const iniciarRealtimeProductos = () => {
  canalProductos = supabase
    .channel("admin-productos-realtime") // Nombre único para el canal.
    .on(
      "postgres_changes",
      {
        event: "UPDATE", // Escucha solo actualizaciones en la tabla.
        schema: "public",
        table: "productos",
      },
      (payload) => {
        console.log("Admin realtime productos:", payload);

        // 🔄 Incrementamos el contador para disparar el re-renderizado
        // del componente hijo <ProductosManager>.
        productosKey.value++;
      }
    )
    .subscribe(); // Inicia la escucha activa del canal.
};

// Ciclo de vida: Inicia la suscripción apenas el dashboard está montado.
onMounted(() => {
  iniciarRealtimeProductos();
});

// Ciclo de vida: Elimina el canal de suscripción al salir de la página
// para evitar fugas de memoria y tráfico innecesario (prevención de bugs).
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