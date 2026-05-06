exports.read_sale_details = async (req, res) => {
    try {
        const response = await axios.get(`${API}/detalle-ventas`, {
            params: { venta: req.query.venta }
        });

        res.render('read_detailsSales', {
            saleDetails: response.data
        });

    } catch (error) {
        res.send(error.message);
    }
};