const API_URL = '/api/server';

let products = [];
let sales = [];
let currentUser = JSON.parse(sessionStorage.getItem('airsoft_logged_user')) || null;

const loginScreen = document.getElementById('login-screen');
const mainApp = document.getElementById('main-app');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const currentUserDisplay = document.getElementById('current-user-display');
const logoutBtn = document.getElementById('logout-btn');
const productForm = document.getElementById('product-form');
const saleForm = document.getElementById('sale-form');
const productTableBody = document.getElementById('product-table-body');
const saleProductSelect = document.getElementById('sale-product-id');
const saleFeedback = document.getElementById('sale-feedback');
const adminFormWrapper = document.getElementById('admin-form-wrapper');
const adminLockOverlay = document.getElementById('admin-lock-overlay');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const usernameInput = document.getElementById('login-username').value.trim();
    const passwordInput = document.getElementById('login-password').value;

    try {
        const response = await fetch(`${API_URL}?type=login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: usernameInput, password: passwordInput })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            currentUser = {
                username: usernameInput.toLowerCase(),
                role: result.role,
                displayName: result.displayName
            };
            sessionStorage.setItem('airsoft_logged_user', JSON.stringify(currentUser));
            loginError.classList.add('hidden');
            loginForm.reset();
            checkAuth();
        } else {
            loginError.innerText = `⚠️ ${result.error || 'Sikertelen belépés!'}`;
            loginError.classList.remove('hidden');
        }
    } catch (err) {
        loginError.innerText = '⚠️ Hálózati hiba a szerverrel való kommunikáció során.';
        loginError.classList.remove('hidden');
    }
});

logoutBtn.addEventListener('click', () => {
    currentUser = null;
    sessionStorage.removeItem('airsoft_logged_user');
    checkAuth();
});

function checkAuth() {
    if (currentUser) {
        loginScreen.classList.add('hidden');
        mainApp.classList.remove('hidden');
        currentUserDisplay.innerText = currentUser.displayName;
        
        if (currentUser.role === 'admin') {
            adminFormWrapper.classList.remove('hidden');
            adminLockOverlay.classList.add('hidden');
        } else {
            adminFormWrapper.classList.add('hidden');
            adminLockOverlay.classList.remove('hidden');
        }
        loadDataFromServer();
    } else {
        loginScreen.classList.remove('hidden');
        mainApp.classList.add('hidden');
    }
}

async function loadDataFromServer() {
    if (!currentUser) return;
    try {
        const resProducts = await fetch(`${API_URL}?type=products`);
        products = await resProducts.json();

        const resSales = await fetch(`${API_URL}?type=sales`);
        sales = await resSales.json();

        renderAll();
    } catch (err) {
        console.error("Hiba az adatok letöltésekor:", err);
    }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 }).format(amount);
}

productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser || currentUser.role !== 'admin') return;

    const newProduct = {
        id: 'PROD-' + Date.now(),
        sku: document.getElementById('p-sku').value.trim(),
        name: document.getElementById('p-name').value.trim(),
        category: document.getElementById('p-category').value,
        buyPrice: Number(document.getElementById('p-buy').value),
        sellPrice: Number(document.getElementById('p-sell').value),
        stock: Number(document.getElementById('p-stock').value),
        minStock: Number(document.getElementById('p-min').value)
    };

    try {
        await fetch(`${API_URL}?type=addProduct`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newProduct)
        });
        productForm.reset();
        loadDataFromServer();
    } catch (err) {
        alert("Szerver hiba.");
    }
});

saleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pId = saleProductSelect.value;
    const qty = Number(document.getElementById('sale-qty').value);
    const product = products.find(p => p.id === pId);

    if (!product) return;
    if (product.stock < qty) {
        showFeedback('Nincs elég készlet!', 'bg-rose-500/10 text-rose-400 border border-rose-500/20');
        return;
    }

    const newSale = {
        id: 'SALE-' + Date.now(),
        productId: product.id,
        productName: product.name,
        quantity: qty,
        totalPrice: product.sellPrice * qty,
        totalProfit: (product.sellPrice - product.buyPrice) * qty,
        date: new Date().toISOString()
    };

    try {
        const response = await fetch(`${API_URL}?type=recordSale`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newSale)
        });

        if (response.ok) {
            saleForm.reset();
            showFeedback('Eladás rögzítve az adatbázisban!', 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20');
            loadDataFromServer();
        } else {
            const errData = await response.json();
            showFeedback(errData.error, 'bg-rose-500/10 text-rose-400 border border-rose-500/20');
        }
    } catch (err) {
        showFeedback('Hálózati hiba történt!', 'bg-rose-500/10 text-rose-400 border border-rose-500/20');
    }
});

async function deleteProduct(id) {
    if (!currentUser || currentUser.role !== 'admin') return;
    if (confirm('Biztosan törölni szeretnéd?')) {
        try {
            await fetch(`${API_URL}?type=deleteProduct`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: id })
            });
            loadDataFromServer();
        } catch (err) {
            console.error(err);
        }
    }
}

function showFeedback(text, classes) {
    saleFeedback.innerText = text;
    saleFeedback.className = `mt-4 p-3 rounded-lg text-sm text-center ${classes}`;
    setTimeout(() => saleFeedback.classList.add('hidden'), 4000);
}

function renderAll() {
    renderTable();
    renderSaleSelect();
    calculateStats();
}

function renderTable() {
    productTableBody.innerHTML = '';
    if (products.length === 0) {
        productTableBody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-gray-500 italic">Nincs még termék.</td></tr>`;
        return;
    }

    products.forEach(p => {
        const isLowStock = p.stock <= p.minStock;
        const stockClass = isLowStock ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold' : 'bg-gray-900 text-emerald-400 border border-gray-800';
        const deleteButtonHTML = (currentUser && currentUser.role === 'admin')
            ? `<button onclick="deleteProduct('${p.id}')" class="text-rose-500 hover:text-rose-400 p-1 rounded hover:bg-rose-500/10 transition">Törlés</button>`
            : `<span class="text-gray-600 italic text-xs">Letiltva</span>`;

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-900/50 transition-colors';
        tr.innerHTML = `
            <td class="py-4 px-6 font-mono text-gray-400 text-xs">${p.sku}</td>
            <td class="py-4 px-6 font-medium text-white">${p.name}</td>
            <td class="py-4 px-6"><span class="bg-gray-800 px-2 py-1 rounded text-xs text-gray-300 border border-gray-700">${p.category}</span></td>
            <td class="py-4 px-6 text-right font-mono text-gray-400">${formatCurrency(p.buyPrice)}</td>
            <td class="py-4 px-6 text-right font-mono text-white">${formatCurrency(p.sellPrice)}</td>
            <td class="py-4 px-6 text-center"><span class="px-2.5 py-1 rounded-md text-xs border ${stockClass}">${p.stock} db ${isLowStock ? '⚠️' : ''}</span></td>
            <td class="py-4 px-6 text-center">${deleteButtonHTML}</td>
        `;
        productTableBody.appendChild(tr);
    });
}

