# Base de datos de usuarios

Esta integración usa MySQL. La referencia a PostgreSQL en los requisitos contradice la indicación de usar MySQL; el esquema y el endpoint se han preparado para MySQL.

## Preparación

1. Inicia Apache y MySQL en XAMPP.
2. Ejecuta `database/schema.sql` desde phpMyAdmin o desde el cliente `mysql`.
3. Instala Node.js y ejecuta `npm install` desde la carpeta del proyecto.
4. Copia `.env.example` a `.env` y ajusta `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD` según tu instalación. Los valores predeterminados corresponden a una instalación local típica de XAMPP; no los uses como configuración de producción.
5. Inicia el sitio con `npm run dev` y ábrelo en `http://localhost:3000`.

## Páginas del portal

- Inicio: `/`
- Registrar vehículo: `/registrar`
- Inventario: `/inventario`
- Iniciar sesión: `/login`
- Crear cuenta: `/registro`

## Contrato para el formulario de login

La API está implementada con Node.js y Express. Envía `POST` con `Content-Type: application/json` a `/api/usuarios/registro` con `nombre`, `correo` y `password`, o a `/api/usuarios/login` con `correo` y `password`.

Las respuestas son JSON con `ok` y `mensaje`. El registro devuelve `201`, correo duplicado `409`; el login devuelve `200` al validar las credenciales y `401` si no coinciden. Las contraseñas se guardan con bcrypt mediante `bcryptjs`, nunca en texto plano.

## Inventario de vehículos

El formulario y la tabla del inventario utilizan MySQL mediante estos endpoints Express:

- `GET /api/vehiculos`: lista vehículos y marcas.
- `POST /api/vehiculos`: registra un vehículo y genera su código secuencial según la sigla de la marca.
- `PUT /api/vehiculos/:codigo`: actualiza los datos de un vehículo.
- `DELETE /api/vehiculos/:codigo`: elimina el vehículo.

Los datos se guardan en las tablas `vehiculos` y `marcas` creadas por `database/schema.sql`. Ya no se utiliza `localStorage` como fuente del inventario. Si la API indica que faltan tablas, vuelve a ejecutar el esquema en la base indicada por `DB_NAME` en `.env`.