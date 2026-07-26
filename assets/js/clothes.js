
    const faces =
document.querySelectorAll(".anime-face");

document.addEventListener(
    "mousemove",
    e => {

        const x =
        (e.clientX / window.innerWidth - .5) * 10;

        const y =
        (e.clientY / window.innerHeight - .5) * 10;

        faces.forEach(face => {

            face.style.transform =
            `translate(${x}px, ${y}px)`;

        });

    }
);