// AutoMax - control de vehículos nuevos conectado a la API MySQL.
var anioActual = new Date().getFullYear();

// Marcas permitidas y su prefijo para el código (FR-001, BM-002...)
// Si hay que agregar otra, se agrega aquí y se actualizan sola las listas.
var MARCAS = [
  { nombre: "Toyota", sigla: "TY" },
  { nombre: "Honda", sigla: "HN" },
  { nombre: "Ford", sigla: "FD" },
  { nombre: "Chevrolet", sigla: "CV" },
  { nombre: "Nissan", sigla: "NS" },
  { nombre: "Hyundai", sigla: "HY" },
  { nombre: "Kia", sigla: "KA" },
  { nombre: "Volkswagen", sigla: "VW" },
  { nombre: "Mercedes-Benz", sigla: "MB" },
  { nombre: "BMW", sigla: "BM" },
  { nombre: "Audi", sigla: "AU" },
  { nombre: "Tesla", sigla: "TS" },
  { nombre: "Porsche", sigla: "PR" },
  { nombre: "Ferrari", sigla: "FR" },
  { nombre: "Lamborghini", sigla: "LB" }
];

var form = document.getElementById("formVehiculo");
var tbody = document.getElementById("listaVehiculos");
var msgVacio = document.getElementById("vacio");
var campoAnio = document.getElementById("anio");
if (campoAnio) campoAnio.max = anioActual;
var btnGuardar = document.getElementById("btnGuardar");
var btnCancelar = document.getElementById("btnCancelar");
var tituloForm = document.getElementById("tituloForm");
var campoMarca = document.getElementById("marca");
var campoCodigo = document.getElementById("codigo");
var btnCerrarSesion = document.getElementById("btnCerrarSesion");

// ids de los campos, en el mismo orden del formulario
var campos = ["marca", "codigo", "modelo", "anio", "color", "combustible", "precio", "cantidad", "descripcion"];

var vehiculos = [];
var codigoEditando = null; // si tiene valor, estamos modificando ese vehículo

/* ---------- API y base de datos ---------- */

function pedirApi(ruta, opciones) {
  return fetch(ruta, opciones).then(async function (respuesta) {
    var resultado = await respuesta.json();
    if (!respuesta.ok || !resultado.ok) {
      throw new Error(resultado.mensaje || "No se pudo completar la operación.");
    }
    return resultado;
  });
}

function cargarDesdeApi() {
  return pedirApi("/api/vehiculos")
    .then(function (resultado) {
      vehiculos = resultado.vehiculos;
      pintar();
    })
    .catch(function (error) {
      vehiculos = [];
      pintar();
      avisar(error.message || "No se pudieron cargar los vehículos de la base de datos.");
    });
}

/* ---------- Marcas y códigos ---------- */

function siglaDe(nombre) {
  var m = MARCAS.find(function (x) { return x.nombre === nombre; });
  return m ? m.sigla : "";
}

// Busca el número más alto que ya existe para esa sigla y le suma 1.
// Se usa el mayor (no la cantidad) para que al borrar uno no se repita un código.
function siguienteCodigo(marca) {
  var sigla = siglaDe(marca);
  if (!sigla) return "";

  var mayor = 0;
  vehiculos.forEach(function (v) {
    var partes = v.codigo.split("-");
    if (partes[0] === sigla) {
      var n = parseInt(partes[1], 10);
      if (n > mayor) mayor = n;
    }
  });

  var texto = String(mayor + 1);
  while (texto.length < 3) texto = "0" + texto; // 1 -> 001
  return sigla + "-" + texto;
}

