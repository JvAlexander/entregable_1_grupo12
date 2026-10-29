// Íconos por defecto (los que están en las carpetas public/img)
const IMG_USUARIO = '/img/users/user.png';
const IMG_MASCOTA = '/img/pets/pets.png';

let listaUsuarios = [];
let listaMascotas = [];
let idUsuarioEditando = null;
let idMascotaEditando = null;
let temporizador;

// Evita que un texto con < o > dañe la página
function escapar(texto) {
    return String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Muestra una sección y cambia el color de fondo de la página
function mostrar(seccion) {
    const secciones = ['usuarios', 'mascotas', 'buscar'];

    for (const s of secciones) {
        document.getElementById(s).style.display = (s === seccion) ? 'block' : 'none';
        document.getElementById('pill-' + s).classList.toggle('active', s === seccion);
    }

    document.body.className = 'tema-' + seccion;
}

// Mensaje arriba de la pantalla: verde si salió bien, rojo si hubo error
function mostrarMensaje(texto, esError) {
    const mensaje = document.getElementById('mensaje');

    mensaje.className = 'd-none';
    void mensaje.offsetWidth; // reinicia la animación
    mensaje.textContent = texto;

    if (esError) {
        mensaje.className = 'alert alert-danger shadow animate__animated animate__headShake';
    } else {
        mensaje.className = 'alert alert-success shadow animate__animated animate__tada';
    }

    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
        mensaje.className = 'd-none';
    }, 5000);
}

// Quita los campos vacíos para que el PUT solo envíe lo que se llenó
function quitarVacios(formData) {
    for (const [clave, valor] of [...formData]) {
        if (valor === '' || (valor instanceof File && valor.name === '')) {
            formData.delete(clave);
        }
    }
    return formData;
}

/* ---------------- USUARIOS ---------------- */

async function cargarUsuarios() {
    try {
        const respuesta = await fetch('/api/users');
        const datos = await respuesta.json();

        if (!respuesta.ok) {
            mostrarMensaje(respuesta.status + ': ' + datos.error, true);
            return;
        }

        listaUsuarios = datos;
    } catch (error) {
        mostrarMensaje('No se pudo conectar con el servidor', true);
        return;
    }

    document.getElementById('contadorUsuarios').textContent = listaUsuarios.length;

    let html = '';

    if (listaUsuarios.length === 0) {
        html = '<div class="col-12"><div class="alert alert-light shadow-sm">Todavía no hay usuarios. ¡Crea el primero!</div></div>';
    }

    for (let i = 0; i < listaUsuarios.length; i++) {
        const u = listaUsuarios[i];
        const foto = u.avatar || IMG_USUARIO;
        const color = 'color' + (u.id % 6 + 1);

        html += `
        <div class="col animate__animated animate__zoomIn" style="animation-delay: ${i * 0.1}s">
            <div class="card tarjeta h-100 text-center shadow">
                <div class="cabecera ${color}"></div>
                <img class="avatar" src="${foto}" onerror="this.onerror=null; this.src='${IMG_USUARIO}'">
                <div class="card-body">
                    <h5 class="card-title">${escapar(u.firstname)} ${escapar(u.lastname)}</h5>
                    <p class="text-muted mb-2">@${escapar(u.username)}</p>
                    <span class="badge rounded-pill ${color}">ID ${u.id}</span>
                </div>
                <div class="card-footer bg-transparent border-0 pb-3">
                    <button class="btn btn-warning btn-sm" onclick="editarUsuario(${u.id})">Editar</button>
                    <button class="btn btn-danger btn-sm" onclick="eliminarUsuario(${u.id})">Eliminar</button>
                </div>
            </div>
        </div>`;
    }

    document.getElementById('listaUsuarios').innerHTML = html;
}

