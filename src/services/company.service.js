// services/company.service.js
const Company = require('../models/company.model');
const cloudinary = require('cloudinary').v2;

// Configuración de cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const getCompany = async () => {
  return await Company.findOne();
};

const updateCompanyInfo = async (companyData) => {
  const company = await Company.findOne();
  
  if (!company) {
    return await Company.create(companyData);
  }

  // Actualizar todos los campos proporcionados
  Object.keys(companyData).forEach(key => {
    company[key] = companyData[key];
  });

  return await company.save();
};

const uploadCompanyLogo = async (filePath) => {
  try {
    const company = await Company.findOne();
    if (!company) {
      throw new Error('Empresa no encontrada');
    }

    // Si existe un logo previo, eliminarlo
    if (company.logoId) {
      await cloudinary.uploader.destroy(company.logoId);
    }

    // Subir nueva imagen
    const result = await cloudinary.uploader.upload(filePath, {
      folder: 'company-logos',
      width: 500,
      crop: 'limit'
    });

    company.logoUrl = result.secure_url;
    company.logoId = result.public_id;

    return await company.save();
  } catch (error) {
    throw new Error(`Error al subir el logo: ${error.message}`);
  }
};

const updateThemeSettings = async (settings) => {
  const company = await Company.findOne();
  if (!company) {
    throw new Error('Empresa no encontrada');
  }

  // Actualizar configuraciones del tema
  if (settings.temaFactura) company.temaFactura = settings.temaFactura;
  if (settings.colorPrimario) company.colorPrimario = settings.colorPrimario;
  if (settings.colorSecundario) company.colorSecundario = settings.colorSecundario;
  if (settings.tamanoFuente) company.tamanoFuente = settings.tamanoFuente;

  return await company.save();
};

module.exports = {
  getCompany,
  updateCompanyInfo,
  uploadCompanyLogo,
  updateThemeSettings
};