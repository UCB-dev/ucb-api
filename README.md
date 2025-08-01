# UCB-API

API REST para el sistema de gestión académica de la Universidad Católica Boliviana. Permite gestionar materias, elementos de competencia, saberes mínimos, recuperatorios y notificaciones push para aplicaciones móviles y dashboard web.

## Tabla de Contenidos

- [Características](#características)
- [Tecnologías](#tecnologías)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Estructura de la Base de Datos](#estructura-de-la-base-de-datos)
- [Endpoints](#endpoints)
- [Notificaciones Push](#notificaciones-push)
- [Ejemplos de Uso](#ejemplos-de-uso)
- [Cron Jobs](#cron-jobs)

## Características

- **Gestión Académica**: Materias, paralelos, elementos de competencia
- **Seguimiento de Progreso**: Saberes mínimos, recuperatorios, evaluaciones
- **Notificaciones Push**: Firebase Cloud Messaging para recordatorios
- **Autenticación**: Google OAuth y Firebase Auth
- **Carga Masiva**: Importación de datos desde Excel
- **API REST**: Endpoints para aplicaciones móviles y dashboard web
- **Base de Datos Cloud**: PostgreSQL en Neon (sin configuración local)

## Tecnologías

- **Backend**: Node.js, Express.js
- **Base de Datos**: PostgreSQL (Neon)
- **Autenticación**: Firebase Admin SDK, Passport.js
- **Notificaciones**: Firebase Cloud Messaging
- **Programación**: node-cron para tareas programadas
- **Seguridad**: Rate limiting, CORS

## Instalación

1. **Clonar el repositorio**
```bash
git clone <repository-url>
cd UCB-API
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
```bash
cp .env.example .env
```

4. **Configurar la base de datos**
```bash
# La base de datos PostgreSQL está alojada en Neon
# Solo necesitas configurar las variables de entorno con las credenciales
```

5. **Ejecutar el servidor**
```bash
npm start
```

## Configuración

### Variables de Entorno (.env)

```env
# Servidor
PORT
FRONTEND_URL

# Base de Datos PostgreSQL (Neon)
PGHOST
PGDATABASE
PGUSER
PGPASSWORD


FIREBASE_PROJECT_ID
FIREBASE_PRIVATE_KEY_ID
FIREBASE_PRIVATE_KEY
FIREBASE_CLIENT_EMAIL
FIREBASE_CLIENT_ID
FIREBASE_CLIENT_CERT_URL

SESSION_SECRET
```

## Estructura de la Base de Datos

La base de datos PostgreSQL está alojada en Neon y ya incluye todas las tablas necesarias. No es necesario crear las tablas localmente.

### Tabla USUARIO
```sql
CREATE TABLE usuario (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100),
    correo VARCHAR(255) NOT NULL UNIQUE,
    google_id VARCHAR(100),
    activo BOOLEAN NOT NULL DEFAULT true,
    fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    picture TEXT
);
```

### Tabla MATERIA
```sql
CREATE TABLE materia (
    id VARCHAR(10) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    image TEXT NOT NULL,
    docente_id INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    paralelo VARCHAR(20) NOT NULL,
    elementos_totales INTEGER NOT NULL DEFAULT 0,
    rec_totales INTEGER NOT NULL DEFAULT 0,
    rec_tomados INTEGER NOT NULL DEFAULT 0,
    elem_evaluados INTEGER NOT NULL DEFAULT 0,
    elem_completados INTEGER NOT NULL DEFAULT 0,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sigla VARCHAR(20) NOT NULL,
    gestion VARCHAR(20) NOT NULL,
    vigente BOOLEAN NOT NULL DEFAULT true
);
```

### Tabla ELEMENTO_COMPETENCIA
```sql
CREATE TABLE elemento_competencia (
    id SERIAL PRIMARY KEY,
    materia_id VARCHAR(10) NOT NULL REFERENCES materia(id) ON DELETE CASCADE,
    descripcion TEXT NOT NULL,
    fecha_limite DATE NOT NULL,
    fecha_registro DATE NOT NULL DEFAULT CURRENT_DATE,
    saberes_totales INTEGER NOT NULL DEFAULT 0,
    saberes_completados INTEGER NOT NULL DEFAULT 0,
    completado BOOLEAN NOT NULL DEFAULT false,
    evaluado BOOLEAN NOT NULL DEFAULT false,
    comentario TEXT,
    fecha_evaluado TIMESTAMP
);
```

### Tabla SABER_MINIMO
```sql
CREATE TABLE saber_minimo (
    id SERIAL PRIMARY KEY,
    completado BOOLEAN NOT NULL DEFAULT false,
    elemento_competencia_id INTEGER NOT NULL REFERENCES elemento_competencia(id) ON DELETE CASCADE,
    descripcion TEXT NOT NULL
);
```

### Tabla RECUPERATORIO
```sql
CREATE TABLE recuperatorio (
    id SERIAL PRIMARY KEY,
    completado BOOLEAN NOT NULL DEFAULT false,
    elemento_competencia_id INTEGER NOT NULL REFERENCES elemento_competencia(id) ON DELETE CASCADE,
    fecha_evaluado TIMESTAMP
);
```

### Tabla USUARIO_FCM_TOKEN
```sql
CREATE TABLE usuario_fcm_token (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    fcm_token TEXT NOT NULL UNIQUE,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Tabla NOTIFICACION
```sql
CREATE TABLE notificacion (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    mensaje TEXT NOT NULL,
    fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    leida BOOLEAN NOT NULL DEFAULT false
);
```

## Endpoints

### Autenticación

#### POST /create-user
Crear un nuevo usuario en Firebase Auth.

**Body:**
```json
{
  "email": "usuario@ejemplo.com",
  "password": "contraseña123",
  "displayName": "Nombre Usuario"
}
```

#### POST /set-password
Establecer contraseña para usuario existente.

**Body:**
```json
{
  "email": "usuario@ejemplo.com",
  "newPassword": "nuevaContraseña123"
}
```

#### GET /validate-email
Validar si un email existe en la base de datos.

**Query Parameters:**
- `email`: Email a validar

### Gestión Académica

#### GET /api/materias/progreso
Obtener progreso general de todas las materias.

**Query Parameters:**
- `gestion` (opcional): Filtrar por gestión

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "nombre_materia": "Matemáticas",
      "elementos_totales": 10,
      "elem_completados": 5,
      "elem_evaluados": 3,
      "rec_totales": 2,
      "rec_tomados": 1,
      "progreso_general": 50,
      "evaluaciones": 30,
      "saberes_minimos": 75
    }
  ]
}
```

#### GET /api/materias/:nombre_materia/rendimiento-paralelo
Obtener rendimiento por paralelo de una materia específica.

**Path Parameters:**
- `nombre_materia`: Nombre de la materia

**Query Parameters:**
- `gestion` (opcional): Filtrar por gestión

#### GET /api/materia/:nombre_materia/elementos-por-paralelo
Obtener elementos de competencia y saberes mínimos por paralelo.

**Path Parameters:**
- `nombre_materia`: Nombre de la materia

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "paralelo": "A",
      "docente": "Juan Pérez",
      "elementos": [
        {
          "id": 1,
          "descripcion": "Resolver ecuaciones",
          "completado": false,
          "evaluado": false,
          "saberes_totales": 3,
          "saberes_completados": 1,
          "fecha_limite": "2024-06-15",
          "fecha_registro": "2024-01-15",
          "fecha_evaluado": null,
          "comentario": null,
          "saberes_minimos": [
            ["Identificar variables", false],
            ["Aplicar propiedades", true]
          ],
          "recuperatorios": [
            [false, null]
          ]
        }
      ]
    }
  ]
}
```

### Gestión de Datos

#### POST /api/upload-excel-data
Cargar datos masivos desde Excel (precaución! reemplaza toda la BD).

**Body:**
```json
{
  "docentes": [
    {
      "correo": "juan.perez@email.com",
      "nombre": "Juan Pérez",
      "picture": null
    }
  ],
  "materias": [
    {
      "id": "MAT101-2024-I-A",
      "name": "Matemáticas Básicas",
      "image": "https://example.com/math.jpg",
      "docente_correo": "juan.perez@email.com",
      "paralelo": "A",
      "sigla": "MAT101",
      "gestion": "2024-I",
      "elementos_totales": 3,
      "rec_totales": 0,
      "saberes_totales": 5
    }
  ],
  "elementos": [
    {
      "materia_id": "MAT101-2024-I-A",
      "descripcion": "Resolver ecuaciones lineales",
      "fecha_limite": "2024-06-15",
      "saberes": [
        "Identificar variables en ecuaciones",
        "Aplicar propiedades algebraicas"
      ],
      "saberes_totales": 2
    }
  ]
}
```

### Aplicación Móvil

#### POST /fcm-token
Registrar token FCM para notificaciones push.

**Body:**
```json
{
  "email": "usuario@ejemplo.com",
  "fcmToken": "firebase-fcm-token"
}
```

#### GET /competitions/:userId
Obtener elementos de competencia para un docente.

**Path Parameters:**
- `userId`: ID del usuario docente

#### GET /notificaciones
Obtener notificaciones de un usuario.

**Query Parameters:**
- `email`: Email del usuario

#### PATCH /notificaciones/:id/read
Marcar notificación como leída.

#### DELETE /notificaciones/:id
Eliminar notificación.

### Actualizaciones

#### PATCH /materia/:id/increment
Incrementar contadores de una materia.

**Body:**
```json
{
  "rec_tomados": 1,
  "elem_completados": 1,
  "elem_evaluados": 1,
  "rec_totales": 1
}
```

#### PATCH /materia/:id
Actualizar datos de una materia.

**Body:**
```json
{
  "rec_tomados": 5,
  "elem_completados": 3,
  "elem_evaluados": 2,
  "vigente": true
}
```

#### PATCH /elemento/:id
Actualizar elemento de competencia.

**Body:**
```json
{
  "evaluado": true,
  "comentario": "Excelente trabajo",
  "fecha_evaluado": "2024-06-15T10:30:00Z",
  "saberes_completados": 3,
  "completado": true
}
```

#### PATCH /saber/:id/completado
Actualizar estado de saber mínimo.

**Body:**
```json
{
  "completado": true
}
```

#### PATCH /recuperatorio/:id
Actualizar recuperatorio.

**Body:**
```json
{
  "completado": true,
  "fecha_evaluado": "2024-06-15T10:30:00Z"
}
```

### Consultas

#### GET /materias
Obtener materias de un docente.

**Query Parameters:**
- `email`: Email del docente

#### GET /elementos
Obtener elementos de competencia de una materia.

**Query Parameters:**
- `materia`: ID de la materia

#### GET /saberes
Obtener saberes mínimos de un elemento.

**Query Parameters:**
- `elemento`: ID del elemento

#### GET /recuperatorios
Obtener recuperatorios de un elemento.

**Query Parameters:**
- `elemento`: ID del elemento

#### GET /materia/:id
Obtener datos de una materia específica.

#### GET /users
Obtener todos los usuarios.

## Notificaciones Push

El sistema utiliza Firebase Cloud Messaging para enviar notificaciones automáticas:

### Tipos de Notificaciones
- **Recordatorio de fecha límite**: 7 días antes del vencimiento
- **Fecha límite vencida**: Cuando pasa la fecha límite

### Configuración
- **Canal**: `competition_notifications`
- **Prioridad**: Alta
- **Sonido**: Por defecto
- **Vibración**: Por defecto

### Tareas Programadas
- **Cada hora**: Verificación de notificaciones
- **Cada 6 horas**: Verificación adicional
- **Al iniciar**: Verificación inicial (5 segundos después)

## Cron Jobs

```javascript

cron.schedule('0 * * * *', () => {
  checkAndSendNotifications();
});


cron.schedule('0 */6 * * *', () => {
  checkAndSendNotifications();
});
```

## Seguridad

- **Rate Limiting**: 1000 requests por 15 minutos
- **CORS**: Configurado para el frontend
- **Validación de Email**: Regex para validar formatos
- **Manejo de Errores**: Respuestas consistentes


## Manejo de Errores

Todas las respuestas siguen el formato:

```json
{
  "success": false,
  "message": "Descripción del error",
  "error": "Detalles técnicos (opcional)"
}
```

## Soporte

Para reportar problemas o solicitar nuevas funcionalidades, contactar al equipo de desarrollo.
ucb.app.dev@gmail.com

---

**Desarrollado para la Universidad Católica Boliviana** 
