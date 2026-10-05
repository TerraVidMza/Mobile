# Etapa 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
# El postinstall copia el .wasm de sql.js a public/ (M-001)
COPY scripts ./scripts
RUN npm ci
COPY . .
ENV NODE_ENV=production
RUN npx expo export --platform web

# Etapa 2: Servidor Nginx liviano
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
