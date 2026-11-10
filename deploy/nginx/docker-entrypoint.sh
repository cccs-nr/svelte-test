#!/bin/sh
set -eu

DOMAIN="${DOMAIN:-localhost}"
APP_BASE_PATH="${APP_BASE_PATH:-/secret-santa}"

case "$DOMAIN" in
	''|*[!A-Za-z0-9.-]*)
		echo "DOMAIN must contain only DNS-name characters." >&2
		exit 1
		;;
esac

case "$APP_BASE_PATH" in
	/*) ;;
	*)
		echo "APP_BASE_PATH must start with /." >&2
		exit 1
		;;
esac
if [ "$APP_BASE_PATH" = "/" ] || [ "${APP_BASE_PATH%/}" != "$APP_BASE_PATH" ]; then
	echo "APP_BASE_PATH must be a non-root path without a trailing slash." >&2
	exit 1
fi
case "$APP_BASE_PATH" in
	*[!A-Za-z0-9/_-]*|*//*)
		echo "APP_BASE_PATH may contain only path segments using letters, numbers, /, _ and -." >&2
		exit 1
		;;
esac

CERTIFICATE_PATH="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
CERTIFICATE_KEY_PATH="/etc/letsencrypt/live/$DOMAIN/privkey.pem"
HSTS_HEADER=

if [ ! -s "$CERTIFICATE_PATH" ] || [ ! -s "$CERTIFICATE_KEY_PATH" ]; then
	mkdir -p /etc/nginx/bootstrap
	CERTIFICATE_PATH=/etc/nginx/bootstrap/fullchain.pem
	CERTIFICATE_KEY_PATH=/etc/nginx/bootstrap/privkey.pem
	HSTS_HEADER=
	if [ ! -s "$CERTIFICATE_PATH" ] || [ ! -s "$CERTIFICATE_KEY_PATH" ]; then
		openssl req -x509 -nodes -newkey rsa:2048 -days 2 \
			-keyout "$CERTIFICATE_KEY_PATH" \
			-out "$CERTIFICATE_PATH" \
			-subj "/CN=$DOMAIN" \
			-addext "subjectAltName=DNS:$DOMAIN" \
			>/dev/null 2>&1
	fi
	echo "No trusted certificate found for $DOMAIN; serving a temporary self-signed certificate until Certbot is configured." >&2
else
	HSTS_HEADER='add_header Strict-Transport-Security "max-age=31536000" always;'
fi

export DOMAIN APP_BASE_PATH CERTIFICATE_PATH CERTIFICATE_KEY_PATH HSTS_HEADER
envsubst '${DOMAIN} ${APP_BASE_PATH} ${CERTIFICATE_PATH} ${CERTIFICATE_KEY_PATH} ${HSTS_HEADER}' \
	< /etc/nginx/templates/secret-santa.conf.template \
	> /etc/nginx/conf.d/default.conf

if [ "${NGINX_VALIDATE_ONLY:-0}" = "1" ]; then
	exec nginx -t
fi

exec nginx -g 'daemon off;'
