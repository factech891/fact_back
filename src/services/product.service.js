// services/product.service.js
const mongoose = require('mongoose');
const Product = require('../models/product.model'); // Asegúrate que la ruta sea correcta

/**
 * Obtener todos los productos de una compañía específica.
 * @param {string} companyId - ID de la compañía.
 * @returns {Promise<Array>} Lista de productos de esa compañía.
 */
const getAllProducts = async (companyId) => {
  try {
    console.log('Servicio - Obteniendo todos los productos para CompanyId:', companyId);
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      console.error('Servicio - ID de compañía inválido:', companyId);
      throw new Error('ID de compañía inválido');
    }
    // Filtrar por companyId
    return await Product.find({ companyId: companyId }).sort({ createdAt: -1 });
  } catch (error) {
    console.error('Servicio - Error al obtener los productos:', error);
    throw new Error(`Error al obtener los productos: ${error.message}`);
  }
};

/**
 * Crear un nuevo producto asociado a una compañía específica.
 * @param {Object} productData - Datos del producto.
 * @param {string} companyId - ID de la compañía del usuario autenticado.
 * @returns {Promise<Object>} Producto creado.
 */
const createProduct = async (productData, companyId) => {
  try {
    console.log('Servicio - Datos recibidos para crear producto:', productData, 'CompanyId:', companyId);
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      console.error('Servicio - ID de compañía inválido para crear producto:', companyId);
      throw new Error('ID de compañía inválido');
    }

    // Asignar el companyId al producto
    productData.companyId = companyId;

    // Convertir código a mayúsculas si existe
    if (productData.codigo) {
        productData.codigo = productData.codigo.toUpperCase();
    }

    const newProduct = new Product(productData);
    const savedProduct = await newProduct.save();
    console.log('Servicio - Producto guardado exitosamente:', savedProduct._id, 'para CompanyId:', companyId);
    return savedProduct;
  } catch (error) {
    console.error('Servicio - Error al crear el producto:', error);
    // Podrías querer manejar errores de duplicados (ej. código de producto) aquí si hay índices únicos
    if (error.code === 11000 || error.message.includes('duplicate key')) {
        // Determinar qué campo causó el error (ej. código)
        const field = Object.keys(error.keyPattern)[0];
        throw new Error(`Error al crear el producto: Ya existe un producto con este ${field === 'codigo' ? 'código' : field} en esta compañía.`);
    }
    throw new Error(`Error al crear el producto: ${error.message}`);
  }
};

/**
 * Obtener un producto por ID, asegurando que pertenezca a la compañía correcta.
 * @param {string} id - ID del producto.
 * @param {string} companyId - ID de la compañía.
 * @returns {Promise<Object>} Producto encontrado.
 */
const getProductById = async (id, companyId) => {
  try {
    console.log('Servicio - Obteniendo producto por ID:', id, 'para CompanyId:', companyId);
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.warn('Servicio - ID de producto inválido:', id);
      throw new Error('ID de producto inválido');
    }
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      console.error('Servicio - ID de compañía inválido:', companyId);
      throw new Error('ID de compañía inválido');
    }

    // Buscar por ID y companyId
    const product = await Product.findOne({ _id: id, companyId: companyId });

    if (!product) {
      console.log('Servicio - Producto no encontrado con ID:', id, 'para CompanyId:', companyId);
      throw new Error('Producto no encontrado');
    }
    console.log('Servicio - Producto encontrado:', product._id);
    return product;
  } catch (error) {
    if (error.message !== 'Producto no encontrado' && error.message !== 'ID de producto inválido') {
        console.error('Servicio - Error al obtener el producto por ID:', error);
    }
    throw error; // Re-lanzar para que el controlador lo maneje
  }
};

/**
 * Obtener un producto por código, asegurando que pertenezca a la compañía correcta.
 * @param {string} codigo - Código del producto.
 * @param {string} companyId - ID de la compañía.
 * @returns {Promise<Object>} Producto encontrado.
 */
