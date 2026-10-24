#!/bin/sh
set -e

PORT="${PORT:-80}"
sed -i "s/^Listen 80/Listen ${PORT}/" /etc/apache2/ports.conf

echo "ServerName ${SERVER_NAME:-localhost}" > /etc/apache2/conf-available/servername.conf
a2enconf servername >/dev/null 2>&1 || true

mkdir -p /var/www/html/uploads/captured_solutions /var/www/html/uploads/subject_photos
chown www-data:www-data /var/www/html /var/www/html/uploads \
    /var/www/html/uploads/captured_solutions /var/www/html/uploads/subject_photos

exec "$@"