function editarUsuario(id) {
    const usuario = listaUsuarios.find(u => u.id === id);
    const form = document.getElementById('formUsuario');

    idUsuarioEditando = id;
    form.firstname.value = usuario.firstname;
    form.lastname.value = usuario.lastname;
    form.username.value = usuario.username;
    form.password.value = '';
    form.avatar.value = '';

    document.getElementById('tituloUsuario').textContent = 'Editar usuario ' + id + ' (contraseña vacía = no cambiarla)';
    document.getElementById('btnUsuario').textContent = 'Guardar cambios';
    window.scrollTo(0, 0);
}

function cancelarUsuario() {
    idUsuarioEditando = null;
    document.getElementById('formUsuario').reset();
    document.getElementById('tituloUsuario').textContent = 'Nuevo usuario';
    document.getElementById('btnUsuario').textContent = 'Guardar usuario';
}

document.getElementById('formUsuario').addEventListener('submit', async (e) => {
    e.preventDefault();

    const datos = quitarVacios(new FormData(e.target));

    let url = '/api/users';
    let metodo = 'POST';

    if (idUsuarioEditando !== null) {
        url = '/api/users/' + idUsuarioEditando;
        metodo = 'PUT';
    }

    try {
        const respuesta = await fetch(url, { method: metodo, body: datos });
        const resultado = await respuesta.json();

        if (respuesta.ok) {
            mostrarMensaje(respuesta.status + ': usuario guardado correctamente', false);
            cancelarUsuario();
            cargarUsuarios();
        } else {
            mostrarMensaje(respuesta.status + ': ' + resultado.error, true);
        }
    } catch (error) {
        mostrarMensaje('No se pudo conectar con el servidor', true);
    }
});

async function eliminarUsuario(id) {
    if (!confirm('¿Seguro que quieres eliminar este usuario?')) {
        return;
    }

    try {
        const respuesta = await fetch('/api/users/' + id, { method: 'DELETE' });
        const resultado = await respuesta.json();

        if (respuesta.ok) {
            mostrarMensaje(respuesta.status + ': usuario eliminado', false);
            cargarUsuarios();
        } else {
            mostrarMensaje(respuesta.status + ': ' + resultado.error, true);
        }
    } catch (error) {
        mostrarMensaje('No se pudo conectar con el servidor', true);
    }
}

/* ---------------- MASCOTAS ---------------- */

async function cargarMascotas() {
    try {
        const respuesta = await fetch('/api/pets');
        const datos = await respuesta.json();

        if (!respuesta.ok) {
            mostrarMensaje(respuesta.status + ': ' + datos.error, true);
            return;
        }

        listaMascotas = datos;
    } catch (error) {
        mostrarMensaje('No se pudo conectar con el servidor', true);
        return;
    }

    document.getElementById('contadorMascotas').textContent = listaMascotas.length;

    let html = '';

    if (listaMascotas.length === 0) {
        html = '<div class="col-12"><div class="alert alert-light shadow-sm">Todavía no hay mascotas. ¡Registra la primera!</div></div>';
    }

    for (let i = 0; i < listaMascotas.length; i++) {
        const m = listaMascotas[i];
        const color = 'color' + (m.id % 6 + 1);
        let foto = '';
        let miniaturas = '';

        // Sin imágenes: se muestra el ícono de mascota sobre un fondo de color
        if (m.img.length === 0) {
            foto = `<div class="sin-foto ${color}"><img src="${IMG_MASCOTA}" alt="Mascota sin foto"></div>`;
        } else {
            foto = `<img class="foto-grande" src="${m.img[0]}" onerror="this.onerror=null; this.src='${IMG_MASCOTA}'">`;
        }

        // Si tiene varias imágenes, al tocar una miniatura se cambia la foto grande
        if (m.img.length > 1) {
            for (const ruta of m.img) {
                miniaturas += `<img class="mini" src="${ruta}" onclick="this.closest('.card').querySelector('.foto-grande').src = this.src">`;
            }
            miniaturas = `<div class="mt-2">${miniaturas}</div>`;
        }

        const colorSexo = (m.sexo === 'macho') ? 'bg-primary' : 'rosa';

        html += `
        <div class="col animate__animated animate__fadeInUp" style="animation-delay: ${i * 0.1}s">
            <div class="card tarjeta h-100 shadow">
                ${foto}
                <div class="card-body">
                    <h5 class="card-title text-capitalize">
                        <img class="icono-mini" src="${IMG_MASCOTA}"> ${escapar(m.especie)}
                    </h5>
                    <span class="badge ${colorSexo}">${escapar(m.sexo)}</span>
                    <span class="badge bg-warning text-dark">${m.edad} años</span>
                    <span class="badge bg-secondary">${escapar(m.color)}</span>
                    <span class="badge ${color}">ID ${m.id}</span>
                    ${miniaturas}
                </div>
                <div class="card-footer bg-transparent border-0 pb-3">
                    <button class="btn btn-warning btn-sm" onclick="editarMascota(${m.id})">Editar</button>
                    <button class="btn btn-danger btn-sm" onclick="eliminarMascota(${m.id})">Eliminar</button>
                </div>
            </div>
        </div>`;
    }

    document.getElementById('listaMascotas').innerHTML = html;
}

