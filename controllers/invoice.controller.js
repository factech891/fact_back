

let facturas = [
    { id: 1, client: 'Juan Pérez', total: 1000 },
    { id: 2, client: 'María López', total: 1500 },
];

const getInvoices =  async (req, res) => res.json(facturas);

const createInvoices =  (req, res) => {
    const nuevaFactura = {
        id: facturas.length + 1,
        client: req.body.client,
        total: req.body.total,
    };
    facturas.push(nuevaFactura);
    res.json(nuevaFactura);
};


const updateInvocies = async (req, res) => {
    const { id } = req.params;
    const { cliente, total } = req.body;
    const index = facturas.findIndex(f => f.id === parseInt(id));
    if (index !== -1) {
        facturas[index] = { id: parseInt(id), cliente, total };
        res.json(facturas[index]);
    } else {
        res.status(404).json({ message: 'Factura no encontrada' });
    }
};

const deleteInvoices = async (req, res) => {
    facturas = facturas.filter(f => f.id !== parseInt(req.params.id));
    res.status(204).end();
};

module.exports = {
    getInvoices,
    createInvoices,
    updateInvocies,
    deleteInvoices

}