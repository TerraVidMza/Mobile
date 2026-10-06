# Etapa 1: Build
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
# El postinstall copia el .wasm de sql.js a public/ (M-001)
COPY scripts ./scripts
RUN npm ci
COPY . .
ENV NODE_ENV=production
# La URL de la API queda dentro del bundle al exportar (M-012). Sin esto el
# bundle apuntaba al fallback del emulador Android (10.0.2.2).
ARG EXPO_PUBLIC_API_BASE_URL=https://terravid-api.duckdns.org/api
ENV EXPO_PUBLIC_API_BASE_URL=$EXPO_PUBLIC_API_BASE_URL
RUN npx expo export --platform web

# Etapa 2: Servidor Nginx liviano
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
