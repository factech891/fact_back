// controllers/company.controller.js
const mongoose = require('mongoose');
// Importar funciones del servicio actualizado
const {
  getCompanyById, // Renombrada
  updateCompanyInfo,
  uploadCompanyLogo,
  deleteCompanyLogo, // Renombrada
  updateThemeSettings,
  deleteCompany // ¡Peligrosa!
} = require('../services/company.service'); // Asegúrate que la ruta sea correcta

// Cloudinary y fs/path ya no son necesarios aquí si el servicio maneja todo
// const cloudinary = require('cloudinary').v2;
// const fs = require('fs');
// const path = require('path');

// Helper para validar ObjectId
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * Obtener información de la compañía del usuario autenticado.
 * @param {Object} req - Solicitud HTTP (debe incluir req.user con companyId)
 * @param {Object} res - Respuesta HTTP
 */
const getCompanyController = async (req, res) => {
  try {
    // Obtener y validar companyId del usuario autenticado
    const companyId = req.user?.companyId;
    if (!companyId || !isValidObjectId(companyId)) {
        console.error('Controller - Error: companyId inválido o no encontrado en req.user');
        return res.status(401).json({ error: 'No autorizado o información de compañía inválida.' }); // 401 o 500
    }

    console.log(`Controller - getCompanyController para CompanyId: ${companyId}`);
    // Llamar al servicio con companyId
    const company = await getCompanyById(companyId);
    // El servicio ya maneja el error 'Compañía no encontrada'

    res.status(200).json(company);

  } catch (error) {
    console.error('Controller - Error al obtener información de la empresa:', error.message);
     if (error.message === 'Compañía no encontrada') {
        // Esto podría indicar un problema si el usuario autenticado tiene un companyId inválido
        return res.status(404).json({ error: 'Información de la compañía no encontrada.' });
    }
     if (error.message === 'ID de compañía inválido') {
        return res.status(500).json({ error: 'Error interno: ID de compañía inválido.' });
    }
    res.status(500).json({ error: 'Error interno del servidor al obtener la compañía.' });
  }
};

/**
 * Actualizar información de la compañía del usuario autenticado.
 * @param {Object} req - Solicitud HTTP (debe incluir req.user con companyId y datos en body)
 * @param {Object} res - Respuesta HTTP
 */
const updateCompanyController = async (req, res) => {
  try {
    // Obtener y validar companyId
    const companyId = req.user?.companyId;
    if (!companyId || !isValidObjectId(companyId)) {
        console.error('Controller - Error: companyId inválido o no encontrado en req.user');
        return res.status(401).json({ error: 'No autorizado o información de compañía inválida.' });
    }

    const companyData = req.body;
    console.log(`Controller - updateCompanyController para CompanyId: ${companyId}`);

    // Validación básica de campos requeridos (el modelo puede tener más)
    if (!companyData.nombre || !companyData.rif || !companyData.email) {
      return res.status(400).json({ error: 'Nombre, RIF y email son requeridos.' });
    }

    // Llamar al servicio con companyId y datos
    const updatedCompany = await updateCompanyInfo(companyId, companyData);
    // El servicio maneja errores de 'no encontrado' y duplicados

    res.status(200).json(updatedCompany);

  } catch (error) {
    console.error('Controller - Error al actualizar la empresa:', error.message);
     if (error.message.startsWith('Compañía no encontrada')) {
        return res.status(404).json({ error: 'Compañía no encontrada para actualizar.' });
    }
     if (error.message.includes('Ya existe otra compañía con este RIF')) {
         return res.status(400).json({ error: error.message });
     }
     if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(el => el.message);
        return res.status(400).json({ error: `Error de validación: ${errors.join(', ')}` });
     }
    res.status(500).json({ error: 'Error interno del servidor al actualizar la compañía.' });
  }
};

/**
 * Subir/Actualizar el logo de la compañía del usuario autenticado.
 * @param {Object} req - Solicitud HTTP (debe incluir req.user con companyId y req.file)
 * @param {Object} res - Respuesta HTTP
 */
const uploadLogoController = async (req, res) => {
  try {
     // Obtener y validar companyId
    const companyId = req.user?.companyId;
    if (!companyId || !isValidObjectId(companyId)) {
        console.error('Controller - Error: companyId inválido o no encontrado en req.user');
        // Limpiar archivo subido si existe
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        return res.status(401).json({ error: 'No autorizado o información de compañía inválida.' });
    }

    // Verificar que se subió un archivo (Multer lo pone en req.file)
    if (!req.file) {
      return res.status(400).json({ error: 'No se ha proporcionado ninguna imagen.' });
    }

    const filePath = req.file.path; // Ruta temporal donde Multer guardó el archivo
    console.log(`Controller - uploadLogoController para CompanyId: ${companyId}, Archivo: ${filePath}`);

    // Llamar al servicio con companyId y la ruta del archivo
    const updatedCompany = await uploadCompanyLogo(companyId, filePath);
    // El servicio maneja la subida a Cloudinary, la limpieza y la actualización de la BD

    res.status(200).json({
      message: 'Logo subido/actualizado exitosamente',
      logoUrl: updatedCompany.logoUrl,
      logoId: updatedCompany.logoId // Podría ser útil para el frontend si necesita el ID de Cloudinary
      // company: updatedCompany // O devolver toda la info actualizada
    });
  } catch (error) {
    console.error('Controller - Error al subir el logo:', error.message);
    // Limpiar archivo subido si aún existe y ocurrió un error en el servicio
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try { fs.unlinkSync(req.file.path); } catch (e) { console.error("Error limpiando archivo subido tras error:", e); }
    }
     if (error.message === 'Compañía no encontrada') {
        return res.status(404).json({ error: 'Compañía no encontrada para subir el logo.' });
    }
    if (error.message === 'Archivo de logo no encontrado o inválido.') {
        return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Error interno al subir el logo.' });
  }
};

