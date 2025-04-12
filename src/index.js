require('dotenv').config();

// Verificar las variables de entorno al inicio
console.log('Verificando variables de entorno de Cloudinary:');
console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME || 'No configurado');
console.log('CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY ? 'Configurado' : 'No configurado');
console.log('CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? 'Configurado' : 'No configurado');

// Configuración de Cloudinary
const cloudinary = require('cloudinary').v2;
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const invoiceController = require('./controllers/invoice.controller');
const clientController = require('./controllers/client.controller');
const productController = require('./controllers/product.controller');
const companyController = require('./controllers/company.controller');
const documentController = require('./controllers/document.controller');

const app = express();
const port = 5002;
const urlMongo = "mongodb://localhost:27017/testing";
const mongoDb = process.env.MONGODB_URI || urlMongo;

// Función para limpiar archivos huérfanos
function cleanOrphanFiles() {
  // <-- CORRECCIÓN: Construir la ruta subiendo un nivel desde __dirname (src)
  const uploadsDir = path.join(__dirname, '..', 'uploads');

  fs.readdir(uploadsDir, async (err, files) => { // Usa la ruta corregida
    if (err) {
      // Este era tu error ENOENT. Con la ruta corregida, no debería pasar.
      console.error('Error al leer directorio uploads:', err);
      return;
    }

    try {
      // Obtener todos los archivos en uso por empresas
      const Company = require('./models/company.model');
      const companies = await Company.find({}, 'localFilePath');
      // Asegurarse de que localFilePath exista antes de intentar accederlo
      const usedFiles = companies
        .map(c => c.localFilePath) // Obtener solo el nombre del archivo
        .filter(Boolean); // Filtrar cualquier valor null o undefined

      console.log('Archivos en uso:', usedFiles);
      console.log('Total archivos en carpeta:', files.length);

      // Edad máxima: 1 hora (3600000 ms)
      const MAX_AGE = 3600000; // 1 hora
      const now = Date.now();
      let deletedCount = 0;

      for (const file of files) {
        // No borrar .gitkeep
        if (file === '.gitkeep') continue;

        // No borrar archivos en uso
        // Comprobar si el nombre del archivo está en la lista de archivos usados
        if (usedFiles.includes(file)) {
          continue;
        }

        // <-- CORRECCIÓN: Usar la ruta base correcta (uploadsDir ya está corregida)
        const filePath = path.join(uploadsDir, file);

        try {
          const stats = fs.statSync(filePath);
          // Si el archivo es más viejo que MAX_AGE y no está en uso, borrarlo
          if (now - stats.mtime.getTime() > MAX_AGE) {
            fs.unlinkSync(filePath);
            console.log(`Archivo huérfano eliminado: ${file}`);
            deletedCount++;
          }
        } catch (statErr) {
          // Manejar el caso donde el archivo ya no existe (puede haber sido borrado por otro proceso)
          if (statErr.code === 'ENOENT') {
             console.log(`Archivo ${file} no encontrado durante la verificación, posiblemente ya eliminado.`);
          } else {
             console.error(`Error al verificar archivo ${file}:`, statErr);
          }
        }
      }

      if (deletedCount > 0) {
        console.log(`Limpieza automática: ${deletedCount} archivos huérfanos eliminados`);
      } else {
        console.log('No se encontraron archivos huérfanos para eliminar');
      }
    } catch (error) {
      console.error('Error en limpieza automática:', error);
    }
  });
}


const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dest = 'uploads/'; // Relativo al CWD (probablemente la raíz del proyecto)
    // Asegurar que el directorio existe antes de guardar
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true }); // recursive: true por si acaso
    }
    cb(null, dest);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });


const uploadsPathRelative = 'uploads';
if (!fs.existsSync(uploadsPathRelative)) {
  fs.mkdirSync(uploadsPathRelative);
  // Opcional: Crear .gitkeep para que la carpeta vacía se pueda commitear
  fs.writeFileSync(path.join(uploadsPathRelative, '.gitkeep'), '');
  console.log(`Directorio ${uploadsPathRelative} creado.`);
}


// Middleware
app.use(cors());
app.use(express.json());
// Servir archivos estáticos desde 'uploads' (relativo al CWD)
app.use('/uploads', express.static(uploadsPathRelative));

// Rutas para invoices
app.get('/api/invoices', invoiceController.getInvoices);
app.post('/api/invoices', invoiceController.createOrUpdateInvoice);
app.put('/api/invoices/:id', invoiceController.updateInvoice);
app.delete('/api/invoices/:id', invoiceController.deleteInvoice);
app.get('/api/invoices/dashboard-data', invoiceController.getDashboardData);
// Ruta para actualizar el estado de una factura
app.patch('/api/invoices/:id/status', async (req, res) => {
    invoiceController.updateInvoiceStatus(req, res);
});

