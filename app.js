// CONFIGURACIÓN DE SUPABASE REAL Y VERIFICADA
const SUPABASE_URL = "https://toqauhxdcyggnsejjijk.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvcWF1hHhkY3lnZ25zZWpqaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MDU4MzQsImV4cCI6MjA5NjA4MTgzNH0.Eb2u6O10ulBv20OoKvwaE64aqwEQzU80GnkbNd8Tp0I"; 

// Usamos supabaseClient para conectar con la base de datos
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// VARIABLES GLOBALES DE CONTROL
let usuarioActual = null;
let vehiculoSeleccionadoId = null;
window.vistaActual = 'vista-login';

// EVENTOS AL CARGAR LA PÁGINA
document.addEventListener("DOMContentLoaded", async () => {
    // Escuchar botones de la interfaz
    document.getElementById('btn-ingresar').addEventListener('click', manejarAccesoUsuario);
    document.getElementById('btn-logout').addEventListener('click', cerrarSesion);
    document.getElementById('btn-agregar-vehiculo').addEventListener('click', agregarVehiculo);
    document.getElementById('btn-enviar-reporte').addEventListener('click', enviarReporte);

    // Chequear si ya hay una sesión guardada en el dispositivo
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) {
        configurarSesionActiva(user);
    }
});

// GESTIÓN DE ACCESO AUTOMÁTICO (LOGIN O REGISTRO)
async function manejarAccesoUsuario() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        alert("Por favor complete todos los campos.");
        return;
    }

    if (password.length < 6) {
        alert("La contraseña debe tener al menos 6 caracteres.");
        return;
    }

    // Intento de inicio de sesión normal
    const { data: loginData, error: loginError } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (!loginError && loginData && loginData.user) {
        configurarSesionActiva(loginData.user);
        return;
    }

    // Registro automático si la cuenta es nueva
    if (loginError && (loginError.message.includes("Invalid login credentials") || loginError.status === 400 || loginError.status === 404)) {
        console.log("Usuario no encontrado, registrando chofer nuevo...");
        
        const { data: signupData, error: signupError } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    rol: 'chofer'
                }
            }
        });

        if (signupError) {
            alert("Error al registrar chofer nuevo: " + signupError.message);
            return;
        }

        if (signupData && signupData.user) {
            alert("¡Cuenta de chofer registrada con éxito! Ingresando...");
            configurarSesionActiva(signupData.user);
        }
    } else {
        alert("Error de acceso: " + loginError.message);
    }
}

// CONFIGURAR INTERFAZ SEGÚN USUARIO Y ROL
function configurarSesionActiva(user) {
    usuarioActual = user;
    document.getElementById('btn-logout').style.display = 'block';
    document.getElementById('menu-navegacion').style.display = 'flex';
    
    const rolUsuario = user?.user_metadata?.rol || 'chofer';
    const btnNavAdmin = document.getElementById('btn-nav-admin');

    if (rolUsuario === 'admin') {
        if (btnNavAdmin) btnNavAdmin.style.display = 'flex';
        cargarReportesParaAdmin();
    } else {
        if (btnNavAdmin) btnNavAdmin.style.display = 'none';
    }

    cambiarVista('vista-flota');
    cargarVehiculos();
}

