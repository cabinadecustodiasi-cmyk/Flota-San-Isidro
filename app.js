// 1. Importación directa de la librería de Supabase para la Web
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// 2. Credenciales de tu proyecto de producción en Supabase
const SUPABASE_URL = "https://toqauhxdcyggnsejjijk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvcWF1aHhkY3lnZ25zZWpqaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MDU4MzQsImV4cCI6MjA5NjA4MTgzNH0.Eb2u6O10ulBv20OoKvwaE64aqwEQzU80GnkbNd8Tp0I";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
// Variables de estado local
let flotaVehiculos = [];
let autoSeleccionadoIndex = -1;
let fotosTemporalesInicio = [];
let usuarioLogueado = null;

// --- CONTROL DE NAVEGACIÓN GLOBAL ---
window.cambiarVista = function(idVista) {
    document.querySelectorAll('.vista').forEach(v => v.classList.remove('activa'));
    const vistaDestino = document.getElementById(idVista);
    if (vistaDestino) vistaDestino.classList.add('activa');
    window.scrollTo(0, 0);
};

window.activarNav = function(elemento) {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('activo'));
    elemento.classList.add('activo');
};

// --- ESCUCHAR SESIÓN (LOGIN REAL) ---
supabase.auth.onAuthStateChange((event, session) => {
    const navInferior = document.querySelector('.nav-inferior');
    if (session) {
        usuarioLogueado = session.user;
        if (navInferior) navInferior.style.display = 'flex';
        window.cambiarVista('vista-flota');
        escucharFlotaTiempoReal();
    } else {
        usuarioLogueado = null;
        if (navInferior) navInferior.style.display = 'none';
        window.cambiarVista('vista-login');
    }
});

window.ejecutarLogin = async function() {
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-pass').value.trim();
    if (!email || !pass) return alert("Por favor, completá todos los campos.");

    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) alert("Error de ingreso: " + error.message);
};

window.crearCuentaChofer = async function() {
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-pass').value.trim();
    if (!email || pass.length < 6) return alert("El mail debe ser válido y la clave tener mínimo 6 caracteres.");

    const { error } = await supabase.auth.signUp({ email, password: pass });
    if (error) alert("Error al registrar: " + error.message);
    else alert("Cuenta creada. Ya podés iniciar sesión.");
};

window.ejecutarLogout = async function() {
    if(confirm("¿Querés cerrar sesión?")) {
        await supabase.auth.signOut();
    }
};

// --- TIEMPO REAL CON SUPABASE ---
let subscripcionFlota = null;
function escucharFlotaTiempoReal() {
    if(subscripcionFlota) return;

    // Traer datos iniciales
    supabase.from("vehiculos").select("*").order("patente").then(({ data }) => {
        if(data) { flotaVehiculos = data; renderizarFlota(); }
    });

    // Escuchar cambios en vivo
    subscripcionFlota = supabase.channel('cambios-flota')
        .on('postgres_changes', { event: '*', filter: 'id=neq.0', schema: 'public', table: 'vehiculos' }, () => {
            supabase.from("vehiculos").select("*").order("patente").then(({ data }) => {
                if(data) { flotaVehiculos = data; renderizarFlota(); }
            });
        })
        .subscribe();
}

