FROM php:8.2-cli

WORKDIR /app

COPY . .

ENTRYPOINT ["sh", "-c", "php -S 0.0.0.0:${PORT}"]