// NAVEGACIÓN ENTRE VISTAS
window.cambiarVista = function(idVista) {
    document.querySelectorAll('.vista').forEach(v => v.classList.remove('activa'));
    const vistaDestino = document.getElementById(idVista);
    if (vistaDestino) {
        vistaDestino.classList.add('activa');
        window.vistaActual = idVista;
    }

    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('activo'));
    if (idVista === 'vista-flota') {
        document.querySelector('button[onclick*="vista-flota"]')?.classList.add('activo');
    } else if (idVista === 'vista-admin') {
        document.querySelector('button[onclick*="vista-admin"]')?.classList.add('activo');
        cargarReportesParaAdmin();
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
        
        const rolUsuario = usuarioActual?.user_metadata?.rol || 'chofer';
        let botonEliminarAutoHtml = '';
        
        if (rolUsuario === 'admin') {
            botonEliminarAutoHtml = `
                <button class="btn-eliminar-auto" style="position: absolute; top: 5px; right: 5px; background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px;" title="Eliminar Vehiculo">
                    <span class="material-icons" style="font-size: 1.2rem;">delete</span>
                </button>
            `;
            item.style.position = 'relative';
        }

        item.innerHTML = `
            ${botonEliminarAutoHtml}
            <span class="material-icons" style="font-size: 2.5rem; color: var(--celeste); margin-top: 5px;">directions_car</span>
            <div style="font-weight: bold; margin-top: 5px;">${auto.patente}</div>
            <div style="font-size: 0.8rem; color: var(--texto-gris);">${auto.modelo || ''}</div>
        `;

        const botonTacho = item.querySelector('.btn-eliminar-auto');
        if (botonTacho) {
            botonTacho.addEventListener('click', (e) => {
                e.stopPropagation();
                eliminarVehiculoCompleto(auto.id, auto.patente);
            });
        }

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

// ELIMINAR VEHÍCULO Y REPORTES (ADMIN)
async function eliminarVehiculoCompleto(idVehiculo, patente) {
    const confirmar = confirm(`¿Estás seguro de eliminar el vehículo ${patente}?\nSe borrarán de forma PERMANENTE todos los reportes asociados.`);
    if (!confirmar) return;

    const { error: errorReportes } = await supabaseClient
        .from('reportes_jornadas')
        .delete()
        .eq('vehiculo_id', idVehiculo);

    if (errorReportes) {
        alert("Error al limpiar los reportes del auto: " + errorReportes.message);
        return;
    }

    const { error: errorVehiculo } = await supabaseClient
        .from('vehiculos')
        .delete()
        .eq('id', idVehiculo);

    if (errorVehiculo) {
        alert("Error al eliminar el vehículo: " + errorVehiculo.message);
    } else {
        alert(`Vehículo ${patente} eliminado correctamente.`);
        cargarVehiculos();
        if (window.vistaActual === 'vista-admin') cargarReportesParaAdmin();
    }
}

// ELIMINAR UN REPORTE INDIVIDUAL (ADMIN)
async function eliminarReporteIndividual(idReporte) {
    const confirmar = confirm("¿Estás seguro de eliminar este reporte de jornada de forma permanente?");
    if (!confirmar) return;

    const { error } = await supabaseClient
        .from('reportes_jornadas')
        .delete()
        .eq('id', idReporte);

    if (error) {
        alert("Error al eliminar el reporte: " + error.message);
    } else {
        alert("Reporte eliminado.");
        cargarReportesParaAdmin();
    }
}

// ENVIAR REPORTE DE JORNADA (CON SUBIDA DE FOTOS AL BUCKET 'FLOTA')
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

    if (inputFotos && inputFotos.files.length > 0) {
        for (let i = 0; i < inputFotos.files.length; i++) {
            const archivo = inputFotos.files[i];
            const nombreArchivo = `${Date.now()}_${i}_${archivo.name}`;
            
            // Subida limpia apuntando al bucket 'flota'
            const { data, error: uploadError } = await supabaseClient.storage
                .from('flota')
                .upload(nombreArchivo, archivo);

            if (uploadError) {
                console.error("Error subiendo foto:", uploadError.message);
            } else {
                // Generación de la URL pública correspondiente
                const { data: publicData } = supabaseClient.storage.from('flota').getPublicUrl(nombreArchivo);
                if (publicData?.publicUrl) {
                    urlsFotos.push(publicData.publicUrl);
                }
            }
        }
    }

    const { error } = await supabaseClient.from('reportes_jornadas').insert([{
        tipo,
        kilometraje,
        combustible,
        novedades: novedades || null,
        fotos_perimetro: urlsFotos,
        vehiculo_id: vehiculoSeleccionadoId
    }]);

    if (error) {
        alert("Error al enviar el reporte: " + error.message);
    } else {
        alert("Reporte guardado con éxito.");
        document.getElementById('reporte-km').value = '';
        document.getElementById('reporte-novedades').value = '';
        if (inputFotos) inputFotos.value = '';
        cambiarVista('vista-flota');
    }
}

