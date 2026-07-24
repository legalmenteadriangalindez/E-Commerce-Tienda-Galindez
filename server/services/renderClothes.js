exports.renderClothes = async (req, res) => {
    try {
const products = [
    {
        _id: 1,

        nombre: "Camiseta Itachi",

        descripcion:
            "Diseño premium inspirado en Itachi Uchiha.",

        precioBase: 89900,

        stock: 25,

        fotos: [
            "/assets/img/faces/Itachi.jpg"
        ]
    },

    {
        _id: 2,

        nombre: "Sudadera Goku",

        descripcion:
            "Edición especial Dragon Ball.",

        precioBase: 129900,

        stock: 12,

        fotos: [
            "/assets/img/faces/DragonBallz.jpg"
        ]
    }
];

        res.render("client/clothes/clothes", {
            products
        });


    } catch (error) {

        res.status(500).send(
            "Error cargando la tienda"
        );

    }

};