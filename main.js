   const endpoint = "https://script.google.com/macros/s/AKfycbxTSHkYVtA3ckQZRbb_tJppuMhTH_oyD1rieVHJY7YfP93RQ3u8u4Qc8bVvQcsCWaoLKQ/exec";

        const inputTelefono = document.getElementById("inputTelefono");
        const estado = document.getElementById("estado");
        const btn = document.getElementById("btnPrincipal");
        const actions = document.getElementById("accionesExistente");

      async function postServer(payload) {
        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json"
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
      inputTelefono.addEventListener("keypress", function(e) {
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
      btn.disabled= true;

      
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
      try {
        mostrarOpcionesExistente("none"); //++++++++++++++++++++++++++++++
        const input = document.getElementById("inputTelefono");
        const tel = input.value;
        let servidorRespondio = false;
        
        const patron = /^\d{8}$/;
        if (!patron.test(tel)) {

          //Implementar modal personalizado en lugar de alertas.
          alert("Deben ser 8 dígitos");
          return;
        }
        mostrarFeedback("Consultando", "loading");
        const timerSeguridad = setTimeout(() => {
          if (!servidorRespondio) {
            console.warn("⚠️ Tiempo de espera agotado. Cambiando a modo offline.");
            mostrarFeedback("Red lenta. Guardando localmente...", "loading");
            ejecutarGuardado(tel, "EXTERNAL_SAVE"); // Forzamos guardado local
          }
          }, 4000); // 4000ms = 4 segundos de tolerancia


        // --- CONFIGURACIÓN DEL TIMEOUT ---

        const consultResult = await postServer({ telefono: tel, modo: "CONSULTAR" });
        servidorRespondio = true;
        clearTimeout(timerSeguridad);
        mostrarFeedback(consultResult.status || "Listo", "success");

        //console.log(consultResult);
        if(consultResult.success && consultResult.mode !== "NUEVO"){
          datosRecuperados = consultResult
          //mostrarOpcionesExistente("flex");
          const mostrar = await mostrarModal("Número Registrado","¿Ver Coordenadas 📍🌍?");
          if(mostrar){
            verEnMapa();
            console.log("Presionaste Ver en Mapa");
          }else{
            console.log("Presionaste Cancelar");
          }
        }

        if(consultResult.mode=="NUEVO"){
          const mostrar = await mostrarModal("Número No Registrado","¿Desea registrarlo con la coordenada actual?");
          if(mostrar){
            ejecutarGuardado(tel, "NUEVO");
          }else{
            console.log("Presionaste Cancelar");
          }
        }
          
      } catch (e) {
        console.log("Error en el servidor: " + e);
        mostrarFeedback("Error de Conexion, guardando localmente", "error");
        console.log("error consulta");
        saveLocal(tel); //solo guarda telefono
        console.log(e);
      } finally {
        console.log("ejecutando finally");
        btn.disabled = false;// <--- Se ejecuta SIEMPRE al terminar el bloque try o catch
      }
    }

    async function ejecutarGuardado(tel, modo) {
      try{
            //gestionarUI("loading", modo === "NUEVO" ? "Registrando..." : "Actualizando...");
          const offlineSave = false;
          let saved= false;
          const locationPayload = await getGPS(tel,modo);

          const timer = setTimeout(()=>{ // timer por si hay mal internet o no hay del todo.
            if(!saved ){
              saveLocal(locationPayload);
              saved = true;
            }
          },3000);

          mostrarFeedback("Guardando en Nube", "loading");
          const result = await postServer(locationPayload);
          saved = true;
          clearTimeout(timer);
          mostrarFeedback(result.status || "Guardado", "success");
          if (modo === "NUEVO") document.getElementById("inputTelefono").value = "";
                    
      }catch(error){
        //FALLO guardando
        console.log("ERROR AL EJECUTAR GUARDAR");
        mostrarFeedback(error,"error");
        return
          // falta agregar/modificar alerta o popup que se muestra al usuario
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

    const getGPS = (tel,modo) => {        
        mostrarFeedback("Obteniendo ubicación...", "loading");
        return new Promise((resolve, reject) => {
          // Verificamos si el navegador soporta Geolocalización
          if (!navigator.geolocation) {
            return reject(new Error("Tu navegador no soporta GPS"));
          }


          const opciones = {
            enableHighAccuracy: true, // Máxima precisión (GPS vs Wi-Fi)
            timeout: 10000,            // Esperar máximo 8 segundos
            maximumAge: 0             // No usar ubicaciones guardadas en caché
          };

            navigator.geolocation.getCurrentPosition(
              (pos) => {
                const payload = {
                telefono: tel,
                latitud: pos.coords.latitude,
                longitud: pos.coords.longitude,
                modo: modo,
                fecha: new Date().getTime(),
                dispositivo: navigator.userAgent
              };
                resolve(payload);
              },(err) => {
                // Traducimos errores comunes para el usuario
                let msg = "Error desconocido";
                if (err.code === 1) msg = "No es posible localizarte. Por favor, activa el GPS y permite el acceso en tu navegador para continuar. 📍";
                if (err.code === 2) msg = "La señal GPS es débil en este momento. Acercarte a una ventana o sal a un espacio abierto, he intenta de nuevo. 🛰️";
                if (err.code === 3) msg = "Algo salió mal al intentar localizarte. Por favor,  presiona 'Guardar' nuevamente. 🔄";
                reject(new Error(msg));
              },opciones);
          });
         
    };
      
      
    

    function saveLocal (payload){ // hay que agregar los datos GPS
      mostrarFeedback("Red lenta. Guardando localmente...", "loading");
      // Creamos una llave única con el prefijo reg_
      const llaveUnica = "reg_" + (payload.telefono || Date.now());
          
      // Guardamos en el teléfono
      localStorage.setItem(llaveUnica, JSON.stringify(payload));
      inputTelefono.value = "";
      inputTelefono.focus();
      inputTelefono.select();
      btn.classList.remove("loading");
      mostrarFeedback("Guardado offline 📡", "success");
    }


    function flujoActualizar() {
      const tel = document.getElementById("inputTelefono").value;
      ejecutarGuardado(tel, "ACTUALIZAR");
    }

    

    function mostrarOpcionesExistente(display) {
      //mostrarFeedback("✅ El número ya existe","success");//+++++++++++++++++++++++++
      const acciones = document.getElementById("accionesExistente");
      if(acciones) acciones.style.display = display;
    }

    function mostrarFeedback(mensaje, tipo = 'success') {
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
          iniciarTemporizadorBorrado();
          break;

        case 'error':
          btnPrincipal.classList.remove("loading");
          estado.classList.add("msg-error");
          card.classList.add("error-state");
          btnPrincipal.style.background = "var(--error)";
          btnPrincipal.disabled = false;
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
          
          iniciarTemporizadorBorrado();
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
          iniciarTemporizadorBorrado(5000); // 5 segundos para que lea el aviso de respaldo
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

          console.log(`🔄 Sincronizando ${pendientes.length} registros...`);
          mostrarFeedback(`🔄 Sincronizando ${pendientes.length} pendientes...`,"loading");

          for (let key of pendientes) {
            try {
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
              //Si ya existe se borra
              console.log(resultado);
              if (resultado.mode==="ACTUALIZAR" && !resultado.success) {
                localStorage.removeItem(key);
                console.log(`✅ Registro ${key} Ya Existe, Eliminando.`);
              }

              //agregar guardar(data) si numero no existe.
            } catch (err) {
              console.error(`❌ Error en registro ${key}:`, err);
              break; // Si falla la red, para el bucle para reintentar después
            }
          }
          
          mostrarFeedback("Sincronización finalizada ✔","success");
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
