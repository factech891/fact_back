// controllers/company.controller.js
const { 
  getCompany, 
  updateCompanyInfo, 
  uploadCompanyLogo,
  updateThemeSettings,
  deleteCompany 
} = require('../services/company.service');
const cloudinary = require('cloudinary').v2; // Asegúrate de tener esto importado
const fs = require('fs');
const path = require('path');

// Obtener información de la empresa
const getCompanyController = async (req, res) => {
  try {
    const company = await getCompany();
    if (!company) {
      return res.status(404).json({ error: 'No se encontró información de la empresa' });
    }
    res.status(200).json(company);
  } catch (error) {
    console.error('Error al obtener información de la empresa:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Actualizar información de la empresa
const updateCompanyController = async (req, res) => {
  try {
    const { nombre, rif, email } = req.body;

    // Validación básica
    if (!nombre || !rif || !email) {
      return res.status(400).json({ error: 'Nombre, RIF y email son requeridos.' });
    }

    const updatedCompany = await updateCompanyInfo(req.body);
    res.status(200).json(updatedCompany);
  } catch (error) {
    console.error('Error al actualizar la empresa:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Eliminar el logo - ¡FUNCIÓN MEJORADA CON TODO EL FLOW!
const deleteLogoController = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Intentando eliminar logo con ID: ${id}`);
    
    // 1. Buscamos la empresa para obtener info del archivo local
    const company = await getCompany();
    
    if (!company) {
      return res.status(404).json({ error: 'No se encontró información de la empresa' });
    }
    
    // 2. Borramos de Cloudinary si hay ID
    if (id) {
      try {
        await cloudinary.uploader.destroy(id);
        console.log(`Logo eliminado de Cloudinary: ${id}`);
      } catch (cloudError) {
        console.error('Error al eliminar de Cloudinary:', cloudError);
        // Continuamos de todas formas para borrar localmente
      }
    }
    
    // 3. Borramos archivo local si existe una ruta
    if (company.localFilePath) {
      const uploadsDir = path.join(__dirname, '..', 'uploads');
      const filePath = path.join(uploadsDir, company.localFilePath);
      
      console.log(`Verificando archivo local: ${filePath}`);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Archivo local borrado: ${filePath}`);
      }
    }
    
    // 4. Actualizamos la empresa quitando referencias al logo
    company.logoUrl = null;
    company.logoId = null;
    company.localFilePath = null; // Asegúrate de que este campo exista en tu modelo
    
    const updatedCompany = await updateCompanyInfo(company);
    
    res.status(200).json({ 
      success: true, 
      message: 'Logo eliminado completamente',
      company: updatedCompany 
    });
  } catch (error) {
    console.error('Error al eliminar logo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Subir logo de la empresa - MEJORADO PA' GUARDAR LA RUTA LOCAL
const uploadLogoController = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se ha proporcionado ninguna imagen' });
    }

    console.log(`Archivo recibido: ${req.file.path}, filename: ${req.file.filename}`);
    
    // Guardamos también el nombre del archivo local
    const logoData = {
      filePath: req.file.path,
      fileName: req.file.filename // Esto es importante pa' borrar después
    };

    const updatedCompany = await uploadCompanyLogo(logoData);
    
    res.status(200).json({
      mensaje: 'Logo subido exitosamente',
      logoUrl: updatedCompany.logoUrl,
      logoId: updatedCompany.logoId
    });
  } catch (error) {
    console.error('Error al subir el logo:', error);
    res.status(500).json({ error: 'Error al subir el logo' });
  }
};

// Actualizar configuración del tema
const updateThemeController = async (req, res) => {
  try {
    const { temaFactura, colorPrimario, colorSecundario, tamanoFuente } = req.body;

    // Validación básica
    if (!temaFactura) {
      return res.status(400).json({ error: 'El tema es requerido.' });
    }

    const updatedCompany = await updateThemeSettings(req.body);
    res.status(200).json({
      temaFactura: updatedCompany.temaFactura,
      colorPrimario: updatedCompany.colorPrimario,
      colorSecundario: updatedCompany.colorSecundario,
      tamanoFuente: updatedCompany.tamanoFuente
    });
  } catch (error) {
    console.error('Error al actualizar el tema:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Eliminar la empresa
const deleteCompanyController = async (req, res) => {
  try {
    await deleteCompany();
    res.status(200).json({ message: 'Empresa eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar la empresa:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getCompanyController,
  updateCompanyController,
  uploadLogoController,
  updateThemeController,
  deleteCompanyController,
  deleteLogoController // ¡OJO! Añadimos esta exportación que faltaba
};