// services/company.service.js
const mongoose = require('mongoose');
const Company = require('../models/company.model'); // Asegúrate que la ruta sea correcta
const { v2: cloudinary } = require('cloudinary');
const fs = require('fs');
const path = require('path');

// Configuración de cloudinary (se mantiene)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Obtener información de una compañía específica por su ID.
 * @param {string} companyId - ID de la compañía.
 * @returns {Promise<Object>} Información de la compañía encontrada.
 */
const getCompanyById = async (companyId) => {
  try {
    console.log('Servicio - Obteniendo compañía por ID:', companyId);
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      console.error('Servicio - ID de compañía inválido:', companyId);
      throw new Error('ID de compañía inválido');
    }
    // Buscar por ID
    const company = await Company.findById(companyId);
    if (!company) {
      console.log('Servicio - Compañía no encontrada con ID:', companyId);
      throw new Error('Compañía no encontrada');
    }
    return company;
  } catch (error) {
    if (error.message !== 'Compañía no encontrada' && error.message !== 'ID de compañía inválido') {
        console.error('Servicio - Error al obtener la compañía:', error);
    }
    // Re-lanzar para que el controlador maneje el error específico
    throw error;
  }
};

/**
 * Actualizar información de una compañía específica.
 * @param {string} companyId - ID de la compañía a actualizar.
 * @param {Object} companyData - Datos a actualizar.
 * @returns {Promise<Object>} Compañía actualizada.
 */
const updateCompanyInfo = async (companyId, companyData) => {
  try {
    console.log('Servicio - Actualizando compañía ID:', companyId, 'con datos:', companyData);
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      console.error('Servicio - ID de compañía inválido para actualizar:', companyId);
      throw new Error('ID de compañía inválido');
    }

    // Evitar que se actualicen campos sensibles o internos accidentalmente
    delete companyData._id;
    delete companyData.companyId; // Por si acaso
    delete companyData.subscription; // La suscripción se manejaría por separado
    delete companyData.active; // El estado activo se manejaría por separado

    // Buscar y actualizar por ID
    const updatedCompany = await Company.findByIdAndUpdate(
      companyId,
      { $set: companyData }, // Usar $set para actualizar solo los campos proporcionados
      { new: true, runValidators: true } // Opciones: devolver doc actualizado, correr validadores
    );

    if (!updatedCompany) {
      console.log('Servicio - Compañía no encontrada para actualizar con ID:', companyId);
      throw new Error('Compañía no encontrada o no tiene permiso para actualizarla');
    }
    console.log('Servicio - Compañía actualizada exitosamente:', updatedCompany._id);
    return updatedCompany;
  } catch (error) {
     if (error.message !== 'Compañía no encontrada o no tiene permiso para actualizarla' && error.message !== 'ID de compañía inválido') {
        console.error('Servicio - Error al actualizar la compañía:', error);
    }
     // Manejar errores específicos como duplicados de RIF si existe índice único
     if (error.code === 11000 || error.message.includes('duplicate key')) {
        const field = Object.keys(error.keyPattern)[0];
        throw new Error(`Error al actualizar: Ya existe otra compañía con este ${field === 'rif' ? 'RIF' : field}.`);
    }
    throw new Error(`Error al actualizar la información de la compañía: ${error.message}`);
  }
};

/**
 * Subir/Actualizar logo de una compañía específica.
 * @param {string} companyId - ID de la compañía.
 * @param {string} filePath - Ruta local del archivo de logo a subir.
 * @returns {Promise<Object>} Compañía actualizada con la info del nuevo logo.
 */
