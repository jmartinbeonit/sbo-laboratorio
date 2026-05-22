# SBO Laboratorio API

Backend seguro para el formulario de GitHub Pages. Guarda respuestas en Cloudflare D1 y expone el panel solo con una clave de administración.

## Despliegue

1. Instala Wrangler o usa `npx wrangler`.
2. Inicia sesión en Cloudflare:

```bash
npx wrangler login
```

3. Crea la base D1:

```bash
cd worker
npx wrangler d1 create sbo-laboratorio
```

4. Copia el `database_id` que devuelva Cloudflare en `worker/wrangler.toml`.
5. Crea el esquema:

```bash
npx wrangler d1 execute sbo-laboratorio --remote --file=./schema.sql
```

6. Configura la clave privada del panel:

```bash
npx wrangler secret put ADMIN_KEY
```

7. Migra las respuestas existentes de `data/responses.json`:

```bash
npm run d1:seed:remote
```

8. Opcional: configura Turnstile:

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY
```

9. Despliega:

```bash
npx wrangler deploy
```

10. Copia la URL del Worker en `config.js` como `apiBase`.

```js
window.SBO_CONFIG = {
  apiBase: "https://sbo-laboratorio-api.<tu-subdominio>.workers.dev",
  turnstileSiteKey: ""
};
```

## Endpoints

- `POST /submit`: recibe `{ response, turnstileToken? }`.
- `GET /results`: requiere `Authorization: Bearer <ADMIN_KEY>` o `x-admin-key`.
- `GET /health`: prueba básica.
