FROM --platform=${BUILDPLATFORM} node:20 AS build

WORKDIR /opt/node_app

COPY . .

# do not ignore optional dependencies:
# Error: Cannot find module @rollup/rollup-linux-x64-gnu
RUN --mount=type=cache,target=/root/.cache/yarn \
    npm_config_target_arch=${TARGETARCH} yarn --network-timeout 600000

ARG NODE_ENV=production

RUN npm_config_target_arch=${TARGETARCH} yarn build:app:docker
RUN npm_config_target_arch=${TARGETARCH} yarn --cwd backend build

FROM --platform=${TARGETPLATFORM} nginx:1.27-alpine

RUN apk add --no-cache nodejs

COPY --from=build /opt/node_app/excalidraw-app/build /usr/share/nginx/html
COPY --from=build /opt/node_app/backend/dist /opt/node_app/backend/dist
COPY --from=build /opt/node_app/backend/package.json /opt/node_app/backend/package.json
COPY --from=build /opt/node_app/backend/prisma /opt/node_app/backend/prisma
COPY --from=build /opt/node_app/node_modules /opt/node_app/node_modules
COPY --from=build /opt/node_app/backend/node_modules /opt/node_app/backend/node_modules

ENV PORT=80
ENV API_UPSTREAM=http://127.0.0.1:3005
ENV BACKEND_PORT=3005
ENV BACKEND_HOST=127.0.0.1

COPY docker/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY docker/start.sh /opt/node_app/start.sh

RUN chmod +x /opt/node_app/start.sh

EXPOSE 80

HEALTHCHECK CMD wget -q -O /dev/null http://localhost:${PORT}/ || exit 1

CMD ["/opt/node_app/start.sh"]
