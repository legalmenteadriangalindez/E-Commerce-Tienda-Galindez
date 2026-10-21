
const Productdb = require("../model/product");

async function descontarStock(productoId, cantidad, session) {
  const unidades = Number(cantidad);

  if (!Number.isInteger(unidades) || unidades <= 0) {
    throw new Error("Cantidad inválida");
  }

  const resultado = await Productdb.updateOne(
    {
      _id: productoId,
      stock: { $gte: unidades }
    },
    {
      $inc: { stock: -unidades }
    },
    session ? { session } : {}
  );

  if (resultado.modifiedCount !== 1) {
    throw new Error("Stock insuficiente");
  }

  return resultado;
}

module.exports = { descontarStock };
