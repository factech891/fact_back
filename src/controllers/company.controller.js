// controllers/company.controller.js
const { 
  getCompany, 
  updateCompanyInfo, 
  uploadCompanyLogo,
  updateThemeSettings,
  deleteCompany 
} = require('../services/company.service');

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

// Subir logo de la empresa
const uploadLogoController = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se ha proporcionado ninguna imagen' });
    }

    const updatedCompany = await uploadCompanyLogo(req.file.path);
    res.status(200).json({
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
  deleteCompanyController
};