function renderizarFlota() {
    const contenedorChoferes = document.getElementById('contenedor-flota-choferes');
    const contenedorAdmin = document.getElementById('lista-crud-admin');
    if(!contenedorChoferes || !contenedorAdmin) return;
    
    contenedorChoferes.innerHTML = '';
    contenedorAdmin.innerHTML = '';

    flotaVehiculos.forEach((auto, index) => {
        let colorEstado = auto.estado === "Disponible" ? "var(--exito)" : (auto.estado === "En Uso" ? "var(--azul-electrico)" : "var(--alerta)");
        
        contenedorChoferes.innerHTML += `
            <div class="tarjeta-auto" onclick="seleccionarVehiculo(${index})">
                <span class="material-icons icono-auto">directions_car</span>
                <span class="nombre-modelo">${auto.modelo}</span>
                <span class="patente">${auto.patente}</span>
                <span class="estado" style="color: ${colorEstado}">${auto.estado}</span>
            </div>
        `;

        contenedorAdmin.innerHTML += `
            <div class="item-crud-auto">
                <div>
                    <strong>${auto.patente}</strong> - ${auto.modelo} 
                    <br><span style="font-size:0.8rem; color:#aaa;">KM: ${auto.km_actual || 0} km</span> | <span style="font-size:0.85rem; color:${colorEstado}">${auto.estado}</span>
                </div>
                <div class="crud-acciones-btn">
                    <button class="btn-icono edit" onclick="prepararEdicion(${index})">
                        <span class="material-icons">edit</span>
                    </button>
                    <button class="btn-icono delete" onclick="eliminarVehiculo(${index})">
                        <span class="material-icons">delete</span>
                    </button>
                </div>
            </div>
        `;
    });
}

window.seleccionarVehiculo = function(index) {
    autoSeleccionadoIndex = index;
    const auto = flotaVehiculos[index];
    document.getElementById('nombre-auto-seleccionado').innerText = `${auto.modelo} [${auto.patente}]`;
    window.cambiarVista('vista-auto');
};

// --- PANEL ADMIN (CRUD) ---
window.guardarVehiculo = async function() {
    const modelo = document.getElementById('admin-modelo').value.trim();
    const patente = document.getElementById('admin-patente').value.trim().toUpperCase();
    const estado = document.getElementById('admin-estado').value;
    const editIndex = parseInt(document.getElementById('edit-index').value);

    if (!modelo || !patente) return alert("Completá modelo y patente.");

    if (editIndex === -1) {
        await supabase.from("vehiculos").insert([{ modelo, patente, estado, km_actual: 0, documentos: [], services: [] }]);
    } else {
        const autoId = flotaVehiculos[editIndex].id;
        await supabase.from("vehiculos").update({ modelo, patente, estado }).eq("id", autoId);
    }
    limpiarFormularioAdmin();
};

window.prepararEdicion = function(index) {
    const auto = flotaVehiculos[index];
    document.getElementById('admin-modelo').value = auto.modelo;
    document.getElementById('admin-patente').value = auto.patente;
    document.getElementById('admin-estado').value = auto.estado;
    document.getElementById('edit-index').value = index;
    document.getElementById('titulo-form-admin').innerText = "Modificar Datos";
    document.getElementById('btn-guardar-auto').innerText = "Aplicar Cambios";
    document.getElementById('btn-guardar-auto').classList.add('btn-modificar');
    document.getElementById('btn-cancelar-edicion').style.display = "block";
};

window.eliminarVehiculo = async function(index) {
    if (confirm(`¿Eliminar coche ${flotaVehiculos[index].patente}?`)) {
        await supabase.from("vehiculos").delete().eq("id", flotaVehiculos[index].id);
        limpiarFormularioAdmin();
    }
};

function limpiarFormularioAdmin() {
    document.getElementById('admin-modelo').value = '';
    document.getElementById('admin-patente').value = '';
    document.getElementById('admin-estado').value = 'Disponible';
    document.getElementById('edit-index').value = '-1';
    document.getElementById('titulo-form-admin').innerText = "Agregar Nuevo Vehículo";
    document.getElementById('btn-guardar-auto').innerText = "Guardar Vehículo";
    document.getElementById('btn-guardar-auto').classList.remove('btn-modificar');
    document.getElementById('btn-cancelar-edicion').style.display = "none";
}

// --- UTILIDAD: CONVERTIR FILE A BLOB PARA STORAGE ---
async function dataURLtoBlob(dataurl) {
    var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while(n--){ u8arr[n] = bstr.charCodeAt(n); }
    return new Blob([u8arr], {type:mime});
}

