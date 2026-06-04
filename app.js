// CONFIGURACIÓN DE SUPABASE REAL Y VERIFICADA
const SUPABASE_URL = "https://toqauhxdcyggnsejjijk.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvcWF1aHhkY3lnZ25zZWpqaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MDU4MzQsImV4cCI6MjA5NjA4MTgzNH0.Eb2u6O10ulBv20OoKvwaE64aqwEQzU80GnkbNd8Tp0I"; 

// Usamos supabaseClient para que el navegador no se trabe
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// VARIABLES GLOBALES DE CONTROL
let usuarioActual = null;
let vehiculoSeleccionadoId = null;
window.vistaActual = 'vista-login';

// EVENTOS AL CARGAR LA PÁGINA
document.addEventListener("DOMContentLoaded", async () => {
    // Escuchar botones de Login y Cierre
    document.getElementById('btn-ingresar').addEventListener('click', iniciarSesion);
    document.getElementById('btn-logout').addEventListener('click', cerrarSesion);
    document.getElementById('btn-agregar-vehiculo').addEventListener('click', agregarVehiculo);
    document.getElementById('btn-enviar-reporte').addEventListener('click', enviarReporte);

    // Chequear si ya hay una sesión guardada del teléfono/PC
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) {
        configurarSesionActiva(user);
    }
});

// FUNCIÓN DE LOGUEO
async function iniciarSesion() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        alert("Por favor complete todos los campos.");
        return;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
        alert("Error al ingresar: " + error.message);
        return;
    }

    if (data && data.user) {
        configurarSesionActiva(data.user);
    }
}

// CONFIGURAR INTERFAZ SEGÚN USUARIO Y ROL
function configurarSesionActiva(user) {
    usuarioActual = user;
    document.getElementById('btn-logout').style.display = 'block';
    document.getElementById('menu-navegacion').style.display = 'flex';
    
    // Filtro de Seguridad por Rol
    const rolUsuario = user?.user_metadata?.rol || 'chofer';
    const btnNavAdmin = document.getElementById('btn-nav-admin');

    if (rolUsuario === 'admin') {
        if (btnNavAdmin) btnNavAdmin.style.display = 'flex'; // Muestra solapa Admin
        cargarReportesParaAdmin(); // Carga el historial de auditoría
    } else {
        if (btnNavAdmin) btnNavAdmin.style.display = 'none'; // Oculta solapa Admin al chofer
    }

    cambiarVista('vista-flota');
    cargarVehiculos();
}

// NAVEGACIÓN ENTRE VISTAS
window.cambiarVista = function(idVista) {
    // Ocultar todas
    document.querySelectorAll('.vista').forEach(v => v.classList.remove('activa'));
    // Mostrar la seleccionada
    const vistaDestino = document.getElementById(idVista);
    if (vistaDestino) {
        vistaDestino.classList.add('activa');
        window.vistaActual = idVista;
    }

    // Actualizar estados de botones del menú inferior
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('activo'));
    if (idVista === 'vista-flota') {
        document.querySelector('button[onclick*="vista-flota"]')?.classList.add('activo');
    } else if (idVista === 'vista-admin') {
        document.querySelector('button[onclick*="vista-admin"]')?.classList.add('activo');
        cargarReportesParaAdmin(); // Actualiza los reportes al entrar
    }
}

// CARGAR LOS AUTOS REGISTRADOS
async function cargarVehiculos() {
    const contenedor = document.getElementById('lista-vehiculos');
    if (!contenedor) return;

    const { data: vehiculos, error } = await supabaseClient.from('vehiculos').select('*');

    if (error) {
        console.error("Error cargando autos:", error.message);
        return;
    }

    contenedor.innerHTML = '';
    vehiculos.forEach(auto => {
        const item = document.createElement('div');
        item.className = 'card-vehiculo';
        item.innerHTML = `
            <span class="material-icons" style="font-size: 2.5rem; color: var(--celeste);">directions_car</span>
            <div style="font-weight: bold; margin-top: 5px;">${auto.patente}</div>
            <div style="font-size: 0.8rem; color: var(--texto-gris);">${auto.modelo || ''}</div>
        `;
        item.onclick = () => {
            vehiculoSeleccionadoId = auto.id;
            document.getElementById('reporte-titulo').innerText = `Reporte Unidad: ${auto.patente}`;
            cambiarVista('vista-reporte');
        };
        contenedor.appendChild(item);
    });
}

// AGREGAR AUTOS (SOLO ADMIN)
async function agregarVehiculo() {
    const patente = document.getElementById('admin-patente').value.trim().toUpperCase();
    const modelo = document.getElementById('admin-modelo').value.trim();

    if (!patente) {
        alert("Escriba la patente del auto.");
        return;
    }

    const { error } = await supabaseClient.from('vehiculos').insert([{ patente, modelo }]);

    if (error) {
        alert("Error al guardar auto: " + error.message);
    } else {
        alert("Vehículo guardado correctamente.");
        document.getElementById('admin-patente').value = '';
        document.getElementById('admin-modelo').value = '';
        cargarVehiculos();
    }
}

