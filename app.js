// CONFIGURACIÓN DE SUPABASE
const SUPABASE_URL = "https://toqauhxdcyggnsejjijk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvcWF1aHhkY3lnZ25zZWpqaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MDU4MzQsImV4cCI6MjA5NjA4MTgzNH0.Eb2u6O10ulBv20OoKvwaE64aqwEQzU80GnkbNd8Tp0I";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let usuarioActual = null;
let vehiculoSeleccionado = null;

// INICIALIZACIÓN
document.addEventListener("DOMContentLoaded", async () => {
    // Escuchar botones principales
    document.getElementById('btn-ingresar')?.addEventListener('click', manejarAccesoUsuario);
    document.getElementById('btn-logout')?.addEventListener('click', cerrarSesion);
    document.getElementById('btn-agregar-vehiculo')?.addEventListener('click', agregarVehiculo);
    document.getElementById('btn-enviar-reporte')?.addEventListener('click', enviarReporte);

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) configurarSesionActiva(user);
});

// GESTIÓN DE SESIÓN
async function manejarAccesoUsuario() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) return alert("Error: " + error.message);
    configurarSesionActiva(data.user);
}

function configurarSesionActiva(user) {
    usuarioActual = user;
    document.getElementById('btn-logout').style.display = 'block';
    document.getElementById('menu-navegacion').style.display = 'flex';
    cargarVehiculos();
    cambiarVista('vista-flota');
}

// NAVEGACIÓN Y VISTAS
window.cambiarVista = function(id) {
    document.querySelectorAll('.vista').forEach(v => v.classList.remove('activa'));
    document.getElementById(id)?.classList.add('activa');
    if (id === 'vista-admin') cargarReportesParaAdmin();
}

// CARGA DE FLOTA
async function cargarVehiculos() {
    const contenedor = document.getElementById('lista-vehiculos');
    const { data } = await supabaseClient.from('vehiculos').select('*');
    contenedor.innerHTML = '';
    data?.forEach(auto => {
        const item = document.createElement('div');
        item.className = 'card-vehiculo';
        item.innerHTML = `<strong>${auto.patente}</strong><br>${auto.modelo || ''}`;
        item.onclick = () => abrirPanelReporteVehiculo(auto);
        contenedor.appendChild(item);
    });
}

// PANEL DE CADA VEHÍCULO
function abrirPanelReporteVehiculo(auto) {
    vehiculoSeleccionado = auto;
    document.getElementById('reporte-titulo').innerText = `Unidad: ${auto.patente}`;
    // Re-vincular eventos de guardado
    document.getElementById('btn-guardar-documento')?.addEventListener('click', subirDocumentacionAuto);
    document.getElementById('btn-guardar-service')?.addEventListener('click', registrarServiceVehiculo);
    mostrarDocumentosAuto();
    mostrarServicesAuto();
    cambiarVista('vista-reporte');
}

// DOCUMENTACIÓN Y SERVICES (LÓGICA CORREGIDA)
async function subirDocumentacionAuto() {
    const nombre = document.getElementById('doc-nombre-tipo').value;
    const archivo = document.getElementById('doc-archivo-file').files[0];
    if (!archivo) return;

    const nombreArchivo = `docs_${Date.now()}`;
    await supabaseClient.storage.from('flota').upload(nombreArchivo, archivo);
    const { data: { publicUrl } } = supabaseClient.storage.from('flota').getPublicUrl(nombreArchivo);

    let docs = Array.isArray(vehiculoSeleccionado.documentos) ? vehiculoSeleccionado.documentos : [];
    docs.push({ nombre, url: publicUrl });

    await supabaseClient.from('vehiculos').update({ documentos: docs }).eq('id', vehiculoSeleccionado.id);
    vehiculoSeleccionado.documentos = docs;
    mostrarDocumentosAuto();
}

async function registrarServiceVehiculo() {
    const tarea = document.getElementById('srv-tarea').value;
    const km = document.getElementById('srv-km').value;
    let services = Array.isArray(vehiculoSeleccionado.services) ? vehiculoSeleccionado.services : [];
    services.push({ tarea, km, fecha: new Date().toLocaleDateString() });

    await supabaseClient.from('vehiculos').update({ services: services }).eq('id', vehiculoSeleccionado.id);
    vehiculoSeleccionado.services = services;
    mostrarServicesAuto();
}

// REPORTE JORNADA
async function enviarReporte() {
    await supabaseClient.from('reportes_jornadas').insert([{
        vehiculo_id: vehiculoSeleccionado.id,
        patente: vehiculoSeleccionado.patente,
        chofer: usuarioActual.email,
        kilometraje: document.getElementById('reporte-km').value,
        tipo: document.getElementById('reporte-tipo').value
    }]);
    alert("Reporte enviado");
    cambiarVista('vista-flota');
}

// ADMIN PANEL
async function cargarReportesParaAdmin() {
    const { data } = await supabaseClient.from('reportes_jornadas').select('*').order('created_at', { ascending: false });
    const cont = document.getElementById('lista-reportes-admin');
    cont.innerHTML = '';
    data?.forEach(r => {
        const div = document.createElement('div');
        div.innerHTML = `Patente: ${r.patente} | KM: ${r.kilometraje} | Chofer: ${r.chofer}`;
        cont.appendChild(div);
    });
}

function cerrarSesion() {
    supabaseClient.auth.signOut();
    location.reload();
}