// --- CHECK-IN (FOTOS A STORAGE GRATIS) ---
window.previsualizarFotosInicio = function(input) {
    const galeria = document.getElementById('galeria-inicio-previa');
    galeria.innerHTML = '';
    fotosTemporalesInicio = [];

    if (input.files) {
        Array.from(input.files).forEach((file, idx) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                fotosTemporalesInicio.push(e.target.result);
                galeria.innerHTML += `
                    <div class="contenedor-miniatura" id="thumb-inicio-${idx}">
                        <img src="${e.target.result}" class="miniatura-foto">
                        <button type="button" class="btn-eliminar-foto" onclick="eliminarFotoTemporalInicio(${idx})">×</button>
                    </div>`;
            };
            reader.readAsDataURL(file);
        });
    }
};

window.eliminarFotoTemporalInicio = function(idx) {
    fotosTemporalesInicio.splice(idx, 1);
    document.getElementById(`thumb-inicio-${idx}`)?.remove();
};

window.guardarInicioJornada = async function() {
    const km = parseInt(document.getElementById('inicio-km').value);
    const combustible = document.getElementById('inicio-combustible').value;
    const auto = flotaVehiculos[autoSeleccionadoIndex];

    if(!km) return alert("Ingresá el kilometraje.");
    alert("Subiendo registros e imágenes a Supabase... Espere confirmación.");
    
    let urlsSubidas = [];
    try {
        for(let i=0; i < fotosTemporalesInicio.length; i++) {
            const nombreArchivo = `jornadas/${auto.patente}_inicio_${Date.now()}_${i}.jpg`;
            const blobData = await dataURLtoBlob(fotosTemporalesInicio[i]);
            
            const { data, error } = await supabase.storage.from("flota").upload(nombreArchivo, blobData, { contentType: 'image/jpeg' });
            if(error) throw error;

            const { data: publicUrlData } = supabase.storage.from("flota").getPublicUrl(nombreArchivo);
            urlsSubidas.push(publicUrlData.publicUrl);
        }

        await supabase.from("reportes_jornadas").insert([{
            patente: auto.patente,
            chofer: usuarioLogueado.email,
            tipo: "Inicio",
            kilometraje: km,
            combustible: combustible,
            fotos_perimetro: urlsSubidas
        }]);

        await supabase.from("vehiculos").update({ km_actual: km, estado: "En Uso" }).eq("id", auto.id);

        alert("¡Jornada iniciada correctamente!");
        document.getElementById('form-inicio').reset();
        document.getElementById('galeria-inicio-previa').innerHTML = '';
        window.cambiarVista('vista-auto');
    } catch(err) { alert("Error en check-in: " + err.message); }
};

// --- CHECK-OUT ---
window.guardarFinJornada = async function() {
    const km = parseInt(document.getElementById('fin-km').value);
    const combustible = document.getElementById('fin-combustible').value;
    const novedades = document.getElementById('fin-novedades').value;
    const cargoNafta = document.getElementById('cargo-nafta').checked;
    const inputTicket = document.querySelector('#seccion-ticket input[type="file"]');
    const auto = flotaVehiculos[autoSeleccionadoIndex];

    if(!km) return alert("Ingresá el kilometraje final.");
    alert("Procesando cierre de jornada...");

    let urlTicket = "";
    try {
        if(cargoNafta && inputTicket.files[0]) {
            const reader = new FileReader();
            reader.onload = async function(e) {
                const nombreArchivo = `tickets/${auto.patente}_ticket_${Date.now()}.jpg`;
                const blobData = await dataURLtoBlob(e.target.result);
                
                await supabase.storage.from("flota").upload(nombreArchivo, blobData, { contentType: 'image/jpeg' });
                const { data } = supabase.storage.from("flota").getPublicUrl(nombreArchivo);
                urlTicket = data.publicUrl;
                
                await subirCierreJornada(auto, km, combustible, novedades, urlTicket);
            };
            reader.readAsDataURL(inputTicket.files[0]);
        } else {
            await subirCierreJornada(auto, km, combustible, novedades, "");
        }
    } catch(err) { alert("Error en check-out: " + err.message); }
};

