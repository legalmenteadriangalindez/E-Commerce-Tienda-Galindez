const axios = require("axios");

const ambiente = process.env.WOMPI_ENV || "sandbox";

if (!["sandbox", "production"].includes(ambiente)) {
    throw new Error("WOMPI_ENV debe ser sandbox o production");
}

const wompi = axios.create({
    baseURL: ambiente === "production"
        ? "https://production.wompi.co/v1"
        : "https://sandbox.wompi.co/v1",
    headers: {
        "Content-Type": "application/json"
    }
});

module.exports = wompi;