function renderSaleSelect() {
    saleProductSelect.innerHTML = '<option value="">-- Válassz terméket --</option>';
    products.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.disabled = p.stock === 0;
        option.innerText = `${p.name} (Raktáron: ${p.stock} db) - ${formatCurrency(p.sellPrice)}`;
        saleProductSelect.appendChild(option);
    });
}

function calculateStats() {
    let totalRevenue = 0;
    let totalProfit = 0;
    sales.forEach(s => {
        totalRevenue += s.totalPrice;
        totalProfit += s.totalProfit;
    });

    const lowStockCount = products.filter(p => p.stock <= p.minStock).length;
    const productSalesCount = {};
    sales.forEach(s => { productSalesCount[s.productName] = (productSalesCount[s.productName] || 0) + s.quantity; });

    let bestseller = '-';
    let maxSales = 0;
    for (const [name, qty] of Object.entries(productSalesCount)) {
        if (qty > maxSales) { maxSales = qty; bestseller = `${name} (${qty} db)`; }
    }

    document.getElementById('stats-revenue').innerText = formatCurrency(totalRevenue);
    document.getElementById('stats-profit').innerText = formatCurrency(totalProfit);
    document.getElementById('stats-low-stock').innerText = lowStockCount + ' db';
    document.getElementById('stats-bestseller').innerText = bestseller;
}

setInterval(loadDataFromServer, 5000);
checkAuth();
