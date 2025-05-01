// controllers/document-numbering.controller.js
const documentNumberingService = require('../services/document-numbering.service');

/**
 * Obtiene la configuración de numeración de documentos para una empresa.
 */
const getDocumentNumberingConfig = async (req, res) => {
    try {
        const { companyId, documentType } = req.params;
        
        // Verificar que el companyId de la petición coincida con el companyId del usuario
        if (req.user.companyId !== companyId && !req.user.isPlatformAdmin) {
            return res.status(403).json({
                success: false,
                message: 'No tiene permiso para acceder a esta información'
            });
        }
        
        const config = await documentNumberingService.getDocumentNumberingConfig(companyId, documentType);
        
        return res.status(200).json({
            success: true,
            data: config
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Actualiza la configuración de numeración de documentos para una empresa.
 */
const updateDocumentNumberingConfig = async (req, res) => {
    try {
        const { companyId, documentType } = req.params;
        const { prefix, padding } = req.body;
        
        // Verificar que el companyId de la petición coincida con el companyId del usuario
        if (req.user.companyId !== companyId && !req.user.isPlatformAdmin) {
            return res.status(403).json({
                success: false,
                message: 'No tiene permiso para modificar esta información'
            });
        }
        
        // Validar datos de entrada
        if (!prefix && padding === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Debe proporcionar al menos un campo para actualizar (prefix o padding)'
            });
        }
        
        // Construir objeto de configuración con los campos proporcionados
        const config = {};
        if (prefix !== undefined) config.prefix = prefix;
        if (padding !== undefined) config.padding = Number(padding);
        
        // Actualizar configuración
        const updatedConfig = await documentNumberingService.updateDocumentNumberingConfig(
            companyId, 
            documentType, 
            config
        );
        
        return res.status(200).json({
            success: true,
            data: updatedConfig,
            message: 'Configuración actualizada exitosamente'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Obtiene el siguiente número de documento para pruebas o vista previa.
 * No incrementa el contador real.
 */
const previewNextDocumentNumber = async (req, res) => {
    try {
        const { companyId, documentType } = req.params;
        
        // Verificar que el companyId de la petición coincida con el companyId del usuario
        if (req.user.companyId !== companyId && !req.user.isPlatformAdmin) {
            return res.status(403).json({
                success: false,
                message: 'No tiene permiso para acceder a esta información'
            });
        }
        
        // Obtener la configuración actual
        const config = await documentNumberingService.getDocumentNumberingConfig(companyId, documentType);
        
        // Si no existe, crear un preview con valores por defecto
        let nextNumber = 'FAC-00001';
        if (config) {
            const nextValue = config.lastNumber + 1;
            nextNumber = `${config.prefix}${nextValue.toString().padStart(config.padding, '0')}`;
        }
        
        return res.status(200).json({
            success: true,
            data: {
                nextNumber
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    getDocumentNumberingConfig,
    updateDocumentNumberingConfig,
    previewNextDocumentNumber
};