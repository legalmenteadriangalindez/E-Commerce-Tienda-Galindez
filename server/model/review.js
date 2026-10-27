const mongoose = require('mongoose');

const replySchema = new mongoose.Schema({
    texto: { type: String, required: true, trim: true, minlength: 3, maxlength: 1000 },
    administrador: { type: mongoose.Schema.Types.ObjectId, ref: 'userdb', required: true },
    fecha: { type: Date, required: true },
    fechaEdicion: { type: Date, default: null }
}, { _id: false });

const moderationSchema = new mongoose.Schema({
    motivo: { type: String, required: true, trim: true, minlength: 3, maxlength: 500 },
    administrador: { type: mongoose.Schema.Types.ObjectId, ref: 'userdb', required: true },
    fecha: { type: Date, required: true }
}, { _id: false });

const historySchema = new mongoose.Schema({
    accion: { type: String, required: true, enum: ['OCULTAR', 'PUBLICAR', 'RESPONDER', 'EDITAR_RESPUESTA', 'RETIRAR_RESPUESTA'] },
    administrador: { type: mongoose.Schema.Types.ObjectId, ref: 'userdb', required: true },
    fecha: { type: Date, required: true },
    detalle: { type: String, maxlength: 1000 },
    textoAnterior: { type: String, maxlength: 1000 }
}, { _id: false });

const schema = new mongoose.Schema({
    producto: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'productdb',
        required: true,
        immutable: true
    },
    usuario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'userdb',
        required: true,
        immutable: true
    },
    calificacion: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
        validate: {
            validator: Number.isInteger,
            message: 'La calificación debe ser un entero entre 1 y 5'
        }
    },
    comentario: {
        type: String,
        required: true,
        trim: true,
        minlength: 3,
        maxlength: 1000
    },
    // Se conservan los adjuntos que puedan tener las reseñas anteriores.
    fotos: {
        type: [String],
        validate: [arr => arr.length <= 5, 'Máximo 5 imágenes por reseña']
    },
    video: String,
    fecha: { type: Date, default: Date.now },
    fechaEdicion: { type: Date, default: null },
    oculta: { type: Boolean, default: false },
    moderacion: { type: moderationSchema, default: undefined },
    respuestaTienda: { type: replySchema, default: undefined },
    historialGestion: { type: [historySchema], default: undefined, select: false },
    claveAutorProducto: {
        type: String,
        immutable: true,
        select: false
    }
});

// Las reseñas antiguas no tienen esta clave. El índice sparse permite
// conservarlas sin borrar ni modificar datos al desplegar la actualización.
schema.index({ claveAutorProducto: 1 }, { unique: true, sparse: true });
schema.index({ producto: 1, fecha: -1, _id: -1 });
schema.index({ producto: 1, usuario: 1 });
schema.index({ oculta: 1, fecha: -1, _id: -1 });

schema.pre('validate', function () {
    if (this.isNew && this.producto && this.usuario) {
        this.claveAutorProducto = this.producto.toString() + ':' + this.usuario.toString();
    }
});

module.exports = mongoose.model('reviewdb', schema);
