FROM nginx:1.29-alpine

COPY apps/media/nginx.conf /etc/nginx/conf.d/default.conf

RUN mkdir -p /media/products /media/categories && chown -R nginx:nginx /media

VOLUME ["/media"]

EXPOSE 80
