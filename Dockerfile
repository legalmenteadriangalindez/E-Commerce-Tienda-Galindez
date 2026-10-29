FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /TiendaGalindez

# El directorio de trabajo debe poder ser utilizado por el usuario sin
# privilegios que ejecutará la aplicación. El usuario `node` viene incluido en
# la imagen oficial de Node.js.
RUN chown node:node /TiendaGalindez

COPY --chown=node:node package.json package-lock.json ./
USER node
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --chown=node:node . .

# Render y otros orquestadores pueden comprobar la salud desde dentro del
# contenedor sin instalar curl/wget. Se usa la ruta pública que ya expone la
# aplicación y se considera fallido cualquier estado distinto de 200.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "const http=require('http');const port=Number(process.env.PORT)||3000;const req=http.get({host:'127.0.0.1',port,path:'/healthz',timeout:4000},res=>{res.resume();process.exit(res.statusCode===200?0:1)});req.on('error',()=>process.exit(1));req.on('timeout',()=>{req.destroy();process.exit(1)})"

# Permite que Node reciba SIGTERM y cierre MongoDB y las sesiones de forma
# ordenada cuando el contenedor se detiene.
STOPSIGNAL SIGTERM
CMD ["node","server.js"]