// Llena los selects de marca (formulario y filtro) y las placas de la portada
function armarMarcas() {
  if (campoMarca) campoMarca.innerHTML = '<option value="">Selecciona una marca</option>';
  var filtroMarca = document.getElementById("fMarca");
  if (filtroMarca) filtroMarca.innerHTML = '<option value="">Todas</option>';
  var placas = document.getElementById("listaPlacas");

  MARCAS.forEach(function (m) {
    if (campoMarca) campoMarca.innerHTML += '<option>' + m.nombre + '</option>';
    if (filtroMarca) filtroMarca.innerHTML += '<option>' + m.nombre + '</option>';
    if (placas) placas.innerHTML += '<li><span class="placa">' + m.sigla + '</span>' + m.nombre + '</li>';
  });
}

/* ---------- Validaciones ---------- */

function ponerError(id, texto) {
  var caja = document.getElementById(id).closest(".campo");
  caja.classList.toggle("malo", texto !== "");
  caja.querySelector(".error").textContent = texto;
}

function validar(datos) {
  var ok = true;

  // limpiamos errores anteriores
  campos.forEach(function (id) { ponerError(id, ""); });

  // 1) todos obligatorios
  campos.forEach(function (id) {
    if (datos[id] === "") {
      ponerError(id, id === "codigo" ? "Se genera al elegir la marca." : "Este campo es obligatorio.");
      ok = false;
    }
  });

  // 2) la marca tiene que ser una de la lista
  if (datos.marca !== "" && siglaDe(datos.marca) === "") {
    ponerError("marca", "Elige una marca de la lista.");
    ok = false;
  }

  // 3) código no repetido (por seguridad, aunque se genera solo)
  if (datos.codigo !== "" && codigoEditando === null) {
    var repetido = vehiculos.some(function (v) { return v.codigo === datos.codigo; });
    if (repetido) {
      ponerError("codigo", "Ese código ya está registrado.");
      ok = false;
    }
  }

  // 4) año válido (entero, entre 1900 y el año actual)
  if (datos.anio !== "") {
    var a = Number(datos.anio);
    if (!Number.isInteger(a) || a < 1900 || a > anioActual) {
      ponerError("anio", "Escribe un año entre 1900 y " + anioActual + ".");
      ok = false;
    }
  }

  // 5) precio mayor que cero
  if (datos.precio !== "") {
    var p = Number(datos.precio);
    if (isNaN(p) || p <= 0) {
      ponerError("precio", "El precio debe ser mayor que cero.");
      ok = false;
    }
  }

  // 6) cantidad numérica (entera, 0 o más)
  if (datos.cantidad !== "") {
    var c = Number(datos.cantidad);
    if (isNaN(c) || !Number.isInteger(c) || c < 0) {
      ponerError("cantidad", "La cantidad debe ser un número entero.");
      ok = false;
    }
  }

  return ok;
}

/* ---------- Filtros ---------- */