// CARGAR HISTORIAL DE REPORTES EN PANEL ADMIN
async function cargarReportesParaAdmin() {
    const contenedor = document.getElementById('lista-reportes-admin');
    if (!contenedor) return;

    const { data: reportes, error: errorReportes } = await supabaseClient
        .from('reportes_jornadas')
        .select('*')
        .order('created_at', { ascending: false });

    const { data: vehiculos, error: errorVehiculos } = await supabaseClient
        .from('vehiculos').select('*');

    if (errorReportes || errorVehiculos) {
        console.error("Error cargando historial:", errorReportes?.message || errorVehiculos?.message);
        contenedor.innerHTML = `<p style="color: #ef4444;">No se pudieron cargar los reportes.</p>`;
        return;
    }

    if (!reportes || reportes.length === 0) {
        contenedor.innerHTML = `<p style="color: #64748b; font-style: italic;">No hay reportes cargados en el sistema todavía.</p>`;
        return;
    }

    const mapaVehiculos = {};
    if (vehiculos) {
        vehiculos.forEach(v => {
            mapaVehiculos[v.id] = `${v.patente} - ${v.modelo || ''}`;
        });
    }

    const reportesAgrupados = {};
    reportes.forEach(reporte => {
        const idVehiculo = reporte.vehiculo_id || 'sin_id';
        const nombreAuto = mapaVehiculos[idVehiculo] || 'Unidad No Identificada';

        if (!reportesAgrupados[nombreAuto]) {
            reportesAgrupados[nombreAuto] = [];
        }
        reportesAgrupados[nombreAuto].push(reporte);
    });

    contenedor.innerHTML = '';

    for (const [auto, listaDeReportes] of Object.entries(reportesAgrupados)) {
        const bloqueAuto = document.createElement('div');
        bloqueAuto.style.cssText = "margin-bottom: 25px; border: 1px solid #334155; border-radius: 10px; padding: 15px; background-color: #111827;";

        bloqueAuto.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 2px solid var(--celeste);">
                <span class="material-icons" style="color: var(--celeste);">directions_car</span>
                <h4 style="margin: 0; font-size: 1.1rem; color: #ffffff; font-weight: bold;">${auto}</h4>
            </div>
            <div class="lista-tarjetas-jornada" style="display: flex; flex-direction: column; gap: 12px;"></div>
        `;

        const contenedorTarjetas = bloqueAuto.querySelector('.lista-tarjetas-jornada');

        listaDeReportes.forEach(reporte => {
            const tarjeta = document.createElement('div');
            tarjeta.style.cssText = "background-color: #1e293b; padding: 12px; border-radius: 8px; border-left: 5px solid " + (reporte.tipo === 'Inicio' ? 'var(--verde-inicio)' : 'var(--naranja-fin)') + "; position: relative;";

            const fechaStr = reporte.created_at ? new Date(reporte.created_at).toLocaleString('es-AR') : 'Sin fecha';

            let fotosHtml = '';
            if (reporte.fotos_perimetro) {
                try {
                    const listaFotos = typeof reporte.fotos_perimetro === 'string' ? JSON.parse(reporte.fotos_perimetro) : reporte.fotos_perimetro;
                    if (Array.isArray(listaFotos) && listaFotos.length > 0) {
                        fotosHtml = `<div style="display: flex; gap: 10px; margin-top: 10px; overflow-x: auto; padding-bottom: 5px;">`;
                        listaFotos.forEach(url => {
                            fotosHtml += `
                                <a href="${url}" target="_blank" style="text-decoration: none; display: inline-block;">
                                    <img src="${url}" alt="Perimetro" style="width: 70px; height: 70px; object-fit: cover; border-radius: 6px; border: 1px solid #475569; display: block;" title="Clic para ampliar foto">
                                </a>`;
                        });
                        fotosHtml += `</div>`;
                    }
                } catch (e) {
                    console.error("Error parseando imágenes:", e);
                }
            }

            tarjeta.innerHTML = `
                <button class="btn-eliminar-reporte" style="position: absolute; top: 10px; right: 10px; background: none; border: none; color: #64748b; cursor: pointer; padding: 2px;" title="Eliminar Reporte">
                    <span class="material-icons" style="font-size: 1.1rem;">delete</span>
                </button>

                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; padding-right: 20px;">
                    <span style="font-weight: bold; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; background-color: ${reporte.tipo === 'Inicio' ? '#064e3b' : '#78350f'}; color: ${reporte.tipo === 'Inicio' ? '#34d399' : '#fbbf24'};">
                        ${reporte.tipo}
                    </span>
                    <span style="font-size: 0.8rem; color: var(--texto-gris); font-weight: 500;">${fechaStr}</span>
                </div>
                
                <div style="font-size: 0.9rem; display: grid; grid-template-columns: 1fr 1fr; gap: 5px; color: #cbd5e1;">
                    <p style="margin: 0;"><strong>KM:</strong> ${reporte.kilometraje || '---'}</p>
                    <p style="margin: 0;"><strong>Combustible:</strong> ${reporte.combustible || '---'}</p>
                </div>
                
                <p style="margin: 6px 0 0 0; font-size: 0.85rem; color: #94a3b8;">
                    <strong>Novedades:</strong> ${reporte.novedades || 'Ninguna'}
                </p>
                
                ${fotosHtml}
            `;

            tarjeta.querySelector('.btn-eliminar-reporte').addEventListener('click', () => {
                eliminarReporteIndividual(reporte.id);
            });

            contenedorTarjetas.appendChild(tarjeta);
        });

        contenedor.appendChild(bloqueAuto);
    }
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