function editarMascota(id) {
    const mascota = listaMascotas.find(m => m.id === id);
    const form = document.getElementById('formMascota');

    idMascotaEditando = id;
    form.especie.value = mascota.especie;
    form.color.value = mascota.color;
    form.edad.value = mascota.edad;
    form.sexo.value = mascota.sexo;
    form.img.value = '';

    document.getElementById('modoImagenes').style.display = 'block';
    document.getElementById('tituloMascota').textContent = 'Editar mascota ' + id;
    document.getElementById('btnMascota').textContent = 'Guardar cambios';
    window.scrollTo(0, 0);
}

function cancelarMascota() {
    idMascotaEditando = null;
    document.getElementById('formMascota').reset();
    document.getElementById('modoImagenes').style.display = 'none';
    document.getElementById('tituloMascota').textContent = 'Nueva mascota';
    document.getElementById('btnMascota').textContent = 'Guardar mascota';
}

document.getElementById('formMascota').addEventListener('submit', async (e) => {
    e.preventDefault();

    const datos = quitarVacios(new FormData(e.target));

    let url = '/api/pets';
    let metodo = 'POST';

    if (idMascotaEditando !== null) {
        url = '/api/pets/' + idMascotaEditando;
        metodo = 'PUT';
    } else {
        datos.delete('modoImg');
    }

    try {
        const respuesta = await fetch(url, { method: metodo, body: datos });
        const resultado = await respuesta.json();

        if (respuesta.ok) {
            mostrarMensaje(respuesta.status + ': mascota guardada correctamente', false);
            cancelarMascota();
            cargarMascotas();
        } else {
            mostrarMensaje(respuesta.status + ': ' + resultado.error, true);
        }
    } catch (error) {
        mostrarMensaje('No se pudo conectar con el servidor', true);
    }
});

async function eliminarMascota(id) {
    if (!confirm('¿Seguro que quieres eliminar esta mascota?')) {
        return;
    }

    try {
        const respuesta = await fetch('/api/pets/' + id, { method: 'DELETE' });
        const resultado = await respuesta.json();

        if (respuesta.ok) {
            mostrarMensaje(respuesta.status + ': mascota eliminada', false);
            cargarMascotas();
        } else {
            mostrarMensaje(respuesta.status + ': ' + resultado.error, true);
        }
    } catch (error) {
        mostrarMensaje('No se pudo conectar con el servidor', true);
    }
}

/* ---------------- BUSCAR POR ID ---------------- */

async function buscarPorId() {
    const tipo = document.getElementById('tipoBusqueda').value;
    const id = document.getElementById('idBusqueda').value;

    try {
        const respuesta = await fetch('/api/' + tipo + '/' + (id || 'x'));
        const datos = await respuesta.json();

        document.getElementById('resultado').textContent =
            'Código HTTP: ' + respuesta.status + '\n' + JSON.stringify(datos, null, 2);
    } catch (error) {
        mostrarMensaje('No se pudo conectar con el servidor', true);
    }
}

// Al abrir la página se cargan las listas
cargarUsuarios();
cargarMascotas();