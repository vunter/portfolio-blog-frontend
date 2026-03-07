FROM node:22-alpine AS build
WORKDIR /app

ARG NPM_REGISTRY=https://registry.npmjs.org/
RUN npm config set registry $NPM_REGISTRY

COPY package*.json ./
RUN npm ci --prefer-offline
COPY . .
RUN npx ng build --configuration=production

# Runtime: nginx:alpine (~40MB)
FROM nginx:1.27-alpine AS runtime

COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -q -O /dev/null http://localhost:4000/ || exit 1

# SPA routing + gzip + security headers
RUN printf 'server {\n\
  listen 4000;\n\
  root /usr/share/nginx/html;\n\
  index index.html;\n\
  gzip on;\n\
  gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;\n\
  gzip_min_length 256;\n\
  location / {\n\
    try_files $uri $uri/ /index.html;\n\
    add_header X-Content-Type-Options "nosniff" always;\n\
    add_header X-Frame-Options "SAMEORIGIN" always;\n\
  }\n\
  location ~* /favicon\\.(ico|svg)$ {\n\
    expires 7d;\n\
    add_header Cache-Control "public, must-revalidate";\n\
  }\n\
  location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot)$ {\n\
    expires 1y;\n\
    add_header Cache-Control "public, immutable";\n\
  }\n\
}\n' > /etc/nginx/conf.d/default.conf

# Run as non-root
RUN chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/log/nginx && \
    touch /var/run/nginx.pid && chown nginx:nginx /var/run/nginx.pid
USER nginx

EXPOSE 4000
CMD ["nginx", "-g", "daemon off;"]
