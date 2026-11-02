const express = require('express');
const pool = require('./db');

const router = express.Router();
const combustibles = ['Gasolina', 'Diésel', 'Híbrido', 'Eléctrico', 'Gas (GLP)'];

function validarVehiculo(datos) {
  if (!datos || typeof datos !== 'object') return 'Datos de vehículo no válidos.';

  const texto = ['marca', 'modelo', 'color', 'combustible', 'descripcion'];
  if (texto.some((campo) => typeof datos[campo] !== 'string')) {
    return 'Completa todos los campos del vehículo.';
  }

  if (
    !datos.marca.trim() || datos.modelo.trim().length > 120 || !datos.modelo.trim() ||
    datos.color.trim().length > 60 || !datos.color.trim() ||
    !combustibles.includes(datos.combustible) || !datos.descripcion.trim()
  ) {
    return 'Revisa la marca, el modelo, el color y el combustible.';
  }

  const anio = Number(datos.anio);
  const precio = Number(datos.precio);
  const cantidad = Number(datos.cantidad);
  if (!Number.isInteger(anio) || anio < 1900 || anio > new Date().getFullYear()) {
    return 'El año del vehículo no es válido.';
  }
  if (!Number.isFinite(precio) || precio <= 0) return 'El precio debe ser mayor que cero.';
  if (!Number.isInteger(cantidad) || cantidad < 0) return 'La cantidad debe ser un entero igual o mayor que cero.';

  return null;
}

router.get('/', async (req, res) => {
  try {
    const [vehiculos] = await pool.execute(
      `SELECT v.codigo, m.nombre AS marca, v.modelo, v.anio, v.color,
              v.combustible, v.precio, v.cantidad, v.descripcion
       FROM vehiculos v
       INNER JOIN marcas m ON m.id = v.marca_id
       ORDER BY v.fecha_registro DESC, v.codigo DESC`
    );

    return res.json({
      ok: true,
      vehiculos: vehiculos.map((vehiculo) => ({
        ...vehiculo,
        anio: Number(vehiculo.anio),
        precio: Number(vehiculo.precio),
        cantidad: Number(vehiculo.cantidad),
      })),
    });
  } catch (error) {
    return responderError(res, error);
  }
});

router.post('/', async (req, res) => {
  const datos = req.body;
  const errorValidacion = validarVehiculo(datos);
  if (errorValidacion) return res.status(400).json({ ok: false, mensaje: errorValidacion });

  let conexion;
  try {
    conexion = await pool.getConnection();
    await conexion.beginTransaction();
    const [marcas] = await conexion.execute(
      'SELECT id, sigla FROM marcas WHERE nombre = ? FOR UPDATE',
      [datos.marca.trim()]
    );
    if (marcas.length === 0) {
      await conexion.rollback();
      return res.status(400).json({ ok: false, mensaje: 'La marca seleccionada no existe.' });
    }

    const marca = marcas[0];
    const [maximos] = await conexion.execute(
      `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(codigo, '-', -1) AS UNSIGNED)), 0) AS mayor
       FROM vehiculos WHERE marca_id = ?`,
      [marca.id]
    );
    const codigo = marca.sigla + '-' + String(Number(maximos[0].mayor) + 1).padStart(3, '0');

    await conexion.execute(
      `INSERT INTO vehiculos
         (codigo, marca_id, modelo, anio, color, combustible, precio, cantidad, descripcion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [codigo, marca.id, datos.modelo.trim(), Number(datos.anio), datos.color.trim(),
        datos.combustible, Number(datos.precio), Number(datos.cantidad), datos.descripcion.trim()]
    );
    await conexion.commit();

    return res.status(201).json({
      ok: true,
      mensaje: `Vehículo ${codigo} registrado en la base de datos.`,
      codigo,
    });
  } catch (error) {
    if (conexion) await conexion.rollback();
    return responderError(res, error);
  } finally {
    if (conexion) conexion.release();
  }
});

router.put('/:codigo', async (req, res) => {
  const datos = req.body;
  const errorValidacion = validarVehiculo(datos);
  if (errorValidacion) return res.status(400).json({ ok: false, mensaje: errorValidacion });

  try {
    const [marcas] = await pool.execute('SELECT id, sigla FROM marcas WHERE nombre = ?', [datos.marca.trim()]);
    if (marcas.length === 0 || !req.params.codigo.startsWith(marcas[0].sigla + '-')) {
      return res.status(400).json({ ok: false, mensaje: 'No se puede cambiar la marca de un vehículo ya registrado.' });
    }

    const [resultado] = await pool.execute(
      `UPDATE vehiculos
       SET modelo = ?, anio = ?, color = ?, combustible = ?, precio = ?, cantidad = ?, descripcion = ?
       WHERE codigo = ? AND marca_id = ?`,
      [datos.modelo.trim(), Number(datos.anio), datos.color.trim(), datos.combustible,
        Number(datos.precio), Number(datos.cantidad), datos.descripcion.trim(), req.params.codigo, marcas[0].id]
    );
    if (resultado.affectedRows === 0) {
      const [existentes] = await pool.execute('SELECT codigo FROM vehiculos WHERE codigo = ?', [req.params.codigo]);
      if (existentes.length === 0) return res.status(404).json({ ok: false, mensaje: 'No se encontró el vehículo.' });
    }

    return res.json({ ok: true, mensaje: `Cambios guardados en ${req.params.codigo}.` });
  } catch (error) {
    return responderError(res, error);
  }
});

router.delete('/:codigo', async (req, res) => {
  try {
    const [resultado] = await pool.execute('DELETE FROM vehiculos WHERE codigo = ?', [req.params.codigo]);
    if (resultado.affectedRows === 0) return res.status(404).json({ ok: false, mensaje: 'No se encontró el vehículo.' });
    return res.json({ ok: true, mensaje: `Vehículo ${req.params.codigo} eliminado.` });
  } catch (error) {
    return responderError(res, error);
  }
});

function responderError(res, error) {
  console.error(error.code || error.message);
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ ok: false, mensaje: 'Ya existe un vehículo con ese código.' });
  }
  if (['ECONNREFUSED', 'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR', 'ER_NO_SUCH_TABLE'].includes(error.code)) {
    return res.status(503).json({
      ok: false,
      mensaje: 'No se pudo acceder a las tablas MySQL. Revisa DB_* en .env e importa database/schema.sql.',
    });
  }
  return res.status(500).json({ ok: false, mensaje: 'No se pudo completar la operación de vehículos.' });
}

module.exports = router;