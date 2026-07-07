// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║            AROMA & GRANO — SISTEMA DE GESTIÓN GASTRONÓMICA              ║
// ║         Archivo: config/env.js — Carga de Variables de Entorno          ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

// =========================================================================
// ¿QUÉ SON LAS VARIABLES DE ENTORNO Y POR QUÉ SON IMPORTANTES?
// =========================================================================
//
// Las variables de entorno (environment variables) son pares clave-valor
// almacenados a nivel del sistema operativo (o en un archivo .env) que
// permiten configurar una aplicación SIN modificar su código fuente.
//
// Ejemplos típicos en este proyecto:
//   - SUPABASE_URL         → La URL del proyecto en Supabase (base de datos).
//   - SUPABASE_SERVICE_ROLE_KEY → La llave secreta de administrador.
//   - PORT                 → El puerto donde escuchará el servidor HTTP.
//
// ¿Por qué NO se escriben directamente en el código?
//   1. SEGURIDAD: Las contraseñas y llaves API nunca deben estar en el
//      repositorio de código (Git). El archivo .env se añade a .gitignore.
//   2. PORTABILIDAD: Permiten que la misma base de código funcione en
//      desarrollo (localhost), staging y producción sin cambios.
//   3. PRINCIPIO 12-FACTOR APP: La metodología "The Twelve-Factor App"
//      (https://12factor.net/config) establece que la configuración debe
//      almacenarse en el entorno, no en el código. Esto es un estándar
//      de la industria para aplicaciones cloud-native y microservicios.
//
// =========================================================================

// =========================================================================
// IMPORTACIÓN DE LA LIBRERÍA DOTENV
// =========================================================================
//
// ¿QUÉ ES DOTENV?
// ────────────────
// 'dotenv' es una librería de Node.js (paquete npm) de configuración cero
// que lee un archivo de texto plano llamado '.env' ubicado en la raíz del
// proyecto y carga cada línea como una variable dentro del objeto global
// 'process.env' de Node.js.
//
// ¿CÓMO FUNCIONA INTERNAMENTE?
// ─────────────────────────────
// 1. Lee el archivo .env con fs.readFileSync() (lectura síncrona).
// 2. Parsea cada línea buscando el patrón: CLAVE=VALOR.
// 3. Asigna cada par al objeto process.env:
//      process.env.SUPABASE_URL = "https://xyz.supabase.co"
// 4. NO sobrescribe variables que ya existan en el sistema operativo,
//    lo que permite que plataformas como Render o Heroku inyecten sus
//    propias variables sin conflicto.
//
// ¿POR QUÉ SE USA 'import' EN LUGAR DE 'require'?
// ─────────────────────────────────────────────────
// Este proyecto utiliza ECMAScript Modules (ESM), el sistema de módulos
// estándar de JavaScript moderno. Se activa con "type": "module" en el
// package.json. La diferencia principal con CommonJS (require) es que
// los imports de ESM se resuelven estáticamente en tiempo de compilación,
// lo que permite optimizaciones como tree-shaking y análisis estático.
//
// PATRÓN DE IMPORTACIÓN:
//   - 'import dotenv from "dotenv"' → Importa la exportación por defecto
//     del paquete, que es un objeto con métodos como .config() y .parse().
//
import dotenv from "dotenv";

// =========================================================================
// EJECUCIÓN DE LA CARGA DE VARIABLES DE ENTORNO
// =========================================================================
//
// ¿QUÉ HACE dotenv.config()?
// ──────────────────────────
// Ejecuta el proceso completo de lectura y carga descrito anteriormente.
// Por defecto busca el archivo '.env' en la raíz del proyecto (process.cwd()),
// pero acepta opciones para personalizar la ruta:
//   dotenv.config({ path: './config/.env.production' })
//
// ¿POR QUÉ ESTE ARCHIVO ES TAN PEQUEÑO PERO TAN CRÍTICO?
// ────────────────────────────────────────────────────────
// Aunque solo tiene dos líneas de código funcional, este archivo es el
// PRIMER MÓDULO que debe ejecutarse en toda la aplicación. Si se importa
// después de otros módulos que ya intentaron leer process.env (como
// supabaseAdmin.js), esas variables llegarían como 'undefined' y la
// conexión a la base de datos fallaría silenciosamente.
//
// ORDEN DE EJECUCIÓN EN server.js (punto de entrada):
//   1. import "./config/env.js"    ← PRIMERO: carga las variables
//   2. import app from "./app.js"  ← SEGUNDO: configura Express y rutas
//
// Esto garantiza que cuando supabaseAdmin.js lea process.env.SUPABASE_URL,
// el valor ya estará disponible en memoria.
//
// PATRÓN ARQUITECTÓNICO: "Bootstrap / Bootstrapping"
// ───────────────────────────────────────────────────
// Este archivo implementa el patrón de inicialización temprana (bootstrap),
// donde las dependencias de configuración se resuelven antes de que
// cualquier componente del sistema las necesite. Es análogo al proceso
// de arranque (boot) de un sistema operativo: primero se cargan los
// drivers, luego se inician los servicios.
//
dotenv.config();