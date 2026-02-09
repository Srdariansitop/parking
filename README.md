Parking API es una aplicación backend desarrollada con Node.js y NestJS que expone una API RESTful para la gestión completa de un parking. Permite administrar usuarios, vehículos, plazas de aparcamiento y reservas, incorporando lógica de negocio para validar disponibilidad, controlar entradas y salidas, y registrar cancelaciones. La plataforma implementa autenticación basada en JWT y autorización por roles (admin, empleado, cliente), utilizando PostgreSQL y Prisma como base de datos principal para las entidades de negocio y MongoDB como sistema de logs para auditar las operaciones críticas del sistema.

![Portada del proyecto](img.jpg)

## 1. Requisitos previos

Antes de iniciar, asegúrate de tener instalado:

- Node.js (versión LTS recomendada, por ejemplo 18.x)
- npm o yarn
- PostgreSQL (para la base de datos principal de negocio)
- MongoDB (para el sistema de logs)
- Git (opcional, para clonar el repositorio)

---

## 2. Clonar el repositorio e instalar dependencias

```bash
git clone <URL_DE_TU_REPOSITORIO>
cd <nombre-del-proyecto>

# Instalar dependencias
npm install
# o
yarn install
```

---

## 3. Configuración de bases de datos

La aplicación utiliza **dos bases de datos**:

- **PostgreSQL**: base de datos principal para las entidades de negocio (User, Vehicle, ParkingSpot, Reservation), gestionada con **Prisma ORM**.
- **MongoDB**: base de datos secundaria para almacenar **logs** de los procesos críticos (reservas, cancelaciones, entradas, salidas, etc.).

### 3.1. Crear la base de datos en PostgreSQL

1. Inicia tu servidor de PostgreSQL.
2. Crea una base de datos (por ejemplo `parking_db`):

   ```sql
   CREATE DATABASE parking_db;
   ```

3. Asegúrate de tener un usuario y contraseña con permisos sobre esa base de datos.

### 3.2. Crear la base de datos en MongoDB

1. Inicia tu servidor de MongoDB (local o en la nube, por ejemplo Atlas).
2. Crea una base de datos para los logs (por ejemplo `parking_logs`).
3. Obtén la URL de conexión (por ejemplo: `mongodb://localhost:27017/parking_logs` o la cadena que te dé tu proveedor).

---

## 4. Configuración de variables de entorno (.env)

Las URLs de conexión **no se incluyen en el repositorio** por motivos de seguridad.  
Debes crear un archivo `.env` en la raíz del proyecto antes de ejecutar la aplicación.

Ejemplo de `.env` (ajusta valores según tu entorno):

```env
# URL de conexión a PostgreSQL (Prisma)
DATABASE_URL="postgresql://usuario:password@localhost:5432/parking_db?schema=public"

# URL de conexión a MongoDB para logs
MONGODB_URI="mongodb://localhost:27017/parking_logs"

```

> Importante:  
> - `DATABASE_URL` es usada por Prisma para conectarse a PostgreSQL.  
> - `MONGODB_URI` se utiliza en la capa de logs para registrar la actividad (reservas, cancelaciones, entradas, salidas, etc.).  
> - Estos valores **no deben subirse al repositorio**. `.env` debe estar en el `.gitignore`.

---

## 5. Esquema de datos (Prisma + PostgreSQL)

La base de datos principal está modelada con **Prisma** en el archivo `schema.prisma`.  
Se definen las siguientes entidades y relaciones:

- **Role** (enum): `admin`, `empleado`, `cliente`.
- **User**: datos del usuario, incluyendo `name`, `email`, `password`, `role`, `phone` (opcional) y relaciones con `reservations` y `vehicles`.
- **Vehicle**: vehículo asociado a un usuario (`userId`), con `plate` única.
- **ParkingSpot**: plaza de aparcamiento con `code` único, relacionada con `Reservation`.
- **Reservation**: reserva que relaciona `User`, `Vehicle` y `ParkingSpot`, con `startTime`, `endTime` y campos de auditoría (`createdAt`).

Esquema simplificado (ya implementado en tu proyecto):

```prisma
generator client {
  provider     = "prisma-client"
  output       = "../src/generated/prisma"
  moduleFormat = "cjs"
}

datasource db {
  provider = "postgresql"
}

enum Role {
  admin
  empleado
  cliente
}

model User {
  id           Int           @id @default(autoincrement())
  name         String
  email        String        @unique
  password     String
  role         Role
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  reservations Reservation[]
  vehicles     Vehicle[]
  phone        String?
}

model Vehicle {
  id           Int           @id @default(autoincrement())
  plate        String        @unique
  userId       Int
  user         User          @relation(fields: [userId], references: [id])
  reservations Reservation[]
}

model ParkingSpot {
  id           Int           @id @default(autoincrement())
  code         String        @unique
  reservations Reservation[]
}

model Reservation {
  id            Int          @id @default(autoincrement())
  startTime     DateTime
  endTime       DateTime
  userId        Int
  vehicleId     Int
  parkingSpotId Int

  user          User         @relation(fields: [userId], references: [id])
  vehicle       Vehicle      @relation(fields: [vehicleId], references: [id])
  parkingSpot   ParkingSpot  @relation(fields: [parkingSpotId], references: [id])

  createdAt     DateTime     @default(now())
}
```

Para aplicar el esquema en tu base de datos PostgreSQL:

