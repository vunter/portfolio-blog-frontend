# SUPPLY CHAIN (M-15): both base images pinned by digest (multi-arch index
# digests from `docker buildx imagetools inspect <tag>`, 2026-08-19).
# node is 22 (not 26) to match the Node version CI validates against.
# Dependabot's docker ecosystem keeps the digests fresh now that they are pinned.

FROM node:24-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43 AS build
WORKDIR /app

ARG NPM_REGISTRY=https://registry.npmjs.org/
RUN npm config set registry $NPM_REGISTRY

COPY package*.json ./
RUN npm ci --prefer-offline
COPY . .
RUN npx ng build --configuration=production

# Runtime: nginx:alpine (~40MB)
FROM nginx:1.31-alpine@sha256:4a73073bd557c65b759505da037898b61f1be6cbcc3c2c3aeac22d2a470c1752 AS runtime

# Patch all OS packages to the latest in the base image's Alpine branch so
# Trivy's fixable CRITICAL/HIGH findings are cleared at build time.
RUN apk upgrade --no-cache

COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -q --spider http://localhost:4000/ || exit 1

# SPA routing + gzip + cache policy + security headers (Q5.11, Q5.12, M-13/M-14).
# Header snippets go to /etc/nginx/snippets/ — NOT conf.d/, which the stock
# nginx.conf auto-includes at http level and would double-apply them.
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/security-headers.conf nginx/csp.conf /etc/nginx/snippets/

# Run as non-root
RUN chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/log/nginx && \
    touch /var/run/nginx.pid && chown nginx:nginx /var/run/nginx.pid
USER nginx

EXPOSE 4000
CMD ["nginx", "-g", "daemon off;"]