const getProductByCode = async (codigo, companyId) => {
    try {
        const upperCaseCodigo = codigo.toUpperCase();
        console.log('Servicio - Obteniendo producto por Código:', upperCaseCodigo, 'para CompanyId:', companyId);
        if (!codigo || codigo.trim() === '') {
            throw new Error('El código del producto no puede estar vacío.');
        }
        if (!mongoose.Types.ObjectId.isValid(companyId)) {
          console.error('Servicio - ID de compañía inválido:', companyId);
          throw new Error('ID de compañía inválido');
        }

        // Buscar por código (insensible a mayúsculas/minúsculas si se guarda normalizado) y companyId
        const product = await Product.findOne({ codigo: upperCaseCodigo, companyId: companyId });

        if (!product) {
          console.log('Servicio - Producto no encontrado con Código:', upperCaseCodigo, 'para CompanyId:', companyId);
          // Es importante devolver null o un error consistente. Devolver null puede ser útil si se espera que no exista.
          // Lanzar error es más explícito si se espera que exista.
          return null; // Opcionalmente: throw new Error('Producto no encontrado con ese código');
        }
        console.log('Servicio - Producto encontrado por código:', product._id);
        return product;
    } catch (error) {
        console.error('Servicio - Error al obtener el producto por código:', error);
        // Evitar propagar errores internos como 'ID de compañía inválido' directamente al usuario si es posible
        if (error.message === 'ID de compañía inválido') {
             throw new Error('Error interno del servidor.');
        }
        throw new Error(`Error al buscar producto por código: ${error.message}`);
    }
};


/**
 * Actualizar un producto, asegurando que pertenezca a la compañía correcta.
 * @param {string} id - ID del producto.
 * @param {Object} productData - Datos actualizados.
 * @param {string} companyId - ID de la compañía.
 * @returns {Promise<Object>} Producto actualizado.
 */
const updateProduct = async (id, productData, companyId) => {
  try {
    console.log('Servicio - Datos recibidos para actualizar producto:', id, 'Data:', productData, 'CompanyId:', companyId);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.warn('Servicio - ID de producto inválido para actualizar:', id);
      throw new Error('ID de producto inválido');
    }
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      console.error('Servicio - ID de compañía inválido para actualizar:', companyId);
      throw new Error('ID de compañía inválido');
    }

    // Asegurarse de no cambiar el companyId durante la actualización
    delete productData.companyId;

    // Convertir código a mayúsculas si se está actualizando
    if (productData.codigo) {
        productData.codigo = productData.codigo.toUpperCase();
    }

    // Buscar y actualizar solo si el _id y companyId coinciden
    const updatedProduct = await Product.findOneAndUpdate(
      { _id: id, companyId: companyId }, // Condición de búsqueda
      { $set: productData }, // Usar $set para actualizar solo los campos proporcionados
      { new: true, runValidators: true } // Opciones
    );

    if (!updatedProduct) {
      console.log('Servicio - Producto no encontrado para actualizar con ID:', id, 'para CompanyId:', companyId);
      throw new Error('Producto no encontrado o no tiene permiso para actualizarlo');
    }

    console.log('Servicio - Producto actualizado exitosamente:', updatedProduct._id);
    return updatedProduct;
  } catch (error) {
     if (error.message !== 'Producto no encontrado o no tiene permiso para actualizarlo' && error.message !== 'ID de producto inválido') {
        console.error('Servicio - Error al actualizar el producto:', error);
    }
     // Manejar errores de duplicados (ej. código de producto)
    if (error.code === 11000 || error.message.includes('duplicate key')) {
        const field = Object.keys(error.keyPattern)[0];
        throw new Error(`Error al actualizar el producto: Ya existe otro producto con este ${field === 'codigo' ? 'código' : field} en esta compañía.`);
    }
    throw new Error(`Error al actualizar el producto: ${error.message}`);
  }
};

/**
 * Eliminar un producto, asegurando que pertenezca a la compañía correcta.
 * @param {string} id - ID del producto.
 * @param {string} companyId - ID de la compañía.
 * @returns {Promise<Object>} Producto eliminado.
 */
const deleteProduct = async (id, companyId) => {
  try {
    console.log('Servicio - Intentando eliminar producto con ID:', id, 'para CompanyId:', companyId);
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.warn('Servicio - ID de producto inválido para eliminar:', id);
      throw new Error('ID de producto inválido');
    }
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      console.error('Servicio - ID de compañía inválido para eliminar:', companyId);
      throw new Error('ID de compañía inválido');
    }

    // Buscar y eliminar solo si el _id y companyId coinciden
    const deletedProduct = await Product.findOneAndDelete({ _id: id, companyId: companyId });

    if (!deletedProduct) {
      console.log('Servicio - Producto no encontrado para eliminar con ID:', id, 'para CompanyId:', companyId);
      throw new Error('Producto no encontrado o no tiene permiso para eliminarlo');
    }

    console.log('Servicio - Producto eliminado exitosamente:', id);
    return deletedProduct;
  } catch (error) {
     if (error.message !== 'Producto no encontrado o no tiene permiso para eliminarlo' && error.message !== 'ID de producto inválido') {
        console.error('Servicio - Error al eliminar el producto:', error);
     }
    throw new Error(`Error al eliminar el producto: ${error.message}`);
  }
};

module.exports = {
  getAllProducts,
  createProduct,
  getProductById,
  updateProduct,
  deleteProduct,
  getProductByCode
};