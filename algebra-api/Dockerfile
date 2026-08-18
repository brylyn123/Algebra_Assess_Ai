FROM php:8.2-apache

RUN apt-get update && apt-get install -y libpng-dev libjpeg-dev libfreetype6-dev libzip-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install gd zip \
    && rm -rf /var/lib/apt/lists/*

RUN sed -i 's/LoadModule mpm_event/LoadModule mpm_prefork/' /etc/apache2/mods-available/mpm_prefork.conf \
    && a2dismod mpm_event \
    && a2enmod mpm_prefork \
    && a2enmod rewrite

COPY . /var/www/html/

RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html

ENV PORT=80
EXPOSE 80
