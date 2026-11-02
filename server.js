require('dotenv').config();

const express = require('express');
const path = require('path');
const usuariosRouter = require('./api/usuarios');
const vehiculosRouter = require('./api/vehiculos');

const app = express();
const port = Number(process.env.PORT || 3000);

app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));
app.use('/api/usuarios', usuariosRouter);
app.use('/api/vehiculos', vehiculosRouter);
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/registrar', (req, res) => res.sendFile(path.join(__dirname, 'registrar.html')));
app.get('/inventario', (req, res) => res.sendFile(path.join(__dirname, 'inventario.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/registro', (req, res) => res.sendFile(path.join(__dirname, 'registro.html')));
app.get('/registrar.html', (req, res) => res.redirect(301, `/registrar${req.url.slice('/registrar.html'.length)}`));
app.get('/inventario.html', (req, res) => res.redirect(301, `/inventario${req.url.slice('/inventario.html'.length)}`));
app.get('/login.html', (req, res) => res.redirect(301, `/login${req.url.slice('/login.html'.length)}`));
app.get('/registro.html', (req, res) => res.redirect(301, `/registro${req.url.slice('/registro.html'.length)}`));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/img', express.static(path.join(__dirname, 'img')));

app.use((error, req, res, next) => {
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, mensaje: 'El cuerpo debe ser JSON válido.' });
  }

  console.error(error);
  return res.status(500).json({ ok: false, mensaje: 'Error interno del servidor.' });
});

app.listen(port, () => {
  console.log(`AutoMax disponible en http://localhost:${port}`);
});