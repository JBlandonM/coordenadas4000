const logPanel = document.getElementById('logPanel');
const appFrame = document.getElementById('appFrame');

function log(msg, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logPanel.appendChild(entry);
    logPanel.scrollTop = logPanel.scrollHeight;
}

function getAppWindow() {
    return appFrame.contentWindow;
}

function resetApp() {
    log("Reseteando aplicación y limpieza de LocalStorage...", "warn");
    const win = getAppWindow();
    win.localStorage.clear();
    win.location.reload();
}

async function runTest(testId) {
    const win = getAppWindow();
    log(`Iniciando prueba: ${testId}`, "info");

    switch (testId) {
        case 'gps_disabled':
            mockGeolocation(win, 1); // PERMISSION_DENIED
            log("GPS mockeado: PERMISSION_DENIED", "warn");
            break;

        case 'gps_weak':
            mockGeolocation(win, 2); // POSITION_UNAVAILABLE
            log("GPS mockeado: POSITION_UNAVAILABLE", "warn");
            break;

        case 'gps_timeout':
            mockGeolocation(win, 3); // TIMEOUT
            log("GPS mockeado: TIMEOUT", "warn");
            break;

        case 'offline':
            mockNetwork(win, false);
            log("Modo Offline activado (navigator.onLine = false)", "warn");
            break;

        case 'slow_network':
            mockSlowNetwork(win, 6000); // 6 segundos (mayor al timeout de 4s)
            log("Red lenta simulada (6s de delay en fetch)", "warn");
            break;

        case 'server_error':
            mockFetchError(win, 500);
            log("Error de servidor simulado (HTTP 500)", "error");
            break;

        case 'autoclicker':
            simulateAutoclicker(win);
            break;

        case 'ghost_input':
            simulateGhostInput(win);
            break;

        case 'offline_sync':
            testOfflineSync(win);
            break;
    }
}

// --- MOCKS ---

function mockGeolocation(win, errorCode) {
    win.navigator.geolocation.getCurrentPosition = (success, error, options) => {
        setTimeout(() => {
            error({ code: errorCode, message: "Mocked Error" });
        }, 500);
    };
}

function mockNetwork(win, isOnline) {
    Object.defineProperty(win.navigator, 'onLine', {
        get: () => isOnline,
        configurable: true
    });
    
    const originalFetch = win.fetch;
    win.fetch = async () => {
        if (!isOnline) throw new TypeError("Failed to fetch");
        return originalFetch.apply(win, arguments);
    };

    // Trigger events
    const event = new Event(isOnline ? 'online' : 'offline');
    win.dispatchEvent(event);
}

function mockSlowNetwork(win, delay) {
    const originalFetch = win.fetch;
    win.fetch = (...args) => new Promise(resolve => {
        setTimeout(() => resolve(originalFetch(...args)), delay);
    });
}

function mockFetchError(win, status) {
    win.fetch = async () => ({
        ok: false,
        status: status,
        text: async () => "Internal Server Error"
    });
}

// --- SIMULATIONS ---

async function simulateAutoclicker(win) {
    const btn = win.document.getElementById('btnPrincipal');
    const input = win.document.getElementById('inputTelefono');
    input.value = "12345678";
    
    log("Iniciando ráfaga de 10 clics en 500ms...", "warn");
    for(let i=0; i<10; i++) {
        btn.click();
        await new Promise(r => setTimeout(r, 50));
    }
    log("Ráfaga finalizada. Verifique que no haya múltiples ejecuciones paralelar.", "success");
}

async function simulateGhostInput(win) {
    const input = win.document.getElementById('inputTelefono');
    const btn = win.document.getElementById('btnPrincipal');
    
    log("Simulando escritura rápida y cambio de foco...", "warn");
    const numbers = ["8", "8", "7", "7", "6", "6", "5", "5"];
    input.value = "";
    for(let n of numbers) {
        input.value += n;
        input.dispatchEvent(new Event('input'));
        await new Promise(r => setTimeout(r, 30));
    }
    btn.click();
    log("Input completado: 88776655", "success");
}

async function testOfflineSync(win) {
    log("Preparando datos locales para sincronización...", "info");
    const fakeKey = "reg_99998888";
    const fakeData = {
        telefono: "99998888",
        latitud: 12.34,
        longitud: -56.78,
        modo: "EXTERNAL_SAVE",
        fecha: Date.now()
    };
    win.localStorage.setItem(fakeKey, JSON.stringify(fakeData));
    
    log("Datos guardados en LocalStorage. Simulando vuelta a la red...", "info");
    mockNetwork(win, true);
    
    // El app escucha el evento 'online' y llama a sincronizarPendientes
    log("Evento 'online' disparado. Verifique consola de la app para ver la subida.", "success");
}
