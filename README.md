# Enlaces del Proyecto

* Repositorio GitHub:
https://github.com/RodrigoAndrade950804/Administracion-MVC

* Backend:
https://aromagranosystem.onrender.com

* Frontend:
https://aromagranosystem.netlify.app

* Video de Tarea Administración
https://youtu.be/oaqMS9igiBU

* Video de Tarea Core Funcionando
https://youtu.be/Y70Jp4jhfYc

* Video Defensa Del Core
https://youtu.be/z2pX-3N2qXQ

---

# Aroma & Grano ☕

## Usuarios y Contraseñas

### Administrador
* Usuario: admin@aromagrano.com
* Contraseña: admin123

### Supervisor
* Usuario: supervisor@aromagrano.com
* Contraseña: supervisor123

### Mesero Principal
* Usuario: mesero@aromagrano.com
* Contraseña: mesero123

## Sistema de Gestión Operativa, POS Reactivo y Business Intelligence

Aroma & Grano es una plataforma web para la administración operativa de cafeterías y restaurantes. Integra gestión de usuarios, control de inventario, procesamiento de pedidos, monitoreo de mesas y análisis de desempeño mediante indicadores de negocio (BI).

El sistema fue desarrollado utilizando una arquitectura híbrida MVC + BaaS, combinando un backend API REST construido con Node.js y Express, un frontend SPA desarrollado con Vue 3 y una base de datos PostgreSQL gestionada mediante Supabase.

---

# Arquitectura del Sistema

## Arquitectura Híbrida MVC + BaaS

El sistema se compone de tres capas principales:

### Frontend (SPA)
* Vue 3 (Composition API)
* Pinia
* Vue Router
* Tailwind CSS
* Supabase Client

Responsabilidades:
* Interfaz de usuario.
* Gestión reactiva del estado.
* Consumo de APIs REST.
* Suscripciones Realtime.

---

### Backend (MVC)

#### Controllers
Gestionan la lógica de negocio:
* Usuarios
* Inventario
* Pedidos

#### Routes
Definen los endpoints REST.

#### Services
Gestionan:
* Conexiones privilegiadas con Supabase
* Operaciones administrativas
* Integraciones

---

### Base de Datos (BaaS)
Supabase PostgreSQL:
* Persistencia de datos
* Realtime (WebSockets)
* Seguridad
* Autenticación
* Consultas relacionales

---

# Tecnologías Utilizadas

## Backend
* Node.js
* Express.js
* Supabase
* PostgreSQL

## Frontend
* Vue.js 3
* Pinia
* Vue Router
* Tailwind CSS
* Vite

## Infraestructura
* Netlify (Frontend)
* Render (Backend)
* Supabase Cloud (Base de Datos)

---

# Funcionalidades Principales

## Gestión de Usuarios
* Registro de usuarios.
* Edición de perfiles.
* Activación y desactivación de cuentas.
* Roles y permisos.
* Cierre automático de sesión mediante Realtime.

---

## Gestión de Productos
* CRUD completo.
* Control de precios.
* Gestión de stock.
* Disponibilidad automática.

---

## Gestión de Inventario
* Entradas de inventario.
* Salidas de inventario.
* Mermas.
* Auditoría histórica.
* Registro permanente de movimientos.

---

## Sistema POS
* Apertura de mesas.
* Gestión de pedidos.
* Agregado de productos.
* Actualización de cantidades.
* Eliminación de productos.
* Cálculo automático de totales.
* Cierre de pedidos.

---

## Gestión de Mesas
* Estado libre.
* Estado ocupada.
* Actualización en tiempo real.
* Sincronización entre múltiples meseros.

---

## Módulo Business Intelligence (MADI)
* Seguimiento de ventas por mesero.
* Cálculo de cumplimiento de metas.
* Clasificación por niveles.
* Factores de bonificación configurables.
* Dashboard para supervisión.

---

# Característica Diferenciadora

