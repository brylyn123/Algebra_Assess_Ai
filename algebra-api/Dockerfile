FROM php:8.2-cli

RUN apt-get update && apt-get install -y libpng-dev libjpeg-dev libfreetype6-dev libzip-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install gd zip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

CMD ["sh", "-c", "echo Starting on port $PORT && php -S 0.0.0.0:$PORT"]
