// Herramienta de diagnóstico para el celular
window.onerror = function(message, source, lineno, colno, error) {
    alert("¡Error de JS en el celu!\n\n" + message + "\n\nLínea: " + lineno);
    return false;
};

// CONFIGURACIÓN DE SUPABASE REAL Y VERIFICADA
const SUPABASE_URL = "https://toqauhxdcyggnsejjijk.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvcWF1aHhkY3lnZ25zZWpqaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MDU4MzQsImV4cCI6MjA5NjA4MTgzNH0.Eb2u6O10ulBv20OoKvwaE64aqwEQzU80GnkbNd8Tp0I"; 

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// VARIABLES GLOBALES DE CONTROL
let usuarioActual = null;
let vehiculoSeleccionado = null; 
let jornadasCargadasVehiculo = []; // Guardará las jornadas del vehículo activo para el PDF
window.vistaActual = 'vista-login';

// EVENTOS AL CARGAR LA PÁGINA
document.addEventListener("DOMContentLoaded", async () => {
    document.getElementById('btn-ingresar').addEventListener('click', manejarAccesoUsuario);
    document.getElementById('btn-logout').addEventListener('click', cerrarSesion);
    document.getElementById('btn-agregar-vehiculo').addEventListener('click', agregarVehiculo);
    document.getElementById('btn-enviar-reporte').addEventListener('click', enviarReporte);

    // Conexión de filtros y PDF en tiempo real (Vista Admin General)
    const filtroPatente = document.getElementById('filtro-patente');
    const filtroFecha = document.getElementById('filtro-fecha');
    const filtroMes = document.getElementById('filtro-mes');
    const btnLimpiar = document.getElementById('btn-limpiar-filtros');
    const btnPdf = document.getElementById('btn-descargar-pdf');

    if (filtroPatente) filtroPatente.addEventListener('input', filtrarReportes);
    if (filtroFecha) filtroFecha.addEventListener('change', filtrarReportes);
    if (filtroMes) filtroMes.addEventListener('change', filtrarReportes);
    if (btnLimpiar) btnLimpiar.addEventListener('click', limpiarFiltros);
    if (btnPdf) btnPdf.addEventListener('click', generarPDFAdminTexto);

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

    const { data: loginData, error: loginError } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (!loginError && loginData && loginData.user) {
        configurarSesionActiva(loginData.user);
        return;
    }

    if (loginError && (loginError.message.includes("Invalid login credentials") || loginError.status === 400 || loginError.status === 404)) {
        console.log("Usuario no encontrado, registrando chofer nuevo...");
        
        const { data: signupData, error: signupError } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: { data: { rol: 'chofer' } }
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
    try {
        // 1. Buscamos el contenedor donde se van a mostrar los autos
        // Reemplazá 'contenedor-vehiculos' por el ID real que uses en tu index.html
        const contenedor = document.getElementById('contenedor-vehiculos'); 
        
        if (!contenedor) {
            console.error("Falta el contenedor HTML para los vehículos.");
            return;
        }

        // 2. Traemos los datos de Supabase
        const { data: vehiculos, error } = await supabase
            .from('vehiculos')
            .select('*');

        if (error) throw error;

        // 3. Limpiamos la pantalla antes de cargar
        contenedor.innerHTML = '';

        if (!vehiculos || vehiculos.length === 0) {
            contenedor.innerHTML = '<p>No hay vehículos registrados.</p>';
            return;
        }

        // 4. Recorremos los autos y los dibujamos (Acá es donde estaba el error de la línea 134 y 151)
        vehiculos.forEach(auto => {
            // Creamos el div de la tarjeta
            const autoDiv = document.createElement('div');
            autoDiv.className = 'vehiculo-item'; // Usá tu clase CSS acá
            
            // Le metemos el texto con los datos del auto
            autoDiv.innerHTML = `
                <p><strong>Patente:</strong> ${auto.patente}</p>
                <p><strong>Marca/Modelo:</strong> ${auto.marca}</p>
            `;

            // SOLUCIÓN: Definimos y creamos el botón acá adentro para que exista
            const botonEliminarAutoHtml = document.createElement('button');
            botonEliminarAutoHtml.textContent = 'Eliminar';
            botonEliminarAutoHtml.onclick = () => eliminarVehiculo(auto.id);

            // Metemos el botón adentro de la tarjeta del auto
            autoDiv.appendChild(botonEliminarAutoHtml);

            // Metemos la tarjeta completa en el contenedor de la pantalla
            contenedor.appendChild(autoDiv);
        });

    } catch (error) {
        console.error("Error al cargar los vehículos:", error.message);
    }
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
            abrirPanelReporteVehiculo(auto);
        };
        contenedor.appendChild(item);
    
// ABRE EL REPORTE E INYECTA LOS CONTENEDORES DE DOCUMENTOS, SERVICES Y JORNADAS
async function abrirPanelReporteVehiculo(auto) {
    vehiculoSeleccionado = auto; 
    document.getElementById('reporte-titulo').innerText = `Reporte Unidad: ${auto.patente}`;
    
    const vistaReporte = document.getElementById('vista-reporte');
    let contenedorDinamico = document.getElementById('secciones-adicionales-flota');
    
    if (!contenedorDinamico) {
        contenedorDinamico = document.createElement('div');
        contenedorDinamico.id = 'secciones-adicionales-flota';
        contenedorDinamico.style.cssText = "margin-top: 25px; display: flex; flex-direction: column; gap: 20px;";
        vistaReporte.appendChild(contenedorDinamico);
    }

    const rolUsuario = usuarioActual?.user_metadata?.rol || 'chofer';

    // 1. Renderizar Estructura de Documentación Digital
    let htmlDocumentos = `
        <div style="background-color: #1e293b; padding: 15px; border-radius: 8px; border: 1px solid #334155;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px; border-bottom: 1px solid #475569; padding-bottom: 5px;">
                <span class="material-icons" style="color: #fbbf24;">folder_shared</span>
                <h3 style="margin:0; font-size: 1.1rem; color: #fff;">Documentación Obligatoria</h3>
            </div>
            <div id="documentos-visor-lista" style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 10px;"></div>
    `;
    
    if (rolUsuario === 'admin') {
        htmlDocumentos += `
            <div style="background-color: #111827; padding: 10px; border-radius: 6px; margin-top: 10px;">
                <label style="color: #cbd5e1; font-size: 0.85rem; display: block; margin-bottom: 5px;"><strong>Subir nuevo documento (VTV, Seguro, Cédula):</strong></label>
                <div style="display: flex; gap: 8px;">
                    <input type="text" id="doc-nombre-tipo" placeholder="Ej: Seguro 2026" style="flex: 1; padding: 6px; border-radius: 4px; border: 1px solid #475569; background: #1f2937; color:#fff; font-size: 0.85rem;">
                    <input type="file" id="doc-archivo-file" accept="image/*,application/pdf" style="max-width: 150px; font-size: 0.85rem; color: #94a3b8;">
                    <button id="btn-guardar-documento" style="background: var(--celeste); color: #000; border: none; padding: 6px 12px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.85rem;">Subir</button>
                </div>
            </div>
        `;
    }
    htmlDocumentos += `</div>`;

    // 2. Renderizar Estructura de Historial y Registro de Mantenimientos (Services)
    let htmlServices = `
        <div style="background-color: #1e293b; padding: 15px; border-radius: 8px; border: 1px solid #334155;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px; border-bottom: 1px solid #475569; padding-bottom: 5px;">
                <span class="material-icons" style="color: #10b981;">build</span>
                <h3 style="margin:0; font-size: 1.1rem; color: #fff;">Historial de Services e Insumos</h3>
            </div>
            
            <div style="background-color: #111827; padding: 12px; border-radius: 6px; margin-bottom: 15px; display: flex; flex-direction: column; gap: 8px;">
                <span style="color: #34d399; font-weight: bold; font-size: 0.85rem;">Registrar Nuevo Mantenimiento / Taller</span>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <input type="text" id="srv-tarea" placeholder="Ej: Cambio Aceite y Filtros" style="padding: 6px; border-radius: 4px; border: 1px solid #475569; background: #1f2937; color:#fff; font-size: 0.85rem;">
                    <input type="number" id="srv-km" placeholder="Kilometraje del Service" style="padding: 6px; border-radius: 4px; border: 1px solid #475569; background: #1f2937; color:#fff; font-size: 0.85rem;">
                </div>
                <input type="text" id="srv-notas" placeholder="Observaciones o taller (Opcional)" style="padding: 6px; border-radius: 4px; border: 1px solid #475569; background: #1f2937; color:#fff; font-size: 0.85rem;">
                <button id="btn-guardar-service" style="background: #10b981; color: #fff; border: none; padding: 6px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.85rem;">Guardar Registro de Taller</button>
            </div>

            <div id="services-tabla-lista" style="max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;"></div>
        </div>
    `;

    // 3. NUEVA MEJORA: Estructura para buscar y ver las Jornadas del Vehículo en Pantalla
    let htmlJornadasVisor = `
        <div style="background-color: #1e293b; padding: 15px; border-radius: 8px; border: 1px solid #334155;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid #475569; padding-bottom: 5px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="material-icons" style="color: var(--celeste);">assignment</span>
                    <h3 style="margin:0; font-size: 1.1rem; color: #fff;">Historial de Jornadas de la Unidad</h3>
                </div>
                <button id="btn-pdf-jornadas-unidad" style="background: #e11d48; color: #fff; border: none; padding: 5px 10px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.75rem; display: flex; align-items: center; gap: 4px;">
                    <span class="material-icons" style="font-size: 0.9rem;">download</span> PDF (Solo Texto)
                </button>
            </div>
            <div id="jornadas-unidad-lista" style="max-height: 350px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px;">
                <p style="color: #64748b; font-size: 0.85rem; margin:0;">Cargando historial de rutas...</p>
            </div>
        </div>
    `;

    contenedorDinamico.innerHTML = htmlDocumentos + htmlServices + htmlJornadasVisor;

    if (rolUsuario === 'admin') {
        document.getElementById('btn-guardar-documento').addEventListener('click', subirDocumentacionAuto);
    }
    document.getElementById('btn-guardar-service').addEventListener('click', registrarServiceVehiculo);
    document.getElementById('btn-pdf-jornadas-unidad').addEventListener('click', generarPDFJornadasUnidadTexto);

    mostrarDocumentosAuto();
    mostrarServicesAuto();
    cargarYMostrarJornadasUnidad(auto.id, auto.patente); // Ejecuta la consulta y dibuja en pantalla

    cambiarVista('vista-reporte');
}

// SECCIÓN: LÓGICA DE DOCUMENTACIÓN
async function subirDocumentacionAuto() {
    const nombreTipo = document.getElementById('doc-nombre-tipo').value.trim();
    const archivoInput = document.getElementById('doc-archivo-file');

    if (!nombreTipo || !archivoInput.files || archivoInput.files.length === 0) {
        alert("Completá el nombre del documento and seleccioná un archivo.");
        return;
    }

    const file = archivoInput.files[0];
    const extension = file.name.split('.').pop();
    const nombreArchivoStorage = `docs_${vehiculoSeleccionado.id}_${Date.now()}.${extension}`;

    const { data: uploadData, error: errorUpload } = await supabaseClient.storage
        .from('flota')
        .upload(nombreArchivoStorage, file);

    if (errorUpload) {
        alert("Error subiendo archivo: " + errorUpload.message);
        return;
    }

    const { data: linkPublico } = supabaseClient.storage.from('flota').getPublicUrl(nombreArchivoStorage);

    let listaDocumentos = [];
    if (vehiculoSeleccionado.documentos) {
        try {
            listaDocumentos = JSON.parse(vehiculoSeleccionado.documentos);
            if (!Array.isArray(listaDocumentos)) listaDocumentos = [];
        } catch (e) {
            listaDocumentos = [];
        }
    }

    listaDocumentos.push({
        nombre: nombreTipo,
        url: linkPublico.publicUrl
    });

    const { error: errorUpdate } = await supabaseClient
        .from('vehiculos')
        .update({ documentos: JSON.stringify(listaDocumentos) })
        .eq('id', vehiculoSeleccionado.id);

    if (errorUpdate) {
        alert("Error al guardar el documento en la base de datos: " + errorUpdate.message);
    } else {
        alert("Documento guardado con éxito.");
        vehiculoSeleccionado.documentos = JSON.stringify(listaDocumentos);
        document.getElementById('doc-nombre-tipo').value = '';
        archivoInput.value = '';
        mostrarDocumentosAuto();
    }
}

function mostrarDocumentosAuto() {
    const contenedor = document.getElementById('documentos-visor-lista');
    if (!contenedor) return;

    let documentos = [];
    if (vehiculoSeleccionado.documentos) {
        try {
            documentos = JSON.parse(vehiculoSeleccionado.documentos);
        } catch (e) {
            documentos = [];
        }
    }

    if (!Array.isArray(documentos) || documentos.length === 0) {
        contenedor.innerHTML = `<p style="color: #64748b; font-size: 0.85rem; margin:0;">No hay documentos digitales cargados para este auto.</p>`;
        return;
    }

    contenedor.innerHTML = '';
    documentos.forEach(doc => {
        const link = document.createElement('a');
        link.href = doc.url;
        link.target = '_blank';
        link.style.cssText = "background: #334155; color: #fbbf24; padding: 6px 12px; border-radius: 6px; font-size: 0.85rem; text-decoration: none; display: flex; align-items: center; gap: 5px; font-weight: bold; border: 1px solid #475569;";
        link.innerHTML = `<span class="material-icons" style="font-size:1rem;">description</span> ${doc.nombre}`;
        contenedor.appendChild(link);
    });
}

// SECCIÓN: LÓGICA DE SERVICES
async function registrarServiceVehiculo() {
    const tarea = document.getElementById('srv-tarea').value.trim();
    const km = parseInt(document.getElementById('srv-km').value);
    const notas = document.getElementById('srv-notas').value.trim();

    if (!tarea || !km) {
        alert("Por favor detallá qué le hicieron al auto y el kilometraje.");
        return;
    }

    let listaServices = [];
    if (vehiculoSeleccionado.services) {
        listaServices = Array.isArray(vehiculoSeleccionado.services) 
            ? vehiculoSeleccionado.services 
            : (typeof vehiculoSeleccionado.services === 'string' ? JSON.parse(vehiculoSeleccionado.services) : []);
    }

    const nuevoService = {
        tarea_realizada: tarea,
        kilometraje: km,
        observaciones: notas || null,
        registrado_por: usuarioActual?.email || "Chofer",
        fecha: new Date().toLocaleDateString('es-AR')
    };

    listaServices.unshift(nuevoService);

    const { error } = await supabaseClient
        .from('vehiculos')
        .update({ services: listaServices })
        .eq('id', vehiculoSeleccionado.id);

    if (error) {
        alert("Error al registrar el service: " + error.message);
    } else {
        alert("Service asentado en el historial de la unidad.");
        vehiculoSeleccionado.services = listaServices;
        document.getElementById('srv-tarea').value = '';
        document.getElementById('srv-km').value = '';
        document.getElementById('srv-notas').value = '';
        mostrarServicesAuto();
    }
}

function mostrarServicesAuto() {
    const contenedor = document.getElementById('services-tabla-lista');
    if (!contenedor) return;

    let mantes = vehiculoSeleccionado.services || [];
    if (typeof mantes === 'string') {
        try { mantes = JSON.parse(mantes); } catch(e) { mantes = []; }
    }

    if (!Array.isArray(mantes) || mantes.length === 0) {
        contenedor.innerHTML = `<p style="color: #64748b; font-size: 0.85rem; margin:0;">Sin registros de mantenimiento previos.</p>`;
        return;
    }

    contenedor.innerHTML = '';
    mantes.forEach(s => {
        const fila = document.createElement('div');
        fila.style.cssText = "background: #111827; padding: 8px; border-radius: 6px; border-left: 3px solid #10b981; font-size: 0.8rem; color: #e2e8f0;";
        
        fila.innerHTML = `
            <div style="display:flex; justify-content: space-between; font-weight: bold; margin-bottom: 2px; color: #fff;">
                <span>${s.tarea_realizada}</span>
                <span style="color: #34d399;">${s.kilometraje} KM</span>
            </div>
            <div style="color: #94a3b8; font-size: 0.75rem;">
                Fecha: ${s.fecha || '---'} | Por: ${s.registrado_por ? s.registrado_por.split('@')[0] : 'Chofer'}
            </div>
            ${s.observaciones ? `<div style="margin-top: 3px; color: #cbd5e1; font-style: italic;">Obs: ${s.observaciones}</div>` : ''}
        `;
        contenedor.appendChild(fila);
    });
}

// NUEVA MEJORA: CONSULTA DE JORNADAS EN PANTALLA PARA EL VEHÍCULO SELECCIONADO
async function cargarYMostrarJornadasUnidad(vehiculoId, patente) {
    const contenedor = document.getElementById('jornadas-unidad-lista');
    if (!contenedor) return;

    const { data: reportes, error } = await supabaseClient
        .from('reportes_jornadas')
        .select('*')
        .eq('vehiculo_id', vehiculoId)
        .order('created_at', { ascending: false });

    if (error) {
        contenedor.innerHTML = `<p style="color: #ef4444; font-size:0.85rem;">Error al cargar jornadas: ${error.message}</p>`;
        return;
    }

    jornadasCargadasVehiculo = reportes || []; // Guardamos en memoria global para el generador de PDF

    if (jornadasCargadasVehiculo.length === 0) {
        contenedor.innerHTML = `<p style="color: #64748b; font-size: 0.85rem; margin:0; font-style: italic;">No hay jornadas registradas para este vehículo.</p>`;
        return;
    }

    contenedor.innerHTML = '';
    jornadasCargadasVehiculo.forEach(rep => {
        const tarjeta = document.createElement('div');
        tarjeta.style.cssText = "background: #111827; padding: 10px; border-radius: 6px; border-left: 4px solid " + (rep.tipo === 'Inicio' ? 'var(--verde-inicio, #10b981)' : 'var(--naranja-fin, #f97316)') + "; color: #e2e8f0; font-size: 0.8rem;";
        
        const fechaStr = rep.created_at ? new Date(rep.created_at).toLocaleString('es-AR') : 'Sin fecha';

        // Procesar fotos de perímetro para descarga
        let btnFotosDescargaHtml = '';
        if (rep.fotos_perimetro) {
            try {
                const listaFotos = typeof rep.fotos_perimetro === 'string' ? JSON.parse(rep.fotos_perimetro) : rep.fotos_perimetro;
                if (Array.isArray(listaFotos) && listaFotos.length > 0) {
                    btnFotosDescargaHtml = `<div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">`;
                    listaFotos.forEach((url, i) => {
                        btnFotosDescargaHtml += `
                            <button onclick="window.descargarArchivoDispositivo('${url}', 'Foto_Perimetro_${patente}_${i+1}.jpg')" style="background:#334155; color:#38bdf8; border:none; padding:4px 8px; border-radius:4px; font-size:0.7rem; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:3px;">
                                <span class="material-icons" style="font-size:0.85rem;">file_download</span> Descargar Foto ${i+1}
                            </button>
                        `;
                    });
                    btnFotosDescargaHtml += `</div>`;
                }
            } catch(e) { console.error(e); }
        }

        // Procesar ticket de combustible para descarga
        let btnTicketDescargaHtml = '';
        if (rep.ticket_combustible) {
            btnTicketDescargaHtml = `
                <div style="margin-top:6px; padding-top:4px; border-top:1px dashed #334155;">
                    <button onclick="window.descargarArchivoDispositivo('${rep.ticket_combustible}', 'Ticket_Combustible_${patente}.jpg')" style="background:#334155; color:#fbbf24; border:none; padding:4px 8px; border-radius:4px; font-size:0.7rem; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:3px;">
                        <span class="material-icons" style="font-size:0.85rem;">receipt</span> Descargar Ticket Combustible
                    </button>
                </div>
            `;
        }

        tarjeta.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; font-weight:bold; margin-bottom:4px;">
                <span style="background:" + (rep.tipo === 'Inicio' ? '#064e3b' : '#78350f') + "; color:" + (rep.tipo === 'Inicio' ? '#34d399' : '#fbbf24') + "; padding:2px 6px; border-radius:4px; font-size:0.75rem;">${rep.tipo}</span>
                <span style="color:#94a3b8; font-size:0.75rem;">${fechaStr}</span>
            </div>
            <div style="color:#cbd5e1; margin-bottom:3px;"><strong>Chofer:</strong> ${rep.chofer || '---'}</div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:5px; margin-bottom:4px; background:#1f2937; padding:5px; border-radius:4px;">
                <span><strong>KM:</strong> ${rep.kilometraje || '---'}</span>
                <span><strong>Nafta:</strong> ${rep.combustible || '---'}</span>
            </div>
            <div><strong>Novedades:</strong> ${rep.novedades || 'Ninguna'}</div>
            ${btnFotosDescargaHtml}
            ${btnTicketDescargaHtml}
        `;
        contenedor.appendChild(tarjeta);
    });
}

// NUEVA MEJORA: HERRAMIENTA ROBUSTA PARA DESCARGAR IMÁGENES/ARCHIVOS EN EL DISPOSITIVO
window.descargarArchivoDispositivo = async function(url, nombreArchivo) {
    try {
        const respuesta = await fetch(url);
        const blob = await respuesta.blob();
        const urlBlob = URL.createObjectURL(blob);
        
        const enlace = document.createElement('a');
        enlace.href = urlBlob;
        enlace.download = nombreArchivo;
        document.body.appendChild(enlace);
        enlace.click();
        
        document.body.removeChild(enlace);
        URL.revokeObjectURL(urlBlob);
    } catch (error) {
        console.warn("Falla de CORS al descargar directo, abriendo en pestaña para guardar manual:", error);
        window.open(url, '_blank');
    }
};

// NUEVA MEJORA: GENERAR PDF DE JORNADAS DE UN VEHÍCULO ESPECÍFICO (FORMATO TEXTO, SIN IMÁGENES)
function generarPDFJornadasUnidadTexto() {
    if (!jornadasCargadasVehiculo || jornadasCargadasVehiculo.length === 0) {
        alert("No hay datos de jornadas disponibles en pantalla para exportar.");
        return;
    }

    if (!window.jspdf) {
        alert("Error: La librería jsPDF no está cargada. Por favor agregá el script en tu HTML.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const patente = vehiculoSeleccionado?.patente || 'UNIDAD';

    // Encabezado
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(`HISTORIAL DE JORNADAS - UNIDAD: ${patente}`, 14, 18);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha de Reporte: ${new Date().toLocaleString('es-AR')}`, 14, 25);
    doc.line(14, 28, 196, 28);

    let lineaY = 36;
    const alturaPagina = doc.internal.pageSize.height;

    jornadasCargadasVehiculo.forEach((j, index) => {
        // Control de salto de página inteligente
        if (lineaY > alturaPagina - 40) {
            doc.addPage();
            lineaY = 20;
        }

        const fecha = j.created_at ? new Date(j.created_at).toLocaleString('es-AR') : '---';

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(`${index + 1}. Registro de ${j.tipo} — ${fecha}`, 14, lineaY);
        lineaY += 6;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(`Chofer: ${j.chofer || '---'}`, 14, lineaY);
        lineaY += 5;
        doc.text(`Kilometraje: ${j.kilometraje || '---'} KM | Nivel Combustible: ${j.combustible || '---'}`, 14, lineaY);
        lineaY += 5;

        // Ajuste automático de renglones para las novedades por si son largas
        const textoNov = `Novedades/Notas: ${j.novedades || 'Ninguna'}`;
        const parrafoDividido = doc.splitTextToSize(textoNov, 180);
        doc.text(parrafoDividido, 14, lineaY);
        lineaY += (parrafoDividido.length * 5) + 3;

        // Separador fino entre tarjetas
        doc.setDrawColor(200, 200, 200);
        doc.line(14, lineaY - 1, 196, lineaY - 1);
        lineaY += 6;
    });

    doc.save(`Jornadas_Texto_${patente}_${Date.now()}.pdf`);
}

// REPORTE DE JORNADAS (ENVÍO)
async function enviarReporte() {
    const tipo = document.getElementById('reporte-tipo').value;
    const kilometraje = parseInt(document.getElementById('reporte-km').value);
    const combustible = document.getElementById('reporte-combustible').value;
    const novedades = document.getElementById('reporte-novedades').value.trim();
    const inputFotos = document.getElementById('reporte-fotos');
    const inputTicket = document.getElementById('reporte-ticket-combustible');

    if (!kilometraje) {
        alert("Por favor ingrese el kilometraje actual.");
        return;
    }

    let urlsFotos = [];

    if (inputFotos && inputFotos.files.length > 0) {
        for (let i = 0; i < inputFotos.files.length; i++) {
            const archivo = inputFotos.files[i];
            const nombreArchivo = `${Date.now()}_${i}_${archivo.name}`;
            
            const { data, error: uploadError } = await supabaseClient.storage
                .from('flota')
                .upload(nombreArchivo, archivo);

            if (!uploadError) {
                const { data: publicData } = supabaseClient.storage.from('flota').getPublicUrl(nombreArchivo);
                if (publicData?.publicUrl) urlsFotos.push(publicData.publicUrl);
            }
        }
    }

    let urlTicket = null;
    if (inputTicket && inputTicket.files.length > 0) {
        const archivoTicket = inputTicket.files[0];
        const nombreTicket = `ticket_${Date.now()}_${archivoTicket.name}`;

        const { data: uploadTicketData, error: uploadTicketError } = await supabaseClient.storage
            .from('flota')
            .upload(nombreTicket, archivoTicket);

        if (!uploadTicketError) {
            const { data: publicTicketData } = supabaseClient.storage.from('flota').getPublicUrl(nombreTicket);
            if (publicTicketData?.publicUrl) urlTicket = publicTicketData.publicUrl;
        }
    }

    const { error } = await supabaseClient.from('reportes_jornadas').insert([{
        tipo,
        kilometraje,
        combustible,
        novedades: novedades || null,
        fotos_perimetro: urlsFotos, 
        ticket_combustible: urlTicket, 
        vehiculo_id: vehiculoSeleccionado.id,
        patente: vehiculoSeleccionado.patente, 
        chofer: usuarioActual?.email || "Chofer Anónimo" 
    }]);

    if (error) {
        alert("Error al enviar el reporte: " + error.message);
    } else {
        alert("Reporte guardado con éxito.");
        
        await supabaseClient.from('vehiculos').update({ km_actual: kilometraje }).eq('id', vehiculoSeleccionado.id);
        
        document.getElementById('reporte-km').value = '';
        document.getElementById('reporte-novedades').value = '';
        if (inputFotos) inputFotos.value = '';
        if (inputTicket) inputTicket.value = ''; 
        cambiarVista('vista-flota');
    }
}

// AGREGAR VEHÍCULO (ADMIN)
async function agregarVehiculo() {
    const patente = document.getElementById('admin-patente').value.trim().toUpperCase();
    const modelo = document.getElementById('admin-modelo').value.trim();

    if (!patente) {
        alert("Escriba la patente del auto.");
        return;
    }

    const { error } = await supabaseClient.from('vehiculos').insert([{ patente, modelo, documentos: "[]", services: [] }]);

    if (error) {
        alert("Error al guardar auto: " + error.message);
    } else {
        alert("Vehículo guardado correctamente.");
        document.getElementById('admin-patente').value = '';
        document.getElementById('admin-modelo').value = '';
        cargarVehiculos();
    }
}

// ELIMINAR VEHÍCULO COMPLETAMENTE
async function eliminarVehiculoCompleto(idVehiculo, patente) {
    const confirmar = confirm(`¿Estás seguro de eliminar el vehículo ${patente}?\nSe borrarán todos los reportes asociados.`);
    if (!confirmar) return;

    await supabaseClient.from('reportes_jornadas').delete().eq('vehiculo_id', idVehiculo);
    const { error: errorVehiculo } = await supabaseClient.from('vehiculos').delete().eq('id', idVehiculo);

    if (errorVehiculo) {
        alert("Error al eliminar el vehículo: " + errorVehiculo.message);
    } else {
        alert(`Vehículo ${patente} eliminado.`);
        cargarVehiculos();
    }
}

// ELIMINAR UN REPORTE INDIVIDUAL (ADMIN)
async function eliminarReporteIndividual(idReporte) {
    const confirmar = confirm("¿Estás seguro de eliminar este reporte?");
    if (!confirmar) return;

    const { error } = await supabaseClient.from('reportes_jornadas').delete().eq('id', idReporte);
    if (error) alert("Error: " + error.message);
    else { alert("Reporte eliminado."); cargarReportesParaAdmin(); }
}

// PANEL ADMINISTRADOR DE HISTORIAL GENERAL
async function cargarReportesParaAdmin() {
    const contenedor = document.getElementById('lista-reportes-admin');
    if (!contenedor) return;

    const { data: reportes, error: errorReportes } = await supabaseClient
        .from('reportes_jornadas')
        .select('*')
        .order('created_at', { ascending: false });

    if (errorReportes) {
        contenedor.innerHTML = `<p style="color: #ef4444;">No se pudieron cargar los reportes.</p>`;
        return;
    }

    if (!reportes || reportes.length === 0) {
        contenedor.innerHTML = `<p style="color: #64748b; font-style: italic;">No hay reportes cargados.</p>`;
        return;
    }

    const reportesAgrupados = {};
    reportes.forEach(reporte => {
        const nombreAuto = reporte.patente || 'Unidad No Identificada';
        if (!reportesAgrupados[nombreAuto]) reportesAgrupados[nombreAuto] = [];
        reportesAgrupados[nombreAuto].push(reporte);
    });

    contenedor.innerHTML = '';

    for (const [auto, listaDeReportes] of Object.entries(reportesAgrupados)) {
        const bloqueAuto = document.createElement('div');
        bloqueAuto.className = 'bloque-vehiculo-grupo';
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
            tarjeta.className = 'card-reporte';
            const fechaISO = reporte.created_at ? reporte.created_at.split('T')[0] : '';
            tarjeta.setAttribute('data-patente', auto.trim().toLowerCase());
            tarjeta.setAttribute('data-fecha', fechaISO);

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
                                    <img src="${url}" alt="Perimetro" style="width: 70px; height: 70px; object-fit: cover; border-radius: 6px; border: 1px solid #475569; display: block;">
                                </a>`;
                        });
                        fotosHtml += `</div>`;
                    }
                } catch (e) { console.error(e); }
            }

            let ticketHtml = '';
            if (reporte.ticket_combustible) {
                ticketHtml = `
                    <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed #334155;">
                        <span style="font-size: 0.75rem; color: #94a3b8; display: block; margin-bottom: 4px;"><strong>Ticket de Carga Combustible:</strong></span>
                        <a href="${reporte.ticket_combustible}" target="_blank" style="display: inline-block;">
                            <img src="${reporte.ticket_combustible}" alt="Ticket Combustible" style="width: 75px; height: 75px; object-fit: cover; border-radius: 6px; border: 1px solid #fbbf24;">
                        </a>
                    </div>
                `;
            }

            tarjeta.innerHTML = `
                <button class="btn-eliminar-reporte" style="position: absolute; top: 10px; right: 10px; background: none; border: none; color: #64748b; cursor: pointer; padding: 2px;">
                    <span class="material-icons" style="font-size: 1.1rem;">delete</span>
                </button>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; padding-right: 20px;">
                    <span style="font-weight: bold; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; background-color: ${reporte.tipo === 'Inicio' ? '#064e3b' : '#78350f'}; color: ${reporte.tipo === 'Inicio' ? '#34d399' : '#fbbf24'};">${reporte.tipo}</span>
                    <span style="font-size: 0.8rem; color: var(--texto-gris);">${fechaStr}</span>
                </div>
                <div style="font-size: 0.75rem; color: #94a3b8; margin-bottom: 5px;"><strong>Chofer:</strong> ${reporte.chofer || '---'}</div>
                <div style="font-size: 0.9rem; display: grid; grid-template-columns: 1fr 1fr; gap: 5px; color: #cbd5e1;">
                    <p style="margin: 0;"><strong>KM:</strong> ${reporte.kilometraje || '---'}</p>
                    <p style="margin: 0;"><strong>Combustible:</strong> ${reporte.combustible || '---'}</p>
                </div>
                <p style="margin: 6px 0 0 0; font-size: 0.85rem; color: #94a3b8;"><strong>Novedades:</strong> ${reporte.novedades || 'Ninguna'}</p>
                ${fotosHtml}
                ${ticketHtml}
            `;

            tarjeta.querySelector('.btn-eliminar-reporte').addEventListener('click', () => { eliminarReporteIndividual(reporte.id); });
            contenedorTarjetas.appendChild(tarjeta);
        });

        contenedor.appendChild(bloqueAuto);
    }
}

// CERRAR SESIÓN
async function cerrarSesion() {
    await supabaseClient.auth.signOut();
    usuarioActual = null;
    vehiculoSeleccionado = null;
    jornadasCargadasVehiculo = [];
    document.getElementById('btn-logout').style.display = 'none';
    document.getElementById('menu-navegacion').style.display = 'none';
    cambiarVista('vista-login');
}

// REGISTRO DE LA PWA (INSTALABLE)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('PWA lista e instalable con éxito', reg))
      .catch(err => console.error('Error registrando Service Worker', err));
  });
}

// FILTRADO MÚLTIPLE AVANZADO EN TIEMPO REAL (ADMIN GENERAL)
const filtrarReportes = () => {
    const patenteBuscada = document.getElementById('filtro-patente').value.toLowerCase().trim();
    const fechaBuscada = document.getElementById('filtro-fecha').value;
    const mesBuscado = document.getElementById('filtro-mes').value; 

    const gruposVehiculos = document.querySelectorAll('.bloque-vehiculo-grupo');

    gruposVehiculos.forEach(grupo => {
        const reportes = grupo.querySelectorAll('.card-reporte');
        let algunaTarjetaVisible = false;

        reportes.forEach(reporte => {
            const patente = reporte.getAttribute('data-patente') || '';
            const fecha = reporte.getAttribute('data-fecha') || ''; 
            
            let coincide = true;

            if (patenteBuscada && !patente.includes(patenteBuscada)) coincide = false;
            if (fechaBuscada && fecha !== fechaBuscada) coincide = false;
            if (mesBuscado && !fecha.startsWith(mesBuscado)) coincide = false;

            reporte.style.display = coincide ? 'block' : 'none';
            
            if (coincide) {
                algunaTarjetaVisible = true;
            }
        });

        grupo.style.display = algunaTarjetaVisible ? 'block' : 'none';
    });
};

// COMPLETADO: Función para restaurar filtros vacíos
const limpiarFiltros = () => {
    document.getElementById('filtro-patente').value = '';
    document.getElementById('filtro-fecha').value = '';
    document.getElementById('filtro-mes').value = '';
    filtrarReportes();
};

// NUEVA MEJORA: GENERAR PDF TEXTUAL DESDE LA VISTA GENERAL DE ADMIN (RESPETA LOS FILTROS DE PANTALLA)
function generarPDFAdminTexto() {
    if (!window.jspdf) {
        alert("Librería jsPDF no detectada.");
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("REPORTE CONSOLIDADO DE JORNADAS (FILTRADO)", 14, 18);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Generado el: ${new Date().toLocaleString('es-AR')}`, 14, 24);
    doc.line(14, 27, 196, 27);

    let lineaY = 35;
    const alturaPagina = doc.internal.pageSize.height;
    
    // Tomamos solo las tarjetas que están visibles en la pantalla en este momento
    const tarjetasVisibles = document.querySelectorAll('.card-reporte');
    let contador = 0;

    tarjetasVisibles.forEach(tarjeta => {
        if (tarjeta.style.display === 'none') return; // Ignora los que filtraste
        contador++;

        if (lineaY > alturaPagina - 35) {
            doc.addPage();
            lineaY = 20;
        }

        const infoEncabezado = tarjeta.querySelector('div').innerText.replace(/\n/g, ' | ');
        const chofer = tarjeta.querySelector('div:nth-of-type(2)').innerText;
        const datosKm = tarjeta.querySelector('div:nth-of-type(3)').innerText.replace(/\n/g, ' ');
        const novedades = tarjeta.querySelector('p').innerText;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(`${contador}. ${infoEncabezado}`, 14, lineaY);
        lineaY += 5;

        doc.setFont("helvetica", "normal");
        doc.text(`${chofer} | ${datosKm}`, 14, lineaY);
        lineaY += 5;

        const parrafoNov = doc.splitTextToSize(novedades, 180);
        doc.text(parrafoNov, 14, lineaY);
        lineaY += (parrafoNov.length * 5) + 3;

        doc.line(14, lineaY - 1, 196, lineaY - 1);
        lineaY += 5;
    });

    if(contador === 0) {
        alert("No hay registros visibles para exportar.");
        return;
    }

    doc.save(`Reporte_General_Texto_${Date.now()}.pdf`);
}