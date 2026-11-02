// Login y registro usan páginas independientes.

var SESION = "automax_sesion";

var formLogin = document.getElementById("formLogin");
var formRegistro = document.getElementById("formRegistro");
var caja = document.getElementById("mensaje");

if (location.protocol === "file:") {
  location.replace("http://localhost:3000" + (formRegistro ? "/registro" : "/login"));
}

// Solo los usuarios registrados con sesión abierta regresan al portal.
var sesionActual = null;
try {
  sesionActual = JSON.parse(sessionStorage.getItem(SESION));
} catch (e) {
  sessionStorage.removeItem(SESION);
}
if (sesionActual && sesionActual.tipo === "usuario") {
  location.replace("/");
}

function mostrar(texto, bien) {
  caja.hidden = false;
  caja.textContent = texto;
  caja.className = "mensaje " + (bien ? "bien" : "mal");
}

// Manda los datos al servidor y devuelve la respuesta ya convertida
function enviar(ruta, datos) {
  return fetch(ruta, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos)
  }).then(function (r) { return r.json(); });
}

function falloDeRed() {
  mostrar("No se pudo conectar con el servidor. Inicia con 'npm start' y abre http://localhost:3000", false);
}

/* ---------- Iniciar sesión ---------- */
if (formLogin) formLogin.addEventListener("submit", function (e) {
  e.preventDefault();
  var boton = formLogin.querySelector("button");
  boton.disabled = true;

  enviar("/api/usuarios/login", {
    correo: document.getElementById("lCorreo").value,
    password: document.getElementById("lPass").value
  }).then(function (resp) {
    mostrar(resp.mensaje, resp.ok);
    if (resp.ok) {
      sessionStorage.setItem(SESION, JSON.stringify({ tipo: "usuario", nombre: resp.usuario.nombre }));
      setTimeout(function () { location.href = "/index.html"; }, 900); // se alcanza a leer el mensaje
    }
  }).catch(falloDeRed).then(function () { boton.disabled = false; });
});

/* ---------- Crear cuenta ---------- */
if (formRegistro) formRegistro.addEventListener("submit", function (e) {
  e.preventDefault();

  var pass = document.getElementById("rPass").value;
  if (pass.length < 8) {
    mostrar("La contraseña debe tener al menos 8 caracteres.", false);
    return;
  }
  if (pass !== document.getElementById("rPass2").value) {
    mostrar("Las contraseñas no coinciden.", false);
    return;
  }

  var boton = formRegistro.querySelector("button");
  boton.disabled = true;

  enviar("/api/usuarios/registro", {
    nombre: document.getElementById("rNombre").value,
    correo: document.getElementById("rCorreo").value,
    password: pass
  }).then(function (resp) {
    if (resp.ok) {
      formRegistro.reset();
      setTimeout(function () { location.href = "/login"; }, 900);
    }
    mostrar(resp.mensaje, resp.ok);
  }).catch(falloDeRed).then(function () { boton.disabled = false; });
});

/* ---------- Invitado ---------- */
var btnInvitado = document.getElementById("btnInvitado");
if (btnInvitado) btnInvitado.addEventListener("click", function () {
  sessionStorage.setItem(SESION, JSON.stringify({ tipo: "invitado", nombre: "Invitado" }));
  location.href = "/inventario.html";
});