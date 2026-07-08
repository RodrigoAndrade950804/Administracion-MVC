<!-- 
╔══════════════════════════════════════════════════════════════════════════════╗
║                     AROMA & GRANO — SISTEMA DE GESTIÓN                      ║
║                  Archivo: App.vue (Componente Raíz)                         ║
╚══════════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────────┐
│  PROPÓSITO DE ESTE ARCHIVO                                                  │
│  ─────────────────────────────────────────────────────────────────────────── │
│  App.vue es el "Componente Raíz" (Root Component) de la aplicación Vue 3.   │
│  Es el primer componente que se renderiza y actúa como contenedor maestro   │
│  para toda la interfaz del usuario.                                         │
│                                                                             │
│  RESPONSABILIDADES:                                                         │
│  1. Renderizar el componente de la ruta activa via <router-view />          │
│  2. Aplicar el tema visual dinámico (Normal vs Happy Hour Neón)             │
│  3. Cargar la configuración de Happy Hour al arrancar la aplicación         │
│  4. Suscribirse a cambios en tiempo real de la configuración Happy Hour     │
│                                                                             │
│  CONCEPTO — Single File Component (SFC):                                    │
│  En Vue 3, cada archivo .vue es un SFC que contiene tres secciones:         │
│  • <template> → Estructura HTML (lo que el usuario VE)                      │
│  • <script>   → Lógica JavaScript (lo que la app HACE)                      │
│  • <style>    → Estilos CSS (cómo se VE lo anterior)                        │
│  Esto promueve la co-localización: todo lo relacionado con un componente    │
│  vive en un solo archivo, facilitando el mantenimiento.                     │
└─────────────────────────────────────────────────────────────────────────────┘
-->

