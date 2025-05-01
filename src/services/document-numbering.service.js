// services/document-numbering.service.js
const mongoose = require('mongoose');
const DocumentNumbering = require('../models/document-numbering.model');

/**
 * Obtiene y actualiza el siguiente número de documento de forma atómica.
 * @param {string} companyId - ID de la compañía.
 * @param {string} documentType - Tipo de documento ('invoice', 'credit_note', etc).
 * @param {mongoose.ClientSession} [session] - Sesión de Mongoose (opcional).
 * @returns {Promise<string>} - Número de documento formateado (con prefijo).
 */
const getNextDocumentNumber = async (companyId, documentType = 'invoice', session = null) => {
    try {
        // Opciones para la actualización
        const options = {
            new: true,
            upsert: true,
            runValidators: true
        };
        
        if (session) {
            options.session = session;
        }
        
        // IMPORTANTE: Asegurarnos que el lastNumber NUNCA se restablece incluso después de eliminar
        // Para esto, usamos upsert pero solo incrementamos si el documento ya existe o no existe
        const numbering = await DocumentNumbering.findOneAndUpdate(
            { companyId, documentType },
            { $inc: { lastNumber: 1 } },
            options
        );
        
        // Formatear el número con el prefijo y padding
        const formattedNumber = `${numbering.prefix}${numbering.lastNumber.toString().padStart(numbering.padding, '0')}`;
        
        // Agregar log para depuración
        console.log(`Servicio - Número generado para ${documentType} de compañía ${companyId}: ${formattedNumber} (contador: ${numbering.lastNumber})`);
        
        return formattedNumber;
    } catch (error) {
        console.error('Error al obtener el siguiente número de documento:', error);
        throw new Error(`Error al generar el número de documento: ${error.message}`);
    }
};

/**
 * Actualiza la configuración de numeración para un tipo de documento en una empresa.
 * @param {string} companyId - ID de la compañía.
 * @param {string} documentType - Tipo de documento.
 * @param {Object} config - Configuración (prefix, padding).
 * @returns {Promise<Object>} - Configuración actualizada.
 */
const updateDocumentNumberingConfig = async (companyId, documentType, config) => {
    try {
        const options = {
            new: true,
            upsert: true,
            runValidators: true
        };
        
        // Actualizamos solo los campos proporcionados
        const updateData = {};
        if (config.prefix !== undefined) updateData.prefix = config.prefix;
        if (config.padding !== undefined) updateData.padding = Number(padding);
        
        // Si no hay datos para actualizar, no hacemos nada
        if (Object.keys(updateData).length === 0) {
            throw new Error('No se proporcionaron datos para actualizar.');
        }
        
        // Actualizar la configuración
        const numbering = await DocumentNumbering.findOneAndUpdate(
            { companyId, documentType },
            updateData,
            options
        );
        
        return numbering;
    } catch (error) {
        console.error('Error al actualizar la configuración de numeración:', error);
        throw new Error(`Error al actualizar la configuración: ${error.message}`);
    }
};

/**
 * Obtiene la configuración de numeración actual para un tipo de documento en una empresa.
 * @param {string} companyId - ID de la compañía.
 * @param {string} documentType - Tipo de documento.
 * @returns {Promise<Object|null>} - Configuración actual o null si no existe.
 */
const getDocumentNumberingConfig = async (companyId, documentType) => {
    try {
        return await DocumentNumbering.findOne({ companyId, documentType });
    } catch (error) {
        console.error('Error al obtener la configuración de numeración:', error);
        throw new Error(`Error al obtener la configuración: ${error.message}`);
    }
};

/**
 * Verifica el estado actual de numeración para un tipo de documento en una empresa.
 * Útil para depuración de problemas con la secuencia de números.
 * @param {string} companyId - ID de la compañía.
 * @param {string} documentType - Tipo de documento.
 * @returns {Promise<Object|null>} - Configuración actual o null si no existe.
 */
const verifyNumberingState = async (companyId, documentType) => {
    try {
        const numbering = await DocumentNumbering.findOne({ companyId, documentType });
        console.log(`Estado actual de numeración para ${documentType} de compañía ${companyId}:`, 
            numbering ? `Último número: ${numbering.lastNumber}, Prefijo: ${numbering.prefix}` : 'No existe configuración');
        return numbering;
    } catch (error) {
        console.error('Error al verificar estado de numeración:', error);
        return null;
    }
};

module.exports = {
    getNextDocumentNumber,
    updateDocumentNumberingConfig,
    getDocumentNumberingConfig,
    verifyNumberingState
};