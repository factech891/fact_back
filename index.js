const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const port = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Facturas dummy data
let facturas = [
    { id: 1, cliente: 'Juan Pérez', total: 1000 },
    { id: 2, cliente: 'María López', total: 1500 },
];

// Clientes dummy data
let clientes = [
    { id: 1, nombre: 'Juan Pérez', email: 'juan@example.com' },
    { id: 2, nombre: 'María López', email: 'maria@example.com' },
];

// Productos dummy data
let productos = [
    { id: 1, nombre: 'Laptop', precio: 1000 },
    { id: 2, nombre: 'Teléfono', precio: 800 },
];

// Endpoints de facturas
app.get('/facturas', (req, res) => res.json(facturas));
app.post('/facturas', (req, res) => {
    const nuevaFactura = {
        id: facturas.length + 1,
        cliente: req.body.cliente,
        total: req.body.total,
    };
    facturas.push(nuevaFactura);
    res.json(nuevaFactura);
});
app.put('/facturas/:id', (req, res) => {
    const { id } = req.params;
    const { cliente, total } = req.body;
    const index = facturas.findIndex(f => f.id === parseInt(id));
    if (index !== -1) {
        facturas[index] = { id: parseInt(id), cliente, total };
        res.json(facturas[index]);
    } else {
        res.status(404).json({ message: 'Factura no encontrada' });
    }
});
app.delete('/facturas/:id', (req, res) => {
    facturas = facturas.filter(f => f.id !== parseInt(req.params.id));
    res.status(204).end();
});

// Endpoints de clientes
app.get('/clientes', (req, res) => res.json(clientes));
app.post('/clientes', (req, res) => {
    const nuevoCliente = {
        id: clientes.length + 1,
        nombre: req.body.nombre,
        email: req.body.email,
    };
    clientes.push(nuevoCliente);
    res.json(nuevoCliente);
});

// Endpoints de productos
app.get('/productos', (req, res) => res.json(productos));
app.post('/productos', (req, res) => {
    const nuevoProducto = {
        id: productos.length + 1,
        nombre: req.body.nombre,
        precio: req.body.precio,
    };
    productos.push(nuevoProducto);
    res.json(nuevoProducto);
});

// Sirviendo el frontend
app.use(express.static(path.join(__dirname, 'build')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Iniciar el servidor
app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor corriendo en http://0.0.0.0:${port}`);
});
