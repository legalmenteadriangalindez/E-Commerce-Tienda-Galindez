# Organización del proyecto

La tienda es un monolito modular Express con vistas EJS. Las páginas y la API
comparten casos de uso; no realizan solicitudes HTTP al propio servidor.

| Directorio           | Responsabilidad                                                            |
| -------------------- | -------------------------------------------------------------------------- |
| `server/routes/`     | Rutas, permisos, middleware y carga de archivos.                           |
| `server/pages/`      | Adaptar solicitudes HTTP a páginas EJS y redirecciones.                    |
| `server/controller/` | Adaptar solicitudes HTTP a respuestas API, descargas y recursos.           |
| `server/business/`   | Operaciones, validaciones de negocio y consultas a MongoDB.                |
| `server/model/`      | Esquemas, relaciones y definiciones de índices.                            |
| `server/validation/` | Esquemas de entradas HTTP compartidos con los servicios de administración. |
| `server/services/`   | Utilidades compartidas: importes, paginación, CSV y respuestas.            |
| `server/templates/`  | Composición de correos; no envía mensajes ni importa servicios de negocio. |
| `server/config/`     | Configuración e integraciones, incluido el transporte Brevo.               |
| `views/`             | Presentación EJS, includes y datos estructurados JSON-LD.                  |
| `assets/`, `public/` | CSS, JavaScript de navegador y recursos; URL canónica `/assets/`.          |

## Reglas para nuevos cambios

- Las rutas aplican autenticación, permisos y CSRF antes de ejecutar una operación.
  Los servicios no reciben `req` ni `res`. Los campos de control no se persisten.
- Perfil, catálogo, proveedores, usuarios, roles, pedidos y ventas comparten
  servicios entre páginas y API. Pedidos y ventas se escriben mediante
  `commerceService`; los servicios de lectura no crean caminos alternativos.
- Los listados administrativos siempre tienen límites. `queryPage` centraliza
  conteo, orden, desplazamiento y máximo de 50 registros. Los detalles de una
  página de ventas también están acotados.
- Las reglas de permisos de usuarios y roles se conservan en sus servicios.
  `users:manage` no permite cambiar roles y una cuenta no puede elevar su propio rol.
- Los productos validan relaciones, importes en centavos, fotografías y stock
  original. Una edición obsoleta devuelve 409 y limpia las imágenes nuevas sin uso.
- `BASE_URL` sirve para enlaces públicos y SEO, no para consultar datos internos.
- El JavaScript ejecutable va en archivos `.js`; los estilos van en `.css`.
  JSON-LD es la excepción declarativa en EJS. Los correos pueden tener estilos
  inline por compatibilidad con clientes de correo.
- `assets/css/theme.css` contiene los colores comunes y utilidades visuales;
  se carga antes del CSS de cada página. Los componentes pueden definir alias
  locales que referencien esos colores.
- No introducir dependencias circulares ni importar páginas o controladores
  desde servicios de negocio. Los cambios de esquema e índices requieren una
  migración nueva; las migraciones publicadas conservan su checksum.

## Comprobaciones locales

```bash
npm ci
npm run lint
npm run format:check
npm test
```

ESLint incluye servidor, scripts, migraciones, pruebas y JavaScript del navegador.
Prettier descubre automáticamente JS, CSS, JSON, documentación y configuración;
no depende de una lista cerrada de archivos. En EJS se normalizan espacios finales
y saltos de línea; sus expresiones no se reformatean como HTML. EJS se compila en `npm run check`
y se comprueban sus includes, recursos, enlaces y separación de estilos/scripts.
Las migraciones se excluyen del reformateo para conservar su identidad.

Las pruebas de formularios arrancan Express en localhost, utilizan sesiones y
CSRF reales y sustituyen únicamente las consultas de persistencia. Comprueban
guardado válido, rechazos, permisos y ausencia de escrituras no autorizadas.
Esto no sustituye las pruebas contra un MongoDB real: para estas últimas ejecutar
`npm run test:integration` con `MONGOD_BINARY` apuntando a un `mongod` local.
El ejecutor crea una base temporal y no utiliza Atlas ni las credenciales de producción.

Las verificaciones de calidad y las pruebas ya forman parte del workflow de CI
para Node 22 y 24. Verificar esos resultados antes de publicar los cambios.