async function subirCierreJornada(auto, km, combustible, novedades, urlTicket) {
    await supabase.from("reportes_jornadas").insert([{
        patente: auto.patente,
        chofer: usuarioLogueado.email,
        tipo: "Fin",
        kilometraje: km,
        combustible: combustible,
        novedades: novedades,
        ticket_combustible: urlTicket
    }]);

    await supabase.from("vehiculos").update({ km_actual: km, estado: "Disponible" }).eq("id", auto.id);

    alert("Jornada cerrada con éxito. Vehículo liberado.");
    document.getElementById('form-fin').reset();
    document.getElementById('seccion-ticket').style.display = 'none';
    window.cambiarVista('vista-flota');
}

// --- DOCUMENTACIÓN CON STORAGE ---
window.abrirDocumentacion = function() {
    const auto = flotaVehiculos[autoSeleccionadoIndex];
    document.getElementById('doc-titulo-auto').innerText = `Documentos: ${auto.patente}`;
    pintarGaleriaDocumentos(auto);
    window.cambiarVista('vista-documentacion');
};

window.procesarFotosDocumento = async function(input) {
    const auto = flotaVehiculos[autoSeleccionadoIndex];
    if (!input.files || input.files.length === 0) return;

    alert("Subiendo documentos...");
    try {
        let copiaDocs = auto.documentos ? [...auto.documentos] : [];
        for (let file of Array.from(input.files)) {
            const reader = new FileReader();
            reader.onload = async function(e) {
                const nombreArchivo = `documentos/${auto.patente}_doc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.jpg`;
                const blobData = await dataURLtoBlob(e.target.result);

                await supabase.storage.from("flota").upload(nombreArchivo, blobData, { contentType: 'image/jpeg' });
                const { data } = supabase.storage.from("flota").getPublicUrl(nombreArchivo);
                
                copiaDocs.push(data.publicUrl);
                await supabase.from("vehiculos").update({ documentos: copiaDocs }).eq("id", auto.id);
                
                // Forzar refresco visual
                auto.documentos = copiaDocs;
                pintarGaleriaDocumentos(auto);
            };
            reader.readAsDataURL(file);
        }
    } catch (e) { alert("Error al subir documentos: " + e.message); }
};

function pintarGaleriaDocumentos(auto) {
    const visor = document.getElementById('visor-documentos-galeria');
    visor.innerHTML = '';

    if (auto.documentos && auto.documentos.length > 0) {
        auto.documentos.forEach((url, idx) => {
            visor.innerHTML += `
                <div class="contenedor-miniatura" style="width:100%; height:130px;">
                    <img src="${url}" class="miniatura-foto" style="height:130px;" onclick="window.open('${url}', '_blank')">
                    <button type="button" class="btn-eliminar-foto" onclick="eliminarDocumentoNube(${idx})">×</button>
                </div>`;
        });
    } else {
        visor.innerHTML = `<span style="color:#aaa; grid-column:1/-1; text-align:center; padding:20px 0;">Sin documentos cargados.</span>`;
    }
}

window.eliminarDocumentoNube = async function(idx) {
    if(confirm("¿Seguro que querés remover permanentemente este documento?")) {
        const auto = flotaVehiculos[autoSeleccionadoIndex];
        let copiaDocs = [...auto.documentos];
        copiaDocs.splice(idx, 1);

        await supabase.from("vehiculos").update({ documentos: copiaDocs }).eq("id", auto.id);
        alert("Documento removido.");
        auto.documentos = copiaDocs;
        pintarGaleriaDocumentos(auto);
    }
};

// --- SERVICES ---
window.abrirService = function() {
    const auto = flotaVehiculos[autoSeleccionadoIndex];
    document.getElementById('service-titulo-auto').innerText = `Services: ${auto.patente}`;
    actualizarHistorialYAlertaService(auto);
    window.cambiarVista('vista-service');
};

