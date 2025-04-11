// services/company.service.js
const Company = require('../models/company.model');
const { v2: cloudinary } = require('cloudinary');
const fs = require('fs'); // Añadimos esto pa' borrar archivos
const path = require('path'); // Y esto pa' manejar rutas

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

// Subir logo de la empresa - MODIFICADA PA' GUARDAR LA RUTA LOCAL
const uploadCompanyLogo = async (logoData) => {
  try {
    // Podemos recibir un objeto con más info o solo la ruta como string
    const filePath = typeof logoData === 'string' ? logoData : logoData.filePath;
    
    // Extraer el nombre del archivo (lo último después de la última barra)
    const fileName = filePath.split('/').pop();
    
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

    // Si existe un logo previo, eliminarlo de Cloudinary
    if (company.logoId) {
      try {
        await cloudinary.uploader.destroy(company.logoId);
        console.log('Logo anterior eliminado de Cloudinary:', company.logoId);
      } catch (error) {
        console.error('Error eliminando logo anterior de Cloudinary:', error);
      }
    }
    
    // Si existe un archivo local previo, eliminarlo
    if (company.localFilePath) {
      try {
        const oldFilePath = path.join(__dirname, '..', 'uploads', company.localFilePath);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
          console.log('Archivo local anterior eliminado:', oldFilePath);
        }
      } catch (error) {
        console.error('Error eliminando archivo local anterior:', error);
      }
    }

    // Subir nueva imagen a Cloudinary
    const result = await cloudinary.uploader.upload(filePath, {
      folder: 'logos_empresas',
      transformation: [
        { width: 500, crop: "limit" },
        { quality: "auto", fetch_format: "auto" }
      ]
    });

    console.log('Resultado de Cloudinary:', result);

    // Guardar datos en la empresa
    company.logoUrl = result.secure_url;
    company.logoId = result.public_id;
    company.localFilePath = fileName; // ¡IMPORTANTE! Guardar nombre del archivo local

    return await company.save();
  } catch (error) {
    console.error('Error en uploadCompanyLogo:', error);
    throw new Error(`Error al subir el logo: ${error.message}`);
  }
};

// NUEVA FUNCIÓN! Eliminar logo por ID
const deleteLogoById = async (logoId) => {
  try {
    const company = await Company.findOne();
    
    if (!company) {
      throw new Error('No existe información de empresa');
    }
    
    // Eliminar de Cloudinary
    if (logoId) {
      await cloudinary.uploader.destroy(logoId);
      console.log('Logo eliminado de Cloudinary:', logoId);
    }
    
    // Eliminar archivo local si existe
    if (company.localFilePath) {
      const localFilePath = path.join(__dirname, '..', 'uploads', company.localFilePath);
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
        console.log('Archivo local eliminado:', localFilePath);
      }
    }
    
    // Limpiar datos en la empresa
    company.logoUrl = null;
    company.logoId = null;
    company.localFilePath = null;
    
    return await company.save();
  } catch (error) {
    console.error('Error eliminando logo:', error);
    throw new Error(`Error al eliminar el logo: ${error.message}`);
  }
};

// Actualizar configuración del tema
const updateThemeSettings = async (themeData) => {
  const company = await Company.findOne();
  
  if (!company) {
    throw new Error('No existe información de empresa para actualizar el tema');
  }

  // Actualizar campos del tema
  if (themeData.temaFactura) company.temaFactura = themeData.temaFactura;
  if (themeData.colorPrimario) company.colorPrimario = themeData.colorPrimario;
  if (themeData.colorSecundario) company.colorSecundario = themeData.colorSecundario;
  if (themeData.tamanoFuente) company.tamanoFuente = themeData.tamanoFuente;

  return await company.save();
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
  
  // Si hay archivo local, eliminarlo
  if (company.localFilePath) {
    try {
      const localFilePath = path.join(__dirname, '..', 'uploads', company.localFilePath);
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
      }
    } catch (error) {
      console.error('Error eliminando archivo local:', error);
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
  deleteLogoById, // ¡Exportamos la nueva función!
  updateThemeSettings,
  deleteCompany
};