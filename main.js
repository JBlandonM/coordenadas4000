const endpoint = "https://script.google.com/macros/s/AKfycbwRkCiftKbx4Hr8CbgIWA9mqV7JEg78FaNjE5uoJCVWN4xFCLibIgpWC5uCEc5qFhcHFA/exec";

const inputTelefono = document.getElementById("inputTelefono");
const estado = document.getElementById("estado");
const btn = document.getElementById("btnPrincipal");
const actions = document.getElementById("accionesExistente");

async function postServer(payload) {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
      },
      body: JSON.stringify(payload),
      mode: "cors",
      cache: "no-store",
      credentials: "omit"
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error conectando con el servidor de Sheets:", error);
    throw error;
  }
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(() => console.log("SW registrado"))
    .catch(err => console.error("Error SW:", err));
}

// Auto focus al cargar
window.onload = () => {
  inputTelefono.focus();
};

//Enter guarda automáticamente
inputTelefono.addEventListener("keypress", function (e) {
  if (e.key === "Enter" || event.keyCode === 13) {
    e.preventDefault();
    document.activeElement.blur();

    if (!btn.disabled) {
      btn.click();
    }
  }
});

let datosRecuperados = null;

/**
* Muestra el modal y devuelve una promesa que se resuelve al hacer clic
*/
function mostrarModal(titulo, mensaje) {
  return new Promise((resolve) => {

    const modal = document.getElementById("miModal");
    const btnTrue = document.getElementById("btnConfirmar");
    const btnFalse = document.getElementById("btnCancelar");
    btn.disabled = true;


    document.getElementById("modalTitulo").innerText = titulo;
    document.getElementById("modalMensaje").innerText = mensaje;

    modal.style.display = "flex";

    // Al aceptar
    btnTrue.onclick = () => {
      limpiarBotones();
      modal.style.display = "none";
      resolve(true);
    };
    // Al Cancelar
    btnFalse.onclick = () => {
      limpiarBotones();
      modal.style.display = "none";
      resolve(false);
    };

  });
}
function limpiarBotones() {
  document.getElementById("btnConfirmar").onclick = null;
  document.getElementById("btnCancelar").onclick = null;
}

async function flujoConsultar() {
  let tel = '';
  let servidorRespondio = false;
  let fallbackActivado = false; // Flag para saber si el timer ya actuó

  try {
    mostrarOpcionesExistente("none"); //++++++++++++++++++++++++++++++
    const input = document.getElementById("inputTelefono");
    // Extraemos solo los números, ignorando espacios o guiones que el teclado móvil pueda insertar
    tel = input.value.replace(/\D/g, '');

    const patron = /^\d{8}$/;
    if (!patron.test(tel)) {
      alert("Deben ser exactamente 8 dígitos numéricos");
      input.focus();
      return;
    }
    btn.disabled = true; // Prevenir múltiples clicks
    mostrarFeedback("Consultando", "loading");

    const timerSeguridad = setTimeout(() => {
      if (!servidorRespondio) {
        fallbackActivado = true;
        console.warn("⚠️ Tiempo de espera agotado. Cambiando a modo offline.");
        mostrarFeedback("Red lenta. Guardando localmente...", "loading");
        ejecutarGuardado(tel, "EXTERNAL_SAVE"); // Forzamos guardado local
      }
    }, 4000); // 4000ms = 4 segundos de tolerancia

    // --- CONFIGURACIÓN DEL TIMEOUT ---

    const consultResult = await postServer({ telefono: tel, modo: "CONSULTAR" });
    servidorRespondio = true;
    clearTimeout(timerSeguridad);

    // Si la red fue lenta y el timer de seguridad ya inició el guardado de emergencia,
    // abortamos silenciosamente este flujo para no mostrar modales confusos.
    if (fallbackActivado) {
      console.log("Consulta finalizada tarde. El modo offline ya se había activado.");
      return;
    }

    mostrarFeedback(consultResult.status || "Listo", "success");

    //console.log(consultResult);
    if (consultResult.success) {

      if (consultResult.mode !== "NUEVO") {
        datosRecuperados = consultResult
        //mostrarOpcionesExistente("flex");
        const mostrar = await mostrarModal("Número Registrado", "¿Ver Coordenadas 📍🌍?");
        if (mostrar) {
          verEnMapa();
          console.log("Presionaste Ver en Mapa");
          input.focus();
        } else {
          console.log("Presionaste Cancelar");
          input.focus();
        }
      }

      if (consultResult.mode == "NUEVO") {
        const mostrar = await mostrarModal("Número No Registrado", "¿Desea registrarlo con la coordenada actual?");
        if (mostrar) {
          ejecutarGuardado(tel, "NUEVO");
          input.focus();
        } else {
          console.log("Presionaste Cancelar");
          input.focus();
        }
      }
    } else {
      console.log("Respuesta del servidor sin exito");
    }

  } catch (e) {
    console.log("Error en el servidor: " + e);
    // Si falla inmediatamente (ej. sin internet), evitamos doble ejecución si el timer ya actuó
    if (!fallbackActivado) {
      fallbackActivado = true;
      mostrarFeedback("Sin conexión. Iniciando guardado offline...", "error");
      // FIX #3: await para que finally no reactive el botón mientras getGPS aún está corriendo
      await ejecutarGuardado(tel, "EXTERNAL_SAVE");
    }
    console.log(e);
  } finally {
    console.log("ejecutando finally");
    // FIX #3: Si fallbackActivado=true, ejecutarGuardado aún puede estar corriendo.
    // mostrarFeedback("success"/"error") dentro de ejecutarGuardado ya re-habilita el botón.
    if (!fallbackActivado) {
      btn.disabled = false;
    }
  }
}