function textoPlano(t) {
  // minúsculas y sin tildes, para que "diesel" encuentre "Diésel"
  return String(t).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function filtrar() {
  var buscar = textoPlano(document.getElementById("fBuscar").value.trim());
  var marca = document.getElementById("fMarca").value;
  var comb = document.getElementById("fComb").value;
  var min = document.getElementById("fMin").value;
  var max = document.getElementById("fMax").value;
  var orden = document.getElementById("fOrden").value;

  var lista = vehiculos.filter(function (v) {
    if (marca && v.marca !== marca) return false;
    if (comb && v.combustible !== comb) return false;
    if (min !== "" && v.precio < Number(min)) return false;
    if (max !== "" && v.precio > Number(max)) return false;

    if (buscar) {
      var pajar = textoPlano(v.codigo + " " + v.marca + " " + v.modelo + " " + v.color + " " + v.anio);
      if (pajar.indexOf(buscar) === -1) return false;
    }
    return true;
  });

  if (orden === "precioAsc") lista.sort(function (a, b) { return a.precio - b.precio; });
  if (orden === "precioDesc") lista.sort(function (a, b) { return b.precio - a.precio; });
  if (orden === "anioDesc") lista.sort(function (a, b) { return b.anio - a.anio; });

  return lista;
}

function limpiarFiltros() {
  ["fBuscar", "fMarca", "fComb", "fMin", "fMax"].forEach(function (id) {
    document.getElementById(id).value = "";
  });
  document.getElementById("fOrden").value = "registro";
  pintar();
}

/* ---------- Pintar la tabla ---------- */

function dinero(n) {
  return "US$ " + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Si el color es un nombre que el navegador entiende (red, blue...) mostramos la pastilla
function pastilla(color) {
  var prueba = new Option().style;
  prueba.color = color;
  if (prueba.color === "") return "";
  return '<span class="chip-color" style="background:' + color + '"></span>';
}

// Evita que un texto con < o > rompa la tabla
function limpio(texto) {
  var d = document.createElement("div");
  d.textContent = texto;
  return d.innerHTML;
}

function pintar() {
  if (tbody) {
    var lista = filtrar();
    tbody.innerHTML = "";

    lista.forEach(function (v) {
      var fila = document.createElement("tr");
      fila.innerHTML =
        '<td><span class="placa">' + limpio(v.codigo) + "</span></td>" +
        "<td>" + limpio(v.marca) + "</td>" +
        "<td>" + limpio(v.modelo) + "<small>" + limpio(v.descripcion) + "</small></td>" +
        "<td>" + v.anio + "</td>" +
        "<td>" + pastilla(v.color) + limpio(v.color) + "</td>" +
        "<td>" + limpio(v.combustible) + "</td>" +
        '<td class="der">' + dinero(v.precio) + "</td>" +
        '<td class="der">' + v.cantidad + "</td>" +
        '<td><div class="fila-btns">' +
          '<button class="btn-editar" data-editar="' + limpio(v.codigo) + '">Editar</button>' +
          '<button class="btn-borrar" data-borrar="' + limpio(v.codigo) + '">Eliminar</button>' +
        "</div></td>";
      tbody.appendChild(fila);
    });

    if (msgVacio) {
      if (vehiculos.length === 0) {
        msgVacio.hidden = false;
        msgVacio.textContent = "El patio está vacío. Registra el primer vehículo.";
      } else if (lista.length === 0) {
        msgVacio.hidden = false;
        msgVacio.textContent = "Ningún vehículo coincide con esos filtros.";
      } else {
        msgVacio.hidden = true;
      }
    }

    var conteo = document.getElementById("conteo");
    if (conteo) {
      conteo.textContent = vehiculos.length === 0 ? "" :
        "Mostrando " + lista.length + " de " + vehiculos.length + " vehículos";
    }
  }

  var unidades = vehiculos.reduce(function (suma, v) { return suma + Number(v.cantidad); }, 0);
  var totalModelos = document.getElementById("totalModelos");
  var totalUnidades = document.getElementById("totalUnidades");
  if (totalModelos) totalModelos.textContent = vehiculos.length;
  if (totalUnidades) totalUnidades.textContent = unidades;
}

/* ---------- Avisos ---------- */

var avisoTimer;
function avisar(texto) {
  var el = document.querySelector(".aviso");
  if (!el) {
    el = document.createElement("div");
    el.className = "aviso";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.textContent = texto;
  el.classList.add("ver");
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(function () { el.classList.remove("ver"); }, 2400);
}

/* ---------- Modo edición ---------- */

function salirDeEdicion() {
  codigoEditando = null;
  form.reset();
  form.classList.remove("editando");
  campoMarca.disabled = false;
  btnGuardar.textContent = "Guardar vehículo";
  btnCancelar.hidden = true;
  tituloForm.textContent = "Registrar vehículo";
  campos.forEach(function (id) { ponerError(id, ""); });
}

function entrarEnEdicion(codigo) {
  var v = vehiculos.find(function (x) { return x.codigo === codigo; });
  if (!v) return;

  campos.forEach(function (id) { document.getElementById(id).value = v[id]; });

  codigoEditando = codigo;
  campoMarca.disabled = true; // si cambia la marca cambiaría el código, así que se queda fija
  form.classList.add("editando");
  btnGuardar.textContent = "Guardar cambios";
  btnCancelar.hidden = false;
  tituloForm.textContent = "Modificar vehículo " + codigo;

  var registro = document.getElementById("registro");
  if (registro) registro.scrollIntoView();
  document.getElementById("modelo").focus();
}

/* ---------- Eventos ---------- */

// Al elegir marca se muestra el código que le toca
if (campoMarca) campoMarca.addEventListener("change", function () {
  campoCodigo.value = siguienteCodigo(campoMarca.value);
});

if (form) form.addEventListener("submit", async function (e) {
  e.preventDefault();

  // armamos el objeto con lo que escribió el usuario
  var datos = {};
  campos.forEach(function (id) { datos[id] = document.getElementById(id).value.trim(); });

  // se recalcula justo al guardar, por si los datos cambiaron en otra pestaña
  if (codigoEditando === null) {
    datos.codigo = siguienteCodigo(datos.marca);
    campoCodigo.value = datos.codigo;
  }

  if (!validar(datos)) return;

  datos.anio = Number(datos.anio);
  datos.precio = Number(datos.precio);
  datos.cantidad = Number(datos.cantidad);

  btnGuardar.disabled = true;
  try {
    var editando = codigoEditando !== null;
    var resultado = await pedirApi(
      editando ? "/api/vehiculos/" + encodeURIComponent(codigoEditando) : "/api/vehiculos",
      {
        method: editando ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      }
    );

    await cargarDesdeApi();
    avisar(resultado.mensaje);
    salirDeEdicion();
    if (!editando && resultado.codigo) campoCodigo.value = resultado.codigo;
  } catch (error) {
    avisar(error.message);
  } finally {
    btnGuardar.disabled = false;
  }
});

if (btnCancelar) btnCancelar.addEventListener("click", salirDeEdicion);

var sesionActual = null;
try {
  sesionActual = JSON.parse(sessionStorage.getItem("automax_sesion"));
} catch (e) {
  sesionActual = null;
}

if (btnCerrarSesion) {
  var esUsuarioRegistrado = sesionActual && sesionActual.tipo === "usuario";
  if (!esUsuarioRegistrado) btnCerrarSesion.textContent = "Iniciar sesión";

  btnCerrarSesion.addEventListener("click", function () {
    if (esUsuarioRegistrado && !confirm("¿Seguro que quieres cerrar sesión?")) return;

    sessionStorage.removeItem("automax_sesion");
    location.href = "/login";
  });
}

// los filtros se aplican en cuanto se toca cualquiera
["fBuscar", "fMarca", "fComb", "fMin", "fMax", "fOrden"].forEach(function (id) {
  var elemento = document.getElementById(id);
  if (elemento) elemento.addEventListener("input", pintar);
});
var btnLimpiar = document.getElementById("btnLimpiar");
if (btnLimpiar) btnLimpiar.addEventListener("click", limpiarFiltros);

// un solo listener para todos los botones de la tabla
if (tbody) tbody.addEventListener("click", async function (e) {
  var btn = e.target.closest("button");
  if (!btn) return;

  if (btn.dataset.editar) {
    location.href = "/registrar?codigo=" + encodeURIComponent(btn.dataset.editar);
  }

  if (btn.dataset.borrar) {
    var cod = btn.dataset.borrar;
    if (!confirm("¿Eliminar el vehículo " + cod + "? Esta acción no se puede deshacer.")) return;

    btn.disabled = true;
    try {
      var resultado = await pedirApi("/api/vehiculos/" + encodeURIComponent(cod), { method: "DELETE" });
      await cargarDesdeApi();
      if (codigoEditando === cod) salirDeEdicion();
      avisar(resultado.mensaje);
    } catch (error) {
      btn.disabled = false;
      avisar(error.message);
    }
  }
});

armarMarcas();
pintar();
cargarDesdeApi();

var codigoSolicitado = new URLSearchParams(location.search).get("codigo");
if (form && codigoSolicitado) entrarEnEdicion(codigoSolicitado);
