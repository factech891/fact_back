const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const invoiceController = require('./controllers/invoice.controller');
const clientController = require('./controllers/client.controller');
const productController = require('./controllers/product.controller');

const app = express();
const port = 5002;
const urlMongo = "mongodb://localhost:27017/testing";
const mongoDb = process.env.MONGODB_URI || urlMongo;

// Middleware
app.use(cors());
app.use(express.json());

// Rutas para invoices
app.get('/api/invoices', invoiceController.getInvoices);
app.post('/api/invoices', invoiceController.createInvoices);
app.put('/api/invoices/:id', invoiceController.updateInvocies);
app.delete('/api/invoices/:id', invoiceController.deleteInvoices);
app.get('/api/invoices/:id/pdf', invoiceController.generateInvoicePDFController);

// Rutas para clients
app.get('/api/clients', clientController.getClients); // Obtener todos los clientes
app.post('/api/clients', clientController.createClientController); // Crear un cliente
app.get('/api/clients/:id', clientController.getClientByIdController); // Obtener un cliente por ID
app.put('/api/clients/:id', clientController.updateClientController); // Actualizar un cliente
app.delete('/api/clients/:id', clientController.deleteClientController); // Eliminar un cliente

// Rutas para products
app.get('/api/products', productController.getProducts);
app.post('/api/products', productController.createProduct);
app.put('/api/products/:id', productController.updateProduct);
app.delete('/api/products/:id', productController.deleteProduct);

// Servir archivos estáticos (si es necesario)
app.use(express.static(path.join(__dirname, 'build')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Conexión a MongoDB
// Conexión a MongoDB
async function conectarBD() {
    try {
        await mongoose.connect(mongoDb);
        console.log('MongoDB Conectada');
    } catch (error) {
        console.error('Error al conectar a MongoDB:', error);
        process.exit(1); // Detiene la aplicación si hay un error
    }
}

conectarBD();

// Iniciar el servidor
app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor corriendo en http://0.0.0.0:${port}`);
});