<!-- =========================================================================
     SECCIÓN: TEMPLATE (Plantilla HTML)
     =========================================================================
     
     CONCEPTO — Directivas de Vue en el Template:
     • :class (v-bind:class) → Enlace dinámico de clases CSS.
       El prefijo ":" es un atajo para v-bind, que conecta un atributo HTML
       a una expresión JavaScript reactiva. Cuando la expresión cambia,
       Vue actualiza automáticamente las clases CSS del elemento.
     
     • <router-view /> → Componente especial de Vue Router que actúa como
       un "placeholder dinámico". Vue Router reemplaza su contenido con el
       componente que corresponda a la URL actual del navegador:
       - URL "/"         → Renderiza LoginView.vue
       - URL "/admin"    → Renderiza AdminDashboard.vue
       - URL "/mesero"   → Renderiza MeseroPOS.vue
       - URL "/supervisor" → Renderiza SupervisorDashboard.vue
     
     PATRÓN DE DISEÑO — Theming Condicional:
     Se utiliza un operador ternario en :class para alternar entre dos
     temas visuales completos según el estado de Happy Hour:
     • Tema Normal:  fondo oscuro (#111111) con estilos corporativos estándar
     • Tema Neón:    fondo azul profundo (#0f172a) con estilos vibrantes tipo neón
     
     Esto permite que TODO el restaurante cambie su apariencia visual de 
     forma sincronizada cuando se activa Happy Hour, creando una experiencia
     inmersiva para clientes y empleados.
     ========================================================================= -->
<template>
  <div :class="happyHourStore.config.is_active ? 'theme-neon min-h-screen bg-[#0f172a]' : 'theme-normal min-h-screen bg-[#111111]'">
    <router-view />
  </div>
</template>

<!-- =========================================================================
     SECCIÓN: SCRIPT SETUP (Lógica del Componente)
     =========================================================================
     
     CONCEPTO — <script setup> (Composition API con Syntactic Sugar):
     La etiqueta <script setup> es una sintaxis especial de Vue 3 que:
     
     1. ELIMINA el boilerplate: No necesitas escribir export default {},
        setup(), ni return {}. Todo lo que declares se expone al template.
     
     2. MEJOR RENDIMIENTO: El compilador de Vue puede optimizar mejor el
        código porque conoce todas las variables en tiempo de compilación.
     
     3. EQUIVALENCIA con Composition API estándar:
        ┌──────────────────────────────────┬──────────────────────────────────┐
        │     CON <script setup>            │     SIN <script setup>           │
        ├──────────────────────────────────┼──────────────────────────────────┤
        │ const count = ref(0)             │ export default {                 │
        │ // se expone automáticamente     │   setup() {                      │
        │                                  │     const count = ref(0)         │
        │                                  │     return { count }             │
        │                                  │   }                              │
        │                                  │ }                                │
        └──────────────────────────────────┴──────────────────────────────────┘
     
     CONCEPTO — onMounted (Lifecycle Hook / Gancho del Ciclo de Vida):
     Vue 3 proporciona funciones llamadas "hooks" que se ejecutan en momentos
     específicos del ciclo de vida de un componente:
     
     • onBeforeMount   → Antes de insertar el componente en el DOM
     • onMounted       → DESPUÉS de insertar el componente en el DOM ✅ (usado aquí)
     • onBeforeUpdate  → Antes de re-renderizar por cambio de datos
     • onUpdated       → Después de re-renderizar
     • onBeforeUnmount → Antes de destruir el componente
     • onUnmounted     → Después de destruir el componente
     
     onMounted es ideal para:
     - Hacer peticiones HTTP al servidor (fetch/axios)
     - Suscribirse a canales de WebSocket
     - Acceder al DOM real (refs)
     - Inicializar bibliotecas de terceros
     ========================================================================= -->
<script setup>
/**
 * onMounted — Hook del ciclo de vida de Vue 3 (Composition API).
 * 
 * Se ejecuta una sola vez cuando el componente App.vue ha sido insertado
 * en el DOM del navegador. Es el momento perfecto para:
 * - Cargar datos iniciales desde el servidor
 * - Iniciar suscripciones en tiempo real (WebSockets)
 * 
 * IMPORTANTE: onMounted solo se puede usar dentro de <script setup>
 * o dentro de la función setup() de un componente.
 */
import { onMounted } from 'vue';
import { useHappyHourStore } from './stores/happyHourStore';

/**
 * useHappyHourStore — Store de Pinia para la gestión de Happy Hour.
 * 
 * CONCEPTO PINIA — Acceso a Stores desde Componentes:
 * Al llamar a useHappyHourStore(), Pinia nos devuelve un objeto reactivo
 * que contiene:
 * - Estado (state): config, ventasSemanales
 * - Acciones (actions): loadConfig(), iniciarRealtimeHappyHour()
 * 
 * Cualquier cambio en el estado del store se refleja AUTOMÁTICAMENTE
 * en el template gracias al sistema de reactividad de Vue 3 (Proxy).
 * 
 * FLUJO: happyHourStore.config.is_active cambia en la DB →
 *        Supabase Realtime notifica al store →
 *        El store actualiza config.value →
 *        Vue detecta el cambio via Proxy →
 *        El :class del template se recalcula →
 *        El tema visual cambia instantáneamente en pantalla
 */
const happyHourStore = useHappyHourStore();

/**
 * Bloque de inicialización que se ejecuta al montarse App.vue.
 * 
 * SECUENCIA DE ARRANQUE:
 * 
 * 1. loadConfig(): Hace un GET al backend para obtener la configuración
 *    actual de Happy Hour (is_active, discount_percentage, etc.).
 *    Esto asegura que al abrir la app, el tema visual sea correcto
 *    desde el primer frame renderizado.
 * 
 * 2. iniciarRealtimeHappyHour(): Abre un canal WebSocket con Supabase
 *    para escuchar cambios en la tabla 'configuracion_happy_hour'.
 *    Si el admin activa/desactiva Happy Hour, TODOS los dispositivos
 *    conectados (tabletas de meseros, pantallas de cocina, etc.)
 *    cambian de tema simultáneamente sin necesidad de recargar.
 * 
 * PATRÓN DE DISEÑO — Observer (Observador):
 * La suscripción Realtime implementa el patrón Observer donde:
 * - Subject (Sujeto):    La tabla 'configuracion_happy_hour' en PostgreSQL
 * - Observer (Observador): Este componente App.vue (y el store)
 * - Evento:               Cualquier INSERT, UPDATE o DELETE en la tabla
 * - Notificación:         Supabase envía el payload via WebSocket
 */
onMounted(() => {
  happyHourStore.loadConfig();
  happyHourStore.iniciarRealtimeHappyHour();
});
</script>