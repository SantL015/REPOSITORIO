# Anthros

## Ejecutar en local

Desde la raíz del proyecto:

```bash
npm start
```

Abre `http://localhost:3000`. El servidor entrega las páginas de `frontend/` y conecta el checkout con estas rutas:

- `GET /api/health`
- `GET /api/orders`
- `POST /api/orders`
- `POST /api/newsletter`
- `POST /api/loyalty`

Los pedidos y registros se guardan en `data/`. Para desarrollo se puede usar `npm run dev`.
