import { defineStore } from "pinia";
import { ref } from "vue";

export const useAuthStore = defineStore("auth", () => {

  const user = ref(null);
  const role = ref(null);
  const isAuthenticated = ref(false);

  // =========================
  // SET USER
  // =========================

  const setUser = (userData, userRole) => {

    user.value = userData;
    role.value = userRole;
    isAuthenticated.value = true;

    localStorage.setItem(
      "auth",
      JSON.stringify({
        user: userData,
        role: userRole,
      })
    );

  };

  // =========================
  // LOAD SESSION
  // =========================

  const loadSession = () => {

    const savedAuth =
      localStorage.getItem("auth");

    if (savedAuth) {

      const parsedAuth =
        JSON.parse(savedAuth);

      user.value = parsedAuth.user;
      role.value = parsedAuth.role;
      isAuthenticated.value = true;

    }

  };

  // =========================
  // LOGOUT
  // =========================

  const logout = () => {

    user.value = null;
    role.value = null;
    isAuthenticated.value = false;

    localStorage.removeItem("auth");

  };

  return {
    user,
    role,
    isAuthenticated,
    setUser,
    loadSession,
    logout,
  };

});