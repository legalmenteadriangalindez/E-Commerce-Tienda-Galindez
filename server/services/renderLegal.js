const dotenv = require('dotenv');

dotenv.config();

const contact = {
    businessName: process.env.LEGAL_BUSINESS_NAME || 'Tienda Galindez',
    email: process.env.LEGAL_CONTACT_EMAIL || process.env.EMAIL_USER || 'tiendagalindez@gmail.com',
    phone: process.env.LEGAL_CONTACT_PHONE || '+57 301 208 4769',
    city: process.env.LEGAL_CITY || 'Timbío, Cauca, Colombia',
    lastUpdated: process.env.LEGAL_LAST_UPDATED || '27 de octubre de 2026'
};

const legalPages = [
    { key: 'privacidad', title: 'Privacidad', path: '/privacidad' },
    { key: 'terminos', title: 'Términos de compra', path: '/terminos' },
    { key: 'cambios-devoluciones', title: 'Cambios y devoluciones', path: '/cambios-devoluciones' },
    { key: 'envios', title: 'Envíos', path: '/envios' },
    { key: 'reclamaciones', title: 'Reclamaciones', path: '/reclamaciones' }
];

const policies = {
    privacidad: {
        eyebrow: 'Información y confianza',
        title: 'Política de privacidad',
        intro: 'En esta página explicamos qué datos necesitamos para atender tus compras, cómo los usamos y cuáles son tus opciones para consultar o actualizar esa información.',
        sections: [
            {
                heading: '1. Responsable y contacto',
                paragraphs: [
                    '{{businessName}} es responsable del tratamiento de los datos que recopila a través de la tienda. Para solicitudes relacionadas con privacidad puedes escribir a {{email}} o comunicarte al {{phone}}. Operamos desde {{city}}.'
                ]
            },
            {
                heading: '2. Datos que podemos solicitar',
                paragraphs: ['Según la operación, podemos solicitar los datos necesarios para identificarte, entregar un pedido y responderte.'],
                items: [
                    'Nombre, correo electrónico y teléfono.',
                    'Dirección, ciudad y referencias necesarias para la entrega.',
                    'Información del pedido, pagos, devoluciones, soporte y preferencias de comunicación.',
                    'Datos técnicos mínimos de seguridad, como sesión, dirección IP y registros de acceso.'
                ]
            },
            {
                heading: '3. Finalidades',
                paragraphs: ['Usamos la información para procesar pedidos, gestionar pagos, entregar productos, atender solicitudes, enviar comunicaciones relacionadas con la cuenta o la compra, prevenir fraude, mantener la seguridad y cumplir obligaciones legales. Los mensajes comerciales se envían solo cuando existe una base válida y puedes solicitar que dejen de enviarse.']
            },
            {
                heading: '4. Conservación y encargados',
                paragraphs: ['Conservamos la información durante el tiempo necesario para cumplir cada finalidad y las obligaciones aplicables. Para operar la tienda podemos contar con proveedores de alojamiento, base de datos, correo, pagos y logística, quienes solo deben tratar la información conforme a sus servicios y medidas de seguridad.']
            },
            {
                heading: '5. Tus solicitudes',
                paragraphs: ['Puedes pedir acceso, actualización, corrección, explicación del uso de tus datos, retiro de autorizaciones cuando proceda o eliminación cuando no exista una obligación para conservarlos. Incluye en tu solicitud el correo de la cuenta y una descripción clara de lo que necesitas. Responderemos por el mismo canal o por otro que permita dejar constancia.']
            },
            {
                heading: '6. Seguridad y cambios',
                paragraphs: ['Aplicamos controles técnicos y administrativos razonables para proteger la información. Ningún canal es completamente invulnerable; si detectas un incidente o un uso no autorizado, avísanos inmediatamente. Publicaremos en esta página las actualizaciones relevantes de la política.']
            }
        ]
    },
    terminos: {
        eyebrow: 'Compra informada',
        title: 'Términos de compra',
        intro: 'Estos términos describen cómo funciona la compra en línea en {{businessName}}. Al confirmar un pedido aceptas las reglas aplicables a esa operación.',
        sections: [
            {
                heading: '1. Catálogo y precios',
                paragraphs: ['Publicamos la descripción, disponibilidad y precio de cada producto con la información disponible al momento de la consulta. Los precios se expresan en pesos colombianos e incluyen los impuestos que correspondan. El valor final, incluido el envío cuando aplique, se muestra antes de confirmar el pedido.']
            },
            {
                heading: '2. Cuenta del cliente',
                paragraphs: ['Debes suministrar información exacta, mantener la confidencialidad de tu contraseña y avisarnos si detectas un acceso no autorizado. La cuenta puede requerir verificación de correo y puede suspenderse cuando existan señales de fraude, suplantación o incumplimiento.']
            },
            {
                heading: '3. Pedido y disponibilidad',
                paragraphs: ['Agregar un producto al carrito no garantiza su reserva. El pedido queda registrado cuando recibes la confirmación correspondiente y la tienda puede contactarte para validar datos de entrega o disponibilidad. Si un producto no está disponible, informaremos la alternativa o el proceso de devolución que corresponda.']
            },
            {
                heading: '4. Pagos',
                paragraphs: ['Los pagos electrónicos se procesan a través del proveedor habilitado en el checkout. {{businessName}} no almacena las credenciales completas de tu medio de pago. La confirmación del pedido depende del resultado reportado por el proveedor y de las validaciones de seguridad. También pueden existir pedidos con pago en efectivo según la opción disponible.']
            },
            {
                heading: '5. Entrega, cambios y reclamos',
                paragraphs: ['La dirección y las condiciones de entrega deben ser verificables. Revisa las páginas de Envíos, Cambios y devoluciones y Reclamaciones para conocer el canal correcto en cada caso. Si una norma aplicable reconoce un derecho adicional, prevalece la normativa vigente.']
            },
            {
                heading: '6. Atención',
                paragraphs: ['Para preguntas sobre una compra, conserva el número de pedido y escribe a {{email}} o al {{phone}}. Procuraremos darte una respuesta clara y dejar registro de la solicitud.']
            }
        ]
    },
    'cambios-devoluciones': {
        eyebrow: 'Después de tu compra',
        title: 'Cambios y devoluciones',
        intro: 'Queremos que recibas una solución clara cuando un producto no corresponda a lo esperado. Estos pasos sirven para solicitar un cambio, devolución, garantía o revisión de un pedido.',
        sections: [
            {
                heading: '1. Antes de enviar la solicitud',
                paragraphs: ['Ten a mano el número de pedido, el correo de compra, una descripción del caso y fotografías o videos cuando ayuden a demostrar el estado del producto. No envíes el artículo por tu cuenta antes de recibir instrucciones.']
            },
            {
                heading: '2. Cómo solicitar un cambio o devolución',
                paragraphs: ['Escribe a {{email}} o comunícate al {{phone}} indicando si solicitas cambio, devolución, garantía o revisión. Te confirmaremos la recepción, los documentos necesarios y el siguiente paso. La evaluación se realiza según el producto, el estado en que fue recibido, la causa de la solicitud y la normativa aplicable.']
            },
            {
                heading: '3. Condiciones de revisión',
                paragraphs: ['Cuando corresponda, el producto debe conservar sus accesorios, manuales, empaques y etiquetas, y encontrarse sin señales de uso distintas de las necesarias para comprobarlo. Esta condición no limita los derechos que la ley reconoce por defectos, falta de conformidad o garantía.']
            },
            {
                heading: '4. Transporte y solución',
                paragraphs: ['Te indicaremos si la recogida o el envío de retorno está a cargo de la tienda o del cliente, según la causa y el resultado de la evaluación. La solución puede ser reparación, cambio, nota crédito, devolución del dinero u otra prevista por la normativa.']
            },
            {
                heading: '5. Exclusiones y productos especiales',
                paragraphs: ['Algunos productos pueden tener restricciones por higiene, personalización, consumo o deterioro atribuible al cliente. Cualquier restricción se informará antes de la compra y se aplicará sin afectar los derechos irrenunciables del consumidor.']
            },
            {
                heading: '6. Estado de la solicitud',
                paragraphs: ['Te informaremos si la solicitud fue recibida, si requiere información adicional, si fue aprobada o si no procede, explicando el motivo. Si no estás de acuerdo, puedes presentar una reclamación formal por el canal indicado en esta página.']
            }
        ]
    },
    envios: {
        eyebrow: 'Entrega de pedidos',
        title: 'Política de envíos',
        intro: 'Aquí encontrarás la información general sobre cobertura, costos, preparación y seguimiento de los pedidos de {{businessName}}.',
        sections: [
            {
                heading: '1. Cobertura',
                paragraphs: ['La cobertura depende de la zona que selecciones al comprar y de la disponibilidad de nuestros aliados de entrega. Si una dirección está fuera de cobertura, te informaremos antes de confirmar o te contactaremos para buscar una alternativa.']
            },
            {
                heading: '2. Costo y tiempo estimado',
                paragraphs: ['El costo de envío y el tiempo estimado se muestran durante el checkout cuando la información de la dirección permite calcularlos. Pueden variar por ciudad, distancia, volumen, disponibilidad del producto, clima, días festivos o circunstancias de fuerza mayor. La estimación no sustituye la confirmación que recibas para tu pedido.']
            },
            {
                heading: '3. Preparación y seguimiento',
                paragraphs: ['Después de confirmar el pedido, lo preparamos y actualizamos su estado. Cuando exista un número de seguimiento o repartidor asignado, podrás consultarlo desde Mis pedidos o mediante las notificaciones enviadas al correo de tu cuenta.']
            },
            {
                heading: '4. Recepción',
                paragraphs: ['Verifica el paquete al recibirlo. Si observas daños visibles, faltantes o un producto diferente, deja constancia con el transportador cuando sea posible y escríbenos dentro del menor tiempo razonable con fotografías y el número de pedido.']
            },
            {
                heading: '5. Entrega fallida',
                paragraphs: ['Si no es posible entregar por datos incorrectos, ausencia del destinatario o restricciones de acceso, te contactaremos para coordinar un nuevo intento. Los costos adicionales, si aplican, se informarán antes de continuar.']
            },
            {
                heading: '6. Soporte',
                paragraphs: ['Para consultar un envío, escribe a {{email}} o comunícate al {{phone}} con tu número de pedido y la ciudad de entrega.']
            }
        ]
    },
    reclamaciones: {
        eyebrow: 'Atención al cliente',
        title: 'Reclamaciones y peticiones',
        intro: 'Puedes usar este canal para reportar un problema, pedir información, solicitar una solución o dejar una sugerencia sobre tu experiencia.',
        sections: [
            {
                heading: '1. Canal de atención',
                paragraphs: ['Envía tu solicitud a {{email}} o comunícate al {{phone}}. También puedes responder la comunicación de tu pedido si ya tienes un caso abierto.']
            },
            {
                heading: '2. Información que debes incluir',
                items: [
                    'Nombre y correo asociado a la compra o cuenta.',
                    'Número de pedido, si existe.',
                    'Descripción concreta de los hechos y la solución que solicitas.',
                    'Soportes relevantes, como fotografías, comprobantes o capturas.'
                ]
            },
            {
                heading: '3. Trámite',
                paragraphs: ['Confirmaremos la recepción y podremos pedir información adicional para investigar. Revisaremos el caso con las áreas de atención, inventario, entregas o pagos que correspondan y te comunicaremos la respuesta por un canal verificable.']
            },
            {
                heading: '4. Casos de pagos y seguridad',
                paragraphs: ['Nunca envíes contraseñas, códigos de verificación ni los datos completos de una tarjeta. Para revisar un pago usaremos el número de pedido, la referencia y los datos mínimos necesarios.']
            },
            {
                heading: '5. Escalamiento',
                paragraphs: ['Si la respuesta no resuelve tu solicitud, responde al mismo caso indicando qué aspecto deseas que revisemos. Conserva las comunicaciones y los soportes asociados. Las autoridades y mecanismos externos que reconozca la normativa aplicable permanecen disponibles.']
            }
        ]
    }
};

function fill(value) {
    return String(value).replace(/\{\{(businessName|email|phone|city)\}\}/g, (_, key) => {
        return contact[key];
    });
}

function hydratePolicy(policy) {
    return {
        ...policy,
        intro: fill(policy.intro),
        sections: policy.sections.map(section => ({
            ...section,
            heading: fill(section.heading),
            paragraphs: (section.paragraphs || []).map(fill),
            items: (section.items || []).map(fill),
            note: section.note ? fill(section.note) : undefined
        }))
    };
}

exports.page = key => (req, res, next) => {
    const policy = policies[key];
    if (!policy) return next();
    const hydratedPolicy = hydratePolicy(policy);

    return res.render('client/legal/page', {
        policy: hydratedPolicy,
        policyKey: key,
        contact,
        legalPages,
        seoTitle: `${policy.title} | ${contact.businessName}`,
        seoDescription: hydratedPolicy.intro,
        seoCanonical: `${(process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')}/${key}`
    });
};

exports.legalPages = legalPages;
exports.contact = contact;
exports.policies = policies;
