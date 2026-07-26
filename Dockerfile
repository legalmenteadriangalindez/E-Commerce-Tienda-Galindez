FROM node:22-alpine
WORKDIR /TiendaGalindez
COPY package.json package-lock.json ./
RUN npm ci
COPY . . 
CMD ["node","server.js"]