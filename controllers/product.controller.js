let products = [
    { id: 1, name: 'Laptop', price: 1000 },
    { id: 2, name: 'Phone', price: 800 },
];

const getProducts = async (req, res) => res.json(products);

const createProduct = async (req, res) => {
    const newProduct = {
        id: products.length + 1,
        name: req.body.name,
        price: req.body.price,
    };
    products.push(newProduct);
    res.json(newProduct);
};

const updateProduct = async (req, res) => {
    const { id } = req.params;
    const { name, price } = req.body;

    const productIndex = products.findIndex(product => product.id === parseInt(id));

    if (productIndex !== -1) {
        
        products[productIndex] = { id: parseInt(id), name, price };
        res.json(products[productIndex]);
    } else {
        
        res.status(404).json({ message: 'Product not found' });
    }
};

const deleteProduct = async (req, res) => {
    products = products.filter(product => product.id !== parseInt(req.params.id));
    res.status(204).end();
};

module.exports = {
    getProducts,
    createProduct,
    updateProduct, 
    deleteProduct,
};