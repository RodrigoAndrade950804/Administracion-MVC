# AromaGrano Frontend (Vue 3 + Vite)

Este es el cliente o SPA (Single Page Application) del sistema Aroma & Grano, desarrollado con tecnologías modernas y reactivas para proporcionar la mejor experiencia de usuario en tiempo real.

## Frameworks y Herramientas Principales

* **Vue.js 3**: Utilizando la `Composition API` y `<script setup>` para un desarrollo modular y limpio.
* **Vite**: Empaquetador y servidor de desarrollo ultra-rápido de nueva generación.
* **Pinia**: Manejo del estado global de forma intuitiva, sustituyendo a Vuex.
* **Vue Router**: Para el enrutamiento y la navegación por la aplicación.
* **Tailwind CSS**: Framework CSS de utilidad (Utility-First) para crear una interfaz "Glassmorphism" y modo Neón con alta calidad visual.
* **Supabase Client**: Se conecta a la base de datos Postgres mediante WebSocket (Realtime) para sincronización automática de información.

## Estructura de Directorios

```plaintext
frontend/
├── index.html           # Punto de entrada de Vite
├── src/
│   ├── main.js          # Instanciación de Vue, Pinia y Router
│   ├── App.vue          # Componente raíz
│   ├── pages/           # Vistas completas para cada rol (Mesero, Admin, Supervisor)
│   ├── components/      # Componentes reutilizables (Modales, Tablas, Grillas)
│   ├── router/          # Definición de rutas de Vue Router
│   ├── stores/          # Manejadores de estado (Pinia) para auth y variables globales
│   ├── services/        # Archivos de servicio para peticiones HTTP al Backend Express
│   ├── styles/          # Hojas de estilo globales 
│   └── utils/           # Funciones de ayuda
├── .env                 # Configuración del frontend
├── tailwind.config.js   # Tokens de diseño y colores
├── vite.config.js       # Configuración del servidor y compilación
└── package.json
```

## Conexión y Arquitectura Frontend

El frontend tiene **doble comunicación**:
1. **Peticiones HTTP (REST)**: Van hacia el Backend (`localhost:3000/api`) para acciones complejas como cobrar pedidos o modificar stock de forma controlada.
2. **WebSockets (Realtime)**: Van directamente hacia Supabase a través de `@supabase/supabase-js`. El Frontend "escucha" cualquier alteración de filas (UPDATE, INSERT, DELETE) para mantener el POS, las mesas y la disponibilidad sin que el mesero tenga que recargar la página.

## Instalación y Configuración

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Configurar las variables en el archivo `.env`:
   ```env
   VITE_API_URL=http://localhost:3000/api
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu_anon_key
   ```

3. Iniciar el servidor local de desarrollo:
   ```bash
   npm run dev
   ```

La aplicación estará disponible en `http://localhost:5173`.
