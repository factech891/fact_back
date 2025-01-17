const express = require('express');
const cors = require('cors');
const path = require('path');
const invoiceController  =  require('./controllers/invoice.controller');
const clientController = require('./controllers/client.controller');
const productController = require('./controllers/product.controller')
const app = express();
const port = 5000;

// Middleware
app.use(cors());
app.use(express.json());


app.get('/facturas',invoiceController.getInvoices);
app.post('/facturas',invoiceController.createInvoices);
app.put('/facturas/:id',invoiceController.updateInvocies);
app.delete('/facturas/:id',invoiceController.deleteInvoices);


// Endpoints de clientes
app.get('/clientes', clientController.getCLients );
app.post('/clientes', clientController.createClient);

// Endpoints de productos
app.get('/productos', productController.getProducts);
app.post('/productos', productController.createProduct);

// Sirviendo el frontend
app.use(express.static(path.join(__dirname, 'build')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Iniciar el servidor
app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor corriendo en http://0.0.0.0:${port}`);
});