## Sincronización Multiusuario en Tiempo Real
El sistema utiliza Supabase Realtime para sincronizar automáticamente:
* Mesas
* Pedidos
* Detalles de pedidos
* Usuarios
* Configuración MADI

Esto permite que múltiples empleados trabajen simultáneamente sobre la misma información sin necesidad de recargar la aplicación.

Ejemplos:
* Un mesero abre una mesa y todos los demás la ven ocupada instantáneamente.
* Un administrador desactiva un usuario y la sesión se cierra automáticamente.
* Un pedido se modifica y los cambios aparecen en todos los dispositivos conectados.

---

# Flujo Principal del Sistema

## Núcleo Operativo
1. El mesero selecciona una mesa.
2. El sistema crea un pedido asociado.
3. El usuario agrega productos.
4. Se valida disponibilidad de stock.
5. Se registra el detalle del pedido.
6. Se recalcula el total automáticamente.
7. Se actualizan métricas de desempeño.
8. Los cambios se sincronizan mediante Realtime.
9. El pedido se cierra.
10. La mesa vuelve a estado libre.

---

# Roles del Sistema

| Nivel | Rol           | Permisos                       |
| ----- | ------------- | ------------------------------ |
| 1     | Administrador | Gestión total del sistema      |
| 2     | Supervisor    | Monitoreo, métricas y reportes |
| 3     | Mesero        | Operación del POS              |

---

# Seguridad Implementada

## Control de Acceso Basado en Roles (RBAC)
Cada usuario posee permisos asociados a su rol.

### Administrador
* Usuarios
* Productos
* Inventario
* Configuración MADI

### Supervisor
* Consultas
* Métricas
* Desempeño

### Mesero
* POS
* Pedidos
* Mesas

---

## Kill-Switch de Seguridad
Cuando un administrador desactiva una cuenta:
1. Se actualiza el registro en la base de datos.
2. Supabase Realtime envía un evento.
3. El cliente recibe la notificación.
4. Se ejecuta logout automático.
5. La sesión queda invalidada.

---

# Patrones y Principios Aplicados

## Single Responsibility Principle (SRP)
Cada módulo tiene una responsabilidad específica.

### Frontend
* Components → UI
* Services → API
* Stores → Estado global

### Backend
* Routes → Enrutamiento
* Controllers → Lógica
* Services → Acceso a datos

---

## Separation of Concerns (SoC)
Separación clara entre:
* Presentación
* Negocio
* Persistencia

---

## Observer Pattern
Implementado mediante Supabase Realtime.
Los clientes reaccionan automáticamente ante cambios en la base de datos.

Ejemplo:
```javascript
supabase
  .channel("users")
  .on(
    "postgres_changes",
    {
      event: "UPDATE",
      schema: "public",
      table: "users"
    },
    (payload) => {
      console.log(payload);
    }
  )
  .subscribe();
```

---

## State Management Pattern
Implementado mediante Pinia.
Permite compartir información entre componentes sin Prop Drilling.

---

## Audit Trail Pattern
Cada movimiento de inventario genera un registro histórico.

Beneficios:
* Trazabilidad.
* Auditoría.
* Recuperación de información.
* Seguimiento de responsables.

---

# Beneficios del Sistema

* **Consistencia de Datos:** Todos los usuarios observan la misma información en tiempo real.
* **Escalabilidad:** La separación de responsabilidades facilita el mantenimiento y crecimiento del sistema.
* **Seguridad:** La invalidación inmediata de sesiones reduce riesgos operativos.
* **Auditoría:** Todos los movimientos importantes quedan registrados.
* **Mantenibilidad:** La arquitectura desacoplada permite modificar módulos sin afectar el resto del sistema.

---

# Instalación

## Backend
```bash
cd backend
npm install
npm run dev
```
Servidor: `http://localhost:3000`

---

## Frontend
```bash
cd frontend
npm install
npm run dev
```
Aplicación: `http://localhost:5173`

---

