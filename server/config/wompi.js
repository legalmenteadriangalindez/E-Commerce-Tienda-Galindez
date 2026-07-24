const axios = require("axios");

const wompi = axios.create({
    baseURL: "https://sandbox.wompi.co/v1",
    headers: {
        "Content-Type": "application/json"
    }
});

module.exports = wompi;

