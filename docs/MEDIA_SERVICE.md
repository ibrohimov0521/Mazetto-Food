# MAZETTO FOOD Media Service

The media service is a separate static file service for product and category images. Database records keep relative paths such as `/products/lavash-big.webp`; customer-web prefixes those paths with `NEXT_PUBLIC_MEDIA_URL`.

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
/media/products/lavash-big.webp
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
products/lavash-big.webp
products/lavash-classic.webp
products/lavash-mini.webp
products/lavash-beef.webp
products/chicken-lavash.webp
products/chicken-cheese-lavash.webp
products/chicken-spicy-lavash.webp
products/burger-classic.webp
products/burger-big.webp
products/cheeseburger.webp
products/burger-double.webp
products/chicken-burger.webp
products/crispy-chicken-burger.webp
products/chicken-cheeseburger.webp
products/hot-dog-classic.webp
products/hot-dog-cheese.webp
products/hot-dog-double.webp
products/doner-wrap.webp
products/doner-plate.webp
products/chicken-doner.webp
products/fries.webp
products/cheese-fries.webp
products/chicken-strips.webp
products/nuggets.webp
products/coca-cola.webp
products/fanta.webp
products/sprite.webp
products/water.webp
products/house-sauce.webp
products/cheese-sauce.webp
products/spicy-sauce.webp
products/set-family.webp
products/set-lavash.webp
products/set-burger.webp
products/set-kids.webp
```
