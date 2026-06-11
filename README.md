# Bibellandskap

Static Bible map app built with Vite and served in production by Nginx.

## Local Development

```sh
npm install
npm run dev
```

## Production Build

```sh
npm run build
npm run preview
```

## Docker

```sh
docker build -t ghcr.io/dinesjo/bible-map:latest .
docker run --rm -p 8080:80 ghcr.io/dinesjo/bible-map:latest
```

## Compose

```sh
docker compose up -d
```

The container uses a Node build stage to produce static files in `dist/`, then serves them from an Nginx runtime image.
