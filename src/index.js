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
app.post('/api/invoices', invoiceController.createOrUpdateInvoice); // Cambiado
app.put('/api/invoices/:id', invoiceController.updateInvoice); // Cambiado nombre de la función
app.delete('/api/invoices/:id', invoiceController.deleteInvoice); // Cambiado nombre de la función

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

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'build')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Conexión a MongoDB
async function conectarBD() {
    try {
        await mongoose.connect(mongoDb);
        console.log('MongoDB Conectada');
    } catch (error) {
        console.error('Error al conectar a MongoDB:', error);
        process.exit(1);
    }
}

conectarBD();

app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor corriendo en http://0.0.0.0:${port}`);
});