// Rutas para clients
app.get('/api/clients', clientController.getClients);
app.post('/api/clients', clientController.createClientController);
app.get('/api/clients/:id', clientController.getClientByIdController);
app.put('/api/clients/:id', clientController.updateClientController);
app.delete('/api/clients/:id', clientController.deleteClientController);

// Rutas para products
app.get('/api/products', productController.getProducts);
app.post('/api/products', productController.createProductController);
app.get('/api/products/:id', productController.getProductByIdController);
app.put('/api/products/:id', productController.updateProductController);
app.delete('/api/products/:id', productController.deleteProductController);

// Rutas para company
app.get('/api/company', companyController.getCompanyController);
app.put('/api/company', companyController.updateCompanyController);

// Ruta mejorada para subir logo
app.post('/api/company/logo', upload.single('logo'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ mensaje: 'No se subió ningún archivo.' });
    }
    try {
        // Guardar la referencia al nombre del archivo local
        const localFilename = req.file.filename;
        console.log('Archivo local guardado:', localFilename);

        // Subir el logo a Cloudinary
        const resultado = await cloudinary.uploader.upload(req.file.path, {
            folder: 'logos_empresas'
        });

        // Guardar info en la base de datos
        const Company = require('./models/company.model');
        let company = await Company.findOne();

        // Si no existe compañía, crearla (o manejar error según tu lógica)
        if (!company) {
           console.log("No se encontró compañía, creando una nueva...")
           company = new Company();
           // Podrías inicializar otros campos aquí si es necesario
        }

        // Si hay logo previo en Cloudinary, eliminarlo
        if (company.logoId) {
            try {
                await cloudinary.uploader.destroy(company.logoId);
                console.log('Logo anterior eliminado de Cloudinary:', company.logoId);
            } catch (err) {
                console.error('Error eliminando logo anterior de Cloudinary:', err);
                // Considera si quieres continuar o retornar un error aquí
            }
        }

        // Si hay archivo local previo registrado, eliminarlo físicamente
        if (company.localFilePath) {
            try {
                // <-- CORRECCIÓN: Construir ruta correcta para eliminar archivo viejo
                const oldPath = path.join(__dirname, '..', 'uploads', company.localFilePath);
                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                    console.log('Archivo local anterior eliminado:', company.localFilePath);
                } else {
                     console.log('Archivo local anterior no encontrado, no se eliminó:', company.localFilePath);
                }
            } catch (err) {
                console.error('Error al eliminar archivo local anterior:', err);
                // Considera si quieres continuar o retornar un error aquí
            }
        }

        // Guardar nuevos datos
        company.logoUrl = resultado.secure_url;
        company.logoId = resultado.public_id;
        company.localFilePath = localFilename; // Guardar solo el nombre del archivo
        await company.save();


        res.json({
            mensaje: 'Logo subido exitosamente',
            url: resultado.secure_url,
            public_id: resultado.public_id
        });
    } catch (error) {
        console.error('Error al subir el logo:', error);
        // Si hubo un error, intentar eliminar el archivo local que se guardó
         if (req.file && req.file.path && fs.existsSync(req.file.path)) {
             try {
                 fs.unlinkSync(req.file.path);
                 console.log('Archivo local eliminado debido a error en subida:', req.file.filename);
             } catch (cleanupErr) {
                 console.error('Error al limpiar archivo local después de un error:', cleanupErr);
             }
         }
        res.status(500).json({ mensaje: 'Error al subir el logo', error: error.message });
    }
});


