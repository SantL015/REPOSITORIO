        let cart = [];
        let appliedPromo = null;
        let menuOpen = false;
        const API_BASE = '/api';
        const PROMO_CODES = {
            'ANTHROS10': 10,
            'BIENVENIDO': 15,
            'VERANO2026': 20
        };

        async function apiRequest(endpoint, options = {}) {
            const response = await fetch(`${API_BASE}${endpoint}`, {
                headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
                ...options
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'No fue posible conectar con el servidor');
            return payload;
        }

        function calcularPrecioConDescuento(precio, procentajeDescuento) {
            const valorDescuento = precio * (procentajeDescuento / 100);
            return precio - valorDescuento;
        }

        function calcularPrecioConImpuesto(precio, porcentajeImpuesto) {
            return precio + (precio * (porcentajeImpuesto / 100));
        }

        function calcularTotalPedido(precioUnitario, cantidad, costoEnvio) {
            if (cantidad > 5) costoEnvio = 0;
            let total = (precioUnitario * cantidad) + costoEnvio;
            if (total > 100000) total = calcularPrecioConDescuento(total, 10);
            return total;
        }

        function formatPrice(price) {
            return '$' + Math.round(price).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
        }

        function showToast(message, type = 'default') {
            const toast = document.getElementById('toast');
            if (!toast) return;
            toast.classList.remove('success', 'error', 'info');
            const content = document.createElement('span');
            content.textContent = message;
            toast.innerHTML = '';
            toast.appendChild(content);
            if (type && type !== 'default') toast.classList.add(type);
            toast.classList.add('show');
            clearTimeout(toast._timer);
            toast._timer = setTimeout(() => toast.classList.remove('show'), 2800);
        }

        function applyPromo() {
            const input = document.getElementById('promoInput');
            const msg = document.getElementById('promoMessage');
            const code = input.value.trim().toUpperCase();
            if (!code) { msg.textContent = 'Ingresa un código'; msg.className = 'promo-message error'; showToast('Ingresa un código promocional', 'error'); return; }
            if (PROMO_CODES[code]) {
                appliedPromo = PROMO_CODES[code];
                msg.textContent = ` ${appliedPromo}% de descuento aplicado`;
                msg.className = 'promo-message success';
                updateCart();
                saveCart();
                showToast(`¡${appliedPromo}% OFF aplicado correctamente!`, 'success');
            } else {
                appliedPromo = null;
                msg.textContent = ' Código inválido';
                msg.className = 'promo-message error';
                saveCart();
                showToast('Código inválido', 'error');
            }
        }

        function toggleCart() {
            if (cart.length === 0 && !window.location.pathname.toLowerCase().includes('carrito')) {
                window.location.href = './carrito.html';
                return;
            }
            const cartModal = document.getElementById('cartModal');
            if (!cartModal) return;
            cartModal.classList.toggle('open');
            document.body.style.overflow = cartModal.classList.contains('open') ? 'hidden' : '';
        }

        function closeCartOutside(e) {
            if (e.target.id === 'cartModal') toggleCart();
        }

        function checkout() {
            if (cart.length === 0) {
                window.location.href = './carrito.html';
                return;
            }
            window.location.href = './checkout.html';
            return;
            const qty = cart.reduce((s, i) => s + i.qty, 0);
            const sub = cart.reduce((s, i) => s + i.price * i.qty, 0);
            calcularTotalPedido(sub / Math.max(qty,1), qty, 5000);
            const nuevoPedido = saveOrderToHistory();
            showToast(' ¡Compra exitosa! Gracias por elegir Anthros', 'success');
            setTimeout(() => {
                const waUrl = generarMensajeWhatsAppCarrito();
                cart = [];
                appliedPromo = null;
                document.getElementById('promoInput').value = '';
                document.getElementById('promoMessage').textContent = '';
                updateCart();
                saveCart();
                toggleCart();
                if (nuevoPedido && waUrl) {
                    showGenericModal(
                        ' Pedido #' + nuevoPedido.id.slice(-6),
                        `<p style="color:var(--text-muted);margin-bottom:16px;line-height:1.6;">Tu pedido ha sido registrado con éxito. ¿Deseas continuar tu compra por <strong style="color:var(--red-primary);">WhatsApp</strong> con un asesor?</p>
                         <div style="display:flex;flex-wrap:wrap;gap:10px;">
                            <a href="${waUrl}" target="_blank" rel="noopener noreferrer" style="flex:1;text-decoration:none;padding:12px 16px;border-radius:var(--radius-md);background:#25D366;color:#fff;font-weight:700;text-align:center;min-width:180px;"> Ir a WhatsApp</a>
                            <button onclick="closeGenericModal()" style="flex:1;padding:12px 16px;border-radius:var(--radius-md);background:transparent;border:2px solid var(--red-primary);color:var(--red-primary);font-weight:700;cursor:pointer;min-width:180px;">Cerrar</button>
                         </div>
                         <p style="font-size:var(--fs-xs);color:var(--text-light);margin-top:14px;">Tu pedido se guardó en Historial · ID: ${nuevoPedido.id}</p>
                        `
                    );
                }
            }, 1700);
        }

        function initCheckoutPage() {
            const itemsEl = document.getElementById('checkoutItems');
            const totalsEl = document.getElementById('checkoutTotals');
            if (!itemsEl || !totalsEl) return;
            if (!cart.length) {
                itemsEl.innerHTML = '<p class="checkout-empty">Tu carrito está vacío. <a href="./catalogo.html">Explorar colección</a></p>';
                totalsEl.innerHTML = '';
            } else {
                const breakdown = calcularDesglosePedidoCompleto();
                itemsEl.innerHTML = cart.map(item => `<div class="checkout-item"><img src="${escapeHTML(item.img)}" alt="${escapeHTML(item.name)}"><div><strong>${escapeHTML(item.name)}</strong><small>${item.qty} × ${formatPrice(item.price)} · Talla ${escapeHTML(item.size || 'M')}</small></div><b>${formatPrice(item.price * item.qty)}</b></div>`).join('');
                totalsEl.innerHTML = `<div class="checkout-total-row"><span>Subtotal</span><b>${formatPrice(breakdown.subtotal)}</b></div>${breakdown.promoDiscount ? `<div class="checkout-total-row discount-row"><span>Descuento</span><b> ${formatPrice(breakdown.promoDiscount)}</b></div>` : ''}${breakdown.umbralDisc ? `<div class="checkout-total-row discount-row"><span>Bono Anthros</span><b> ${formatPrice(breakdown.umbralDisc)}</b></div>` : ''}<div class="checkout-total-row"><span>Envío</span><b>${breakdown.shipping ? formatPrice(breakdown.shipping) : 'Gratis'}</b></div><div class="checkout-total-row checkout-grand-total"><span>Total</span><b>${formatPrice(breakdown.total)}</b></div>`;
            }
            const city = document.getElementById('checkoutCity');
            const cash = document.querySelector('#cashPaymentOption input');
            const note = document.getElementById('cashPaymentNote');
            const updateCashAvailability = () => {
                const available = city.value === 'Barranquilla';
                cash.disabled = !available;
                document.getElementById('cashPaymentOption').classList.toggle('disabled', !available);
                note.textContent = available ? 'Contraentrega disponible para Barranquilla.' : 'Selecciona Barranquilla para activar contraentrega.';
                if (!available && cash.checked) cash.checked = false;
            };
            city.addEventListener('change', updateCashAvailability);
            updateCashAvailability();
            document.querySelectorAll('input[name="payment"]').forEach(input => input.addEventListener('change', () => {
                const extra = document.getElementById('paymentExtra');
                extra.innerHTML = input.value === 'card' ? '<label>Número de tarjeta<input required inputmode="numeric" placeholder="0000 0000 0000 0000"></label><div class="checkout-fields"><label>Vencimiento<input required placeholder="MM/AA"></label><label>CVV<input required inputmode="numeric" placeholder="123"></label></div>' : '';
            }));
        }

        async function finalizeCheckout(e) {
            e.preventDefault();
            if (!cart.length) { showToast('Añade productos antes de pagar', 'error'); return; }
            const form = e.currentTarget;
            const data = new FormData(form);
            if (data.get('payment') === 'cash' && data.get('city') !== 'Barranquilla') { showToast('Contraentrega solo está disponible en Barranquilla', 'error'); return; }
            if (!validateEmail(data.get('email')) || !validatePhone(data.get('phone')) || !validateRequired(data.get('name'), 3, 100) || !validateRequired(data.get('address'), 5, 180)) {
                showToast('Revisa nombre, correo, teléfono y dirección', 'error');
                return;
            }
            const order = saveOrderToHistory({
                customer: {
                    name: data.get('name'),
                    email: data.get('email'),
                    phone: data.get('phone'),
                    city: data.get('city'),
                    address: data.get('address')
                },
                payment: data.get('payment')
            });
            const orderId = order ? order.id : 'ORD-' + Date.now().toString(36).toUpperCase();
            let serverOrder = order;
            try {
                const result = await apiRequest('/orders', { method: 'POST', body: JSON.stringify(order) });
                serverOrder = result.order || order;
            } catch (error) {
                console.warn('Pedido guardado localmente; API no disponible:', error.message);
            }
            cart = [];
            appliedPromo = null;
            saveCart();
            const confirmedId = serverOrder?.id || orderId;
            form.innerHTML = `<div class="checkout-success"><span></span><p class="section-eyebrow">Pedido confirmado</p><h2>Gracias por elegir Anthros.</h2><p>Tu pedido <strong>#${confirmedId.slice(-8)}</strong> fue registrado. Te enviaremos los detalles a <strong>${data.get('email')}</strong>.</p><a href="./index.html" class="checkout-submit">Volver al inicio </a></div>`;
        }

        function selectSize(el) {
            el.parentElement.querySelectorAll('.size-option').forEach(s => s.classList.remove('selected'));
            el.classList.add('selected');
        }

        function toggleFav(btn) {
            btn.classList.toggle('active');
            const esActivo = btn.classList.contains('active');
            btn.textContent = esActivo ? 'Guardado' : 'Guardar';
            const card = btn.closest('.product-card');
            if (card) {
                const addBtn = card.querySelector('.add-to-cart-btn');
                const onclickText = addBtn?.getAttribute('onclick') || '';
                const match = onclickText.match(/id:(\d+)/);
                const id = match ? Number(match[1]) : null;
                if (id) toggleFavoritoById(id);
            }
            showToast(esActivo ? ' Añadido a favoritos' : ' Eliminado de favoritos', 'info');
        }

        function filterProducts(cat, btn) {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            _catalogFilters.category = cat;
            applyCatalogFilters();
        }

        async function subscribeNewsletter(e) {
            e.preventDefault();
            const input = document.getElementById('newsletterEmail');
            const email = String(input?.value || '').trim();
            if (!validateEmail(email)) {
                showToast(' Ingresa un correo válido', 'error');
                if (input) { input.style.borderColor = 'var(--red-primary)'; setTimeout(() => input.style.borderColor = '', 1500); }
                return;
            }
            let serverCreated = false;
            try {
                const result = await apiRequest('/newsletter', { method: 'POST', body: JSON.stringify({ email }) });
                serverCreated = result.created;
            } catch (error) {
                console.warn('Newsletter guardado localmente; API no disponible:', error.message);
            }
            const nuevo = saveNewsletterSubscriber(email);
            if (nuevo || serverCreated) {
                showToast(' ¡Suscripción exitosa! 10% OFF listo', 'success');
            } else {
                showToast(' Ya estás suscrito a nuestras novedades', 'info');
            }
            if (input) input.value = '';
        }

        function closeNewsletterFloat() {
            const newsletter = document.getElementById('newsletterFloat');
            if (newsletter) newsletter.classList.add('is-closed');
        }

        async function subscribeLoyalty(e) {
            e.preventDefault();
            const emailInput = document.getElementById('loyaltyEmail');
            const tierInput = document.getElementById('loyaltyTier');
            const email = String(emailInput?.value || '').trim().toLowerCase();
            const tier = String(tierInput?.value || 'esencial');
            if (!validateEmail(email)) {
                showToast('Ingresa un correo válido para unirte', 'error');
                emailInput?.focus();
                return;
            }
            try {
                let serverCreated = false;
                try {
                    const result = await apiRequest('/loyalty', { method: 'POST', body: JSON.stringify({ email, tier }) });
                    serverCreated = result.created;
                } catch (error) {
                    console.warn('Membresía guardada localmente; API no disponible:', error.message);
                }
                const members = JSON.parse(localStorage.getItem(STORAGE_KEYS.LOYALTY) || '[]');
                if (members.some(member => member.email === email)) {
                    showToast('Este correo ya pertenece al Círculo', 'info');
                } else {
                    members.push({ email, tier, joinedAt: new Date().toISOString(), points: 0 });
                    localStorage.setItem(STORAGE_KEYS.LOYALTY, JSON.stringify(members));
                    showToast(serverCreated ? 'Bienvenido al Círculo Anthros' : 'Bienvenido al Círculo Anthros (guardado localmente)', 'success');
                }
                if (emailInput) emailInput.value = '';
            } catch (error) {
                console.warn('No fue posible guardar la membresía', error);
                showToast('No pudimos completar el registro', 'error');
            }
        }

        function scrollToTop() {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        window.addEventListener('scroll', () => {
            const btn = document.getElementById('scrollTop');
            if (!btn) return;
            btn.classList.toggle('visible', window.scrollY > 450);
        }, { passive: true });

        function toggleMobileMenu() {
            menuOpen = !menuOpen;
            const menu = document.getElementById('mobileMenu');
            const btn = document.getElementById('hamburgerBtn');
            if (!menu || !btn) return;
            menu.classList.toggle('open', menuOpen);
            btn.classList.toggle('open', menuOpen);
            btn.setAttribute('aria-expanded', menuOpen);
            document.body.style.overflow = menuOpen ? 'hidden' : '';
        }

        function closeMobileMenu() {
            if (!menuOpen) return;
            menuOpen = false;
            const menu = document.getElementById('mobileMenu');
            const btn = document.getElementById('hamburgerBtn');
            if (!menu || !btn) return;
            menu.classList.remove('open');
            btn.classList.remove('open');
            btn.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
        }

        function closeMenuOutside(e) {
            if (e.target.id === 'mobileMenu') closeMobileMenu();
        }

        /* =========================================================
           MÓDULO 1 · CONSTANTES GLOBALES DE CONFIGURACIÓN ANTHROS
           ========================================================= */
        const APP_CONFIG = Object.freeze({
            STORE_NAME: 'ANTHROS',
            STORE_SLOGAN: 'Moda que se siente, estilo que perdura',
            CURRENCY: 'COP',
            CURRENCY_SYMBOL: '$',
            LOCALE: 'es-CO',
            COUNTRY: 'Colombia',
            CITY: 'Barranquilla',
            ADDRESS: 'Carrera 43 #75-130',
            EMAIL_CONTACTO: 'hola@anthros.com',
            EMAIL_VENTAS: 'ventas@anthros.com',
            PHONE: '+57 (5) 123-4567',
            WHATSAPP: '573001234567',
            HORARIO: 'Lun-Vie 9am-7pm · Sáb 10am-4pm',
            DOMINIO: 'https://anthros.com'
        });

        const SHIPPING_CONFIG = Object.freeze({
            COSTO_ESTANDAR: 5000,
            COSTO_EXPRESS: 12000,
            UMBRAL_GRATIS_CANTIDAD: 5,
            UMBRAL_GRATIS_MONTO: 150000,
            DIAS_ESTANDAR: '3-5 días hábiles',
            DIAS_EXPRESS: '1-2 días hábiles'
        });

        const TAX_CONFIG = Object.freeze({
            IVA_PORCENTAJE: 19,
            INCLUYE_IVA: true,
            BASE_GRAVABLE: 0.81
        });

        Object.assign(PROMO_CODES, {
            'ANTIVERSARIO': 25,
            'AMIGOANTHROS': 12,
            'COLOMBIA': 18,
            'BLACKFRIDAY': 30,
            'CYBERMONDAY': 28,
            'PRIMERACOMPRA': 10
        });

        const PRODUCT_CATEGORIES = Object.freeze({
            ALL: { key: 'all', label: 'Todos', icon: '' },
            HOMBRES: { key: 'hombres', label: 'Hombres', icon: '' },
            MUJERES: { key: 'mujeres', label: 'Mujeres', icon: '' },
            ACCESORIOS: { key: 'accesorios', label: 'Accesorios', icon: '' },
            OFERTAS: { key: 'ofertas', label: 'Ofertas', icon: '' },
            NUEVOS: { key: 'nuevos', label: 'Nuevos', icon: '' }
        });

        const AVAILABLE_SIZES = Object.freeze({
            ROPA_HOMBRE: ['S', 'M', 'L', 'XL', 'XXL'],
            ROPA_MUJER: ['XS', 'S', 'M', 'L', 'XL'],
            CAMISETAS: ['S', 'M', 'L', 'XL'],
            PANTALONES: ['28', '30', '32', '34', '36', '38'],
            ACCESORIOS: ['Talla Única']
        });

        const SORT_OPTIONS = Object.freeze([
            { value: 'default',     label: 'Por defecto' },
            { value: 'price-asc',   label: 'Precio: menor a mayor' },
            { value: 'price-desc',  label: 'Precio: mayor a menor' },
            { value: 'name-asc',    label: 'Nombre: A-Z' },
            { value: 'name-desc',   label: 'Nombre: Z-A' },
            { value: 'discount',    label: 'Mayor descuento' },
            { value: 'news',        label: 'Novedades primero' }
        ]);

        const CUOTAS_CONFIG = Object.freeze({
            MAX_CUOTAS: 12,
            CUOTAS_SIN_INTERES: [1, 3, 6],
            INTERES_MENSUAL: 0.025
        });

        const STORAGE_KEYS = Object.freeze({
            CART: 'anthros_cart_v1',
            FAVORITES: 'anthros_favorites_v1',
            PROMO_APLIED: 'anthros_promo_v1',
            NEWSLETTER: 'anthros_newsletter_v1',
            LOYALTY: 'anthros_loyalty_v1',
            RECOMMENDATIONS: 'anthros_recommendations_v1',
            ORDER_HISTORY: 'anthros_orders_v1',
            USER_PREFS: 'anthros_user_prefs_v1',
            ACCOUNT: 'anthros_account_v1'
        });

        const FAQ_DATA = Object.freeze([
            { q: '¿Cuánto tarda mi envío?', a: 'Envío estándar 3-5 días hábiles · Express 1-2 días hábiles. Gratis compras > 5 unidades o > $150.000.' },
            { q: '¿Puedo cambiar o devolver?', a: '30 días hábiles después de recibir tu pedido. La prenda debe estar sin uso y con etiquetas.' },
            { q: '¿Qué tallas debo comprar?', a: 'Consulta nuestra guía de tallas. Si aún tienes dudas, contáctanos por WhatsApp y te ayudamos.' },
            { q: '¿Los descuentos se acumulan?', a: 'Solo un código promocional por pedido. El bono > $100k se aplica automáticamente con cualquier código.' },
            { q: '¿Qué métodos de pago aceptan?', a: 'Efectivo contraentrega, PSE, Tarjetas crédito/débito (Visa/Mastercard), Nequi y Daviplata.' },
            { q: '¿Tienen tienda física?', a: '¡Sí! En Barranquilla: Carrera 43 #75-130 · Horario Lun-Vie 9am-7pm · Sáb 10am-4pm.' }
        ]);

        const PRODUCTS_DATA = Object.freeze([
            { id: 1, name: 'Camiseta Manga Larga Essence', category: 'mujeres ofertas', gender: 'Mujer', line: 'Básicos', price: 63920, originalPrice: 79900, discount: 20, isNew: false, badge: '-20%', sizes: ['S','M','L'], collection: 'Esenciales', year: 2026, material: 'Algodón orgánico 100%', colors: ['Marfil', 'Terracota'], shipping: '3-5 días hábiles', care: 'Lavar en frío y secar a la sombra', img: './camiseta-mujer-manga-larga-de-algodon-ecologico.jpg.webp', desc: 'Elegancia atemporal en algodón premium. Transpirable, suave y perfecta para cada estación del año.', rating: 5, reviews: 124 },
            { id: 2, name: 'Camisa Lino Serenity', category: 'hombres nuevos', gender: 'Hombre', line: 'Camisas', price: 125000, originalPrice: null, discount: 0, isNew: true, badge: 'Nuevo', sizes: ['S','M','L','XL'], collection: 'Horizonte', year: 2026, material: 'Lino europeo certificado', colors: ['Arena', 'Blanco humo'], shipping: '3-5 días hábiles', care: 'Lavar a mano y planchar a baja temperatura', img: './Organic-Linen-Shirts-Men-Long-Sleeve-Shirts-for-Men-Eco-Friendly-Camisas-Sustainable-Men-Linen-Shirt-Men-s-Shirts.avif', desc: 'Lino premium, ligero y transpirable. Ideal para eventos especiales o el día a día con estilo.', rating: 4, reviews: 87 },
            { id: 3, name: 'Camiseta Essential Blanca', category: 'hombres ofertas', gender: 'Hombre', line: 'Básicos', price: 67915, originalPrice: 79900, discount: 15, isNew: false, badge: '-15%', sizes: ['S','M','L','XL'], collection: 'Esenciales', year: 2026, material: 'Algodón peinado 100%', colors: ['Blanco óptico', 'Negro carbón'], shipping: '3-5 días hábiles', care: 'Lavar del revés en ciclo suave', img: './Rebeld-Enjoylife-Camiseta-Essential-Blanca-F-500x500.png', desc: 'El básico indispensable. Algodón 100% peinado, corte clásico y versátil para cualquier look.', rating: 5, reviews: 312 },
            { id: 4, name: 'Camisa Rayas Coastal', category: 'hombres', gender: 'Hombre', line: 'Casual', price: 79900, originalPrice: null, discount: 0, isNew: false, badge: '', sizes: ['S','M','L'], collection: 'Horizonte', year: 2025, material: 'Algodón reciclado y lino', colors: ['Azul costa', 'Marfil'], shipping: '3-5 días hábiles', care: 'Lavar en frío con colores similares', img: './camisa-rayas-manga-corta-ecologica-350x464.jpg', desc: 'Estilo náutico con un toque contemporáneo. Perfecta para looks casuales y días soleados.', rating: 4, reviews: 58 },
            { id: 5, name: 'Sudadera Urban Cozy', category: 'hombres ofertas', gender: 'Hombre', line: 'Sudaderas', price: 76930, originalPrice: 109900, discount: 30, isNew: false, badge: '-30%', sizes: ['S','M','L','XL'], collection: 'Movimiento', year: 2025, material: 'Algodón reciclado y felpa suave', colors: ['Gris humo', 'Verde bosque'], shipping: '3-5 días hábiles', care: 'Lavar del revés y no usar secadora', img: './adis-gris-19053-742485_019053-1_703c77d9-da0b-4aec-b78a-a613020cff3a.webp', desc: 'Calidez urbana en suave felpa premium. Ideal para días frescos con un toque de estilo moderno.', rating: 5, reviews: 201 },
            { id: 6, name: 'Vestido Ethereal Bloom', category: 'mujeres nuevos', gender: 'Mujer', line: 'Vestidos', price: 149900, originalPrice: null, discount: 0, isNew: true, badge: 'Nuevo', sizes: ['XS','S','M','L'], collection: 'Horizonte', year: 2026, material: 'Viscosa ECOVERO', colors: ['Rosa arcilla', 'Verde salvia'], shipping: '3-5 días hábiles', care: 'Lavar a mano y colgar para secar', img: './images (2).jpg', desc: 'Diseño versátil y delicado. Fabricada con materiales de alta calidad para máximo confort y estilo.', rating: 5, reviews: 76 }
        ]);

        /* =========================================================
           MÓDULO 2 · VARIABLES GLOBALES DE ESTADO COMPLEMENTARIO
           ========================================================= */
        let favorites = [];
        let currentSort = 'default';
        let searchQuery = '';
        let newsletterSubscribers = [];
        let orderHistory = [];
        let userPreferences = { theme: 'warm', currency: 'COP' };
        let userAccount = null;

        const CART_LIMITS = Object.freeze({ MAX_QTY_PER_ITEM: 20, MAX_TOTAL_ITEMS: 100 });

        function escapeHTML(value) {
            return String(value ?? '').replace(/[&<>'"]/g, character => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
            }[character]));
        }

        function normalizeCartItem(item) {
            if (!item || !Number.isInteger(Number(item.id))) return null;
            const product = PRODUCTS_DATA.find(candidate => candidate.id === Number(item.id));
            if (!product) return null;
            const size = String(item.size || product.sizes?.[0] || 'M');
            const qty = Math.min(CART_LIMITS.MAX_QTY_PER_ITEM, Math.max(1, Math.floor(Number(item.qty) || 1)));
            if (!product.sizes?.includes(size)) return { ...product, size: product.sizes?.[0] || 'M', qty };
            return { ...product, size, qty };
        }

        function normalizeCart(items) {
            if (!Array.isArray(items)) return [];
            const normalized = [];
            let total = 0;
            items.forEach(item => {
                const valid = normalizeCartItem(item);
                if (!valid || total >= CART_LIMITS.MAX_TOTAL_ITEMS) return;
                valid.qty = Math.min(valid.qty, CART_LIMITS.MAX_TOTAL_ITEMS - total);
                const existing = normalized.find(current => current.id === valid.id && current.size === valid.size);
                if (existing) existing.qty = Math.min(CART_LIMITS.MAX_QTY_PER_ITEM, existing.qty + valid.qty);
                else normalized.push(valid);
                total = normalized.reduce((sum, current) => sum + current.qty, 0);
            });
            return normalized;
        }

        function getProductPayload(product, size, qty = 1) {
            const source = PRODUCTS_DATA.find(candidate => candidate.id === Number(product?.id));
            if (!source) return null;
            const selectedSize = source.sizes?.includes(size) ? size : source.sizes?.[0] || 'M';
            return { ...source, size: selectedSize, qty: Math.min(CART_LIMITS.MAX_QTY_PER_ITEM, Math.max(1, Number(qty) || 1)) };
        }

        /* =========================================================
           MÓDULO 3 · FUNCIONES DE CÁLCULO EXTENDIDAS
           Extiende calculos.js original con utilidades avanzadas
           ========================================================= */
        function calcularSubtotalCarrito(cartItems = cart) {
            return cartItems.reduce((s, i) => s + (i.price * i.qty), 0);
        }

        function calcularCantidadCarrito(cartItems = cart) {
            return cartItems.reduce((s, i) => s + i.qty, 0);
        }

        function calcularIVA(valorBase, porcentaje = TAX_CONFIG.IVA_PORCENTAJE) {
            if (TAX_CONFIG.INCLUYE_IVA) return valorBase - (valorBase / (1 + (porcentaje / 100)));
            return valorBase * (porcentaje / 100);
        }

        function calcularBaseGravable(valor, iva = TAX_CONFIG.IVA_PORCENTAJE) {
            return valor / (1 + (iva / 100));
        }

        function calcularPrecioConIVA(precioSinIVA, iva = TAX_CONFIG.IVA_PORCENTAJE) {
            return calcularPrecioConImpuesto(precioSinIVA, iva);
        }

        function calcularEnvio(totalQty, subtotal, tipoEnvio = 'estandar') {
            if (totalQty > SHIPPING_CONFIG.UMBRAL_GRATIS_CANTIDAD) return 0;
            if (subtotal >= SHIPPING_CONFIG.UMBRAL_GRATIS_MONTO) return 0;
            return tipoEnvio === 'express'
                ? SHIPPING_CONFIG.COSTO_EXPRESS
                : SHIPPING_CONFIG.COSTO_ESTANDAR;
        }

        function calcularAhorroTotal(cartItems = cart, appliedPromoPct = appliedPromo) {
            let ahorro = 0;
            cartItems.forEach(item => {
                const prod = PRODUCTS_DATA.find(p => p.id === item.id);
                if (prod && prod.originalPrice) ahorro += (prod.originalPrice - prod.price) * item.qty;
            });
            const subtotal = calcularSubtotalCarrito(cartItems);
            const qty = calcularCantidadCarrito(cartItems);
            const beforePromo = subtotal;
            if (appliedPromoPct) ahorro += beforePromo * (appliedPromoPct / 100);
            const umbral = (subtotal + calcularEnvio(qty, subtotal));
            if (umbral > 100000) ahorro += umbral * 0.10;
            return Math.round(ahorro);
        }

        function calcularDesglosePedidoCompleto(cartItems = cart, appliedPromoPct = appliedPromo, costoEnvioAdicional = null) {
            const subtotal = calcularSubtotalCarrito(cartItems);
            const totalQty = calcularCantidadCarrito(cartItems);
            const shipping = costoEnvioAdicional ?? calcularEnvio(totalQty, subtotal);
            const promoDiscount = appliedPromoPct ? (subtotal * (appliedPromoPct / 100)) : 0;
            const afterPromo = subtotal - promoDiscount;
            const beforeUmbral = afterPromo + shipping;
            const umbralDisc = beforeUmbral > 100000 ? (beforeUmbral * 0.10) : 0;
            const total = beforeUmbral - umbralDisc;
            const ahorro = calcularAhorroTotal(cartItems, appliedPromoPct);
            const iva = calcularIVA(total);
            const baseGrav = calcularBaseGravable(total);
            return {
                subtotal, totalQty, shipping, promoDiscount, appliedPromoPct,
                umbralDisc, total, ahorro, iva, baseGrav, afterPromo, beforeUmbral
            };
        }

        function calcularCuotas(valor, numCuotas = 1, conInteres = true) {
            if (numCuotas <= 0) return { cuota: valor, total: valor, error: 'Número inválido' };
            if (CUOTAS_CONFIG.CUOTAS_SIN_INTERES.includes(numCuotas)) conInteres = false;
            if (numCuotas > CUOTAS_CONFIG.MAX_CUOTAS) numCuotas = CUOTAS_CONFIG.MAX_CUOTAS;
            let total = valor;
            if (conInteres) {
                const i = CUOTAS_CONFIG.INTERES_MENSUAL;
                const n = numCuotas;
                total = valor * Math.pow(1 + i, n);
            }
            return {
                numCuotas,
                cuota: total / numCuotas,
                total,
                conInteres,
                sinInteres: CUOTAS_CONFIG.CUOTAS_SIN_INTERES.includes(numCuotas),
                texto: `${numCuotas}x ${formatPrice(total / numCuotas)}${conInteres ? ' c/interés' : ' sin interés'}`
            };
        }

        function obtenerCuotasDisponibles(valor, max = CUOTAS_CONFIG.MAX_CUOTAS) {
            return Array.from({ length: max }, (_, i) => i + 1).map(n => calcularCuotas(valor, n));
        }

        function redondearPrecio(precio, base = 50) {
            return Math.round(precio / base) * base;
        }

        function formatearNumero(num, decimales = 0) {
            return Number(num).toLocaleString(APP_CONFIG.LOCALE, {
                minimumFractionDigits: decimales, maximumFractionDigits: decimales
            });
        }

        function calcularPrecioMayorista(precioUnitario, cantidad, umbrales = [
            { qty: 10, pct: 5 }, { qty: 25, pct: 10 }, { qty: 50, pct: 18 }, { qty: 100, pct: 25 }
        ]) {
            const u = [...umbrales].sort((a,b) => b.qty - a.qty);
            const d = u.find(x => cantidad >= x.qty);
            const pct = d ? d.pct : 0;
            const unitarioConDesc = calcularPrecioConDescuento(precioUnitario, pct);
            return {
                porcentaje: pct,
                precioUnitarioMayorista: unitarioConDesc,
                totalMayorista: unitarioConDesc * cantidad
            };
        }

        function calcularRangoDescuento(precio, originalPrice) {
            if (!originalPrice || originalPrice <= precio) return 0;
            return Math.round(100 - ((precio / originalPrice) * 100));
        }

        /* =========================================================
           MÓDULO 4 · FUNCIONES DE PERSISTENCIA (localStorage)
           Aseguran que carrito, favoritos y pedidos no se pierdan
           ========================================================= */
        function soportaStorage() {
            try {
                const k = '__test_anthros__';
                localStorage.setItem(k, '1');
                localStorage.removeItem(k);
                return true;
            } catch { return false; }
        }

        function saveCart() {
            if (!soportaStorage()) return;
            try { localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(normalizeCart(cart))); } catch (e) { console.warn('saveCart falló', e); }
            if (Number.isFinite(appliedPromo) && appliedPromo > 0 && appliedPromo <= 100) {
                localStorage.setItem(STORAGE_KEYS.PROMO_APLIED, String(appliedPromo));
            } else {
                appliedPromo = null;
                localStorage.removeItem(STORAGE_KEYS.PROMO_APLIED);
            }
        }

        function loadCart() {
            if (!soportaStorage()) return;
            try {
                const data = localStorage.getItem(STORAGE_KEYS.CART);
                if (data) {
                    const parsed = JSON.parse(data);
                    cart = normalizeCart(parsed);
                }
                const promo = localStorage.getItem(STORAGE_KEYS.PROMO_APLIED);
                const promoValue = Number(promo);
                appliedPromo = Object.values(PROMO_CODES).includes(promoValue) ? promoValue : null;
                saveCart();
            } catch (e) { console.warn('loadCart falló', e); }
        }

        function saveFavorites() {
            if (!soportaStorage()) return;
            try { localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites)); } catch (e) { console.warn(e); }
        }

        function loadFavorites() {
            if (!soportaStorage()) return;
            try {
                const data = localStorage.getItem(STORAGE_KEYS.FAVORITES);
                const parsed = data ? JSON.parse(data) : [];
                favorites = [...new Set(Array.isArray(parsed) ? parsed.map(Number).filter(id => PRODUCTS_DATA.some(product => product.id === id)) : [])];
                saveFavorites();
                sincronizarFavoritosUI();
            } catch (e) { console.warn(e); }
        }

        function sincronizarFavoritosUI() {
            const cards = document.querySelectorAll('.product-card');
            cards.forEach(card => {
                const btn = card.querySelector('.product-fav');
                if (!btn) return;
                const addBtn = card.querySelector('.add-to-cart-btn');
                if (!addBtn) return;
                const onclickText = addBtn.getAttribute('onclick') || '';
                const match = onclickText.match(/id:(\d+)/);
                const id = match ? Number(match[1]) : null;
                if (id && favorites.includes(id)) {
                    btn.classList.add('active');
                    btn.textContent = '';
                }
            });
        }

        function esFavorito(productId) {
            return favorites.includes(productId);
        }

        function toggleFavoritoById(productId) {
            const idx = favorites.indexOf(productId);
            if (idx >= 0) favorites.splice(idx, 1);
            else favorites.push(productId);
            saveFavorites();
        }

        function saveNewsletterSubscriber(email) {
            if (!soportaStorage() || !email) return false;
            try {
                const data = localStorage.getItem(STORAGE_KEYS.NEWSLETTER);
                if (data) newsletterSubscribers = JSON.parse(data);
                if (!newsletterSubscribers.includes(email)) {
                    newsletterSubscribers.push(email);
                    localStorage.setItem(STORAGE_KEYS.NEWSLETTER, JSON.stringify(newsletterSubscribers));
                    return true;
                }
                return false;
            } catch (e) { console.warn(e); return false; }
        }

        function saveOrderToHistory(checkoutData = {}) {
            if (!soportaStorage()) return null;
            try {
                const data = localStorage.getItem(STORAGE_KEYS.ORDER_HISTORY);
                if (data) orderHistory = JSON.parse(data);
                const order = {
                    id: 'ORD-' + Date.now().toString(36).toUpperCase(),
                    fecha: new Date().toISOString(),
                    items: JSON.parse(JSON.stringify(cart)),
                    appliedPromo,
                    desglose: calcularDesglosePedidoCompleto(),
                    total: calcularDesglosePedidoCompleto().total,
                    customer: checkoutData.customer || null,
                    payment: checkoutData.payment || null
                };
                orderHistory.unshift(order);
                localStorage.setItem(STORAGE_KEYS.ORDER_HISTORY, JSON.stringify(orderHistory));
                return order;
            } catch (e) { console.warn(e); return null; }
        }

        function getOrderHistory() {
            if (!soportaStorage()) return [];
            try {
                const data = localStorage.getItem(STORAGE_KEYS.ORDER_HISTORY);
                return data ? JSON.parse(data) : [];
            } catch { return []; }
        }

        function saveUserPrefs() {
            if (!soportaStorage()) return;
            try { localStorage.setItem(STORAGE_KEYS.USER_PREFS, JSON.stringify(userPreferences)); }
            catch (e) { console.warn(e); }
        }

        function loadUserPrefs() {
            if (!soportaStorage()) return;
            try {
                const data = localStorage.getItem(STORAGE_KEYS.USER_PREFS);
                if (data) userPreferences = { ...userPreferences, ...JSON.parse(data) };
            } catch (e) { console.warn(e); }
        }

        function saveUserAccount() {
            if (!soportaStorage() || !userAccount) return;
            try { localStorage.setItem(STORAGE_KEYS.ACCOUNT, JSON.stringify(userAccount)); } catch (error) { console.warn('No fue posible guardar la cuenta', error); }
        }

        function loadUserAccount() {
            if (!soportaStorage()) return;
            try {
                const stored = localStorage.getItem(STORAGE_KEYS.ACCOUNT);
                if (stored) userAccount = JSON.parse(stored);
            } catch (error) { console.warn('No fue posible cargar la cuenta', error); }
        }

        function clearAllAnthrosData() {
            if (!soportaStorage()) return;
            Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
            cart = []; appliedPromo = null; favorites = [];
            updateCart(); sincronizarFavoritosUI();
            showToast('Datos de Anthros eliminados', 'info');
        }

        function exportarDatosUsuario() {
            if (!soportaStorage()) return showToast('Almacenamiento no soportado', 'error');
            const exp = {
                exportDate: new Date().toISOString(),
                store: APP_CONFIG.STORE_NAME,
                cart, favorites, appliedPromo,
                newsletterSubscribers: getOrderHistory(),
                userPreferences
            };
            const blob = new Blob([JSON.stringify(exp, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `anthros-datos-${Date.now()}.json`; a.click();
            URL.revokeObjectURL(url);
            showToast('Resumen exportado', 'success');
        }

        /* =========================================================
           MÓDULO 5 · FUNCIONES UX / UI EXTENDIDAS
           Búsqueda, orden, validaciones, WhatsApp, FAQs, etc.
           ========================================================= */
        function validateEmail(email) {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
        }

        function validatePhone(phone) {
            return /^[+\d][\d\s()-]{6,}$/.test(String(phone).trim());
        }

        function validateRequired(value, minLen = 2, maxLen = 200) {
            const v = String(value || '').trim();
            return v.length >= minLen && v.length <= maxLen;
        }

        function copyToClipboard(text) {
            if (!navigator.clipboard) {
                const ta = document.createElement('textarea');
                ta.value = text; document.body.appendChild(ta); ta.select();
                try { document.execCommand('copy'); } catch (e) {}
                document.body.removeChild(ta);
            } else {
                navigator.clipboard.writeText(text).catch(() => {});
            }
            showToast(`Copiado: ${text}`, 'info');
        }

        function buscarProducto(query) {
            searchQuery = String(query || '').toLowerCase().trim();
            if (searchQuery.length > 1) recordRecommendationAction({ type: 'query', value: searchQuery });
            return applyCatalogFilters();
        }

        function ordenarProductos(criterio = 'default') {
            currentSort = criterio;
            const grid = document.getElementById('productsGrid');
            if (!grid) return;
            const cardsArr = Array.from(grid.querySelectorAll('.product-card'));
            const getPrecio = (card) => Number(card.querySelector('.product-price')?.textContent.replace(/[^0-9]/g, '') || 0);
            const getNombre = (card) => card.querySelector('.product-name')?.textContent || '';
            const getDescuento = (card) => {
                const badge = card.querySelector('.product-badge.discount')?.textContent || '';
                const match = badge.match(/-(\d+)/);
                return match ? Number(match[1]) : 0;
            };
            const esNuevo = (card) => card.querySelector('.product-badge:not(.discount)')?.textContent?.includes('Nuevo');
            switch (criterio) {
                case 'price-asc':  cardsArr.sort((a,b) => getPrecio(a) - getPrecio(b)); break;
                case 'price-desc': cardsArr.sort((a,b) => getPrecio(b) - getPrecio(a)); break;
                case 'name-asc':   cardsArr.sort((a,b) => getNombre(a).localeCompare(getNombre(b), 'es')); break;
                case 'name-desc':  cardsArr.sort((a,b) => getNombre(b).localeCompare(getNombre(a), 'es')); break;
                case 'discount':   cardsArr.sort((a,b) => getDescuento(b) - getDescuento(a)); break;
                case 'news':       cardsArr.sort((a,b) => Number(esNuevo(b)) - Number(esNuevo(a))); break;
                default:           cardsArr.sort((a,b) => Number(a.dataset.id || 0) - Number(b.dataset.id || 0));
            }
            cardsArr.forEach(card => grid.appendChild(card));
        }

        function contarProductosPorCategoria() {
            const res = {};
            document.querySelectorAll('.product-card').forEach(card => {
                const cats = (card.dataset.category || 'all').split(/\s+/);
                cats.forEach(c => { res[c] = (res[c] || 0) + 1; });
                res['all'] = (res['all'] || 0) + 1;
            });
            return res;
        }

        function obtenerResumenTienda() {
            const desglose = calcularDesglosePedidoCompleto();
            return {
                totalProductos: PRODUCTS_DATA.length,
                categoriasDisponibles: Object.keys(contarProductosPorCategoria()).length - 1,
                carritoCantidad: calcularCantidadCarrito(),
                carritoSubtotal: desglose.subtotal,
                carritoTotal: desglose.total,
                ahorroAcumulado: desglose.ahorro,
                favoritosCantidad: favorites.length
            };
        }

        function generarMensajeWhatsAppCarrito(numero = APP_CONFIG.WHATSAPP) {
            if (cart.length === 0) return showToast('Tu carrito está vacío', 'error');
            const lines = [`Hola ANTHROS, quiero hacer este pedido:%0A%0A *Mi Pedido Anthros*%0A`];
            const desglose = calcularDesglosePedidoCompleto();
            cart.forEach((it, idx) => {
                lines.push(
                    `%0A${idx + 1}. *${it.name}*` +
                    `%0A   · Talla ${it.size} · Cant. ${it.qty}` +
                    `%0A   · Subtotal: ${formatPrice(it.price * it.qty)}`
                );
            });
            lines.push(`%0A%0A--- *RESUMEN* ---`);
            lines.push(`%0ASubtotal (${desglose.totalQty} prod): ${formatPrice(desglose.subtotal)}`);
            if (desglose.promoDiscount > 0) lines.push(`%0ACódigo ${desglose.appliedPromoPct}% OFF: -${formatPrice(desglose.promoDiscount)}`);
            if (desglose.umbralDisc > 0) lines.push(`%0ABono > $100k: -${formatPrice(desglose.umbralDisc)}`);
            lines.push(`%0AEnvío: ${desglose.shipping === 0 ? ' GRATIS' : formatPrice(desglose.shipping)}`);
            lines.push(`%0A*TOTAL A PAGAR: ${formatPrice(desglose.total)}*`);
            lines.push(`%0A%0A Ahorro total: ${formatPrice(desglose.ahorro)}`);
            const url = `https://wa.me/${numero}?text=${lines.join('')}`;
            return url;
        }

        function enviarPedidoPorWhatsApp() {
            const url = generarMensajeWhatsAppCarrito();
            if (!url) return;
            window.open(url, '_blank', 'noopener,noreferrer');
            showToast('Abriendo WhatsApp con tu pedido...', 'success');
        }

        function compartirProducto(productId, red = 'wa') {
            const prod = PRODUCTS_DATA.find(p => p.id === productId);
            if (!prod) return;
            const text = encodeURIComponent(`¡Mira esta prenda de ANTHROS!  ${prod.name} · ${formatPrice(prod.price)} · ${APP_CONFIG.DOMINIO}/#producto-${prod.id}`);
            let url = '';
            if (red === 'wa') url = `https://wa.me/?text=${text}`;
            else if (red === 'fb') url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(APP_CONFIG.DOMINIO + '/#producto-' + prod.id)}&quote=${text}`;
            else if (red === 'copy') return copyToClipboard(decodeURIComponent(text));
            if (url) window.open(url, '_blank', 'noopener,noreferrer');
        }

        function generarCodigoPromoAleatorio(longitud = 8) {
            const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
            let code = '';
            for (let i = 0; i < longitud; i++) code += chars[Math.floor(Math.random() * chars.length)];
            return `ANTHROS-${code}`;
        }

        function mostrarSimuladorCuotas(valor) {
            const cuotas = obtenerCuotasDisponibles(valor, 6);
            const msg = cuotas.map(c => c.texto).join('%0A');
            showToast('Cuotas calculadas. Abre la consola para ver detalles.', 'info');
            console.table(cuotas.map(c => ({
                Cuotas: c.numCuotas,
                'Valor cuota': formatPrice(c.cuota),
                'Total': formatPrice(c.total),
                '¿Sin interés?': c.sinInteres ? 'SÍ' : 'NO'
            })));
            return cuotas;
        }

        function showFAQModal() {
            const html = FAQ_DATA.map(f => `<div style="margin-bottom:14px;"><strong style="color:var(--red-primary);"> ${f.q}</strong><p style="color:var(--text-muted);margin-top:4px;">${f.a}</p></div>`).join('');
            const modal = document.createElement('div');
            modal.id = 'faqModal';
            modal.setAttribute('role','dialog');
            modal.style.cssText = 'position:fixed;inset:0;background:rgba(55,6,23,0.55);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:1000000;display:flex;align-items:center;justify-content:center;padding:20px;';
            modal.innerHTML = `
                <div style="background:var(--cream-light);border-radius:var(--radius-lg);padding:28px;max-width:560px;max-height:82vh;overflow-y:auto;box-shadow:0 20px 60px var(--shadow-xl);width:100%;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
                        <h3 style="font-family:var(--font-display);color:var(--red-deep);font-size:var(--fs-xl);"> Preguntas Frecuentes</h3>
                        <button onclick="closeFAQModal()" aria-label="Cerrar FAQ" style="width:38px;height:38px;border-radius:50%;background:rgba(0,0,0,0.05);font-size:1.3rem;cursor:pointer;"></button>
                    </div>
                    ${html}
                </div>
            `;
            modal.addEventListener('click', e => { if (e.target === modal) closeFAQModal(); });
            document.body.appendChild(modal);
            document.body.style.overflow = 'hidden';
            document.addEventListener('keydown', function escFAQ(e) {
                if (e.key === 'Escape') { closeFAQModal(); document.removeEventListener('keydown', escFAQ); }
            });
        }

        function closeFAQModal() {
            const m = document.getElementById('faqModal');
            if (m) { m.remove(); document.body.style.overflow = ''; }
        }

        function showGenericModal(titulo, contenidoHTML, onClose = null) {
            const modal = document.createElement('div');
            modal.id = 'genericModal';
            modal.setAttribute('role','dialog');
            modal.style.cssText = 'position:fixed;inset:0;background:rgba(55,6,23,0.55);backdrop-filter:blur(8px);z-index:1000001;display:flex;align-items:center;justify-content:center;padding:20px;';
            modal.innerHTML = `
                <div style="background:var(--cream-light);border-radius:var(--radius-lg);padding:26px;max-width:520px;width:100%;box-shadow:0 20px 60px var(--shadow-xl);">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                        <h3 style="font-family:var(--font-display);color:var(--red-deep);font-size:var(--fs-lg);">${titulo}</h3>
                        <button onclick="closeGenericModal()" style="width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,0.05);font-size:1.2rem;cursor:pointer;"></button>
                    </div>
                    <div>${contenidoHTML}</div>
                </div>
            `;
            modal.addEventListener('click', e => { if (e.target === modal) closeGenericModal(); });
            document.body.appendChild(modal);
            document.body.style.overflow = 'hidden';
            window._genericModalOnClose = onClose;
        }

        function closeGenericModal() {
            const m = document.getElementById('genericModal');
            if (m) {
                m.remove();
                document.body.style.overflow = '';
                if (typeof window._genericModalOnClose === 'function') {
                    try { window._genericModalOnClose(); } catch (e) {}
                }
                window._genericModalOnClose = null;
            }
        }

        function generateProductCardHTML(prod) {
            const badge = prod.badge
                ? `<span class="product-badge ${prod.badge.includes('%') ? 'discount' : ''}">${prod.badge}</span>`
                : '';
            const sizes = (prod.sizes || ['S','M','L']).map(s => `<div class="size-option" onclick="selectSize(this)">${s}</div>`).join('');
            const precioOriginal = prod.originalPrice
                ? `<span class="product-price-original">${formatPrice(prod.originalPrice)}</span>` : '';
            return `
                <article class="product-card reveal" data-category="${prod.category}" data-id="${prod.id}" data-price="${prod.price}" data-discount="${prod.discount || 0}" data-year="${prod.year || ''}" data-collection="${prod.collection || ''}" data-sizes="${(prod.sizes || []).join(',')}">
                    ${badge}
                    <button class="product-fav" onclick="toggleFav(this)" aria-label="Añadir a favoritos"></button>
                    <div class="product-image" onclick="goToProduct(${prod.id})" role="link" tabindex="0" onkeydown="if(event.key==='Enter')goToProduct(${prod.id})">
                        <img src="${prod.img}" alt="${prod.name}" loading="lazy">
                        <button class="quick-view-btn" onclick="event.stopPropagation();goToProduct(${prod.id})" aria-label="Ver detalles de ${prod.name}">Ver producto </button>
                    </div>
                    <div class="product-info">
                        <div class="product-category">${prod.gender} · ${prod.line}</div>
                        <h3 class="product-name" onclick="goToProduct(${prod.id})">${prod.name}</h3>
                        <p class="product-description">${prod.desc}</p>
                        <div class="product-size">${sizes}</div>
                        <div class="product-footer">
                            <div class="price-container">
                                ${precioOriginal}
                                <span class="product-price">${formatPrice(prod.price)}</span>
                            </div>
                            <button class="add-to-cart-btn" onclick='addToCart({id:${prod.id},name:${JSON.stringify(prod.name)},price:${prod.price},img:"${prod.img}",category:"${prod.gender}"})' aria-label="Añadir al carrito">+</button>
                        </div>
                    </div>
                </article>
            `;
        }

        function renderProductsFromData(products = PRODUCTS_DATA) {
            const grid = document.getElementById('productsGrid');
            if (!grid) return;
            grid.innerHTML = products.map(generateProductCardHTML).join('');
            document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
            sincronizarFavoritosUI();
            renderRecommendations();
        }

        function goToProduct(productId) {
            const product = PRODUCTS_DATA.find(item => item.id === Number(productId));
            if (!product) return showToast('Producto no encontrado', 'error');
            recordRecommendationAction({ type: 'view', productId: product.id });
            window.location.href = `./producto.html?id=${product.id}`;
        }

        /* =========================================================
           MÓDULO 6 · LISTENERS Y AUTO-EJECUCIÓN
           Integración con el flujo existente
           ========================================================= */
        window.addEventListener('beforeunload', () => { saveCart(); saveFavorites(); saveUserPrefs(); });
        window.addEventListener('pagehide',    () => { saveCart(); saveFavorites(); });
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                const inp = prompt(' Buscar productos en ANTHROS:');
                if (inp !== null) {
                    const encontrados = buscarProducto(inp);
                    showToast(`${encontrados} producto(s) encontrado(s)`, encontrados ? 'success' : 'info');
                }
            }
        });

        (function inicializarModulosNuevos() {
            if (!soportaStorage()) return;
            loadUserPrefs();
            loadUserAccount();
            loadCart();
            loadFavorites();
            try {
                const data = localStorage.getItem(STORAGE_KEYS.NEWSLETTER);
                if (data) newsletterSubscribers = JSON.parse(data);
            } catch {}
            try {
                const data = localStorage.getItem(STORAGE_KEYS.ORDER_HISTORY);
                if (data) orderHistory = JSON.parse(data);
            } catch {}
        })();

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(en => {
                if (en.isIntersecting) {
                    en.target.classList.add('visible');
                    observer.unobserve(en.target);
                }
            });
        }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
        document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('cartModal');
                if (modal.classList.contains('open')) toggleCart();
                closeQuickView();
                closeSizeGuideModal();
                if (menuOpen) closeMobileMenu();
            }
        });

        /* =========================================================
           MÓDULO 7 · NUEVAS FUNCIONES UI (FALTANTES)
           navigateTo, toggleTheme, search, filters, modals, etc.
           ========================================================= */
        let _searchDebounceTimer = null;
        let _currentViewMode = 'grid';
        let _currentPriceMax = 500000;
        const _catalogFilters = { category: 'all', year: 'all', collection: 'all', size: 'all', offers: false };
        let _testimonialIndex = 0;
        let _testimonialAutoTimer = null;
        let _heroIndex = 0;
        let _heroTimer = null;
        let _countdownTarget = null;
        let _quickViewData = { productId: null, qty: 1, size: null };
        let _emptyCartSlide = 0;
        let _emptyCartTimer = null;

        const HERO_SLIDES = Object.freeze([
            { image: './images (2).jpg', label: 'Anthros / 01' },
            { image: './Organic-Linen-Shirts-Men-Long-Sleeve-Shirts-for-Men-Eco-Friendly-Camisas-Sustainable-Men-Linen-Shirt-Men-s-Shirts.avif', label: 'Anthros / 02' },
            { image: './camiseta-mujer-manga-larga-de-algodon-ecologico.jpg.webp', label: 'Anthros / 03' }
        ]);

        function renderHeroSlide() {
            const hero = document.querySelector('.hero-carousel-shell');
            const dots = document.getElementById('heroCarouselDots');
            if (!hero || !dots) return;
            const slide = HERO_SLIDES[_heroIndex];
            hero.classList.remove('hero-slide-enter');
            void hero.offsetWidth;
            hero.classList.add('hero-slide-enter');
            hero.style.backgroundImage = `linear-gradient(90deg, rgba(28, 8, 10, 0.84) 0%, rgba(55, 6, 23, 0.62) 46%, rgba(55, 6, 23, 0.16) 100%), url("${slide.image}")`;
            dots.innerHTML = HERO_SLIDES.map((item, index) => `<button type="button" class="hero-carousel-dot ${index === _heroIndex ? 'active' : ''}" onclick="setHeroSlide(${index})" aria-label="Ir a ${item.label}"></button>`).join('');
        }

        function setHeroSlide(index) {
            _heroIndex = (index + HERO_SLIDES.length) % HERO_SLIDES.length;
            renderHeroSlide();
        }

        function changeHeroSlide(direction) {
            setHeroSlide(_heroIndex + direction);
            restartHeroTimer();
        }

        function restartHeroTimer() {
            clearInterval(_heroTimer);
            _heroTimer = setInterval(() => setHeroSlide(_heroIndex + 1), 4000);
        }

        function initHeroCarousel() {
            const hero = document.querySelector('.hero-carousel-shell');
            if (!hero) return;
            renderHeroSlide();
            restartHeroTimer();
            hero.addEventListener('mouseenter', () => clearInterval(_heroTimer));
            hero.addEventListener('mouseleave', restartHeroTimer);
        }

        /* 1) NAVIGATE MPA (navegación real entre páginas) */
        function navigateTo(section, anchorId = null) {
            const pages = {
                home: 'index.html',
                productos: 'catalogo.html',
                catalogo: 'catalogo.html',
                coleccion: 'catalogo.html',
                nosotros: 'nosotros.html',
                cart: 'carrito.html',
                carrito: 'carrito.html',
                checkout: 'carrito.html',
                favorites: 'favoritos.html',
                favoritos: 'favoritos.html',
                orders: 'pedidos.html',
                pedidos: 'pedidos.html',
                howtobuy: 'index.html#howtobuy',
                contacto: 'index.html#contacto'
            };
            let target = pages[section] || 'index.html';
            if (anchorId && target.includes('#') === false) {
                target = target + '#' + anchorId;
            }
            closeMobileMenu();
            const isSamePage = target.startsWith('index.html#') && window.location.pathname.includes('index.html');
            if (isSamePage || (section === 'home' && anchorId)) {
                const el = document.getElementById(anchorId || section);
                if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
            }
            window.location.href = target;
        }

        /* 2) TOGGLE TEMA CLARO / OSCURO */
        function toggleTheme() {
            const root = document.documentElement;
            const btn = document.getElementById('themeToggle');
            const isDark = root.classList.toggle('theme-dark');
            if (btn) btn.textContent = isDark ? 'Tema claro' : 'Tema oscuro';
            const mobileBtn = document.getElementById('mobileThemeToggle');
            if (mobileBtn) mobileBtn.textContent = isDark ? 'Tema claro' : 'Tema oscuro';
            userPreferences.theme = isDark ? 'dark' : 'warm';
            saveUserPrefs();
            showToast(isDark ? ' Tema oscuro activado' : ' Tema cálido activado', 'info');
        }

        /* 3) SCROLL PROGRESS BAR */
        function updateScrollProgress() {
            const bar = document.getElementById('scrollProgress');
            if (!bar) return;
            const scrollTop = window.scrollY || document.documentElement.scrollTop;
            const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const pct = height > 0 ? Math.min(100, (scrollTop / height) * 100) : 0;
            bar.style.width = pct + '%';
        }
        window.addEventListener('scroll', updateScrollProgress, { passive: true });
        window.addEventListener('resize', updateScrollProgress, { passive: true });

        /* 4) BÚSQUEDA (debounce) */
        function onSearchInput(value) {
            clearTimeout(_searchDebounceTimer);
            _searchDebounceTimer = setTimeout(() => {
                const count = buscarProducto(value);
                const label = document.getElementById('searchResultsCount');
                if (label) {
                    label.style.display = value ? 'block' : 'none';
                    label.textContent = count ? ` ${count} producto(s) encontrado(s)` : ` No se encontraron productos para "${value}"`;
                    label.style.color = count ? 'var(--success)' : 'var(--red-primary)';
                }
            }, 280);
        }
        function executeSearch() {
            const input = document.getElementById('searchInput');
            if (!input) return;
            onSearchInput(input.value);
            showToast('Búsqueda ejecutada ', 'info');
        }

        /* 5) SORT PRODUCTOS (wrapper para <select>) */
        function sortProducts(criterio) {
            ordenarProductos(criterio);
            const label = criterio ? SORT_OPTIONS.find(s => s.value === criterio)?.label : 'Por defecto';
            if (criterio && criterio !== 'default') showToast(`Ordenado: ${label}`, 'info');
        }

        /* 6) VIEW MODE (GRID / LISTA) */
        function setViewMode(mode, btn) {
            _currentViewMode = mode === 'list' ? 'list' : 'grid';
            const grid = document.getElementById('productsGrid');
            if (grid) grid.classList.toggle('list-mode', _currentViewMode === 'list');
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            if (btn) btn.classList.add('active');
        }

        /* 7) FILTRO RANGO DE PRECIOS */
        function onPriceFilterChange(value) {
            _currentPriceMax = Number(value) || 500000;
            const label = document.getElementById('priceRangeLabel');
            if (label) label.textContent = formatearNumero(_currentPriceMax);
            return applyCatalogFilters();
        }

        function applyCatalogFilters() {
            const cards = document.querySelectorAll('.product-card');
            let countVisible = 0;
            cards.forEach(card => {
                const precio = Number(card.dataset.price || 0);
                const nombre = (card.querySelector('.product-name')?.textContent || '').toLowerCase();
                const categoria = (card.dataset.category || '').toLowerCase();
                const descripcion = (card.querySelector('.product-description')?.textContent || '').toLowerCase();
                const matchesSearch = !searchQuery || nombre.includes(searchQuery) || categoria.includes(searchQuery) || descripcion.includes(searchQuery);
                const matchesCategory = _catalogFilters.category === 'all' || categoria.includes(_catalogFilters.category);
                const matchesYear = _catalogFilters.year === 'all' || card.dataset.year === _catalogFilters.year;
                const matchesCollection = _catalogFilters.collection === 'all' || card.dataset.collection === _catalogFilters.collection;
                const matchesSize = _catalogFilters.size === 'all' || (card.dataset.sizes || '').split(',').includes(_catalogFilters.size);
                const matchesOffers = !_catalogFilters.offers || Number(card.dataset.discount || 0) > 0 || card.querySelector('.product-badge.discount');
                const show = matchesSearch && matchesCategory && matchesYear && matchesCollection && matchesSize && matchesOffers && precio <= _currentPriceMax;
                if (show) {
                    countVisible++;
                    card.style.display = '';
                    setTimeout(() => { card.style.opacity = '1'; card.style.transform = 'scale(1)'; }, 30);
                } else {
                    card.style.opacity = '0';
                    card.style.transform = 'scale(0.92) translateY(6px)';
                    setTimeout(() => { card.style.display = 'none'; }, 260);
                }
            });
            const resultLabel = document.getElementById('searchResultsCount');
            if (resultLabel && (searchQuery || _catalogFilters.category !== 'all' || _catalogFilters.year !== 'all' || _catalogFilters.collection !== 'all' || _catalogFilters.size !== 'all' || _catalogFilters.offers || _currentPriceMax < 500000)) {
                resultLabel.style.display = 'block';
                resultLabel.textContent = `${countVisible} producto(s) coinciden con tus filtros`;
                resultLabel.style.color = countVisible ? 'var(--success)' : 'var(--red-primary)';
            }
            return countVisible;
        }

        function updateAdvancedFilter(name, value) {
            if (name === 'offers') _catalogFilters.offers = Boolean(value);
            else _catalogFilters[name] = value || 'all';
            applyCatalogFilters();
        }

        function clearCatalogFilters() {
            Object.assign(_catalogFilters, { category: 'all', year: 'all', collection: 'all', size: 'all', offers: false });
            _currentPriceMax = 500000;
            ['catalogYear', 'catalogCollection', 'catalogSize'].forEach(id => { const el = document.getElementById(id); if (el) el.value = 'all'; });
            const range = document.getElementById('priceRangeFilter');
            if (range) range.value = '500000';
            const offers = document.getElementById('offersOnly');
            if (offers) offers.checked = false;
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.filter === 'all'));
            applyCatalogFilters();
        }

        /* 8) MODAL GUÍA DE TALLAS */
        function showSizeGuideModal() {
            let modal = document.getElementById('sizeGuideModal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'sizeGuideModal';
                modal.className = 'size-guide-modal';
                modal.addEventListener('click', e => { if (e.target === modal) closeSizeGuideModal(); });
                modal.innerHTML = `
                    <div class="size-guide-panel">
                        <button class="sg-close" onclick="closeSizeGuideModal()" aria-label="Cerrar guía de tallas"></button>
                        <h3> Guía de Tallas ANTHROS</h3>
                        <p style="color:var(--text-muted);font-size:var(--fs-sm);margin-bottom:var(--space-4);line-height:1.7;">
                            Para elegir tu talla correcta, toma tus medidas y compáralas con la tabla. Si estás entre 2 tallas, elige la mayor.
                        </p>
                        <div style="overflow-x:auto;margin-bottom:var(--space-3);">
                            <table class="size-guide-table" style="width:100%;border-collapse:collapse;font-size:var(--fs-sm);">
                                <thead>
                                    <tr>
                                        <th>Talla</th><th>Pecho (cm)</th><th>Cintura (cm)</th><th>Cadera (cm)</th><th>Hombro (cm)</th><th>Largo Manga (cm)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr><td>XS</td><td>84-88</td><td>62-66</td><td>88-92</td><td>37</td><td>57</td></tr>
                                    <tr><td>S</td><td>88-92</td><td>66-70</td><td>92-96</td><td>39</td><td>59</td></tr>
                                    <tr><td>M</td><td>92-96</td><td>70-74</td><td>96-100</td><td>41</td><td>61</td></tr>
                                    <tr><td>L</td><td>96-102</td><td>74-80</td><td>100-106</td><td>43</td><td>63</td></tr>
                                    <tr><td>XL</td><td>102-108</td><td>80-86</td><td>106-112</td><td>45</td><td>65</td></tr>
                                    <tr><td>XXL</td><td>108-114</td><td>86-92</td><td>112-118</td><td>47</td><td>67</td></tr>
                                </tbody>
                            </table>
                        </div>
                        <div class="size-guide-note">
                             <strong>Consejo:</strong> La medida más importante para prendas superiores es el <strong>pecho</strong>. Si tus medidas son mixtas, prioriza tu talla de pecho. Para una prenda más ajustada usa tu medida exacta, para un fit relajado suma 2-4 cm.
                        </div>
                        <div style="margin-top:var(--space-4);display:flex;gap:var(--space-3);flex-wrap:wrap;">
                            <button class="qv-btn-primary" style="flex:1;min-width:180px;" onclick="closeSizeGuideModal()">Entendido </button>
                            <button class="qv-btn-secondary" onclick="closeSizeGuideModal();navigateTo('home','productos');">Ver Productos </button>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);
            }
            modal.classList.add('open');
            document.body.style.overflow = 'hidden';
        }
        function closeSizeGuideModal() {
            const m = document.getElementById('sizeGuideModal');
            if (m) { m.classList.remove('open'); if (!isCartOpen() && !isQuickViewOpen()) document.body.style.overflow = ''; }
        }
        function isCartOpen() { return document.getElementById('cartModal')?.classList.contains('open'); }
        function isQuickViewOpen() { return document.getElementById('quickViewModal')?.classList.contains('open'); }

        /* 9) QUICK VIEW MODAL */
        function openQuickView(productId) {
            const prod = PRODUCTS_DATA.find(p => p.id === Number(productId));
            if (!prod) return showToast('Producto no encontrado', 'error');
            recordRecommendationAction({ type: 'view', productId: prod.id });
            _quickViewData = { productId: prod.id, qty: 1, size: prod.sizes?.[1] || 'M' };
            let modal = document.getElementById('quickViewModal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'quickViewModal';
                modal.className = 'quick-view-modal';
                modal.addEventListener('click', e => { if (e.target === modal) closeQuickView(); });
                document.body.appendChild(modal);
            }
            const starsHtml = `Calificación ${prod.rating || 0}/5`;
            const sizesHtml = (prod.sizes || ['S','M','L']).map((s, idx) =>
                `<div class="size-option ${s === _quickViewData.size ? 'selected' : ''}" onclick="qvSelectSize('${s}', this)">${s}</div>`
            ).join('');
            const priceOrigHtml = prod.originalPrice
                ? `<span class="qv-price-orig">${formatPrice(prod.originalPrice)}</span>
                   <span style="display:inline-block;padding:3px 10px;border-radius:var(--radius-full);background:rgba(230,57,70,0.12);color:var(--red-primary);font-weight:800;font-size:var(--fs-xs);">-${prod.discount}%</span>`
                : '';
            modal.innerHTML = `
                <div class="quick-view-panel">
                    <button class="qv-close" onclick="closeQuickView()" aria-label="Cerrar vista rápida"></button>
                    <div class="qv-image-wrap"><img src="${prod.img}" alt="${prod.name}" loading="lazy"></div>
                    <div class="qv-info">
                        <div class="qv-cat">${prod.gender} · ${prod.line}${prod.isNew ? ' · <span style=\\"color:var(--red-primary);\\">NUEVO</span>' : ''}</div>
                        <h3 class="qv-name">${prod.name}</h3>
                        <div class="qv-rating">
                            <div class="rating-stars" style="font-size:1rem;">${starsHtml}</div>
                            <span class="rating-count">(${prod.reviews || 0} reseñas)</span>
                        </div>
                        <div class="qv-price-row">
                            <span class="qv-price">${formatPrice(prod.price)}</span>
                            ${priceOrigHtml}
                        </div>
                        <p class="qv-desc">${prod.desc}</p>
                        <div class="qv-product-facts">
                            <div><span>Material</span><strong>${prod.material || 'Textil seleccionado Anthros'}</strong></div>
                            <div><span>Colores</span><strong>${(prod.colors || []).join(' · ') || 'Consulta disponibilidad'}</strong></div>
                            <div><span>Envío estimado</span><strong>${prod.shipping || '3-5 días hábiles'}</strong></div>
                            <div><span>Cuidado</span><strong>${prod.care || 'Seguir instrucciones de la etiqueta'}</strong></div>
                        </div>
                        <div>
                            <div class="qv-size-title"> Elige tu talla</div>
                            <div class="qv-sizes">${sizesHtml}</div>
                            <button class="qv-btn-secondary" style="margin-top:var(--space-2);padding:8px 14px;font-size:var(--fs-xs);" onclick="showSizeGuideModal()"> Ver guía de tallas</button>
                        </div>
                        <div class="qv-qty-row">
                            <div><span class="qv-size-title">Cantidad</span></div>
                            <div class="qv-qty">
                                <button class="qv-qty-btn" onclick="qvChangeQty(-1)" aria-label="Restar"></button>
                                <span class="qv-qty-val" id="qvQtyVal">1</span>
                                <button class="qv-qty-btn" onclick="qvChangeQty(1)" aria-label="Sumar">+</button>
                            </div>
                        </div>
                        <div class="qv-actions">
                            <button class="qv-btn-primary" onclick="qvAddToCart()"> Añadir al carrito</button>
                            <button class="qv-btn-secondary" onclick="toggleQuickViewFav()" title="Favorito" aria-label="Añadir favorito">${esFavorito(prod.id) ? '' : ''}</button>
                        </div>
                        <div class="qv-share-row">
                            <span>Compartir:</span>
                            <button class="qv-share-btn" title="WhatsApp" onclick="compartirProducto(${prod.id},'wa')">WhatsApp</button>
                            <button class="qv-share-btn" title="Facebook" onclick="compartirProducto(${prod.id},'fb')">Facebook</button>
                            <button class="qv-share-btn" title="Copiar enlace" onclick="compartirProducto(${prod.id},'copy')">Copiar</button>
                        </div>
                    </div>
                </div>
            `;
            modal.classList.add('open');
            document.body.style.overflow = 'hidden';
        }
        function closeQuickView() {
            const m = document.getElementById('quickViewModal');
            if (m) { m.classList.remove('open'); if (!isCartOpen()) document.body.style.overflow = ''; }
        }
        function qvSelectSize(size, el) {
            _quickViewData.size = size;
            el.parentElement?.querySelectorAll('.size-option').forEach(s => s.classList.remove('selected'));
            el.classList.add('selected');
        }
        function qvChangeQty(delta) {
            _quickViewData.qty = Math.max(1, (_quickViewData.qty || 1) + delta);
            const v = document.getElementById('qvQtyVal');
            if (v) v.textContent = _quickViewData.qty;
        }
        function qvAddToCart() {
            const prod = PRODUCTS_DATA.find(p => p.id === Number(_quickViewData.productId));
            if (!prod) return;
            for (let i = 0; i < _quickViewData.qty; i++) {
                addToCart({
                    id: prod.id,
                    name: prod.name,
                    price: prod.price,
                    img: prod.img,
                    category: prod.gender,
                    originalPrice: prod.originalPrice || undefined,
                    _forcedSize: _quickViewData.size
                });
            }
            showToast(` ${_quickViewData.qty} × ${prod.name} (${_quickViewData.size}) añadido(s) al carrito`, 'success');
            setTimeout(closeQuickView, 400);
        }
        function toggleQuickViewFav() {
            const id = Number(_quickViewData.productId);
            if (!id) return;
            if (esFavorito(id)) {
                favorites.splice(favorites.indexOf(id), 1);
            } else {
                favorites.push(id);
            }
            saveFavorites();
            sincronizarFavoritosUI();
            updateFavoritesCount();
            const prod = PRODUCTS_DATA.find(p => p.id === id);
            showToast(esFavorito(id) ? ` ${prod?.name} en favoritos` : ` Eliminado de favoritos`, 'info');
            openQuickView(id);
        }

        function recordRecommendationAction(action) {
            if (!soportaStorage()) return;
            try {
                const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.RECOMMENDATIONS) || '{"views":{},"carts":{},"queries":{}}');
                if (action.type === 'view') history.views[action.productId] = (history.views[action.productId] || 0) + 1;
                if (action.type === 'cart') history.carts[action.productId] = (history.carts[action.productId] || 0) + 1;
                if (action.type === 'query' && action.value) history.queries[action.value] = (history.queries[action.value] || 0) + 1;
                localStorage.setItem(STORAGE_KEYS.RECOMMENDATIONS, JSON.stringify(history));
            } catch (error) { console.warn('No se pudo actualizar el historial de recomendaciones', error); }
        }

        function getRecommendationHistory() {
            try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.RECOMMENDATIONS) || '{"views":{},"carts":{},"queries":{}}'); }
            catch { return { views: {}, carts: {}, queries: {} }; }
        }

        function normalizeRecommendationText(value) {
            return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        }

        function getRecommendedProducts(limit = 4) {
            const history = getRecommendationHistory();
            const viewedIds = Object.keys(history.views).map(Number);
            const viewedProducts = PRODUCTS_DATA.filter(product => viewedIds.includes(product.id));
            const queryText = Object.keys(history.queries).join(' ').toLowerCase();
            const anchor = viewedProducts[viewedProducts.length - 1];
            return [...PRODUCTS_DATA].sort((a, b) => {
                const score = product => {
                    let points = Number(history.views[product.id] || 0) * 5;
                    points += Number(history.carts?.[product.id] || 0) * 9;
                    if (anchor && product.collection === anchor.collection) points += 7;
                    if (anchor && product.material && anchor.material && product.material.split(' ').some(word => word.length > 4 && anchor.material.includes(word))) points += 5;
                    if (queryText && `${product.name} ${product.material} ${product.collection} ${product.category}`.toLowerCase().split(' ').some(word => queryText.includes(word) && word.length > 3)) points += 4;
                    if (userAccount?.preferences?.collection && product.collection === userAccount.preferences.collection) points += 5;
                    if (userAccount?.preferences?.gender && product.gender.toLowerCase() === userAccount.preferences.gender) points += 3;
                    if (userAccount?.preferences?.materials?.some(material => normalizeRecommendationText(product.material).includes(normalizeRecommendationText(material)))) points += 6;
                    if (userAccount?.preferences?.size && product.sizes.includes(userAccount.preferences.size)) points += 2;
                    if (userAccount?.preferences?.style && normalizeRecommendationText(product.line).includes(normalizeRecommendationText(userAccount.preferences.style))) points += 2;
                    if (product.isNew) points += 1;
                    return points;
                };
                return score(b) - score(a);
            }).filter(product => !anchor || product.id !== anchor.id).slice(0, limit);
        }

        function renderRecommendations() {
            const container = document.getElementById('recommendationsPanel');
            if (!container) return;
            const recommendations = getRecommendedProducts();
            container.innerHTML = recommendations.map(product => `<article class="recommendation-card" onclick="goToProduct(${product.id})" tabindex="0" role="link"><div class="recommendation-image"><img src="${product.img}" alt="${product.name}" loading="lazy"></div><div><span>${product.collection} · ${product.material}</span><h3>${product.name}</h3><strong>${formatPrice(product.price)}</strong></div></article>`).join('');
        }

        let productPageQuantity = 1;

        function getProductFromUrl() {
            const id = new URLSearchParams(window.location.search).get('id');
            return PRODUCTS_DATA.find(product => product.id === Number(id));
        }

        function initProductPage() {
            const detail = document.getElementById('productDetail');
            if (!detail) return;
            const product = getProductFromUrl();
            if (!product) {
                detail.innerHTML = '<section class="product-not-found"><span class="section-eyebrow">404 / Producto</span><h1>No encontramos esta pieza.</h1><p>Puede que haya cambiado de colección.</p><a class="checkout-submit" href="./catalogo.html">Volver al catálogo </a></section>';
                return;
            }
            recordRecommendationAction({ type: 'view', productId: product.id });
            productPageQuantity = 1;
            document.title = `${product.name} | Anthros`;
            const originalPrice = product.originalPrice ? `<span class="product-detail-original">${formatPrice(product.originalPrice)}</span><span class="product-detail-discount">-${product.discount}%</span>` : '';
            const sizes = (product.sizes || ['S', 'M', 'L']).map((size, index) => `<button type="button" class="detail-size ${index === 1 ? 'selected' : ''}" onclick="selectProductSize(this)">${size}</button>`).join('');
            detail.innerHTML = `
                <nav class="product-breadcrumb" aria-label="Migas de pan"><a href="./index.html">Inicio</a><span>/</span><a href="./catalogo.html">Colección</a><span>/</span><strong>${product.name}</strong></nav>
                <section class="product-detail-shell">
                    <div class="product-detail-visual"><span class="product-detail-collection">${product.collection} / ${product.year}</span><img src="${product.img}" alt="${product.name}" fetchpriority="high"><span class="product-detail-index">0${product.id}  ${product.line}</span></div>
                    <div class="product-detail-copy"><p class="product-detail-category">${product.gender} · ${product.line}${product.isNew ? ' · NUEVO' : ''}</p><h1>${product.name}</h1><div class="product-detail-rating"><span>${''.repeat(product.rating)}${''.repeat(5 - product.rating)}</span><small>${product.reviews} reseñas verificadas</small></div><p class="product-detail-description">${product.desc}</p>
                        <div class="product-detail-price"><strong>${formatPrice(product.price)}</strong>${originalPrice}</div>
                        <div class="product-detail-data"><div><span>Material</span><strong>${product.material}</strong></div><div><span>Color disponible</span><strong>${product.colors.join(' · ')}</strong></div><div><span>Envío</span><strong>${product.shipping}</strong></div><div><span>Cuidado</span><strong>${product.care}</strong></div></div>
                        <div class="detail-choice"><span>Talla</span><div class="detail-sizes">${sizes}</div></div>
                        <div class="detail-buy-row"><div class="detail-quantity"><button type="button" onclick="changeProductQuantity(-1)" aria-label="Restar cantidad"></button><strong id="productQuantity">1</strong><button type="button" onclick="changeProductQuantity(1)" aria-label="Sumar cantidad">+</button></div><button type="button" class="detail-add-button" onclick="addProductFromPage(${product.id})">Añadir al carrito <span></span></button></div>
                        <div class="detail-service"><span></span><p><strong>Compra con calma.</strong><br>14 días para cambios y devoluciones. Revisa nuestra <a href="./garantias.html">política de garantías</a>.</p></div>
                    </div>
                </section>`;
            renderProductRecommendations(product.id);
        }

        function selectProductSize(button) {
            button.parentElement.querySelectorAll('.detail-size').forEach(size => size.classList.remove('selected'));
            button.classList.add('selected');
        }

        function changeProductQuantity(delta) {
            productPageQuantity = Math.max(1, productPageQuantity + delta);
            const output = document.getElementById('productQuantity');
            if (output) output.textContent = productPageQuantity;
        }

        function addProductFromPage(productId) {
            const product = PRODUCTS_DATA.find(item => item.id === Number(productId));
            const selectedSize = document.querySelector('.detail-size.selected')?.textContent.trim() || product?.sizes?.[1] || 'M';
            if (!product) return;
            for (let index = 0; index < productPageQuantity; index++) addToCart({ id: product.id, name: product.name, price: product.price, img: product.img, category: product.gender, originalPrice: product.originalPrice || undefined, _forcedSize: selectedSize });
            showToast(`${productPageQuantity} × ${product.name} añadido al carrito`, 'success');
        }

        function renderProductRecommendations(currentId) {
            const rail = document.getElementById('productRecommendations');
            if (!rail) return;
            const products = getRecommendedProducts(5).filter(product => product.id !== Number(currentId));
            rail.innerHTML = products.map(product => `<article class="product-rail-card" onclick="goToProduct(${product.id})" tabindex="0" role="link"><div class="product-rail-image"><img src="${product.img}" alt="${product.name}" loading="lazy"><span>${product.collection}</span></div><div class="product-rail-copy"><small>${product.material}</small><h3>${product.name}</h3><strong>${formatPrice(product.price)}</strong></div></article>`).join('');
        }

        function chooseAccountMethod(method) {
            const accountMethod = document.getElementById('accountMethod');
            const emailField = document.getElementById('accountEmailField');
            const phoneField = document.getElementById('accountPhoneField');
            if (!accountMethod || !emailField || !phoneField) return;
            accountMethod.value = method;
            emailField.hidden = method !== 'google';
            phoneField.hidden = method !== 'phone';
            document.getElementById('accountEmail').required = method === 'google';
            document.getElementById('accountPhone').required = method === 'phone';
            document.querySelectorAll('.account-method').forEach(button => button.classList.toggle('active', button.dataset.method === method));
        }

        function initAccountPage() {
            loadUserAccount();
            if (userAccount) showAccountSettings();
            chooseAccountMethod(document.getElementById('accountMethod')?.value || 'google');
        }

        function saveAccount(event) {
            event.preventDefault();
            const method = document.getElementById('accountMethod')?.value || 'google';
            const name = document.getElementById('accountName')?.value.trim();
            const email = document.getElementById('accountEmail')?.value.trim().toLowerCase();
            const phone = document.getElementById('accountPhone')?.value.trim();
            if (!name || (method === 'google' && !validateEmail(email)) || (method === 'phone' && !/^\+?[0-9\s()-]{7,}$/.test(phone))) {
                showToast('Revisa los datos de tu cuenta', 'error');
                return;
            }
            userAccount = { name, email: method === 'google' ? email : '', phone: method === 'phone' ? phone : '', provider: method, createdAt: userAccount?.createdAt || new Date().toISOString(), preferences: userAccount?.preferences || {} };
            saveUserAccount();
            showAccountSettings();
            showToast(method === 'google' ? 'Cuenta de Google vinculada localmente' : 'Cuenta creada con tu teléfono', 'success');
        }

        function showAccountSettings() {
            const accountCard = document.getElementById('accountCard');
            const settings = document.getElementById('accountSettings');
            if (accountCard) accountCard.classList.add('account-card-saved');
            if (settings) settings.hidden = false;
            const nameInput = document.getElementById('accountName');
            if (nameInput && userAccount) nameInput.value = userAccount.name || '';
            const preferences = userAccount?.preferences || {};
            ['profileCity', 'profileAge', 'profileGender', 'profileSize', 'profileStyle', 'profileFrequency'].forEach(id => { const field = document.getElementById(id); const key = id.replace('profile', '').toLowerCase(); if (field && preferences[key]) field.value = preferences[key]; });
            document.querySelectorAll('#materialChoices input').forEach(input => { input.checked = (preferences.materials || []).includes(input.value); });
        }

        function saveAccountPreferences(event) {
            event.preventDefault();
            if (!userAccount) return showToast('Primero crea tu cuenta', 'error');
            const materials = Array.from(document.querySelectorAll('#materialChoices input:checked')).slice(0, 3).map(input => input.value);
            userAccount.preferences = { city: document.getElementById('profileCity')?.value || '', age: document.getElementById('profileAge')?.value || '', gender: document.getElementById('profileGender')?.value || 'unisex', size: document.getElementById('profileSize')?.value || '', materials, style: document.getElementById('profileStyle')?.value || 'atemporal', frequency: document.getElementById('profileFrequency')?.value || 'ocasional' };
            saveUserAccount();
            showToast('Preferencias guardadas. Ajustamos tus recomendaciones', 'success');
        }

        function resetAccount() {
            userAccount = null;
            if (soportaStorage()) localStorage.removeItem(STORAGE_KEYS.ACCOUNT);
            window.location.reload();
        }

        function getEmptyCartProducts() {
            const offers = PRODUCTS_DATA.filter(product => product.discount > 0).sort((a, b) => b.discount - a.discount);
            const bestSellers = PRODUCTS_DATA.filter(product => !offers.includes(product)).sort((a, b) => (b.reviews || 0) - (a.reviews || 0));
            return [...offers, ...bestSellers].slice(0, 6);
        }

        function renderEmptyCartCarousel() {
            const carousel = document.getElementById('emptyCartRecommendations');
            if (!carousel) return;
            const products = getEmptyCartProducts();
            if (!products.length) return;
            const product = products[_emptyCartSlide % products.length];
            const label = product.discount > 0 ? `Oferta / ${product.discount}% menos` : `Más vendido / ${product.reviews} reseñas`;
            carousel.innerHTML = `<div class="empty-cart-carousel-heading"><span class="section-eyebrow">Una pista para empezar</span><h2 id="emptyCartCarouselTitle">Descubre algo que pueda gustarte</h2></div><article class="empty-cart-slide"><div class="empty-cart-slide-image"><img src="${product.img}" alt="${product.name}"><span>${label}</span></div><div class="empty-cart-slide-copy"><small>${product.collection} · ${product.material}</small><h3>${product.name}</h3><p>${product.desc}</p><div><strong>${formatPrice(product.price)}</strong>${product.originalPrice ? `<del>${formatPrice(product.originalPrice)}</del>` : ''}</div><button type="button" class="qv-btn-primary" onclick="goToProduct(${product.id})">Ver producto </button></div></article><div class="empty-cart-carousel-controls"><button type="button" onclick="changeEmptyCartSlide(-1)" aria-label="Recomendación anterior"></button><span>${String((_emptyCartSlide % products.length) + 1).padStart(2, '0')} / ${String(products.length).padStart(2, '0')}</span><button type="button" onclick="changeEmptyCartSlide(1)" aria-label="Siguiente recomendación"></button></div>`;
            restartEmptyCartCarousel(products.length);
        }

        function changeEmptyCartSlide(direction) {
            const products = getEmptyCartProducts();
            if (!products.length) return;
            _emptyCartSlide = (_emptyCartSlide + direction + products.length) % products.length;
            renderEmptyCartCarousel();
        }

        function restartEmptyCartCarousel(totalSlides) {
            clearInterval(_emptyCartTimer);
            _emptyCartTimer = setInterval(() => {
                _emptyCartSlide = (_emptyCartSlide + 1) % totalSlides;
                renderEmptyCartCarousel();
            }, 3000);
        }

        /* 10) COUNTDOWN TIMER OFERTA */
        function initCountdownTimer() {
            if (!document.getElementById('cdDays')) return;
            const stored = localStorage.getItem('anthros_countdown_end_v1');
            let target;
            if (stored) { target = new Date(Number(stored)); if (target < new Date()) target = null; }
            if (!target) { target = new Date(Date.now() + (47 * 60 * 60 * 1000) + (55 * 60 * 1000)); localStorage.setItem('anthros_countdown_end_v1', String(target.getTime())); }
            _countdownTarget = target;
            const tick = () => {
                const now = new Date();
                let diff = Math.max(0, target - now);
                const d = Math.floor(diff / (24 * 60 * 60 * 1000)); diff -= d * 24 * 60 * 60 * 1000;
                const h = Math.floor(diff / (60 * 60 * 1000)); diff -= h * 60 * 60 * 1000;
                const m = Math.floor(diff / (60 * 1000)); diff -= m * 60 * 1000;
                const s = Math.floor(diff / 1000);
                const pad = n => String(n).padStart(2, '0');
                ['cdDays','cdHours','cdMinutes','cdSeconds'].forEach((id, i) => {
                    const el = document.getElementById(id);
                    if (!el) return;
                    const val = [d, h, m, s][i];
                    el.textContent = pad(val);
                    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
                });
            };
            tick(); setInterval(tick, 1000);
        }

        /* 11) CARRUSEL TESTIMONIOS */
        function initTestimonialsCarousel() {
            const track = document.getElementById('testimonialsTrack');
            const dotsContainer = document.getElementById('testimonialDots');
            if (!track) return;
            const slides = track.querySelectorAll('.testimonial-slide');
            if (!slides.length) return;
            if (dotsContainer) {
                dotsContainer.innerHTML = '';
                slides.forEach((_, i) => {
                    const dot = document.createElement('button');
                    dot.className = 'testimonial-dot' + (i === 0 ? ' active' : '');
                    dot.setAttribute('aria-label', `Ir al testimonio ${i + 1}`);
                    dot.onclick = () => goToTestimonial(i);
                    dotsContainer.appendChild(dot);
                });
            }
            const applyTransform = () => {
                const pct = (_testimonialIndex % slides.length) * 100;
                track.style.transform = `translateX(-${pct}%)`;
                const dots = dotsContainer?.querySelectorAll('.testimonial-dot');
                dots?.forEach((d, i) => d.classList.toggle('active', i === (_testimonialIndex % slides.length)));
            };
            applyTransform();
            if (_testimonialAutoTimer) clearInterval(_testimonialAutoTimer);
            _testimonialAutoTimer = setInterval(() => nextTestimonial(true), 7500);
            slides.forEach(s => {
                s.addEventListener('mouseenter', () => { if (_testimonialAutoTimer) clearInterval(_testimonialAutoTimer); });
                s.addEventListener('mouseleave', () => { _testimonialAutoTimer = setInterval(() => nextTestimonial(true), 7500); });
            });
            window._testimonialApplyTransform = applyTransform;
            window._testimonialSlidesLen = slides.length;
        }
        function goToTestimonial(idx) { _testimonialIndex = idx; window._testimonialApplyTransform?.(); }
        function prevTestimonial() {
            const n = window._testimonialSlidesLen || 4;
            _testimonialIndex = (_testimonialIndex - 1 + n) % n;
            window._testimonialApplyTransform?.();
        }
        function nextTestimonial(fromAuto = false) {
            const n = window._testimonialSlidesLen || 4;
            _testimonialIndex = (_testimonialIndex + 1) % n;
            window._testimonialApplyTransform?.();
            if (!fromAuto && _testimonialAutoTimer) { clearInterval(_testimonialAutoTimer); _testimonialAutoTimer = setInterval(() => nextTestimonial(true), 7500); }
        }

        /* 12) FAVORITOS SPA CONTADOR */
        function updateFavoritesCount() {
            const n = favorites.length;
            document.querySelectorAll('.favorites-count').forEach(badge => {
                badge.style.display = n > 0 ? 'inline-flex' : 'none';
                badge.textContent = String(n);
            });
        }

        /* 13) FAVORITOS SPA RENDER */
        function renderFavoritesSPA() {
            updateFavoritesCount();
            const wrap = document.getElementById('favoritesContent');
            if (!wrap) return;
            if (favorites.length === 0) {
                wrap.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon"></div>
                        <h3>Aún no tienes favoritos</h3>
                        <p>Explora nuestra colección y guarda tus prendas preferidas para después.</p>
                        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
                            <button class="qv-btn-primary" style="min-width:200px;" onclick="navigateTo('home','productos')"> Explorar Colección</button>
                            <button class="qv-btn-secondary" style="min-width:200px;" onclick="navigateTo('home','howtobuy')">¿Cómo comprar?</button>
                        </div>
                    </div>`;
                return;
            }
            const prods = favorites.map(id => PRODUCTS_DATA.find(p => p.id === id)).filter(Boolean);
            wrap.innerHTML = `
                <p style="color:var(--text-muted);margin-bottom:var(--space-5);font-size:var(--fs-sm);">Tienes <strong style="color:var(--red-primary);">${prods.length}</strong> ${prods.length === 1 ? 'prenda' : 'prendas'} guardada(s) como favorita(s).</p>
                <div class="products-grid" id="favGrid">
                    ${prods.map(prod => {
                        const badge = prod.badge ? `<span class="product-badge ${prod.badge.includes('%') ? 'discount' : ''}">${prod.badge}</span>` : '';
                        const origHtml = prod.originalPrice ? `<span class="product-price-original">${formatPrice(prod.originalPrice)}</span>` : '';
                        const sizesHtml = (prod.sizes || ['S','M','L']).map(s => `<div class="size-option" onclick="selectSize(this)">${s}</div>`).join('');
                        const stars = `Calificación ${prod.rating || 0}/5`;
                        return `
                        <article class="product-card reveal visible" data-category="${prod.category}" data-id="${prod.id}" data-price="${prod.price}" data-discount="${prod.discount}" data-isnew="${prod.isNew}">
                            ${badge}
                            <button class="product-fav active" onclick="removeFromFavSpa(${prod.id})" aria-label="Quitar de favoritos"></button>
                            <button class="quick-view-btn" style="opacity:1;transform:translateY(0);" onclick="goToProduct(${prod.id})">Ver producto </button>
                            <div class="product-image"><img src="${prod.img}" alt="${prod.name}" loading="lazy"></div>
                            <div class="product-info">
                                <div class="product-category">${prod.gender} · ${prod.line}</div>
                                <h3 class="product-name">${prod.name}</h3>
                                <div class="product-rating"><div class="rating-stars">${stars}</div><div class="rating-count">(${prod.reviews || 0})</div></div>
                                <p class="product-description">${prod.desc}</p>
                                <div class="product-size">${sizesHtml}</div>
                                <div class="product-footer">
                                    <div class="price-container">${origHtml}<span class="product-price">${formatPrice(prod.price)}</span></div>
                                    <button class="add-to-cart-btn" onclick='addToCart({id:${prod.id},name:${JSON.stringify(prod.name)},price:${prod.price},img:"${prod.img}",category:"${prod.gender}"${prod.originalPrice ? `,originalPrice:${prod.originalPrice}` : ''}})' aria-label="Añadir al carrito">+</button>
                                </div>
                            </div>
                        </article>`;
                    }).join('')}
                </div>
            `;
        }
        function removeFromFavSpa(id) {
            const i = favorites.indexOf(id);
            if (i >= 0) favorites.splice(i, 1);
            saveFavorites();
            sincronizarFavoritosUI();
            const p = PRODUCTS_DATA.find(x => x.id === id);
            showToast(` ${p?.name || 'Producto'} eliminado de favoritos`, 'info');
            renderFavoritesSPA();
        }

        /* 14) HISTORIAL PEDIDOS SPA */
        function renderOrdersSPA() {
            const wrap = document.getElementById('ordersContent');
            if (!wrap) return;
            const history = getOrderHistory();
            if (history.length === 0) {
                wrap.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon"></div>
                        <h3>No tienes pedidos aún</h3>
                        <p>Tu historial de compras aparecerá aquí. ¡Anímate a hacer tu primera compra Anthros!</p>
                        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
                            <button class="qv-btn-primary" style="min-width:200px;" onclick="navigateTo('home','productos')"> Ver Productos</button>
                            <button class="qv-btn-secondary" style="min-width:200px;" onclick="showFAQModal()"> Ayuda</button>
                        </div>
                    </div>`;
                return;
            }
            const fmtDate = iso => {
                try {
                    const d = new Date(iso);
                    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                } catch { return iso; }
            };
            wrap.innerHTML = `
                <p style="color:var(--text-muted);margin-bottom:var(--space-5);font-size:var(--fs-sm);">Total <strong style="color:var(--red-primary);">${history.length}</strong> ${history.length === 1 ? 'pedido' : 'pedidos'} registrado(s).</p>
                <div>
                    ${history.map(o => {
                        const chips = (o.items || []).slice(0, 4).map(it => `<span class="history-chip">${it.qty}× ${String(it.name || '').slice(0, 22)}</span>`).join('');
                        const extra = (o.items?.length > 4) ? `<span class="history-chip">+${o.items.length - 4} más</span>` : '';
                        return `
                        <div class="history-item" onclick="showOrderDetail('${o.id}')">
                            <div class="history-header">
                                <span class="history-id">#${o.id.slice(-8)}</span>
                                <span class="history-date"> ${fmtDate(o.fecha)}</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:var(--space-3);flex-wrap:wrap;">
                                <div style="flex:1;">
                                    <div class="history-items-preview">${chips}${extra}</div>
                                    <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
                                        <span class="history-chip" style="background:rgba(230,57,70,0.08);color:var(--red-primary);">${o.items?.length || 0} artículo(s)</span>
                                        ${o.appliedPromo ? `<span class="history-chip" style="background:rgba(120,0,0,0.1);color:var(--red-deep);"> Promo ${o.appliedPromo}% OFF</span>` : ''}
                                        ${o.desglose?.envioGratisAplicado || o.desglose?.envio === 0 ? `<span class="history-chip" style="background:rgba(34,197,94,0.12);color:var(--success);"> Envío Gratis</span>` : ''}
                                    </div>
                                </div>
                                <span class="history-total">${formatPrice(o.total || 0)}</span>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            `;
        }
        function showOrderDetail(orderId) {
            const o = getOrderHistory().find(x => x.id === orderId);
            if (!o) return;
            const itemsHtml = (o.items || []).map(it => `
                <div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px dashed rgba(214,140,69,0.25);">
                    <div style="width:54px;height:54px;border-radius:var(--radius-sm);overflow:hidden;background:#fff;flex-shrink:0;"><img src="${it.img}" style="width:100%;height:100%;object-fit:cover;" alt=""></div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:700;color:var(--red-deep);font-size:var(--fs-sm);">${it.name}</div>
                        <div style="font-size:var(--fs-xs);color:var(--text-light);">${it.qty} × ${it.size || ''} · ${formatPrice(it.price)} c/u</div>
                    </div>
                    <div style="font-weight:800;color:var(--red-primary);font-size:var(--fs-sm);">${formatPrice(it.price * it.qty)}</div>
                </div>
            `).join('');
            const d = o.desglose || {};
            showGenericModal(` Pedido #${o.id.slice(-8)}`, `
                <p style="font-size:var(--fs-xs);color:var(--text-light);margin-bottom:14px;">${new Date(o.fecha).toLocaleString('es-CO')}</p>
                ${itemsHtml}
                <div style="margin-top:14px;padding:14px;border-radius:var(--radius-md);background:rgba(255,245,236,0.7);">
                    <div style="display:flex;justify-content:space-between;padding:3px 0;"><span style="color:var(--text-muted);font-size:var(--fs-sm);">Subtotal</span><span style="font-weight:700;">${formatPrice(d.subtotal || 0)}</span></div>
                    ${d.promoDiscount > 0 ? `<div style="display:flex;justify-content:space-between;padding:3px 0;color:var(--success);"><span style="font-size:var(--fs-sm);"> Promo ${o.appliedPromo}%</span><span style="font-weight:700;"> ${formatPrice(d.promoDiscount)}</span></div>` : ''}
                    ${d.bonoUmbral100k || d.umbralDisc ? `<div style="display:flex;justify-content:space-between;padding:3px 0;color:var(--success);"><span style="font-size:var(--fs-sm);"> Bono $100k</span><span style="font-weight:700;"> ${formatPrice(d.bonoUmbral100k || d.umbralDisc || 0)}</span></div>` : ''}
                    <div style="display:flex;justify-content:space-between;padding:3px 0;"><span style="color:var(--text-muted);font-size:var(--fs-sm);">Envío</span><span style="font-weight:700;">${(d.envio === 0 || d.envioGratisAplicado) ? ' Gratis' : formatPrice(d.envio || 0)}</span></div>
                    <div style="border-top:2px solid var(--orange-warm);margin-top:8px;padding-top:8px;display:flex;justify-content:space-between;"><span style="font-weight:800;font-size:var(--fs-md);color:var(--red-deep);">Total</span><span style="font-weight:900;font-size:var(--fs-lg);color:var(--red-primary);">${formatPrice(o.total || 0)}</span></div>
                </div>
                <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;">
                    <button class="qv-btn-secondary" style="flex:1;min-width:160px;" onclick="closeGenericModal();navigateTo('favorites')"> Mis Favoritos</button>
                    <button class="qv-btn-primary" style="flex:1;min-width:160px;" onclick="closeGenericModal();navigateTo('home','productos')"> Comprar de nuevo</button>
                </div>
            `);
        }

        /* 15) BENEFITS PROGRESS (en el carrito) */
        function renderBenefitsProgress() {
            const subtotal = calcularSubtotalCarrito();
            const totalQty = calcularCantidadCarrito();
            const envioCantOk = totalQty > SHIPPING_CONFIG.UMBRAL_GRATIS_CANTIDAD;
            const envioMontoOk = subtotal >= SHIPPING_CONFIG.UMBRAL_GRATIS_MONTO;
            const bono100kOk = subtotal > CONFIG_TIENDA ? true : subtotal > 100000;
            const pctEnvioQty = Math.min(100, Math.round((totalQty / (SHIPPING_CONFIG.UMBRAL_GRATIS_CANTIDAD + 1)) * 100));
            const pctEnvioMonto = Math.min(100, Math.round((subtotal / SHIPPING_CONFIG.UMBRAL_GRATIS_MONTO) * 100));
            const pctBono = Math.min(100, Math.round((subtotal / 100001) * 100));
            const overallPct = Math.max(pctEnvioQty, pctEnvioMonto, pctBono);
            const prox = calcularProximosBeneficios ? calcularProximosBeneficios(cart, appliedPromo || 0) : null;
            const nextMsg = prox && !prox.tieneBono100k
                ? `Faltan $${formatearCOPConSimbolo ? formatearCOPConSimbolo(prox.paraBono100k) : formatPrice(prox.paraBono100k)} para bono 10% `
                : (prox && !prox.tieneEnvioGratisPorCantidad && !prox.tieneEnvioGratisPorMonto
                    ? `Compra ${prox.paraEnvioGratisCantidad} producto(s) más para envío gratis `
                    : bono100kOk ? ' ¡Todos los beneficios activos!' : 'Sigue añadiendo productos para obtener beneficios');
            return `
                <div class="benefits-progress">
                    <div class="benefits-item ${envioCantOk || envioMontoOk ? 'done' : ''}">
                        <span>${envioCantOk || envioMontoOk ? '' : ''} Envío gratis</span>
                        <span style="font-size:0.7rem;">${envioCantOk ? '5+ prod ' : (envioMontoOk ? '>$150k ' : `${totalQty}/${SHIPPING_CONFIG.UMBRAL_GRATIS_CANTIDAD + 1}`)}</span>
                    </div>
                    <div class="benefits-bar"><div class="benefits-bar-fill" style="width:${overallPct}%;"></div></div>
                    <div class="benefits-item ${bono100kOk ? 'done' : ''}">
                        <span>${bono100kOk ? '' : ''} Bono 10% > $100k</span>
                        <span style="font-size:0.7rem;">${bono100kOk ? 'Activo ' : formatPrice(subtotal) + ' / $100.001'}</span>
                    </div>
                    <div class="benefits-next">${nextMsg}</div>
                </div>
            `;
        }

        function refreshCartViews() {
            updateCart();
            if (document.getElementById('fullCartItems')) renderFullCartPage();
        }

        function removeFromCart(index) {
            const itemIndex = Number(index);
            if (!Number.isInteger(itemIndex) || !cart[itemIndex]) return;
            cart.splice(itemIndex, 1);
            cart = normalizeCart(cart);
            saveCart();
            refreshCartViews();
            showToast('Producto eliminado', 'info');
        }

        function changeQty(index, delta) {
            const itemIndex = Number(index);
            const amount = Number(delta);
            const item = cart[itemIndex];
            if (!Number.isInteger(itemIndex) || !item || !Number.isFinite(amount) || amount === 0) return;
            item.qty = Math.min(CART_LIMITS.MAX_QTY_PER_ITEM, Math.max(0, item.qty + amount));
            if (item.qty === 0) cart.splice(itemIndex, 1);
            cart = normalizeCart(cart);
            saveCart();
            refreshCartViews();
        }

        /* 16) ADD TO CART CON TALLA SELECCIONADA */
        function addToCart(product) {
            const card = typeof event !== 'undefined' && event?.target?.closest ? event.target.closest('.product-card') : null;
            let selectedSize = product._forcedSize || 'M';
            if (card && !product._forcedSize) {
                const sizeEl = card.querySelector('.size-option.selected');
                if (sizeEl) selectedSize = sizeEl.textContent.trim();
                else {
                    const firstSize = card.querySelector('.size-option');
                    if (firstSize) { firstSize.classList.add('selected'); selectedSize = firstSize.textContent.trim(); }
                }
                card.classList.remove('just-added'); void card.offsetWidth; card.classList.add('just-added');
                setTimeout(() => card.classList.remove('just-added'), 500);
            }
            const payload = getProductPayload(product, selectedSize, product.qty || 1);
            if (!payload) return showToast('Producto no disponible', 'error');
            const existing = cart.find(i => i.id === payload.id && i.size === payload.size);
            if (existing) existing.qty = Math.min(CART_LIMITS.MAX_QTY_PER_ITEM, existing.qty + payload.qty);
            else if (calcularCantidadCarrito() + payload.qty <= CART_LIMITS.MAX_TOTAL_ITEMS) cart.push(payload);
            else return showToast('El carrito alcanzó su límite de unidades', 'error');
            cart = normalizeCart(cart);
            saveCart();
            refreshCartViews();
            showToast(`${product.name} (${selectedSize}) añadido al carrito`, 'success');
        }

        /* 17) CARRITO CON BENEFICIOS */
        function updateCart() {
            const itemsEl = document.getElementById('cartItems');
            const emptyEl = document.getElementById('cartEmpty');
            const summaryEl = document.getElementById('cartSummary');
            const countEl = document.getElementById('cartCount');
            const checkoutBtn = document.getElementById('checkoutBtn');
            if (!itemsEl || !summaryEl || !countEl) return;
            const totalQty = cart.reduce((s, i) => s + i.qty, 0);
            document.querySelectorAll('.cart-count, #navCartCount').forEach(badge => {
                badge.textContent = totalQty;
                badge.classList.remove('pop'); void badge.offsetWidth;
                if (totalQty > 0) badge.classList.add('pop');
            });
            try { updateFavoritesCount(); } catch(e) {}

            if (cart.length === 0) {
                itemsEl.innerHTML = '';
                summaryEl.innerHTML = '';
                if (emptyEl) {
                    summaryEl.appendChild(emptyEl);
                    emptyEl.style.display = 'block';
                }
                if (checkoutBtn) checkoutBtn.style.display = 'none';
                return;
            }
            itemsEl.innerHTML = cart.map((item, idx) => `
                <div class="cart-item">
                    <div class="cart-item-img"><img src="${escapeHTML(item.img)}" alt="${escapeHTML(item.name)}" loading="lazy"></div>
                    <div class="cart-item-details">
                        <div class="cart-item-name">${escapeHTML(item.name)}</div>
                        <div class="cart-item-size">Talla: ${escapeHTML(item.size)} · ${escapeHTML(item.gender || item.category)}</div>
                        <div class="cart-item-price">${formatPrice(item.price * item.qty)}</div>
                        <div class="cart-item-qty">
                            <button class="qty-btn" onclick="changeQty(${idx}, -1)" aria-label="Restar"></button>
                            <span class="qty-value">${item.qty}</span>
                            <button class="qty-btn" onclick="changeQty(${idx}, 1)" aria-label="Sumar">+</button>
                        </div>
                    </div>
                    <button class="cart-remove" onclick="removeFromCart(${idx})" aria-label="Eliminar"></button>
                </div>
            `).join('');

            const breakdown = calcularDesglosePedidoCompleto();

            summaryEl.innerHTML = `
                ${renderBenefitsProgress()}
                <div class="summary-row">
                    <span>Subtotal (${breakdown.totalQty} ${breakdown.totalQty === 1 ? 'producto' : 'productos'})</span>
                    <span>${formatPrice(breakdown.subtotal)}</span>
                </div>
                ${breakdown.promoDiscount ? `
                <div class="summary-row discount-row">
                    <span>Código (${breakdown.appliedPromoPct}%)</span>
                    <span> ${formatPrice(breakdown.promoDiscount)}</span>
                </div>` : ''}
                ${breakdown.umbralDisc > 0 ? `
                <div class="summary-row discount-row">
                    <span> Bono > $100k</span>
                    <span> ${formatPrice(breakdown.umbralDisc)}</span>
                </div>` : ''}
                <div class="summary-row">
                    <span>Envío ${breakdown.shipping === 0 ? '<span style="color:var(--success);">· Gratis </span>' : ''}</span>
                    <span>${breakdown.shipping === 0 ? formatPrice(0) : formatPrice(breakdown.shipping)}</span>
                </div>
                <div class="summary-row total-row">
                    <span>Total</span>
                    <span>${formatPrice(breakdown.total)}</span>
                </div>
            `;
            if (checkoutBtn) checkoutBtn.style.display = 'block';
        }

        /* FUNCIONES FULL PAGE (MPA) */
        function renderFavoritesFullPage() {
            const wrap = document.getElementById('favoritesContent');
            if (!wrap) { if (typeof renderFavoritesSPA === 'function') return renderFavoritesSPA(); }
            if (favorites.length === 0) {
                wrap.innerHTML = `<div class="empty-state"><div class="empty-state-icon"></div><h3>Aún no tienes favoritos</h3><p>Explora nuestra colección y guarda tus prendas preferidas para después.</p><div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;"><a href="catalogo.html" class="qv-btn-primary" style="min-width:200px;text-align:center;display:inline-block;text-decoration:none;"> Explorar Colección</a><a href="index.html#howtobuy" class="qv-btn-secondary" style="min-width:200px;text-align:center;display:inline-block;text-decoration:none;">¿Cómo comprar?</a></div></div>`;
                return;
            }
            const prods = favorites.map(id => PRODUCTS_DATA.find(p => p.id === id)).filter(Boolean);
            wrap.innerHTML = `<p style="color:var(--text-muted);margin-bottom:var(--space-5);font-size:var(--fs-sm);">Tienes <strong style="color:var(--red-primary);">${prods.length}</strong> ${prods.length === 1 ? 'prenda' : 'prendas'} guardada(s) como favorita(s).</p><div class="products-grid" id="favGrid">${prods.map(prod => {
                const badge = prod.badge ? `<span class="product-badge ${prod.badge.includes('%') ? 'discount' : ''}">${prod.badge}</span>` : '';
                const origHtml = prod.originalPrice ? `<span class="product-price-original">${formatPrice(prod.originalPrice)}</span>` : '';
                const sizesHtml = (prod.sizes || ['S','M','L']).map(s => `<div class="size-option" onclick="selectSize(this)">${s}</div>`).join('');
                const stars = `Calificación ${prod.rating || 0}/5`;
                return `<article class="product-card reveal visible" data-category="${prod.category}" data-id="${prod.id}" data-price="${prod.price}" data-discount="${prod.discount}" data-isnew="${prod.isNew}">${badge}<button class="product-fav active" onclick="removeFromFavFull(${prod.id})" aria-label="Quitar de favoritos"></button><button class="quick-view-btn" style="opacity:1;transform:translateY(0);" onclick="goToProduct(${prod.id})">Ver producto </button><div class="product-image" onclick="goToProduct(${prod.id})"><img src="${prod.img}" alt="${prod.name}" loading="lazy"></div><div class="product-info"><div class="product-category">${prod.gender} · ${prod.line}</div><h3 class="product-name" onclick="goToProduct(${prod.id})">${prod.name}</h3><div class="product-rating"><div class="rating-stars">${stars}</div><div class="rating-count">(${prod.reviews || 0})</div></div><p class="product-description">${prod.desc}</p><div class="product-size">${sizesHtml}</div><div class="product-footer"><div class="price-container">${origHtml}<span class="product-price">${formatPrice(prod.price)}</span></div><button class="add-to-cart-btn" onclick='addToCart({id:${prod.id},name:${JSON.stringify(prod.name)},price:${prod.price},img:"${prod.img}",category:"${prod.gender}"${prod.originalPrice ? `,originalPrice:${prod.originalPrice}` : ''}})' aria-label="Añadir al carrito">+</button></div></div></article>`;
            }).join('')}</div>`;
            sincronizarFavoritosUI();
        }
        function removeFromFavFull(id) {
            const i = favorites.indexOf(id);
            if (i >= 0) favorites.splice(i, 1);
            saveFavorites(); sincronizarFavoritosUI();
            const p = PRODUCTS_DATA.find(x => x.id === id);
            showToast(` ${p?.name || 'Producto'} eliminado de favoritos`, 'info');
            renderFavoritesFullPage();
        }
        function renderOrdersFullPage() {
            if (typeof renderOrdersSPA === 'function') {
                const orig = document.getElementById('ordersContent');
                if (!orig) {
                    const wrap = document.getElementById('pedidosContent');
                    if (wrap) {
                        const existingContent = document.getElementById('ordersContent');
                        if (!existingContent) { wrap.setAttribute('id', 'ordersContent'); }
                    }
                }
                return renderOrdersSPA();
            }
        }
        function renderFullCartPage() {
            const itemsContainer = document.getElementById('fullCartItems');
            const summaryContainer = document.getElementById('fullCartSummary');
            const emptyContainer = document.getElementById('fullCartEmpty');
            if (!itemsContainer && !summaryContainer) return;
            try {
                if (emptyContainer) emptyContainer.style.display = cart.length ? 'none' : 'block';
                if (cart.length === 0) renderEmptyCartCarousel();
                else clearInterval(_emptyCartTimer);
                if (typeof updateFullCartUI === 'function') return updateFullCartUI();
                if (typeof updateCart === 'function') {
                    updateCart();
                    const modalItems = document.getElementById('cartItems');
                    const modalSummary = document.getElementById('cartSummary');
                    if (itemsContainer && modalItems) itemsContainer.innerHTML = modalItems.innerHTML;
                    if (summaryContainer && modalSummary) {
                        summaryContainer.innerHTML = modalSummary.innerHTML;
                        const promoRow = `
                            <div style="margin:var(--space-4) 0;padding:var(--space-3);border-radius:var(--radius-md);background:rgba(255,245,236,0.6);">
                                <div style="font-weight:700;margin-bottom:var(--space-2);color:var(--red-deep);"> Código Promocional</div>
                                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                                    <input type="text" id="promoInputFull" placeholder="Ej: ANTHROS10" style="flex:1;min-width:140px;padding:10px 14px;border:2px solid rgba(214,140,69,0.25);border-radius:var(--radius-sm);font-size:var(--fs-sm);background:#fff;" />
                                    <button class="qv-btn-secondary" onclick="applyPromoFull()">Aplicar</button>
                                </div>
                                <div id="promoMsgFull" style="margin-top:8px;font-size:var(--fs-xs);color:var(--text-light);"></div>
                            </div>
                            <div style="margin-top:var(--space-4);display:flex;flex-direction:column;gap:10px;">
                                <button class="qv-btn-primary" style="width:100%;justify-content:center;padding:14px 20px;font-size:var(--fs-md);" onclick="checkout()"> Finalizar Compra</button>
                                <button class="qv-btn-secondary" style="width:100%;justify-content:center;padding:12px 18px;" onclick="navigateTo('catalogo')"> Seguir Comprando</button>
                            </div>`;
                        summaryContainer.insertAdjacentHTML('beforeend', promoRow);
                    }
                }
            } catch (e) { console.warn(e); }
        }
        function applyPromoFull() {
            const input = document.getElementById('promoInputFull');
            const msg = document.getElementById('promoMsgFull');
            const code = (input?.value || '').toUpperCase().trim();
            if (!code) { if (msg) msg.textContent = 'Escribe un código'; return; }
            const pct = PROMO_CODES[code];
            if (!pct) { if (msg) { msg.textContent = ' Código inválido. Prueba: ANTHROS10, BIENVENIDO, VERANO20'; msg.style.color = 'var(--red-primary)'; } return; }
            appliedPromo = pct; saveCart();
            if (msg) { msg.textContent = ` Código ${code} aplicado: ${pct}% OFF`; msg.style.color = 'var(--success)'; }
            showToast(` ${code}: ${pct}% OFF aplicado!`, 'success');
            if (typeof renderFullCartPage === 'function') renderFullCartPage();
        }

        /* =========================================================
           MÓDULO 8 · AUTO-EJECUCIÓN DE NUEVOS MÓDULOS
           ========================================================= */
        (function autoInitAllNewModules() {
            document.querySelectorAll('.theme-toggle').forEach(button => {
                if (!button.textContent.trim()) button.textContent = 'Tema';
            });
            document.querySelectorAll('.favorites-btn').forEach(button => {
                const count = button.querySelector('.favorites-count');
                if (count && !button.firstChild?.textContent?.trim()) button.insertBefore(document.createTextNode('Favoritos '), button.firstChild);
                if (!count && !button.textContent.trim()) button.textContent = 'Favoritos';
            });
            if (userPreferences.theme === 'dark') {
                document.documentElement.classList.add('theme-dark');
                const btn = document.getElementById('themeToggle');
                if (btn) btn.textContent = '';
                const mobileBtn = document.getElementById('mobileThemeToggle');
                if (mobileBtn) mobileBtn.textContent = 'Tema claro';
            }
            updateFavoritesCount();
            initTestimonialsCarousel();
            initHeroCarousel();
            sincronizarFavoritosUI();
            updateScrollProgress();
        })();

        (function autoRenderByPage() {
            const path = window.location.pathname.toLowerCase();
            const isPage = (name) => path.includes(name);
            try { sincronizarFavoritosUI(); } catch(e) {}
            try {
                if (isPage('catalogo')) {
                    if (typeof renderProductsFromData === 'function') renderProductsFromData(PRODUCTS_DATA);
                } else if (isPage('index.html') || path === '/' || path === '' || path.endsWith('/frontend/')) {
                    const featured = PRODUCTS_DATA.slice(0, 6);
                    if (typeof renderProductsFromData === 'function' && document.getElementById('productsGrid')) {
                        renderProductsFromData(featured);
                    }
                } else if (isPage('favoritos') || isPage('favorites')) {
                    if (typeof renderFavoritesFullPage === 'function') renderFavoritesFullPage();
                    else if (typeof renderFavoritesSPA === 'function') renderFavoritesSPA();
                } else if (isPage('pedidos') || isPage('orders')) {
                    if (typeof renderOrdersFullPage === 'function') renderOrdersFullPage();
                    else if (typeof renderOrdersSPA === 'function') renderOrdersSPA();
                } else if (isPage('carrito') || isPage('cart')) {
                    if (typeof renderFullCartPage === 'function') renderFullCartPage();
                }
            } catch (e) { console.warn('autoRenderByPage error', e); }
        })();

        updateCart();





