// models/client.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const clientSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    rif: {
        type: String,
        required: true,
        unique: true
    },
    direccion: {
        type: String,
        required: true
    },
    telefono: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Client', clientSchema);