// ENVIAR REPORTE DE JORNADA (CON SUBIDA DE FOTOS MULTIPLES)
async function enviarReporte() {
    const tipo = document.getElementById('reporte-tipo').value;
    const kilometraje = parseInt(document.getElementById('reporte-km').value);
    const combustible = document.getElementById('reporte-combustible').value;
    const novedades = document.getElementById('reporte-novedades').value.trim();
    const inputFotos = document.getElementById('reporte-fotos');

    if (!kilometraje) {
        alert("Por favor ingrese el kilometraje actual.");
        return;
    }

    let urlsFotos = [];

    // Subir fotos al Storage si el chofer seleccionó archivos
    if (inputFotos && inputFotos.files.length > 0) {
        for (let i = 0; i < inputFotos.files.length; i++) {
            const archivo = inputFotos.files[i];
            const nombreArchivo = `${Date.now()}_${i}_${archivo.name}`;
            
            // Subimos al bucket llamado 'perimetros'
            const { data, error: uploadError } = await supabaseClient.storage
                .from('perimetros')
                .upload(nombreArchivo, archivo);

            if (uploadError) {
                console.error("Error subiendo foto:", uploadError.message);
            } else {
                // Generamos la URL pública de la imagen
                const { data: publicData } = supabaseClient.storage.from('perimetros').getPublicUrl(nombreArchivo);
                if (publicData?.publicUrl) {
                    urlsFotos.push(publicData.publicUrl);
                }
            }
        }
    }

    // Insertamos la fila en la tabla reportes_jornadas
    const { error } = await supabaseClient.from('reportes_jornadas').insert([{
        tipo,
        kilometraje,
        combustible,
        novedades: novedades || null,
        fotos_perimetro: urlsFotos // Guardamos el array de URLs
    }]);

    if (error) {
        alert("Error al enviar el reporte: " + error.message);
    } else {
        alert("Reporte guardado con éxito.");
        // Limpiamos el formulario
        document.getElementById('reporte-km').value = '';
        document.getElementById('reporte-novedades').value = '';
        if (inputFotos) inputFotos.value = '';
        cambiarVista('vista-flota');
    }
}

// CARGAR HISTORIAL DE REPORTES (SOLO ADMINS)
async function cargarReportesParaAdmin() {
    const contenedor = document.getElementById('lista-reportes-admin');
    if (!contenedor) return;

    const { data: reportes, error } = await supabaseClient
        .from('reportes_jornadas')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error trayendo reportes:", error.message);
        contenedor.innerHTML = `<p style="color: #ef4444;">No se pudieron cargar los reportes.</p>`;
        return;
    }

    if (!reportes || reportes.length === 0) {
        contenedor.innerHTML = `<p style="color: #64748b; font-style: italic;">No hay reportes cargados en el sistema todavía.</p>`;
        return;
    }

    contenedor.innerHTML = '';

    reportes.forEach(reporte => {
        const tarjeta = document.createElement('div');
        tarjeta.style.cssText = "background-color: #0f172a; padding: 15px; border-radius: 8px; border-left: 5px solid " + (reporte.tipo === 'Inicio' ? 'var(--verde-inicio)' : 'var(--naranja-fin)') + ";";

        const fechaStr = reporte.created_at ? new Date(reporte.created_at).toLocaleString('es-AR') : 'Sin fecha';

        // Renderizado de las imágenes adjuntas
        let fotosHtml = '';
        if (reporte.fotos_perimetro) {
            try {
                const listaFotos = typeof reporte.fotos_perimetro === 'string' ? JSON.parse(reporte.fotos_perimetro) : reporte.fotos_perimetro;
                if (Array.isArray(listaFotos) && listaFotos.length > 0) {
                    fotosHtml = `<div style="display: flex; gap: 10px; margin-top: 10px; overflow-x: auto; padding-bottom: 5px;">`;
                    listaFotos.forEach(url => {
                        fotosHtml += `<img src="${url}" alt="Perímetro" style="width: 80px; height: 80px; object-fit: cover; border-radius: 6px; border: 1px solid #334155; cursor: pointer;" onclick="window.open('${url}', '_blank')">`;
                    });
                    fotosHtml += `</div>`;
                } else {
                    fotosHtml = `<p style="font-size: 0.85rem; color: #475569; margin: 8px 0 0 0;">Sin fotos de perímetro</p>`;
                }
            } catch (e) {
                fotosHtml = `<p style="font-size: 0.85rem; color: #475569; margin: 8px 0 0 0;">Sin fotos de perímetro</p>`;
            }
        }

        tarjeta.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-weight: bold; padding: 3px 8px; border-radius: 4px; font-size: 0.85rem; background-color: ${reporte.tipo === 'Inicio' ? '#064e3b' : '#78350f'}; color: ${reporte.tipo === 'Inicio' ? '#34d399' : '#fbbf24'};">
                    Jornada: ${reporte.tipo}
                </span>
                <span style="font-size: 0.8rem; color: var(--texto-gris);">${fechaStr}</span>
            </div>
            
            <div style="font-size: 0.95rem; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; color: #cbd5e1;">
                <p style="margin: 0;"><strong>KM:</strong> ${reporte.kilometraje || '---'}</p>
                <p style="margin: 0;"><strong>Tanque:</strong> ${reporte.combustible || '---'}</p>
            </div>
            
            <p style="margin: 8px 0 0 0; font-size: 0.9rem; color: #94a3b8;">
                <strong>Novedades:</strong> ${reporte.novedades || 'Ninguna'}
            </p>
            
            ${fotosHtml}
        `;

        contenedor.appendChild(tarjeta);
    });
}

// CERRAR SESIÓN
async function cerrarSesion() {
    await supabaseClient.auth.signOut();
    usuarioActual = null;
    vehiculoSeleccionadoId = null;
    document.getElementById('btn-logout').style.display = 'none';
    document.getElementById('menu-navegacion').style.display = 'none';
    cambiarVista('vista-login');
}