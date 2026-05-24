// Animación al hacer focus en inputs
const inputs = document.querySelectorAll("input");

inputs.forEach(input => {
    input.addEventListener("focus", () => {
        input.parentElement.style.boxShadow = "0 0 10px #ff4b2b";
    });

    input.addEventListener("blur", () => {
        input.parentElement.style.boxShadow = "none";
    });
});

// Animación botón click
const btn = document.querySelector(".btn");

btn.addEventListener("click", () => {
    btn.innerText = "Cargando...";
});

// Animación suave del título
const title = document.querySelector(".right h1");

setInterval(() => {
    title.style.transform = "scale(1.05)";
    setTimeout(() => {
        title.style.transform = "scale(1)";
    }, 500);
}, 2000);