import { createRouter, createWebHistory } from "vue-router";

import LoginView from "../pages/LoginView.vue";
import AdminDashboard from "../pages/AdminDashboard.vue";
import SupervisorDashboard from "../pages/SupervisorDashboard.vue";
import MeseroPOS from "../pages/MeseroPOS.vue";

import { useAuthStore } from "../stores/authStore";

const routes = [
  {
    path: "/",
    component: LoginView,
  },

  {
    path: "/admin",
    component: AdminDashboard,
    meta: {
      requiresAuth: true,
      role: "admin",
    },
  },

  {
    path: "/supervisor",
    component: SupervisorDashboard,
    meta: {
      requiresAuth: true,
      role: "supervisor",
    },
  },

  {
    path: "/mesero",
    component: MeseroPOS,
    meta: {
      requiresAuth: true,
      role: "mesero",
    },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// =========================
// ROUTE GUARD
// =========================

router.beforeEach((to, from, next) => {

  const authStore = useAuthStore();

  // =========================
  // REQUIRE LOGIN
  // =========================

  if (
    to.meta.requiresAuth &&
    !authStore.isAuthenticated
  ) {

    return next("/");

  }

  // =========================
  // USER INACTIVO
  // =========================

  if (
    authStore.user?.active === false
  ) {

    authStore.logout();

    return next("/");

  }

  // =========================
  // REQUIRE ROLE
  // =========================

  if (
    to.meta.role &&
    authStore.role !== to.meta.role
  ) {

    return next("/");

  }

  next();

});

export default router;