// Código actualizado para Google Apps Script con CORS habilitado
function doPost(e) {
  // Headers CORS - permite cualquier origen para testing, cambia '*' por tu dominio en producción
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400', // 24 horas
    'Content-Type': 'application/json'
  };

  // Manejar preflight OPTIONS request
  if (e.parameter.method === 'OPTIONS' || e.parameter.method === undefined) {
    return ContentService
      .createTextOutput('')
      .setMimeType(ContentService.MimeType.TEXT)
      .setHeaders(headers);
  }

  try {
    // Parsear los datos JSON enviados
    const data = JSON.parse(e.postData.contents);
    const telefono = data.telefono;
    const modo = data.modo;

    // Tu lógica de procesamiento aquí
    let resultado = {};

    if (modo === 'CONSULTAR') {
      // Lógica para consultar si existe el teléfono
      resultado = {
        success: true,
        status: 'Número consultado exitosamente',
        mode: 'CONSULTAR',
        exists: false // cambiar según tu lógica
      };
    } else if (modo === 'NUEVO' || modo === 'ACTUALIZAR') {
      // Lógica para guardar/actualizar coordenadas
      resultado = {
        success: true,
        status: 'Coordenadas guardadas exitosamente',
        mode: modo
      };
    }

    // Respuesta exitosa con headers CORS
    return ContentService
      .createTextOutput(JSON.stringify(resultado))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders(headers);

  } catch (error) {
    // Respuesta de error con headers CORS
    const errorResponse = {
      success: false,
      error: error.toString(),
      status: 'Error en el servidor'
    };

    return ContentService
      .createTextOutput(JSON.stringify(errorResponse))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders(headers);
  }
}

// Función para manejar OPTIONS requests
function doOptions(e) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'text/plain'
  };

  return ContentService
    .createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeaders(headers);
}