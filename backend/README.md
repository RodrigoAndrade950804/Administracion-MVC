# AromaGrano Backend (Express + Supabase)

Este es el servidor Backend que soporta la aplicación Aroma & Grano System, construido con **Node.js** y **Express.js**, empleando una arquitectura tipo MVC (Controladores, Rutas y Servicios).

## Arquitectura y Flujo

1. **Rutas (Routes):** Reciben las peticiones REST y las envían al controlador.
2. **Controladores (Controllers):** Orquestan las respuestas HTTP y agrupan la lógica de validación de entrada.
3. **Servicios (Services):** Se conectan a **Supabase (PostgreSQL)** mediante `Supabase Admin SDK` usando una *Service Role Key*, permitiendo hacer operaciones privilegiadas como manejo de roles, usuarios en Auth y transacciones de base de datos seguras.

## Frameworks y Herramientas

* **Node.js**: Entorno de ejecución en tiempo real.
* **Express.js**: Framework minimalista para la creación de la API RESTful.
* **Supabase / @supabase/supabase-js**: BaaS (Backend as a Service) para la autenticación, base de datos Postgres y WebSockets (Realtime).
* **Dotenv**: Gestión segura de las variables de entorno.
* **Cors**: Para permitir peticiones desde el frontend (SPA).

## Estructura de Directorios

```plaintext
backend/
├── src/
│   ├── app.js               # Instancia y middlewares de Express
│   ├── server.js            # Punto de entrada principal (arranque del servidor HTTP)
│   ├── config/              # Configuraciones globales y variables de entorno
│   ├── controllers/         # Lógica principal de peticiones y respuestas HTTP
│   ├── routes/              # Definición de rutas (endpoints) REST
│   └── services/            # Comunicación con Supabase y lógica de negocio dura
├── .env                     # Variables de entorno 
├── package.json
└── README.md                # Este documento
```

## Instalación y Configuración

1. Instalar las dependencias de Node.js:
   ```bash
   npm install
   ```

2. Crear un archivo `.env` basado en la plantilla y proporcionar tus claves:
   ```env
   PORT=3000
   SUPABASE_URL=https://tu-proyecto.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=tu_service_key
   ```

3. Levantar el servidor en modo desarrollo:
   ```bash
   npm run dev
   ```

El servidor estará escuchando en `http://localhost:3000` y ofrecerá todos los endpoints bajo la base `/api/...`.
