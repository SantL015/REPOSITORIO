const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || 'localhost';
const ROOT_DIR = __dirname;
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DATA_FILES = {
    orders: path.join(DATA_DIR, 'orders.json'),
    newsletter: path.join(DATA_DIR, 'newsletter.json'),
    loyalty: path.join(DATA_DIR, 'loyalty.json')
};

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.avif': 'image/avif',
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml'
};

function ensureDataFiles() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    Object.values(DATA_FILES).forEach(file => {
        if (!fs.existsSync(file)) fs.writeFileSync(file, '[]\n', 'utf8');
    });
}

function readData(name) {
    try {
        const parsed = JSON.parse(fs.readFileSync(DATA_FILES[name], 'utf8'));
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeData(name, data) {
    fs.writeFileSync(DATA_FILES[name], `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function sendJson(response, status, payload) {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify(payload));
}

function readJson(request) {
    return new Promise((resolve, reject) => {
        let body = '';
        request.on('data', chunk => {
            body += chunk;
            if (body.length > 1024 * 1024) request.destroy(new Error('Payload too large'));
        });
        request.on('end', () => {
            try { resolve(body ? JSON.parse(body) : {}); }
            catch { reject(new Error('Invalid JSON')); }
        });
        request.on('error', reject);
    });
}

function cleanText(value, maxLength = 500) {
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function createId(prefix) {
    return `${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function handleApi(request, response, url) {
    if (request.method === 'GET' && url.pathname === '/api/health') {
        return sendJson(response, 200, { ok: true, service: 'anthros', timestamp: new Date().toISOString() });
    }

    if (request.method === 'GET' && url.pathname === '/api/orders') {
        return sendJson(response, 200, { orders: readData('orders') });
    }

    if (request.method !== 'POST') return sendJson(response, 405, { error: 'Método no permitido' });

    return readJson(request).then(payload => {
        if (url.pathname === '/api/orders') {
            if (!payload.customer || !Array.isArray(payload.items) || payload.items.length === 0) {
                return sendJson(response, 400, { error: 'El pedido necesita cliente y productos' });
            }
            const order = {
                id: cleanText(payload.id, 80) || createId('ORD'),
                createdAt: new Date().toISOString(),
                customer: {
                    name: cleanText(payload.customer.name, 100),
                    email: cleanText(payload.customer.email, 160).toLowerCase(),
                    phone: cleanText(payload.customer.phone, 40),
                    city: cleanText(payload.customer.city, 80),
                    address: cleanText(payload.customer.address, 180)
                },
                payment: cleanText(payload.payment, 30),
                items: payload.items,
                appliedPromo: Number(payload.appliedPromo) || 0,
                breakdown: payload.breakdown || {},
                total: Number(payload.total) || 0
            };
            const orders = readData('orders');
            orders.unshift(order);
            writeData('orders', orders);
            return sendJson(response, 201, { ok: true, order });
        }

        if (url.pathname === '/api/newsletter') {
            const email = cleanText(payload.email, 160).toLowerCase();
            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendJson(response, 400, { error: 'Correo inválido' });
            const subscribers = readData('newsletter');
            if (subscribers.some(item => item.email === email)) return sendJson(response, 200, { ok: true, created: false });
            subscribers.push({ email, createdAt: new Date().toISOString() });
            writeData('newsletter', subscribers);
            return sendJson(response, 201, { ok: true, created: true });
        }

        if (url.pathname === '/api/loyalty') {
            const email = cleanText(payload.email, 160).toLowerCase();
            const tier = cleanText(payload.tier, 30) || 'esencial';
            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendJson(response, 400, { error: 'Correo inválido' });
            const members = readData('loyalty');
            if (members.some(item => item.email === email)) return sendJson(response, 200, { ok: true, created: false });
            const member = { id: createId('MEM'), email, tier, points: 0, createdAt: new Date().toISOString() };
            members.push(member);
            writeData('loyalty', members);
            return sendJson(response, 201, { ok: true, created: true, member });
        }

        return sendJson(response, 404, { error: 'Ruta API no encontrada' });
    }).catch(error => sendJson(response, error.message === 'Invalid JSON' ? 400 : 413, { error: error.message }));
}

function serveStatic(response, urlPath) {
    const requestedPath = urlPath === '/' ? '/index.html' : urlPath;
    const filePath = path.resolve(FRONTEND_DIR, `.${requestedPath}`);
    if (!filePath.startsWith(`${FRONTEND_DIR}${path.sep}`)) return sendJson(response, 403, { error: 'Acceso denegado' });

    fs.stat(filePath, (error, stats) => {
        if (error || !stats.isFile()) return sendJson(response, 404, { error: 'Archivo no encontrado' });
        response.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(response);
    });
}

ensureDataFiles();
const server = http.createServer((request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || `${HOST}:${PORT}`}`);
    if (url.pathname.startsWith('/api/')) return handleApi(request, response, url);
    if (request.method !== 'GET' && request.method !== 'HEAD') return sendJson(response, 405, { error: 'Método no permitido' });
    return serveStatic(response, decodeURIComponent(url.pathname));
});

server.listen(PORT, HOST, () => {
    console.log(`Anthros disponible en http://${HOST}:${PORT}`);
});
