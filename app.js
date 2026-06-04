// CONFIGURACIÓN DE SUPABASE REAL Y VERIFICADA
const SUPABASE_URL = "https://toqauhxdcyggnsejjijk.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvcWF1aHhkY3lnZ25zZWpqaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MDU4MzQsImV4cCI6MjA5NjA4MTgzNH0.Eb2u6O10ulBv20OoKvwaE64aqwEQzU80GnkbNd8Tp0I"; 

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// VARIABLES GLOBALES DE CONTROL
let usuarioActual = null;
let vehiculoSeleccionado = null; // Guardamos el objeto completo del auto
window.vistaActual = 'vista-login';

// EVENTOS AL CARGAR LA PÁGINA
document.addEventListener("DOMContentLoaded", async () => {
    document.getElementById('btn-ingresar').addEventListener('click', manejarAccesoUsuario);
    document.getElementById('btn-logout').addEventListener('click', cerrarSesion);
    document.getElementById('btn-agregar-vehiculo').addEventListener('click', agregarVehiculo);
    document.getElementById('btn-enviar-reporte').addEventListener('click', enviarReporte);

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
            abrirPanelReporteVehiculo(auto);
        };
        contenedor.appendChild(item);
    });
}

// ABRE EL REPORTE E INYECTA LOS CONTENEDORES DE DOCUMENTOS Y SERVICES (USANDO LA ESTRUCTURA NATIVA)
async function abrirPanelReporteVehiculo(auto) {
    vehiculoSeleccionado = auto; // Guardamos el objeto completo del auto activo
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

    contenedorDinamico.innerHTML = htmlDocumentos + htmlServices;

    if (rolUsuario === 'admin') {
        document.getElementById('btn-guardar-documento').addEventListener('click', subirDocumentacionAuto);
    }
    document.getElementById('btn-guardar-service').addEventListener('click', registrarServiceVehiculo);

    // Mostrar los datos que ya contiene el objeto del vehículo
    mostrarDocumentosAuto();
    mostrarServicesAuto();

    cambiarVista('vista-reporte');
}

// ==========================================
// SECCIÓN: LÓGICA DE DOCUMENTACIÓN (COLUMNA NATIVA 'documentos')
// ==========================================
async function subirDocumentacionAuto() {
    const nombreTipo = document.getElementById('doc-nombre-tipo').value.trim();
    const archivoInput = document.getElementById('doc-archivo-file');

    if (!nombreTipo || !archivoInput.files || archivoInput.files.length === 0) {
        alert("Completá el nombre del documento y seleccioná un archivo.");
        return;
    }

    const file = archivoInput.files[0];
    const extension = file.name.split('.').pop();
    const nombreArchivoStorage = `docs_${vehiculoSeleccionado.id}_${Date.now()}.${extension}`;

    // Subida al bucket 'flota'
    const { data: uploadData, error: errorUpload } = await supabaseClient.storage
        .from('flota')
        .upload(nombreArchivoStorage, file);

    if (errorUpload) {
        alert("Error subiendo archivo: " + errorUpload.message);
        return;
    }

    const { data: linkPublico } = supabaseClient.storage.from('flota').getPublicUrl(nombreArchivoStorage);

    // Interpretamos los documentos existentes
    let listaDocumentos = [];
    if (vehiculoSeleccionado.documentos) {
        try {
            listaDocumentos = JSON.parse(vehiculoSeleccionado.documentos);
            if (!Array.isArray(listaDocumentos)) listaDocumentos = [];
        } catch (e) {
            listaDocumentos = [];
        }
    }

    // Sumamos el nuevo documento al array
    listaDocumentos.push({
        nombre: nombreTipo,
        url: linkPublico.publicUrl
    });

    // Guardamos la actualización en la columna 'documentos' de la tabla 'vehiculos'
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

// ==========================================
// SECCIÓN: LÓGICA DE SERVICES (COLUMNA NATIVA 'services')
// ==========================================
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

    // Creamos el nuevo registro
    const nuevoService = {
        tarea_realizada: tarea,
        kilometraje: km,
        observaciones: notas || null,
        registrado_por: usuarioActual?.email || "Chofer",
        fecha: new Date().toLocaleDateString('es-AR')
    };

    listaServices.unshift(nuevoService); // Lo agregamos al principio del historial

    // Actualizamos la columna jsonb 'services'
    const { error } = await supabaseClient
        .from('vehiculos')
        .update({ services: JSON.stringify(listaServices) })
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

// ==========================================
// REPORTE DE JORNADAS (CORREGIDO CON PATENTE Y CHOFER OBLIGATORIOS)
// ==========================================
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
            
            const { data, error: uploadError } = await supabaseClient.storage
                .from('flota')
                .upload(nombreArchivo, archivo);

            if (!uploadError) {
                const { data: publicData } = supabaseClient.storage.from('flota').getPublicUrl(nombreArchivo);
                if (publicData?.publicUrl) urlsFotos.push(publicData.publicUrl);
            }
        }
    }

    // CORRECCIÓN CRÍTICA: Se inyectan de forma obligatoria las columnas 'patente' y 'chofer'
    const { error } = await supabaseClient.from('reportes_jornadas').insert([{
        tipo,
        kilometraje,
        combustible,
        novedades: novedades || null,
        fotos_perimetro: JSON.stringify(urlsFotos),
        vehiculo_id: vehiculoSeleccionado.id,
        patente: vehiculoSeleccionado.patente, // Requerido por la base de datos
        chofer: usuarioActual?.email || "Chofer Anónimo" // Requerido por la base de datos
    }]);

    if (error) {
        alert("Error al enviar el reporte: " + error.message);
    } else {
        alert("Reporte guardado con éxito.");
        
        // Actualizamos dinámicamente el kilometraje en la tabla vehiculos para mantener el estado real
        await supabaseClient.from('vehiculos').update({ km_actual: kilometraje }).eq('id', vehiculoSeleccionado.id);
        
        document.getElementById('reporte-km').value = '';
        document.getElementById('reporte-novedades').value = '';
        if (inputFotos) inputFotos.value = '';
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

// PANEL ADMINISTRADOR DE HISTORIAL
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
                                    <img src="${url}" alt="Perimetro" style="width: 70px; height: 70px; object-fit: cover; border-radius: 6px; border: 1px solid #475569; display: block;">
                                </a>`;
                        });
                        fotosHtml += `</div>`;
                    }
                } catch (e) { console.error(e); }
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
    document.getElementById('btn-logout').style.display = 'none';
    document.getElementById('menu-navegacion').style.display = 'none';
    cambiarVista('vista-login');
}