const uploadCompanyLogo = async (companyId, filePath) => {
  try {
    console.log('Servicio - Subiendo logo para CompanyId:', companyId, 'desde:', filePath);
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      console.error('Servicio - ID de compañía inválido para subir logo:', companyId);
      throw new Error('ID de compañía inválido');
    }
    if (!filePath || !fs.existsSync(filePath)) {
         console.error('Servicio - Ruta de archivo de logo inválida o no encontrada:', filePath);
         throw new Error('Archivo de logo no encontrado o inválido.');
    }

    // Buscar la compañía específica
    let company = await Company.findById(companyId);
    if (!company) {
      console.log('Servicio - Compañía no encontrada para subir logo con ID:', companyId);
      throw new Error('Compañía no encontrada');
    }

    // Extraer el nombre del archivo
    const fileName = path.basename(filePath);

    // --- Limpieza de logo anterior (Cloudinary y local) ---
    const oldLogoId = company.logoId;
    const oldLocalFileName = company.localFilePath; // Usar el nombre guardado

    if (oldLogoId) {
      try {
        console.log('Servicio - Eliminando logo anterior de Cloudinary:', oldLogoId);
        await cloudinary.uploader.destroy(oldLogoId);
      } catch (error) {
        console.error('Servicio - Error eliminando logo anterior de Cloudinary:', error);
        // No detener el proceso si falla la eliminación del antiguo, pero sí loguearlo
      }
    }
    if (oldLocalFileName) {
      try {
        // Asumir que 'uploads' está en la raíz del proyecto o ajustar ruta base
        const oldFilePath = path.resolve(__dirname, '..', '..', 'uploads', oldLocalFileName); // Ajustar ruta base si es necesario
        if (fs.existsSync(oldFilePath)) {
          console.log('Servicio - Eliminando archivo local anterior:', oldFilePath);
          fs.unlinkSync(oldFilePath);
        }
      } catch (error) {
        console.error('Servicio - Error eliminando archivo local anterior:', error);
      }
    }
    // --- Fin Limpieza ---

    // Subir nueva imagen a Cloudinary
    console.log('Servicio - Subiendo nuevo logo a Cloudinary desde:', filePath);
    
    // CAMBIO CLAVE: Usar un public_id fijo basado en el ID de la compañía
    // en lugar de un timestamp que genera nuevas imágenes cada vez
    const result = await cloudinary.uploader.upload(filePath, {
      folder: 'logos_empresas', // Carpeta común para todos los logos
      public_id: `company_logo_${companyId}`, // ID fijo basado en el ID de la compañía
      overwrite: true, // Sobrescribir si ya existe una imagen con este ID
      transformation: [
        { width: 500, height: 500, crop: "limit" }, // Limitar tamaño
        { quality: "auto", fetch_format: "auto" } // Optimizar calidad y formato
      ]
    });
    console.log('Servicio - Resultado de Cloudinary:', result);

    // Actualizar datos en la compañía usando findByIdAndUpdate
    const updatedCompany = await Company.findByIdAndUpdate(
        companyId,
        {
            logoUrl: result.secure_url,
            logoId: result.public_id,
            localFilePath: fileName // Guardar solo el nombre del nuevo archivo local
        },
        { new: true, runValidators: true }
    );

     if (!updatedCompany) {
         // Esto no debería pasar si findById tuvo éxito antes, pero por seguridad...
         throw new Error('No se pudo actualizar la compañía con la información del logo.');
     }

    console.log('Servicio - Logo actualizado exitosamente para CompanyId:', companyId);
    return updatedCompany;

  } catch (error) {
    console.error('Servicio - Error en uploadCompanyLogo:', error);
    // Intentar limpiar el archivo subido a Cloudinary si la actualización de BD falla? Podría ser complejo.
    throw new Error(`Error al subir el logo: ${error.message}`);
  } finally {
      // Opcional: Limpiar el archivo temporal local después de subir a Cloudinary (si no se movió a 'uploads' permanentemente)
      // if (filePath && fs.existsSync(filePath) && !filePath.includes(path.basename(filePath))) { // Evitar borrar si ya está en 'uploads'
      //    try { fs.unlinkSync(filePath); console.log('Archivo temporal eliminado:', filePath); } catch (e) { console.error('Error eliminando archivo temporal:', e); }
      // }
  }
};

/**
 * Eliminar el logo actual de una compañía específica.
 * @param {string} companyId - ID de la compañía.
 * @returns {Promise<Object>} Compañía actualizada sin logo.
 */
