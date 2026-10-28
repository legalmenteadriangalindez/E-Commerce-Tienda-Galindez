FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /TiendaGalindez
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY . .
CMD ["node","server.js"]
