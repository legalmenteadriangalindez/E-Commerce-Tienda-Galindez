const { escapeHtml, formatDate, formatHeaderText, formatText, publicUrl, renderEmailDocument } = require('./shared');

function subjectForRaffleWinner(data) {
    const number = formatHeaderText(data.numero || '—');
    return `¡Ganaste el sorteo! Número ${number} - Tienda Galindez`;
}

function renderRaffleWinner(data) {
    const name = formatText(data.nombre || 'Cliente');
    const number = formatText(data.numero || '—');
    const title = formatText(data.titulo || 'Sorteo de regalos');
    const selectedAt = formatDate(data.seleccionadoEn, 'fecha pendiente de confirmar');
    const content = `
        <h2 style="color:#d85c32">Tienda Galindez</h2>
        <p>Hola, ${escapeHtml(name)}.</p>
        <h1 style="color:#7b2cbf">¡Felicitaciones!</h1>
        <p>Tu número de participación fue seleccionado como ganador del sorteo <strong>${escapeHtml(title)}</strong>.</p>
        <p style="font-size:24px"><strong>Número ganador: #${escapeHtml(number)}</strong></p>
        <p>Selección realizada el ${escapeHtml(selectedAt)}.</p>
        <p>Conserva este correo y contacta a la tienda para coordinar la entrega del premio.</p>
        <p>Consulta el resultado público en <a href="${publicUrl('/sorteo')}">la página del sorteo</a>.</p>
    `;
    const htmlContent = renderEmailDocument(content);
    const textContent = `Hola, ${name}.\n\n¡Felicitaciones! Tu número de participación #${number} ganó el sorteo "${title}".\nSelección realizada el ${selectedAt}.\n\nContacta a Tienda Galindez para coordinar la entrega del premio.`;

    return { subject: subjectForRaffleWinner(data), htmlContent, textContent };
}

module.exports = { renderRaffleWinner, subjectForRaffleWinner };
