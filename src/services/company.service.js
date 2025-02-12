// services/company.service.js
const Company = require('../models/company.model');
const { v2: cloudinary } = require('cloudinary');

// Configuración de cloudinary
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Obtener información de la empresa
const getCompany = async () => {
  return await Company.findOne();
};

// Actualizar información de la empresa
const updateCompanyInfo = async (companyData) => {
  const company = await Company.findOne();
  
  if (!company) {
    return await Company.create(companyData);
  }

  Object.keys(companyData).forEach(key => {
    company[key] = companyData[key];
  });

  return await company.save();
};

// Subir logo de la empresa
const uploadCompanyLogo = async (filePath) => {
  try {
    let company = await Company.findOne();
    
    // Si no existe la empresa, crear una por defecto
    if (!company) {
      company = await Company.create({
        nombre: 'Empresa',
        rif: 'Por definir',
        email: 'por@definir.com'
      });
    }

    console.log('Subiendo archivo desde:', filePath);

    // Si existe un logo previo, eliminarlo
    if (company.logoId) {
      try {
        await cloudinary.uploader.destroy(company.logoId);
      } catch (error) {
        console.error('Error eliminando logo anterior:', error);
      }
    }

    // Subir nueva imagen
    const result = await cloudinary.uploader.upload(filePath, {
      folder: 'company-logos',
      transformation: [
        { width: 500, crop: "limit" },
        { quality: "auto", fetch_format: "auto" }
      ]
    });

    console.log('Resultado de Cloudinary:', result);

    company.logoUrl = result.secure_url;
    company.logoId = result.public_id;

    return await company.save();
  } catch (error) {
    console.error('Error en uploadCompanyLogo:', error);
    throw new Error(`Error al subir el logo: ${error.message}`);
  }
};

// Eliminar empresa
const deleteCompany = async () => {
  const company = await Company.findOne();
  
  if (!company) {
    throw new Error('No existe información de empresa para eliminar');
  }

  // Si hay un logo, eliminarlo de cloudinary
  if (company.logoId) {
    try {
      await cloudinary.uploader.destroy(company.logoId);
    } catch (error) {
      console.error('Error eliminando logo:', error);
    }
  }

  // Eliminar la empresa
  await company.deleteOne();
  return true;
};

module.exports = {
  getCompany,
  updateCompanyInfo,
  uploadCompanyLogo,
  deleteCompany
};