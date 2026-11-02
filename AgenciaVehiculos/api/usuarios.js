const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('./db');

const router = express.Router();
const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const erroresMySQL = ['ECONNREFUSED', 'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR', 'ER_NO_SUCH_TABLE'];

function responderError(res, error) {
  console.error(error.code || error.message);

  if (erroresMySQL.includes(error.code)) {
    return res.status(503).json({
      ok: false,
      mensaje: 'No se pudo acceder a MySQL. Inicia MySQL, importa database/schema.sql y revisa las variables DB_* del archivo .env.',
    });
  }

  return res.status(500).json({ ok: false, mensaje: 'No se pudo completar la operación.' });
}

router.post('/registro', async (req, res) => {
  const { nombre, correo, password } = req.body || {};

  if (typeof nombre !== 'string' || typeof correo !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ ok: false, mensaje: 'Nombre, correo o contraseña no válidos.' });
  }

  const nombreNormalizado = nombre.trim();
  const correoNormalizado = correo.trim().toLowerCase();
  if (
    !nombreNormalizado || [...nombreNormalizado].length > 120 ||
    [...correoNormalizado].length > 254 || !correoValido.test(correoNormalizado) ||
    [...password].length < 8
  ) {
    return res.status(400).json({
      ok: false,
      mensaje: 'Revisa el nombre, el correo y la contraseña (mínimo 8 caracteres).',
    });
  }

  try {
    const hash = await bcrypt.hash(password, 12);
    await pool.execute(
      'INSERT INTO usuarios (nombre, correo, password) VALUES (?, ?, ?)',
      [nombreNormalizado, correoNormalizado, hash]
    );

    return res.status(201).json({ ok: true, mensaje: 'Usuario registrado correctamente.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ ok: false, mensaje: 'Ya existe una cuenta con ese correo.' });
    }

    return responderError(res, error);
  }
});

router.post('/login', async (req, res) => {
  const { correo, password } = req.body || {};

  if (typeof correo !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ ok: false, mensaje: 'Correo o contraseña no válidos.' });
  }

  const correoNormalizado = correo.trim().toLowerCase();
  if (!correoValido.test(correoNormalizado) || [...correoNormalizado].length > 254 || !password) {
    return res.status(400).json({ ok: false, mensaje: 'Correo o contraseña no válidos.' });
  }

  try {
    const [usuarios] = await pool.execute(
      'SELECT nombre, password FROM usuarios WHERE correo = ? LIMIT 1',
      [correoNormalizado]
    );
    const coincide = usuarios.length > 0 && await bcrypt.compare(password, usuarios[0].password);

    if (!coincide) {
      return res.status(401).json({ ok: false, mensaje: 'Correo o contraseña incorrectos.' });
    }

    return res.status(200).json({
      ok: true,
      mensaje: 'Acceso correcto.',
      usuario: { nombre: usuarios[0].nombre },
    });
  } catch (error) {
    return responderError(res, error);
  }
});

module.exports = router;