const deleteCompanyLogo = async (companyId) => {
  try {
    console.log('Servicio - Eliminando logo para CompanyId:', companyId);
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      console.error('Servicio - ID de compañía inválido para eliminar logo:', companyId);
      throw new Error('ID de compañía inválido');
    }

    // Buscar la compañía específica
    const company = await Company.findById(companyId);
    if (!company) {
      console.log('Servicio - Compañía no encontrada para eliminar logo con ID:', companyId);
      throw new Error('Compañía no encontrada');
    }

    // --- Limpieza de logo actual (Cloudinary y local) ---
    const logoIdToDelete = company.logoId;
    const localFileNameToDelete = company.localFilePath;

    if (logoIdToDelete) {
      try {
        console.log('Servicio - Eliminando logo de Cloudinary:', logoIdToDelete);
        await cloudinary.uploader.destroy(logoIdToDelete);
      } catch (error) {
        console.error('Servicio - Error eliminando logo de Cloudinary:', error);
        // Loguear pero continuar para limpiar la BD
      }
    }
    if (localFileNameToDelete) {
      try {
        const localFilePath = path.resolve(__dirname, '..', '..', 'uploads', localFileNameToDelete); // Ajustar ruta base
        if (fs.existsSync(localFilePath)) {
          console.log('Servicio - Eliminando archivo local:', localFilePath);
          fs.unlinkSync(localFilePath);
        }
      } catch (error) {
        console.error('Servicio - Error eliminando archivo local:', error);
      }
    }
    // --- Fin Limpieza ---

    // Limpiar campos en la base de datos usando findByIdAndUpdate
    const updatedCompany = await Company.findByIdAndUpdate(
        companyId,
        {
            logoUrl: null,
            logoId: null,
            localFilePath: null
        },
        { new: true, runValidators: true }
    );

     if (!updatedCompany) {
         throw new Error('No se pudo actualizar la compañía para eliminar la información del logo.');
     }

    console.log('Servicio - Logo eliminado exitosamente para CompanyId:', companyId);
    return updatedCompany;

  } catch (error) {
    console.error('Servicio - Error eliminando logo:', error);
    throw new Error(`Error al eliminar el logo: ${error.message}`);
  }
};


/**
 * Actualizar configuración del tema para una compañía específica.
 * @param {string} companyId - ID de la compañía.
 * @param {Object} themeData - Datos del tema a actualizar.
 * @returns {Promise<Object>} Compañía actualizada.
 */
const updateThemeSettings = async (companyId, themeData) => {
  try {
    console.log('Servicio - Actualizando tema para CompanyId:', companyId, 'con datos:', themeData);
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      console.error('Servicio - ID de compañía inválido para actualizar tema:', companyId);
      throw new Error('ID de compañía inválido');
    }

    // Construir objeto de actualización solo con campos de tema válidos
    const themeUpdate = {};
    if (themeData.temaFactura) themeUpdate.temaFactura = themeData.temaFactura;
    if (themeData.colorPrimario) themeUpdate.colorPrimario = themeData.colorPrimario;
    if (themeData.colorSecundario) themeUpdate.colorSecundario = themeData.colorSecundario;
    if (themeData.tamanoFuente) themeUpdate.tamanoFuente = themeData.tamanoFuente;

    if (Object.keys(themeUpdate).length === 0) {
        console.log('Servicio - No se proporcionaron datos de tema válidos para actualizar.');
        // Devolver la compañía sin cambios o lanzar error, según prefieras
        return await getCompanyById(companyId); // Devolver datos actuales
        // throw new Error('No se proporcionaron datos de tema para actualizar.');
    }

    // Buscar y actualizar por ID
    const updatedCompany = await Company.findByIdAndUpdate(
      companyId,
      { $set: themeUpdate }, // Usar $set para actualizar solo campos del tema
      { new: true, runValidators: true }
    );

    if (!updatedCompany) {
      console.log('Servicio - Compañía no encontrada para actualizar tema con ID:', companyId);
      throw new Error('Compañía no encontrada o no tiene permiso para actualizarla');
    }

    console.log('Servicio - Tema actualizado exitosamente para CompanyId:', companyId);
    return updatedCompany;
  } catch (error) {
     if (error.message !== 'Compañía no encontrada o no tiene permiso para actualizarla' && error.message !== 'ID de compañía inválido') {
        console.error('Servicio - Error al actualizar el tema:', error);
    }
    // Considerar errores de validación de enums si existen en el modelo
    if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(el => el.message);
        throw new Error(`Error de validación de tema: ${errors.join(', ')}`);
    }
    throw new Error(`Error al actualizar la configuración del tema: ${error.message}`);
  }
};