async function ejecutarGuardado(tel, modo) {
  try {
    //gestionarUI("loading", modo === "NUEVO" ? "Registrando..." : "Actualizando...");
    const offlineSave = false;
    let saved = false;
    const locationPayload = await getGPS(tel, modo);

    const timer = setTimeout(() => { // timer por si hay mal internet o no hay del todo.
      if (!saved) {
        saveLocal(locationPayload);
        saved = true;
      }
    }, 3000);

    mostrarFeedback("Guardando en Nube", "loading");
    const result = await postServer(locationPayload);
    saved = true;
    clearTimeout(timer);

    // Si se guardó exitosamente en la nube, nos aseguramos de borrarlo localmente 
    // en caso de que el timer de 3 segundos haya saltado antes de que esto terminara.
    if (result && result.success) {
      localStorage.removeItem("reg_" + (locationPayload.telefono || Date.now()));
    }

    mostrarFeedback(result.status || "Guardado", "success");
    if (modo === "NUEVO") document.getElementById("inputTelefono").value = "";

  } catch (error) {
    console.log("ERROR AL EJECUTAR GUARDAR");
    // FIX #1 & #5: Usar error.message en lugar del objeto Error crudo que mostraba "[object Error]"
    // FIX #2: 8000ms para que el mensaje GPS (largo e instructivo) sea legible antes de desaparecer
    mostrarFeedback(error.message || String(error), "error", 8000);
    // FIX #11: Recuperar foco en el input tras error GPS para guiar al usuario
    inputTelefono.focus();
  }
}

function verEnMapa() {
  if (datosRecuperados && datosRecuperados.lat) {
    const url = "https://www.google.com/maps/search/?api=1&query=" + datosRecuperados.lat + "," + datosRecuperados.lng;
    window.open(url, "_blank");
    mostrarOpcionesExistente("none");
    inputTelefono.value = "";
  }
}

