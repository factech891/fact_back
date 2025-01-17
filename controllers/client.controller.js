let clientes = [
    { id: 1, nombre: 'Juan Pérez', email: 'juan@example.com' },
    { id: 2, nombre: 'María López', email: 'maria@example.com' },
];


const getCLients = async (req, res) => res.json(clientes);


const createClient = async (req, res) => {
    const nuevoCliente = {
        id: clientes.length + 1,
        nombre: req.body.nombre,
        email: req.body.email,
    };
    clientes.push(nuevoCliente);
    res.json(nuevoCliente);
};

module.exports = {
    getCLients,
    createClient
}