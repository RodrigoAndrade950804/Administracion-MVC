import { defineStore } from "pinia";
import { ref } from "vue";
import { supabase } from "../services/supabase"; // Asumiendo que esta es tu instancia de supabase
import { fetchWithAuth } from "../api/apiClient";

export const useHappyHourStore = defineStore("happyHour", () => {
  const config = ref({
    is_active: false,
    discount_percentage: 0,
    waiter_multiplier: 1.0,
    weekly_sales_trigger: 0,
    activation_day: 'Friday'
  });
  const ventasSemanales = ref(0);

  const loadConfig = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const res = await fetch(`${apiUrl}/api/happy-hour/config`); // Público
      if (res.ok) {
        const data = await res.json();
        if(data) config.value = data;
      }
    } catch (error) {
      console.error("Error al cargar config Happy Hour:", error);
    }
  };

  const loadVentasSemanales = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const res = await fetchWithAuth(`${apiUrl}/api/happy-hour/ventas-semanales`);
      if (res.ok) {
        const data = await res.json();
        ventasSemanales.value = Number(data.total || 0);
      }
    } catch (error) {
      console.error("Error al cargar ventas semanales:", error);
    }
  };

  let canal = null;

  const iniciarRealtimeHappyHour = () => {
    if (canal) return;
    canal = supabase
      .channel("public:configuracion_happy_hour")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "configuracion_happy_hour" },
        (payload) => {
          if (payload.new) {
            config.value = payload.new;
          }
        }
      )
      .subscribe();
  };

  return { config, ventasSemanales, loadConfig, loadVentasSemanales, iniciarRealtimeHappyHour };
});