// Ruta mejorada para eliminar logo
app.delete('/api/company/logo/:id', async (req, res) => {
  try {
    // Decodificar el ID que viene codificado en la URL (public_id de Cloudinary)
    const publicIdToDelete = decodeURIComponent(req.params.id);
    console.log('Intentando eliminar logo con public_id:', publicIdToDelete);

    // 1. Buscar la compañía que tiene este logoId
    const Company = require('./models/company.model');
    // Buscar por logoId para asegurar que estamos modificando la compañía correcta
    const company = await Company.findOne({ logoId: publicIdToDelete });

    if (!company) {
        console.log('No se encontró compañía con ese logoId:', publicIdToDelete);
        // Decidir si eliminar de Cloudinary de todas formas o retornar error
        // Por seguridad, podríamos solo eliminar si encontramos la compañía asociada
        try {
             console.log("Intentando eliminar de Cloudinary de todas formas...");
             await cloudinary.uploader.destroy(publicIdToDelete);
             console.log('Logo eliminado de Cloudinary (sin compañía asociada encontrada):', publicIdToDelete);
             return res.json({ success: true, message: 'Logo eliminado de Cloudinary (compañía no encontrada/actualizada)' });
        } catch (cloudinaryErr) {
             console.error('Error eliminando logo de Cloudinary (sin compañía asociada):', cloudinaryErr);
             return res.status(500).json({ success: false, message: 'Error eliminando de Cloudinary', error: cloudinaryErr.message });
        }
    }

    // 2. Eliminar de Cloudinary (si se encontró la compañía)
    try {
        await cloudinary.uploader.destroy(publicIdToDelete);
        console.log('Logo eliminado de Cloudinary:', publicIdToDelete);
    } catch (cloudinaryErr) {
         console.error('Error eliminando logo de Cloudinary:', cloudinaryErr);
         // Decide si continuar para limpiar DB y local o retornar error
         return res.status(500).json({ success: false, message: 'Error eliminando de Cloudinary', error: cloudinaryErr.message });
    }

    // 3. Eliminar archivo local si existe referencia
    if (company.localFilePath) {
      try {
        // <-- CORRECCIÓN: Construir ruta correcta para eliminar archivo local
        const filePath = path.join(__dirname, '..', 'uploads', company.localFilePath);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log('Archivo local eliminado:', company.localFilePath);
        } else {
          console.log('Archivo local referenciado no encontrado, no se eliminó:', company.localFilePath);
        }
      } catch (fsError) {
        console.error('Error al eliminar archivo local (continuando...):', fsError);
        // No retornar error aquí necesariamente, pero sí loggearlo. La eliminación principal (Cloudinary) ya ocurrió.
      }
    } else {
        console.log('No había referencia a archivo local para eliminar.');
    }

    // 4. Actualizar la empresa en la base de datos
    company.logoUrl = null;
    company.logoId = null;
    company.localFilePath = null;
    await company.save();
    console.log('Referencia de logo eliminada de la base de datos.');

    res.json({ success: true, message: 'Logo eliminado completamente' });
  } catch (error) {
    console.error('Error general en la ruta de eliminar logo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});


app.put('/api/company/theme', companyController.updateThemeController);
app.delete('/api/company', companyController.deleteCompanyController);

// Rutas para documentos
app.get('/api/documents', documentController.getDocuments);
app.get('/api/documents/pending', documentController.getPendingDocuments);
app.get('/api/documents/:id', documentController.getDocument);
app.post('/api/documents', documentController.createDocument);
app.put('/api/documents/:id', documentController.updateDocument);
app.delete('/api/documents/:id', documentController.deleteDocument);
app.patch('/api/documents/:id/status', documentController.updateDocumentStatus);
app.post('/api/documents/:id/convert-to-invoice', documentController.convertToInvoice);

app.use(express.static(path.join(__dirname, '..', 'build')));
app.get('*', (req, res) => {
  // Si ninguna ruta API coincide, sirve el index.html para el routing del lado del cliente
  res.sendFile(path.join(__dirname, '..', 'build', 'index.html'), (err) => {
     if (err) {
       // Manejar error, por ejemplo si 'build/index.html' no existe
       res.status(500).send(err);
     }
  });
});


// Conexión a MongoDB
async function conectarBD() {
  try {
    await mongoose.connect(mongoDb);
    console.log('MongoDB Conectada');
  } catch (error) {
    console.error('Error al conectar a MongoDB:', error);
    process.exit(1); // Terminar el proceso si no se puede conectar a la BD
  }
}

// Iniciar servidor y tareas programadas
async function startServer() {
    await conectarBD(); // Esperar a que la BD esté conectada

    app.listen(port, '0.0.0.0', () => {
      console.log(`Servidor corriendo en http://0.0.0.0:${port}`);

      // Ejecutar limpieza inicial después de un breve retraso (ej. 10s)
      console.log('Programando limpieza inicial de archivos huérfanos en 10 segundos...');
      setTimeout(() => {
          console.log('Ejecutando limpieza inicial de archivos huérfanos...');
          cleanOrphanFiles();
      }, 10000);

      // Programar limpieza recurrente (ej. cada 30 minutos)
      const cleanIntervalMinutes = 30;
      console.log(`Programando limpieza recurrente de archivos huérfanos cada ${cleanIntervalMinutes} minutos...`);
      setInterval(cleanOrphanFiles, cleanIntervalMinutes * 60 * 1000);
    });
}

startServer(); 