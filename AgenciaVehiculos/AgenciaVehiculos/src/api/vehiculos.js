const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const pool = require('./db');

const router = express.Router();
const combustibles = ['Gasolina', 'Diésel', 'Híbrido', 'Eléctrico', 'Gas (GLP)'];
const transmisiones = ['Automática', 'Manual', 'CVT', 'Doble embrague', 'Otra'];
const categorias = ['nuevo', 'usado'];
const directorioImagenes = path.join(__dirname, '..', '..', 'public', 'uploads');
const extensionesImagen = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

fs.mkdirSync(directorioImagenes, { recursive: true });

const subirImagen = multer({
  storage: multer.diskStorage({
    destination: directorioImagenes,
    filename: (req, file, callback) => callback(null, crypto.randomUUID() + extensionesImagen[file.mimetype]),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (!extensionesImagen[file.mimetype]) {
      const error = new Error('La imagen debe ser JPG, PNG o WebP.');
      error.code = 'UNSUPPORTED_IMAGE';
      return callback(error);
    }
    return callback(null, true);
  },
});

function rutaImagen(file) {
  return file ? '/uploads/' + file.filename : null;
}

function eliminarImagen(ruta) {
  if (!ruta || !ruta.startsWith('/uploads/')) return Promise.resolve();
  return fs.promises.unlink(path.join(directorioImagenes, path.basename(ruta))).catch(() => {});
}

function validarVehiculo(datos) {
  if (!datos || typeof datos !== 'object') return 'Datos de vehículo no válidos.';

  const texto = ['marca', 'modelo', 'color', 'combustible', 'transmision', 'categoria', 'descripcion'];
  if (texto.some((campo) => typeof datos[campo] !== 'string')) {
    return 'Completa todos los campos del vehículo.';
  }

  if (
    !datos.marca.trim() || datos.modelo.trim().length > 120 || !datos.modelo.trim() ||
    datos.color.trim().length > 60 || !datos.color.trim() ||
    !combustibles.includes(datos.combustible) || !transmisiones.includes(datos.transmision) ||
    !categorias.includes(datos.categoria) || !datos.descripcion.trim()
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
  const categoria = req.query.categoria;
  if (categoria && !categorias.includes(categoria)) {
    return res.status(400).json({ ok: false, mensaje: 'La categoría debe ser nuevo o usado.' });
  }

  try {
    const [vehiculos] = await pool.execute(
      `SELECT v.id, v.codigo, v.marca, v.modelo, v.anio, v.precio, v.color,
              v.transmision, v.combustible, v.descripcion, v.imagen, v.categoria,
              v.cantidad, v.fecha_registro
       FROM vehiculos v
       INNER JOIN marcas m ON m.id = v.marca_id
       WHERE (? IS NULL OR v.categoria = ?)
      ORDER BY v.fecha_registro DESC, v.codigo DESC`,
      [categoria || null, categoria || null]
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

router.post('/', subirImagen.single('imagen'), async (req, res) => {
  const datos = req.body;
  const errorValidacion = validarVehiculo(datos);
  if (errorValidacion) {
    await eliminarImagen(rutaImagen(req.file));
    return res.status(400).json({ ok: false, mensaje: errorValidacion });
  }

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
      await eliminarImagen(rutaImagen(req.file));
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
        (codigo, marca, marca_id, modelo, anio, precio, color, transmision, combustible,
          descripcion, imagen, categoria, cantidad)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [codigo, datos.marca.trim(), marca.id, datos.modelo.trim(), Number(datos.anio), Number(datos.precio),
        datos.color.trim(), datos.transmision, datos.combustible, datos.descripcion.trim(),
        rutaImagen(req.file), datos.categoria, Number(datos.cantidad)]
    );
    await conexion.commit();

    return res.status(201).json({
      ok: true,
      mensaje: `Vehículo ${codigo} registrado en la base de datos.`,
      codigo,
    });
  } catch (error) {
    if (conexion) await conexion.rollback();
    await eliminarImagen(rutaImagen(req.file));
    return responderError(res, error);
  } finally {
    if (conexion) conexion.release();
  }
});

router.put('/:codigo', subirImagen.single('imagen'), async (req, res) => {
  const datos = req.body;
  const errorValidacion = validarVehiculo(datos);
  if (errorValidacion) {
    await eliminarImagen(rutaImagen(req.file));
    return res.status(400).json({ ok: false, mensaje: errorValidacion });
  }

  try {
    const [actuales] = await pool.execute(
      `SELECT v.imagen, v.marca_id, m.sigla
       FROM vehiculos v INNER JOIN marcas m ON m.id = v.marca_id
       WHERE v.codigo = ?`,
      [req.params.codigo]
    );
    if (actuales.length === 0) {
      await eliminarImagen(rutaImagen(req.file));
      return res.status(404).json({ ok: false, mensaje: 'No se encontró el vehículo.' });
    }

    const [marcas] = await pool.execute('SELECT id, sigla FROM marcas WHERE nombre = ?', [datos.marca.trim()]);
    if (marcas.length === 0 || marcas[0].id !== actuales[0].marca_id ||
        !req.params.codigo.startsWith(marcas[0].sigla + '-')) {
      await eliminarImagen(rutaImagen(req.file));
      return res.status(400).json({ ok: false, mensaje: 'No se puede cambiar la marca de un vehículo ya registrado.' });
    }

    await pool.execute(
      `UPDATE vehiculos
         SET marca = ?, modelo = ?, anio = ?, precio = ?, color = ?, transmision = ?, combustible = ?,
           descripcion = ?, imagen = COALESCE(?, imagen), categoria = ?, cantidad = ?
       WHERE codigo = ? AND marca_id = ?`,
        [datos.marca.trim(), datos.modelo.trim(), Number(datos.anio), Number(datos.precio), datos.color.trim(),
        datos.transmision, datos.combustible, datos.descripcion.trim(), rutaImagen(req.file),
        datos.categoria, Number(datos.cantidad), req.params.codigo, marcas[0].id]
    );
    if (req.file) await eliminarImagen(actuales[0].imagen);

    return res.json({ ok: true, mensaje: `Cambios guardados en ${req.params.codigo}.` });
  } catch (error) {
    await eliminarImagen(rutaImagen(req.file));
    return responderError(res, error);
  }
});

router.delete('/:codigo', async (req, res) => {
  try {
    const [actuales] = await pool.execute('SELECT imagen FROM vehiculos WHERE codigo = ?', [req.params.codigo]);
    if (actuales.length === 0) return res.status(404).json({ ok: false, mensaje: 'No se encontró el vehículo.' });

    const [resultado] = await pool.execute('DELETE FROM vehiculos WHERE codigo = ?', [req.params.codigo]);
    if (resultado.affectedRows === 0) return res.status(404).json({ ok: false, mensaje: 'No se encontró el vehículo.' });
    await eliminarImagen(actuales[0].imagen);
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