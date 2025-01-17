let productos = [
    { id: 1, nombre: 'Laptop', precio: 1000 },
    { id: 2, nombre: 'Teléfono', precio: 800 },
];


const getProducts = (req, res) => res.json(productos);
const createProduct =  (req, res) => {
    const nuevoProducto = {
        id: productos.length + 1,
        nombre: req.body.nombre,
        precio: req.body.precio,
    };
    productos.push(nuevoProducto);
    res.json(nuevoProducto);
};

module.exports = {
    getProducts,
    createProduct
}