const pool = require('../src/api/db');

const columnas = {
  id: 'ADD COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE FIRST',
  marca: 'ADD COLUMN marca VARCHAR(80) NULL AFTER codigo',
  transmision: "ADD COLUMN transmision ENUM('Automática', 'Manual', 'CVT', 'Doble embrague', 'Otra') NOT NULL DEFAULT 'Automática' AFTER color",
  imagen: 'ADD COLUMN imagen VARCHAR(500) NULL AFTER descripcion',
  categoria: "ADD COLUMN categoria ENUM('nuevo', 'usado') NOT NULL DEFAULT 'nuevo' AFTER imagen",
};

async function migrar() {
  const [existentes] = await pool.query('SHOW COLUMNS FROM vehiculos');
  const nombres = new Set(existentes.map((columna) => columna.Field));

  for (const [nombre, definicion] of Object.entries(columnas)) {
    if (!nombres.has(nombre)) {
      await pool.query(`ALTER TABLE vehiculos ${definicion}`);
      console.log(`Columna agregada: ${nombre}`);
    }
  }

  await pool.query(
    `UPDATE vehiculos v
     INNER JOIN marcas m ON m.id = v.marca_id
     SET v.marca = m.nombre
     WHERE v.marca IS NULL OR v.marca = ''`
  );
  await pool.query('ALTER TABLE vehiculos MODIFY COLUMN marca VARCHAR(80) NOT NULL');

  console.log('Migración de vehículos completada. Los registros existentes se conservaron.');
}

migrar()
  .catch((error) => {
    console.error('No se pudo migrar la tabla vehiculos:', error.code || error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());