// services/document-numbering.service.js
const mongoose = require('mongoose');
const DocumentNumbering = require('../models/document-numbering.model');

/**
 * Obtiene y actualiza el siguiente número de documento de forma atómica.
 * @param {string} companyId - ID de la compañía.
 * @param {string} documentType - Tipo de documento ('invoice', 'quote', etc).
 * @param {mongoose.ClientSession} [session] - Sesión de Mongoose (opcional).
 * @returns {Promise<string>} - Número de documento formateado (con prefijo).
 */
const getNextDocumentNumber = async (companyId, documentType = 'invoice', session = null) => {
    try {
        // Agregar log para depuración
        console.log(`Recibido tipo de documento: "${documentType}"`);
        
        // Normalizar el tipo de documento (eliminar guiones bajos y convertir a minúsculas)
        const normalizedType = documentType.toLowerCase().replace(/_/g, '');
        console.log(`Tipo normalizado para comparación: "${normalizedType}"`);

        // Determinar el prefijo correcto según el tipo de documento normalizado
        let prefix;
        switch (normalizedType) {
            case 'invoice':
                prefix = 'FAC';
                break;
            case 'quote':
                prefix = 'COT';
                break;
            case 'proforma':
                prefix = 'PRO';
                break;
            case 'deliverynote':
                prefix = 'ALB';
                break;
            case 'creditnote':
                prefix = 'NC';
                break;
            case 'debitnote':
                prefix = 'ND';
                break;
            default:
                prefix = 'DOC';
                console.log(`Tipo de documento no reconocido: "${documentType}", usando prefijo genérico: "DOC"`);
        }

        console.log(`Prefijo seleccionado: "${prefix}" para tipo "${documentType}"`);

        // Opciones para la actualización
        const options = {
            new: true, // Devuelve el documento actualizado
            upsert: true, // Crea el documento si no existe
            runValidators: true
        };

        if (session) {
            options.session = session;
        }

        // Usar el tipo original (no el normalizado) para buscar en la base de datos
        // para mantener la compatibilidad con registros existentes
        const originalType = documentType.toLowerCase();
        
        // Buscar o crear el contador para esta empresa y tipo de documento
        // MODIFICACIÓN: Ahora actualizamos el prefijo siempre, no solo en la inserción
        const numbering = await DocumentNumbering.findOneAndUpdate(
            { companyId, documentType: originalType },
            { 
                $inc: { lastNumber: 1 }, 
                $set: { prefix: prefix } // Actualizar el prefijo siempre
            },
            options
        );

        // CORRECCIÓN: Asegurar que no haya doble guión en el formato
        // Formateamos el número con un solo guión entre el prefijo y el número
        const formattedNumber = `${prefix}-${numbering.lastNumber.toString().padStart(5, '0')}`;

        // Agregar log para depuración
        console.log(`Servicio - Número generado para ${documentType} de compañía ${companyId}: ${formattedNumber} (contador: ${numbering.lastNumber}, prefijo usado: ${prefix})`);

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
        if (config.padding !== undefined) updateData.padding = Number(config.padding);

        // Si no hay datos para actualizar, no hacemos nada
        if (Object.keys(updateData).length === 0) {
            throw new Error('No se proporcionaron datos para actualizar.');
        }

        // Actualizar la configuración
        const numbering = await DocumentNumbering.findOneAndUpdate(
            { companyId, documentType: documentType.toLowerCase() },
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
        return await DocumentNumbering.findOne({
            companyId,
            documentType: documentType.toLowerCase()
        });
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
        const numbering = await DocumentNumbering.findOne({
            companyId,
            documentType: documentType.toLowerCase()
        });
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