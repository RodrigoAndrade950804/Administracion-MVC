import { createApp } from "vue";
import App from "./App.vue";
import "./style.css";

import router from "./router";
import { createPinia } from "pinia";
import { useAuthStore } from "./stores/authStore";

const app = createApp(App);

const pinia = createPinia();

app.use(router);
app.use(pinia);

// =========================
// LOAD SESSION
// =========================

const authStore = useAuthStore();

authStore.loadSession();

app.mount("#app");