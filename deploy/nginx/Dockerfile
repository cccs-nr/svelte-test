FROM nginx:1.28-alpine

RUN apk add --no-cache gettext openssl

COPY deploy/nginx/default.conf.template /etc/nginx/templates/secret-santa.conf.template
COPY --chmod=755 deploy/nginx/docker-entrypoint.sh /usr/local/bin/secret-santa-nginx-entrypoint

ENTRYPOINT ["/usr/local/bin/secret-santa-nginx-entrypoint"]