# Variables de Entorno

## Backend (.env)
```env
PORT=3000
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
```

---

## Frontend (.env)
```env
VITE_API_URL=http://localhost:3000/api
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=
```

---

# Estructura Final

```plaintext
AromaGranoSystem
├─ backend
│  ├─ .env
│  ├─ package-lock.json
│  ├─ package.json
│  └─ src
│     ├─ app.js
│     ├─ config
│     │  └─ env.js
│     ├─ controllers
│     │  ├─ happy_hour.controller.js
│     │  ├─ inventario.controller.js
│     │  ├─ madi.controller.js
│     │  ├─ mesas.controller.js
│     │  ├─ pedidos.controller.js
│     │  ├─ productos.controller.js
│     │  └─ users.controller.js
│     ├─ routes
│     │  ├─ happy_hour.routes.js
│     │  ├─ inventario.routes.js
│     │  ├─ madi.routes.js
│     │  ├─ mesas.routes.js
│     │  ├─ pedidos.routes.js
│     │  ├─ productos.routes.js
│     │  └─ users.routes.js
│     ├─ server.js
│     ├─ services
│     │  ├─ happy_hour.service.js
│     │  ├─ inventario.service.js
│     │  ├─ madi.service.js
│     │  ├─ mesas.service.js
│     │  ├─ pedidos.service.js
│     │  ├─ productos.service.js
│     │  ├─ supabaseAdmin.js
│     │  └─ users.service.js
│     ├─ utils
│     └─ validations
├─ docs
├─ frontend
│  ├─ .env
│  ├─ dist
│  ├─ index.html
│  ├─ package-lock.json
│  ├─ package.json
│  ├─ public
│  │  ├─ favicon.svg
│  │  ├─ icons.svg
│  │  └─ _redirects
│  ├─ README.md
│  ├─ src
│  │  ├─ api
│  │  ├─ App.vue
│  │  ├─ components
│  │  │  └─ admin
│  │  │     ├─ HappyHourManager.vue
│  │  │     ├─ MadiManager.vue
│  │  │     ├─ ProductosManager.vue
│  │  │     └─ UsuariosManager.vue
│  │  ├─ layouts
│  │  ├─ main.js
│  │  ├─ pages
│  │  │  ├─ AdminDashboard.vue
│  │  │  ├─ LoginView.vue
│  │  │  ├─ MeseroPOS.vue
│  │  │  └─ SupervisorDashboard.vue
│  │  ├─ router
│  │  │  └─ index.js
│  │  ├─ services
│  │  │  ├─ inventarioService.js
│  │  │  ├─ madiService.js
│  │  │  ├─ mesasService.js
│  │  │  ├─ pedidosService.js
│  │  │  ├─ productosService.js
│  │  │  ├─ supabase.js
│  │  │  └─ usuariosService.js
│  │  ├─ stores
│  │  │  ├─ authStore.js
│  │  │  └─ happyHourStore.js
│  │  ├─ style.css
│  │  ├─ styles
│  │  └─ utils
│  └─ vite.config.js
└─ README.md
```

---

# Aprendizajes del Proyecto
Durante el desarrollo se aplicaron conceptos de:
* Arquitectura MVC.
* Arquitectura SPA.
* REST API.
* PostgreSQL.
* Supabase Realtime.
* Gestión de estado con Pinia.
* WebSockets.
* Control de acceso por roles.
* Business Intelligence.
* Auditoría de inventario.
* Integración Full Stack.

---

# Autor
**Rodrigo Andrade**  
Universidad de Las Américas (UDLA)  
Ingeniería de Software  
2025

---

# Conclusión
Aroma & Grano demuestra la implementación práctica de una arquitectura híbrida MVC + BaaS capaz de soportar operaciones concurrentes en tiempo real, control de inventario auditado, procesamiento de pedidos y generación de métricas empresariales, integrando tecnologías modernas de desarrollo Full Stack en un entorno productivo.