const getGPS = (tel, modo) => {
  mostrarFeedback("Obteniendo ubicación... 📍", "loading");

  // FIX #7: Mensajes intermedios de progreso para que el usuario sepa que la app sigue viva
  // durante los 10s de espera del GPS (sin estos, la UI parece congelada)
  const timerProgreso1 = setTimeout(() => mostrarFeedback("Buscando señal GPS... 🛰️", "loading"), 4000);
  const timerProgreso2 = setTimeout(() => mostrarFeedback("Señal débil, aguardando... ⏳", "loading"), 7500);

  const limpiarTimersProgreso = () => {
    clearTimeout(timerProgreso1);
    clearTimeout(timerProgreso2);
  };

  return new Promise((resolve, reject) => {
    // Verificamos si el navegador soporta Geolocalización
    if (!navigator.geolocation) {
      limpiarTimersProgreso();
      return reject(new Error("Tu navegador no soporta GPS"));
    }

    const opciones = {
      enableHighAccuracy: true, // Máxima precisión (GPS vs Wi-Fi)
      timeout: 10000,           // Esperar máximo 10 segundos
      maximumAge: 0             // No usar ubicaciones guardadas en caché
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        limpiarTimersProgreso(); // FIX #7: Cancelar mensajes de progreso al obtener posición exitosa
        const payload = {
          telefono: tel,
          latitud: pos.coords.latitude,
          longitud: pos.coords.longitude,
          modo: modo,
          fecha: new Date().getTime(),
          dispositivo: navigator.userAgent
        };
        resolve(payload);
      }, (err) => {
        limpiarTimersProgreso(); // FIX #7: Cancelar mensajes de progreso al fallar

        // FIX #6: Mensajes diferenciados por tipo de error GPS con instrucciones específicas por caso
        let msg = "Error desconocido al obtener ubicación.";
        if (err.code === 1) msg = "No es posible localizarte. Activa el GPS y permite el acceso en tu navegador. 📍";
        if (err.code === 2) msg = "La señal GPS es débil. Acércate a una ventana o sal a un espacio abierto e intenta de nuevo. 🛰️";
        // FIX #8: El botón dice 'Consultar', no 'Guardar' — el texto anterior era incorrecto
        if (err.code === 3) msg = "No se pudo obtener tu ubicación a tiempo. Presiona 'Consultar' nuevamente. 🔄";
        reject(new Error(msg));
      }, opciones);
  });
};




function saveLocal(payload) { // hay que agregar los datos GPS
  mostrarFeedback("Red lenta. Guardando localmente...", "loading");
  // Creamos una llave única con el prefijo reg_
  const llaveUnica = "reg_" + (payload.telefono);

  // Guardamos en el teléfono
  localStorage.setItem(llaveUnica, JSON.stringify(payload));
  inputTelefono.value = "";
  inputTelefono.focus();
  inputTelefono.select();
  btn.classList.remove("loading");
  mostrarFeedback("Guardado Localmente 📡", "success");
}


function flujoActualizar() {
  const tel = document.getElementById("inputTelefono").value;
  ejecutarGuardado(tel, "ACTUALIZAR");
}



function mostrarOpcionesExistente(display) {
  //mostrarFeedback("✅ El número ya existe","success");//+++++++++++++++++++++++++
  const acciones = document.getElementById("accionesExistente");
  if (acciones) acciones.style.display = display;
}

// FIX #2: Parámetro opcional `duracion` para controlar cuánto persiste el mensaje
// Los errores GPS necesitan más tiempo (~8s) que los mensajes genéricos (3s)
function mostrarFeedback(mensaje, tipo = 'success', duracion = null) {
  const card = document.querySelector('.card');
  const estado = document.getElementById("estado"); // Aseguramos el ID correcto

  // 1. Limpieza inicial
  estado.innerText = mensaje;
  estado.className = "msg-base"; // Una clase base para estilo común
  card.classList.remove("error-state", "loading-state");

  // Detener cualquier timer de borrado previo para que no se pisen
  if (window.feedbackTimer) clearTimeout(window.feedbackTimer);

  // 2. Aplicar estilos según el tipo
  switch (tipo) {
    case 'success':
      estado.classList.add("msg-success");
      btnPrincipal.style.background = "var(--success)";
      btnPrincipal.classList.remove("loading");
      btnPrincipal.disabled = false;//+++++++++


      if (navigator.vibrate) navigator.vibrate(100);

      // Solo el éxito y el error se borran solos
      iniciarTemporizadorBorrado(duracion || 3000); // FIX #2: respetar duracion personalizada
      break;

    case 'error':
      btnPrincipal.classList.remove("loading");
      estado.classList.add("msg-error");
      card.classList.add("error-state");
      btnPrincipal.style.background = "var(--error)";
      btnPrincipal.disabled = false;
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

      iniciarTemporizadorBorrado(duracion || 20000);
      break;

    case 'loading':
      estado.classList.add("msg-loading");
      card.classList.add("loading-state");
      btnPrincipal.style.background = "var(--primary-dark)"
      btnPrincipal.classList.add("loading");
      btnPrincipal.disabled = true;
      ;
      // NOTA: No llamamos al temporizador aquí. El 'loading' se quita 
      // manualmente cuando llega la respuesta del servidor.
      break;

    case 'offline':
      estado.classList.add("msg-offline");
      btnPrincipal.style.background = "var(--warning)";
      btnPrincipal.disabled = false;
      iniciarTemporizadorBorrado(duracion || 5000); // FIX #2: respetar duracion personalizada
      break;
  }
}

