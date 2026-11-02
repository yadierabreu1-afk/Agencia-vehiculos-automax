require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const usuariosRouter = require('./api/usuarios');
const vehiculosRouter = require('./api/vehiculos');

const app = express();
const port = Number(process.env.PORT || 3000);
const publicDirectory = path.join(__dirname, '..', 'public');
const pagesDirectory = path.join(publicDirectory, 'pages');

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use('/api/usuarios', usuariosRouter);
app.use('/api/vehiculos', vehiculosRouter);
app.get('/', (req, res) => res.sendFile(path.join(pagesDirectory, 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(pagesDirectory, 'index.html')));
app.get('/registrar', (req, res) => res.sendFile(path.join(pagesDirectory, 'registrar.html')));
app.get('/inventario', (req, res) => res.sendFile(path.join(pagesDirectory, 'inventario.html')));
app.get('/login', (req, res) => res.sendFile(path.join(pagesDirectory, 'login.html')));
app.get('/registro', (req, res) => res.sendFile(path.join(pagesDirectory, 'registro.html')));
app.get('/vehiculos-nuevos', (req, res) => res.sendFile(path.join(pagesDirectory, 'inventario.html')));
app.get('/vehiculos-usados', (req, res) => res.sendFile(path.join(pagesDirectory, 'inventario.html')));
app.get('/nosotros', (req, res) => res.sendFile(path.join(pagesDirectory, 'nosotros.html')));
app.get('/sucursales', (req, res) => res.sendFile(path.join(pagesDirectory, 'sucursales.html')));
app.get('/registrar.html', (req, res) => res.redirect(301, `/registrar${req.url.slice('/registrar.html'.length)}`));
app.get('/inventario.html', (req, res) => res.redirect(301, `/inventario${req.url.slice('/inventario.html'.length)}`));
app.get('/login.html', (req, res) => res.redirect(301, `/login${req.url.slice('/login.html'.length)}`));
app.get('/registro.html', (req, res) => res.redirect(301, `/registro${req.url.slice('/registro.html'.length)}`));
app.use('/css', express.static(path.join(publicDirectory, 'css')));
app.use('/js', express.static(path.join(publicDirectory, 'js')));
app.use('/img', express.static(path.join(publicDirectory, 'img')));
app.use('/uploads', express.static(path.join(publicDirectory, 'uploads')));

app.use((error, req, res, next) => {
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, mensaje: 'El cuerpo debe ser JSON válido.' });
  }
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ ok: false, mensaje: 'La imagen no puede superar 5 MB.' });
  }
  if (error.code === 'UNSUPPORTED_IMAGE') {
    return res.status(400).json({ ok: false, mensaje: error.message });
  }

  console.error(error);
  return res.status(500).json({ ok: false, mensaje: 'Error interno del servidor.' });
});

app.listen(port, () => {
  console.log(`AutoMax disponible en http://localhost:${port}`);
});