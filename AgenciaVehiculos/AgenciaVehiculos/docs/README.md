# Base de datos de usuarios

Esta integración usa MySQL. La referencia a PostgreSQL en los requisitos contradice la indicación de usar MySQL; el esquema y el endpoint se han preparado para MySQL.

## Estructura del proyecto

```text
AgenciaVehiculos/
	src/
		server.js
		api/
	public/
		pages/
		css/
		js/
		img/
	database/
		schema.sql
	docs/
		README.md
	package.json
	.env
```

El servidor y los endpoints Express están en `src/`; las páginas y los recursos del navegador están en `public/`; el esquema MySQL se mantiene en `database/`.

## Preparación

1. Inicia Apache y MySQL en XAMPP.
2. Ejecuta `database/schema.sql` desde phpMyAdmin o desde el cliente `mysql`.
3. Instala Node.js y ejecuta `npm install` desde la carpeta del proyecto.
4. Copia `.env.example` a `.env` y ajusta `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD` según tu instalación.
5. Si ya tenías una tabla `vehiculos`, ejecuta `npm run db:migrate` para agregar los nuevos campos sin borrar los registros existentes.
6. Inicia el sitio con `npm start` o `npm run dev` desde la carpeta raíz del proyecto y ábrelo en `http://localhost:3000`.

## Páginas del portal

- Inicio: `/`
- Registrar vehículo: `/registrar`
- Vehículos nuevos: `/vehiculos-nuevos`
- Vehículos usados: `/vehiculos-usados`
- Nosotros: `/nosotros`
- Sucursales: `/sucursales`
- Iniciar sesión: `/login`
- Crear cuenta: `/registro`

## Contrato para el formulario de login

La API está implementada con Node.js y Express. Envía `POST` con `Content-Type: application/json` a `/api/usuarios/registro` con `nombre`, `correo` y `password`, o a `/api/usuarios/login` con `correo` y `password`.

Las respuestas son JSON con `ok` y `mensaje`. El registro devuelve `201`, correo duplicado `409`; el login devuelve `200` al validar las credenciales y `401` si no coinciden. Las contraseñas se guardan con bcrypt mediante `bcryptjs`, nunca en texto plano.

## Inventario de vehículos

El formulario y la tabla del inventario utilizan MySQL mediante estos endpoints Express:

- `GET /api/vehiculos`: lista vehículos y marcas.
- `GET /api/vehiculos?categoria=nuevo|usado`: filtra por tipo de vehículo.
- `POST /api/vehiculos`: registra un vehículo y genera su código secuencial según la sigla de la marca. Usa `multipart/form-data` para incluir una imagen JPG, PNG o WebP de hasta 5 MB.
- `PUT /api/vehiculos/:codigo`: actualiza los datos y opcionalmente la imagen de un vehículo.
- `DELETE /api/vehiculos/:codigo`: elimina el vehículo.

Los datos se guardan en las tablas `vehiculos` y `marcas` creadas por `database/schema.sql`. Ya no se utiliza `localStorage` como fuente del inventario. El middleware `cors` está habilitado para la API.