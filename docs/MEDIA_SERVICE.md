# MAZETTO FOOD Media Service

The media service is a separate static file service for product and category images. Database records keep relative paths such as `/products/big-lavash.webp`; customer-web prefixes those paths with `NEXT_PUBLIC_MEDIA_URL`.

## Service

| Setting          | Value                          |
| ---------------- | ------------------------------ |
| Service name     | `mazetto-food-media`           |
| Dockerfile       | `apps/media/Dockerfile`        |
| Image base       | `nginx:1.29-alpine`            |
| Container port   | `80`                           |
| Persistent mount | `/media`                       |
| Public domain    | `https://media.mazettofood.uz` |

## Folder Structure

```text
apps/media/
  Dockerfile
  nginx.conf
  public/
    products/
    categories/
```

Production media files should live in a persistent Dokploy/Docker volume mounted to `/media`, not inside the container image.

Expected paths:

```text
/media/products/big-lavash.webp
/media/categories/lavash.webp
```

## Dokploy

Create a Dockerfile application:

| Setting               | Value                                       |
| --------------------- | ------------------------------------------- |
| Build context         | repository root                             |
| Dockerfile            | `apps/media/Dockerfile`                     |
| Internal service name | `mazetto-food-media`                        |
| Port                  | `80`                                        |
| Volume                | persistent media volume mounted at `/media` |

Do not store real product images in the image. Upload or sync them into the persistent volume.

An example Compose file is available at `apps/media/docker-compose.example.yml`. It is a reference only and is not wired into the current production deployment.

## Cloudflare Tunnel

Required ingress route:

```text
media.mazettofood.uz -> http://mazetto-food-media:80
```

DNS must point `media.mazettofood.uz` to the Cloudflare tunnel.

## Frontend Environment

Customer-web must be built with:

```text
NEXT_PUBLIC_MEDIA_URL=https://media.mazettofood.uz
```

Local development can use:

```text
NEXT_PUBLIC_MEDIA_URL=http://localhost:8080
```

## Required Media Files

### Categories

```text
categories/lavash.webp
categories/chicken-lavash.webp
categories/burger.webp
categories/chicken-burger.webp
categories/hot-dog.webp
categories/doner.webp
categories/fast-food.webp
categories/drinks.webp
categories/sauces.webp
categories/sets.webp
```

### Products

```text
products/lavash.webp
products/big-lavash.webp
products/lavash-pishloqli.webp
products/big-lavash-pishloqli.webp
products/achchiq-lavash.webp
products/achchiq-big-lavash.webp
products/tandir-lavash.webp
products/tandir-lavash-pishloqli.webp
products/kurinniy-lavash.webp
products/kurinniy-big-lavash.webp
products/kurinniy-lavash-pishloqli.webp
products/kurinniy-big-lavash-pishloqli.webp
products/achchiq-kurinniy-lavash.webp
products/achchiq-kurinniy-big-lavash.webp
products/xaggi.webp
products/doner.webp
products/kurinniy-doner.webp
products/klab-senwich-friziz.webp
products/klab-senwich.webp
products/saseska-podomashniy.webp
products/chicken-hot-dog-mini.webp
products/chicken-hot-dog-katta.webp
products/doner-blyuda.webp
products/katlet-podamashni.webp
products/kampot.webp
products/moxito.webp
products/burger.webp
products/chizburger.webp
products/double-burger.webp
products/double-chizburger.webp
products/chicken-burger.webp
products/chicken-chizburger.webp
products/double-chicken-burger.webp
products/double-chicken-chizburger.webp
products/kurinniy-sharik-3-dona.webp
products/kurinniy-sharik-5-dona.webp
products/naggets-5-dona.webp
products/kurinniy-lukavoyi-kalso-8-ta.webp
products/kartoshka-fri-kichik-100gr.webp
products/kartoshka-fri-katta-120gr.webp
products/jaydari-kartoshka-120gr.webp
products/jaydari-kartoshka-150gr.webp
products/salatli-hot-dog-kichik.webp
products/salatli-hot-dog-katta.webp
products/salatli-mega-hot-dog.webp
products/fresh-hot-dog.webp
products/karaleviski-hot-dog.webp
products/kichkina-qazili-hot-dog.webp
products/ortacha-qazili-hot-dog.webp
products/katta-qazili-hot-dog.webp
products/ultra-qazili-hot-dog.webp
products/shashlikli-hot-dog.webp
products/shashlik-katletli-hot-dog.webp
products/ketchup.webp
products/pishloqli-sous.webp
products/chesnochniy-sous.webp
products/set-lavashlar-uchligi.webp
products/set-tandir-lavash-juftligi.webp
products/set-donerda-baraka.webp
products/set-katlet-podomashni-juftligi.webp
products/set-oilaviy.webp
products/set-klab-senwich-juftligi.webp
products/set-xaggi-uchligi.webp
products/set-klab-senwich.webp
products/set-lavashlar-juftligi.webp
products/set-double-chizburger-juftligi.webp
products/set-doner-blyuda-juftligi.webp
products/set-salatli-hot-dog.webp
products/set-lavash.webp
products/set-xaggi.webp
products/set-qazili-hot-dog.webp
products/set-chizburger.webp
products/set-doner.webp
products/set-double-chizburger.webp
```
