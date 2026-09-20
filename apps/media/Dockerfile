FROM nginx:1.29-alpine

COPY apps/media/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/media/10-prepare-media.sh /docker-entrypoint.d/10-prepare-media.sh

RUN chmod +x /docker-entrypoint.d/10-prepare-media.sh     && mkdir -p /media/products /media/categories /media/homepage     && chown -R nginx:nginx /media

VOLUME ["/media"]

EXPOSE 80