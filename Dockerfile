# SUPPLY CHAIN: pin both base images by digest before release. Lookup with:
#   docker buildx imagetools inspect node:22-alpine
#   docker buildx imagetools inspect nginx:1.27-alpine
# Then change the FROM lines to:
#   FROM node:22-alpine@sha256:<digest> AS build
#   FROM nginx:1.27-alpine@sha256:<digest> AS runtime
# Dependabot's docker ecosystem will keep the digest fresh once pinned.

FROM node:26-alpine AS build
WORKDIR /app

ARG NPM_REGISTRY=https://registry.npmjs.org/
RUN npm config set registry $NPM_REGISTRY

COPY package*.json ./
RUN npm ci --prefer-offline
COPY . .
RUN npx ng build --configuration=production

# Runtime: nginx:alpine (~40MB)
FROM nginx:1.27-alpine AS runtime

# Patch all OS packages to the latest in the base image's Alpine branch so
# Trivy's fixable CRITICAL/HIGH findings are cleared at build time.
RUN apk upgrade --no-cache

COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -q --spider http://localhost:4000/ || exit 1

# SPA routing + gzip + security headers (Q5.11, Q5.12)
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Run as non-root
RUN chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/log/nginx && \
    touch /var/run/nginx.pid && chown nginx:nginx /var/run/nginx.pid
USER nginx

EXPOSE 4000
CMD ["nginx", "-g", "daemon off;"]