/**
 * Eliminar una compañía específica (¡Operación peligrosa!).
 * @param {string} companyId - ID de la compañía a eliminar.
 * @returns {Promise<boolean>} True si se eliminó, lanza error si no.
 */
const deleteCompany = async (companyId) => {
  // ADVERTENCIA: Eliminar una compañía puede tener efectos cascada (usuarios, facturas, etc. huérfanos).
  // Considera desactivar (`active: false`) en lugar de eliminar.
  try {
    console.warn('Servicio - ¡INTENTO DE ELIMINACIÓN DE COMPAÑÍA!', companyId);
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      console.error('Servicio - ID de compañía inválido para eliminar:', companyId);
      throw new Error('ID de compañía inválido');
    }

    // Buscar la compañía para obtener info del logo antes de eliminar
    const company = await Company.findById(companyId);
    if (!company) {
      console.log('Servicio - Compañía no encontrada para eliminar con ID:', companyId);
      throw new Error('Compañía no encontrada');
    }

    // --- Limpieza de logo (Cloudinary y local) ---
    const logoIdToDelete = company.logoId;
    const localFileNameToDelete = company.localFilePath;

    if (logoIdToDelete) {
      try {
        console.log('Servicio - Eliminando logo de Cloudinary (pre-delete compañía):', logoIdToDelete);
        await cloudinary.uploader.destroy(logoIdToDelete);
      } catch (error) {
        console.error('Servicio - Error eliminando logo de Cloudinary durante eliminación de compañía:', error);
      }
    }
    if (localFileNameToDelete) {
      try {
        const localFilePath = path.resolve(__dirname, '..', '..', 'uploads', localFileNameToDelete); // Ajustar ruta base
        if (fs.existsSync(localFilePath)) {
          console.log('Servicio - Eliminando archivo local (pre-delete compañía):', localFilePath);
          fs.unlinkSync(localFilePath);
        }
      } catch (error) {
        console.error('Servicio - Error eliminando archivo local durante eliminación de compañía:', error);
      }
    }
    // --- Fin Limpieza ---

    // Eliminar la compañía de la base de datos
    const deleteResult = await Company.deleteOne({ _id: companyId });

    if (deleteResult.deletedCount === 0) {
         // Esto no debería pasar si findById tuvo éxito, pero por seguridad...
         console.log('Servicio - No se eliminó ninguna compañía con ID:', companyId);
         throw new Error('No se pudo eliminar la compañía.');
    }

    // Aquí deberías considerar eliminar/desvincular usuarios, facturas, clientes, etc. asociados.
    // Esta lógica es compleja y depende de tus reglas de negocio.

    console.log('Servicio - Compañía eliminada exitosamente:', companyId);
    return true;

  } catch (error) {
     if (error.message !== 'Compañía no encontrada' && error.message !== 'ID de compañía inválido') {
        console.error('Servicio - Error al eliminar la compañía:', error);
    }
    throw new Error(`Error al eliminar la compañía: ${error.message}`);
  }
};


module.exports = {
  getCompanyById, // Renombrada
  updateCompanyInfo,
  uploadCompanyLogo,
  deleteCompanyLogo, // Renombrada/Corregida
  updateThemeSettings,
  deleteCompany // ¡Usar con extrema precaución!
};