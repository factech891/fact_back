// services/invoice.service.js
const Invoice = require('../models/invoice.model');

const getAllInvoices = async () => {
   return Invoice.find()
       .populate('client')
       .populate('items.product')
       .sort({ date: -1 });
};

const getInvoiceById = async (id) => {
   return Invoice.findById(id)
       .populate('client')
       .populate('items.product');
};

const createInvoice = async (invoiceData) => {
   const invoice = new Invoice(invoiceData);
   return invoice.save();
};

const updateInvoice = async (id, invoiceData) => {
   return Invoice.findByIdAndUpdate(id, invoiceData, {
       new: true,
       runValidators: true
   }).populate('client').populate('items.product');
};

const deleteInvoice = async (id) => {
   return Invoice.findByIdAndDelete(id);
};

const getInvoiceByNumber = async (number) => {
   return Invoice.findOne({ number });
};

// Nuevo método para actualizar estado
const updateInvoiceStatus = async (id, status) => {
   return Invoice.findByIdAndUpdate(
       id,
       { status },
       { new: true, runValidators: true }
   ).populate('client').populate('items.product');
};

module.exports = {
   getAllInvoices,
   getInvoiceById,
   createInvoice,
   updateInvoice,
   deleteInvoice,
   getInvoiceByNumber,
   updateInvoiceStatus
};