/**
 * Eliminar el logo de la compañía del usuario autenticado.
 * @param {Object} req - Solicitud HTTP (debe incluir req.user con companyId)
 * @param {Object} res - Respuesta HTTP
 */
const deleteLogoController = async (req, res) => {
  try {
     // Obtener y validar companyId
    const companyId = req.user?.companyId;
    if (!companyId || !isValidObjectId(companyId)) {
        console.error('Controller - Error: companyId inválido o no encontrado en req.user');
        return res.status(401).json({ error: 'No autorizado o información de compañía inválida.' });
    }

    console.log(`Controller - deleteLogoController para CompanyId: ${companyId}`);

    // Llamar al servicio con companyId
    const updatedCompany = await deleteCompanyLogo(companyId);
    // El servicio maneja la eliminación de Cloudinary, archivo local y actualización de BD

    res.status(200).json({
      success: true,
      message: 'Logo eliminado exitosamente.',
      company: updatedCompany // Devolver compañía actualizada sin logo
    });
  } catch (error) {
    console.error('Controller - Error al eliminar logo:', error.message);
     if (error.message === 'Compañía no encontrada') {
        return res.status(404).json({ success: false, error: 'Compañía no encontrada para eliminar el logo.' });
    }
    res.status(500).json({ success: false, error: 'Error interno al eliminar el logo.' });
  }
};


/**
 * Actualizar configuración del tema para la compañía del usuario autenticado.
 * @param {Object} req - Solicitud HTTP (debe incluir req.user con companyId y datos en body)
 * @param {Object} res - Respuesta HTTP
 */
const updateThemeController = async (req, res) => {
  try {
     // Obtener y validar companyId
    const companyId = req.user?.companyId;
    if (!companyId || !isValidObjectId(companyId)) {
        console.error('Controller - Error: companyId inválido o no encontrado en req.user');
        return res.status(401).json({ error: 'No autorizado o información de compañía inválida.' });
    }

    const themeData = req.body;
    console.log(`Controller - updateThemeController para CompanyId: ${companyId}`);

    // Validación básica (el servicio valida si hay datos)
    // if (!themeData.temaFactura && !themeData.colorPrimario && ...) {
    //   return res.status(400).json({ error: 'Se requiere al menos un dato del tema para actualizar.' });
    // }

    // Llamar al servicio con companyId y datos del tema
    const updatedCompany = await updateThemeSettings(companyId, themeData);
    // El servicio maneja error 'no encontrado' y validaciones

    // Devolver solo los datos del tema actualizados
    res.status(200).json({
      temaFactura: updatedCompany.temaFactura,
      colorPrimario: updatedCompany.colorPrimario,
      colorSecundario: updatedCompany.colorSecundario,
      tamanoFuente: updatedCompany.tamanoFuente
    });
  } catch (error) {
    console.error('Controller - Error al actualizar el tema:', error.message);
     if (error.message.startsWith('Compañía no encontrada')) {
        return res.status(404).json({ error: 'Compañía no encontrada para actualizar el tema.' });
    }
     if (error.name === 'ValidationError' || error.message.includes('Error de validación de tema')) {
        return res.status(400).json({ error: error.message });
     }
    res.status(500).json({ error: 'Error interno del servidor al actualizar el tema.' });
  }
};

/**
 * Eliminar la compañía del usuario autenticado (¡Operación peligrosa!).
 * @param {Object} req - Solicitud HTTP (debe incluir req.user con companyId)
 * @param {Object} res - Respuesta HTTP
 */
const deleteCompanyController = async (req, res) => {
  // ADVERTENCIA: Esta ruta debe estar fuertemente protegida (ej. solo SUPER_ADMIN o dueño de la cuenta)
  // y probablemente requerir confirmación adicional.
  try {
     // Obtener y validar companyId
    const companyId = req.user?.companyId;
    if (!companyId || !isValidObjectId(companyId)) {
        console.error('Controller - Error: companyId inválido o no encontrado en req.user');
        return res.status(401).json({ error: 'No autorizado o información de compañía inválida.' });
    }

    // Añadir capa extra de seguridad/confirmación aquí si es necesario

    console.warn(`Controller - ¡SOLICITUD DE ELIMINACIÓN DE COMPAÑÍA! CompanyId: ${companyId}, User: ${req.user.email}`);
    // Llamar al servicio con companyId
    await deleteCompany(companyId);
    // El servicio maneja error 'no encontrado'

    // Quizás invalidar sesión del usuario aquí o redirigir
    res.status(200).json({ message: 'Compañía eliminada exitosamente (operación peligrosa completada).' });

  } catch (error) {
    console.error('Controller - Error al eliminar la empresa:', error.message);
     if (error.message === 'Compañía no encontrada') {
        return res.status(404).json({ error: 'Compañía no encontrada para eliminar.' });
    }
    res.status(500).json({ error: 'Error interno del servidor al eliminar la compañía.' });
  }
};

module.exports = {
  getCompanyController,
  updateCompanyController,
  uploadLogoController,
  deleteLogoController, // Exportada correctamente
  updateThemeController,
  deleteCompanyController // ¡Usar con precaución!
};