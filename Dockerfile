FROM node:22-alpine AS build
WORKDIR /app

# F-410: TODO: Externalize Nexus registry URL to build arg
# Configure npm to use local Nexus proxy
ARG NPM_REGISTRY=http://192.168.1.214:30081/repository/npm-proxy/
RUN npm config set registry $NPM_REGISTRY

COPY package*.json ./
RUN npm ci
COPY . .
RUN npx ng build --configuration=production

# F-406: Nexus credentials are in a separate build stage and discarded in final image
# Publish build tarball to Nexus (best-effort)
ARG NEXUS_USERNAME=""
ARG NEXUS_PASSWORD=""
RUN if [ -n "$NEXUS_USERNAME" ]; then \
      npm config set //192.168.1.214:30081/repository/npm-hosted/:_auth=$(echo -n "$NEXUS_USERNAME:$NEXUS_PASSWORD" | base64) && \
      npm publish --registry http://192.168.1.214:30081/repository/npm-hosted/ || true; \
    fi

FROM nginx:alpine
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html

# F-405: Add HEALTHCHECK (use full GET — spider/HEAD may fail with SPA try_files)
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -q -O /dev/null http://localhost:4000/ || exit 1

# SPA routing: serve index.html for all routes
RUN printf 'server {\n\
  listen 4000;\n\
  root /usr/share/nginx/html;\n\
  index index.html;\n\
  location / {\n\
    try_files $uri $uri/ /index.html;\n\
  }\n\
  location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot)$ {\n\
    expires 1y;\n\
    add_header Cache-Control "public, immutable";\n\
  }\n\
}\n' > /etc/nginx/conf.d/default.conf

# F-404: Run nginx as non-root user
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid
USER nginx

EXPOSE 4000
CMD ["nginx", "-g", "daemon off;"]
