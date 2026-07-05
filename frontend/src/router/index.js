import { createRouter, createWebHistory } from "vue-router";

import LoginView from "../pages/LoginView.vue";
import AdminDashboard from "../pages/AdminDashboard.vue";
import SupervisorDashboard from "../pages/SupervisorDashboard.vue";
import MeseroPOS from "../pages/MeseroPOS.vue";

import { useAuthStore } from "../stores/authStore";

// Definición de rutas con metadatos (meta) para control de acceso.
const routes = [
  {
    path: "/",
    component: LoginView,
  },
  {
    path: "/admin",
    component: AdminDashboard,
    meta: { requiresAuth: true, role: "admin" },
  },
  {
    path: "/supervisor",
    component: SupervisorDashboard,
    meta: { requiresAuth: true, role: "supervisor" },
  },
  {
    path: "/mesero",
    component: MeseroPOS,
    meta: { requiresAuth: true, role: "mesero" },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// =========================
// ROUTE GUARD (Middleware de seguridad)
// =========================
router.beforeEach((to, from) => {
  const authStore = useAuthStore();

  // 1. Verificación de Autenticación:
  // Si la ruta requiere sesión y el usuario no está logueado, redirige al login.
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return "/";
  }

  // 2. Verificación de Usuario Activo:
  // Si el usuario en el store está marcado como inactivo, forzamos cierre de sesión.
  if (authStore.user?.active === false) {
    authStore.logout();
    return "/";
  }

  // 3. Verificación de Rol:
  // Compara el rol necesario en 'meta' con el rol guardado en el store.
  // Si no coinciden, bloquea el acceso redirigiendo al home.
  if (to.meta.role && authStore.role !== to.meta.role) {
    return "/";
  }

  // Si pasa todas las validaciones, permite el acceso devolviendo undefined implícitamente
  return true;
});

export default router;