// Función auxiliar para resetear la UI
function iniciarTemporizadorBorrado(ms = 3000) {
  window.feedbackTimer = setTimeout(() => {
    const estado = document.getElementById("estado");
    const card = document.querySelector('.card');

    estado.innerText = "";
    estado.className = "";
    card.classList.remove("error-state", "loading-state");
    btnPrincipal.style.background = "var(--primary)";
  }, ms);
}
// 1. LA FUNCIÓN MAESTRA (Sincronización segura)
async function sincronizarPendientes() {
  if (!navigator.onLine) {
    console.log("🚫 Sin red real. Sincronización cancelada.");
    return;
  }

  const keys = Object.keys(localStorage);
  const pendientes = keys.filter(k => k.startsWith("reg_")); //de local storage, filtra los registro de coordenadas, e intenta subirlos a G SHEETS.

  if (pendientes.length === 0) {
    console.log("0 Pendientes, Sincronizacion Finalizada")
    return
  };


  for (let key of pendientes) {

    try {
      console.log(`🔄 Sincronizando ${pendientes.length} registros...`);
      mostrarFeedback(`🔄 Sincronizando ${pendientes.length} pendientes...`, "loading");

      const rawData = localStorage.getItem(key);
      if (!rawData) continue;
      const data = JSON.parse(rawData);
      data.modo = "EXTERNAL_SAVE"
      console.log(data);

      //teléfono del objeto guardado en Local Storage, basandose en el formato "data" del metodo getGPS().
      const telefonoAValidar = data.telefono;

      const resultado = await Promise.race([
        postServer(data),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout Google")), 15000))
      ]);
      // Si llegamos aquí, el servidor respondió (con éxito o con un error lógico como "NUMERO INVALIDO")
      console.log(resultado);
      if (resultado && (resultado.success === true || resultado.success === "true")) {
        localStorage.removeItem(key);
        console.log(`✅ Registro ${key} sincronizado exitosamente, Eliminando localmente.`);
      } else if (resultado && resultado.error) {
        // El servidor rechazó los datos permanentemente (ej. número inválido). 
        // Lo borramos para que no se quede atascado en un bucle infinito.
        localStorage.removeItem(key);
        console.warn(`⚠️ Registro ${key} rechazado por el servidor (${resultado.error}). Eliminando localmente para evitar bucle.`);
      } else {
        console.log(`⚠️ Registro ${key} respuesta inesperada, se conservará para revisión.`);
      }

    } catch (err) {
      console.error(`❌ Error de red en registro ${key}:`, err);
      // Solo en caso de error de red (Failed to fetch) conservamos el registro para el futuro
      break;
    }
  }

  mostrarFeedback("Sincronización finalizada ✔", "success");
  setTimeout(() => estado.innerText = "", 3000);
}

// 2. DISPARADORES (Event Listeners)

// Cuando vuelve el internet
window.addEventListener("online", sincronizarPendientes);

// Al cargar la página (con un pequeño delay para que GAS esté listo)
window.addEventListener("load", () => {
  inputTelefono.focus();
  console.log("App cargada. Verificando pendientes...");
  setTimeout(sincronizarPendientes, 2500);
});