window.agregarNuevoService = async function() {
    const desc = document.getElementById('srv-descripcion').value.trim();
    const kmSrv = parseInt(document.getElementById('srv-km').value);
    const frec = parseInt(document.getElementById('srv-frecuencia').value);
    const auto = flotaVehiculos[autoSeleccionadoIndex];

    if(!desc || !kmSrv || !frec) return alert("Completá todos los campos.");

    const nuevoSrv = { descripcion: desc, km: kmSrv, frecuencia: frec, fecha: new Date().toLocaleDateString() };
    let listaActualizada = auto.services ? [nuevoSrv, ...auto.services] : [nuevoSrv];

    let nuevoKmGeneral = auto.km_actual;
    if (kmSrv > auto.km_actual) nuevoKmGeneral = kmSrv;

    try {
        await supabase.from("vehiculos").update({ services: listaActualizada, km_actual: nuevoKmGeneral }).eq("id", auto.id);
        alert("Service guardado.");
        document.getElementById('srv-descripcion').value = '';
        document.getElementById('srv-km').value = '';
        document.getElementById('srv-frecuencia').value = '';
        
        auto.services = listaActualizada;
        auto.km_actual = nuevoKmGeneral;
        actualizarHistorialYAlertaService(auto);
    } catch(e) { alert("Error al registrar service: " + e.message); }
};

function actualizarHistorialYAlertaService(auto) {
    const lista = document.getElementById('historial-services-lista');
    const bloqueAlerta = document.getElementById('bloque-alerta-service');
    lista.innerHTML = '';

    if (!auto.services || auto.services.length === 0) {
        lista.innerHTML = '<p style="color:#aaa;">No registra ningún service previo.</p>';
        bloqueAlerta.style.display = 'none';
        return;
    }

    auto.services.forEach(s => {
        let text = s.fecha || 'Sin fecha';
        lista.innerHTML += `
            <div class="historial-item">
                <strong>${s.descripcion}</strong> (${text})<br>
                Hecho a los: ${s.km} km | Próximo a los: ${s.km + s.frecuencia} km
            </div>`;
    });

    const ultimoSrv = auto.services[0]; 
    const proximoKm = ultimoSrv.km + ultimoSrv.frecuencia;
    const kmRestantes = proximoKm - (auto.km_actual || 0);

    bloqueAlerta.style.display = 'block';
    if (kmRestantes <= 0) {
        bloqueAlerta.style.backgroundColor = "rgba(230, 57, 70, 0.3)";
        bloqueAlerta.style.borderColor = "var(--alerta)";
        bloqueAlerta.innerHTML = `<span class="material-icons" style="font-size:18px; vertical-align:middle; margin-right:5px;">error</span> <strong>¡SERVICE VENCIDO!</strong> Pasado por ${Math.abs(kmRestantes)} km.`;
    } else if (kmRestantes <= 1000) {
        bloqueAlerta.style.backgroundColor = "rgba(255, 183, 3, 0.3)";
        bloqueAlerta.style.borderColor = "var(--advertencia)";
        bloqueAlerta.innerHTML = `<span class="material-icons" style="font-size:18px; vertical-align:middle; margin-right:5px;">warning</span> <strong>Atención:</strong> Quedan solo <strong>${kmRestantes} km</strong> para el próximo service.`;
    } else {
        bloqueAlerta.style.backgroundColor = "rgba(42, 157, 143, 0.3)";
        bloqueAlerta.style.borderColor = "var(--exito)";
        bloqueAlerta.innerHTML = `<span class="material-icons" style="font-size:18px; vertical-align:middle; margin-right:5px;">check_circle</span> Faltan <strong>${kmRestantes} km</strong> para el próximo service.`;
    }
}

window.limpiarFormularioAdmin = limpiarFormularioAdmin;