```bash
npx prisma migrate dev --name init
# o
npx prisma db push
```

---

## 6. Inicialización de la base de datos de logs (MongoDB)

La parte de logs utiliza la URL `MONGODB_URI` desde el `.env`.  
Al iniciar la aplicación, se establece la conexión y se crean/usan las colecciones necesarias para registrar:

- Reservas creadas
- Reservas canceladas
- Entradas de vehículos
- Salidas de vehículos

No suele necesitar migraciones explícitas (MongoDB es no relacional), basta con que la URL sea válida y el servidor esté levantado.

---

## 7. Levantar la aplicación

Una vez configurado el `.env` y las bases de datos:

```bash
# Desarrollo
npm run start:dev
# o
yarn start:dev
```

La API quedará disponible en algo como:

- `http://localhost:3000`

(ajusta el puerto según tu `PORT`).

---

## 8. Endpoints principales y casos de uso

La API se estructura en controladores (NestJS) para cada entidad y para los casos de uso requeridos.

### 8.1. Parking spots (plazas de parking)

Controlador:

```ts
@Controller('parking-spots')
```

- CRUD completo para la entidad `ParkingSpot` (crear, listar, actualizar, eliminar plazas).
- Endpoint especial para ocupación actual del parking (Caso 2):

```ts
@Get('parking-spots/stats/occupancy')
```

Este endpoint calcula la ocupación del parking consultando las reservas vigentes y las plazas disponibles.

### 8.2. Users (usuarios)

Controlador:

```ts
@Controller('users')
```

- CRUD completo para `User`:
  - Crear usuario
  - Obtener usuarios / usuario por id
  - Actualizar datos del usuario (nombre, email, teléfono, etc.)
  - Eliminar usuario

Incluye lógica de autorización basada en roles para que solo perfiles adecuados (por ejemplo `admin`) puedan actualizar o gestionar otros usuarios.

### 8.3. Reservations (reservas)

Controlador:

```ts
@Controller('reservations')
```

- Crear reservas (Caso 1: reservar plaza de aparcamiento).
- Consultar reservas.
- Actualizar y cancelar reservas.

Endpoints específicos:

```ts
@Patch('reservations/:id/cancel')
```

- Permite cancelar una reserva.
- Registra el evento en MongoDB como log de actividad.

```ts
@Patch('reservations/:id/entry')
@Patch('reservations/:id/exit')
```

- `entry`: registra la entrada del vehículo al parking.
- `exit`: registra la salida del vehículo.
- Ambos endpoints generan logs en MongoDB y validan que la entrada/salida se produzca dentro del intervalo de la reserva (no se permite entrar fuera del rango de `startTime`–`endTime`).

### 8.4. Vehicles (vehículos)

Controlador:

```ts
@Controller('vehicles')
```

- CRUD de la entidad `Vehicle`:
  - Asociar vehículos a usuarios.
  - Listar vehículos.
  - Actualizar datos del vehículo.
  - Eliminar vehículos.

---

## 9. Autenticación y autorización

La aplicación implementa:

- **Autenticación JWT**:
  - El usuario se autentica (login) y obtiene un token JWT firmado con `JWT_SECRET`.
  - El token se envía en el header `Authorization: Bearer <token>` en las peticiones protegidas.

- **Autorización basada en roles**:
  - Roles definidos en el enum `Role`: `admin`, `empleado`, `cliente`.
  - Diferentes endpoints requieren permisos concretos:
    - `admin`: gestión de usuarios, acceso a logs, etc.
    - `empleado`: consulta de ocupación, operaciones internas.
    - `cliente`: creación y gestión de sus propias reservas, vehículos, etc.

---

## 10. Logs de actividad (MongoDB)

Cada operación crítica genera registros en la base de datos de logs (MongoDB):

- Creación de reservas
- Cancelación de reservas
- Entrada de vehículo (`entry`)
- Salida de vehículo (`exit`)

Los logs son accesibles mediante endpoints protegidos (por ejemplo, accesibles solo para `admin`) para cubrir el Caso 4 del enunciado (acceso a logs del parking).

---

## 11. Pruebas e2e

El proyecto incluye **pruebas end-to-end (e2e)** para los 4 casos de uso principales descritos en el enunciado.

Los tests se encuentran en la carpeta `test`:

- `users.e2e-spec.ts`: pruebas del flujo de usuarios (registro, login, actualización de datos, roles y permisos).  
- `reservations.e2e-spec.ts`: pruebas del flujo de reservas (creación de reserva, validación de plaza disponible, reglas de negocio básicas).  
- `parking-occupancy.e2e-spec.ts`: pruebas del endpoint de ocupación del parking (cálculo de plazas ocupadas/libres en función de las reservas activas).  
- `reservations-logs.e2e-spec.ts`: pruebas de los logs de actividad relacionados con reservas (cancelaciones, entradas y salidas de vehículos) y su persistencia en MongoDB.

Todos los tests se ejecutan con el comando:

```bash
npm run test:e2e
# o
yarn test:e2e
```
## Coleccion de EndPoints de Postamn
[Colección de Postman](https://dariantop-6090400.postman.co/workspace/Darian's-Workspace~6f2d23f7-9d66-4c15-80ec-2bcaa1cb7c72/collection/50102764-d8a23ce6-afed-4bfe-b0eb-6239587f7ac3?action=share&source=copy-link&creator=50102764)
