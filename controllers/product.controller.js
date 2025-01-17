let productos = [
    { id: 1, name: 'Laptop', price: 1000 },
    { id: 2, name: 'Teléfono', price: 800 },
];


const getProducts = (req, res) => res.json(productos);
const createProduct =  (req, res) => {
    const nuevoProducto = {
        id: productos.length + 1,
        name: req.body.name,
        price: req.body.price,
    };
    productos.push(nuevoProducto);
    res.json(nuevoProducto);
};

module.exports = {
    getProducts,
    createProduct
}