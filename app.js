// Alkalmazás állapot (State) inicializálása LocalStorage-ból
let products = JSON.parse(localStorage.getItem('airsoft_products')) || [];
let sales = JSON.parse(localStorage.getItem('airsoft_sales')) || [];

// DOM Elemek kinyerése
const productForm = document.getElementById('product-form');
const saleForm = document.getElementById('sale-form');
const productTableBody = document.getElementById('product-table-body');
const saleProductSelect = document.getElementById('sale-product-id');
const saleFeedback = document.getElementById('sale-feedback');

// Adatmentés és UI frissítés vezérlése
function saveState() {
    localStorage.setItem('airsoft_products', JSON.stringify(products));
    localStorage.setItem('airsoft_sales', JSON.stringify(sales));
    renderAll();
}

// Magyar pénznem formázó (pl. 120 000 Ft)
function formatCurrency(amount) {
    return new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 }).format(amount);
}

// 1. Új termék hozzáadásának eseménykezelője
productForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
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

    products.push(newProduct);
    productForm.reset();
    saveState();
});

// 2. Eladás rögzítésének eseménykezelője
saleForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const pId = saleProductSelect.value;
    const qty = Number(document.getElementById('sale-qty').value);
    const product = products.find(p => p.id === pId);

    if (!product) return;

    // Készlet ellenőrzése (Biztonsági korlát)
    if (product.stock < qty) {
        showFeedback('Nincs elég készlet ezen a terméken!', 'bg-rose-500/10 text-rose-400 border border-rose-500/20');
        return;
    }

    // Készlet levonása
    product.stock -= qty;

    // Pénzügyi számítások
    const totalRevenue = product.sellPrice * qty;
    const totalProfit = (product.sellPrice - product.buyPrice) * qty;

    const newSale = {
        id: 'SALE-' + Date.now(),
        productId: product.id,
        productName: product.name,
        quantity: qty,
        totalPrice: totalRevenue,
        totalProfit: totalProfit,
        date: new Date().toISOString()
    };

    sales.push(newSale);
    saleForm.reset();
    showFeedback('Sikeres eladás rögzítve!', 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20');
    saveState();
});

// 3. Termék törlése funkció
function deleteProduct(id) {
    if(confirm('Biztosan törölni szeretnéd ezt a terméket?')) {
        products = products.filter(p => p.id !== id);
        saveState();
    }
}

// 4. Felugró vizuális visszajelzés sikeres/sikertelen tranzakciókról
function showFeedback(text, classes) {
    saleFeedback.innerText = text;
    saleFeedback.className = `mt-4 p-3 rounded-lg text-sm text-center ${classes}`;
    setTimeout(() => saleFeedback.classList.add('hidden'), 4000);
}

// 5. Globális UI frissítés
function renderAll() {
    renderTable();
    renderSaleSelect();
    calculateStats();
}

// Táblázat legenerálása a meglévő termékekből
function renderTable() {
    productTableBody.innerHTML = '';
    
    if (products.length === 0) {
        productTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="py-8 text-center text-gray-500 italic">Nincs még termék a raktárban. Adj hozzá egyet fentebb!</td>
            </tr>
        `;
        return;
    }

    products.forEach(p => {
        const isLowStock = p.stock <= p.minStock;
        const stockClass = isLowStock 
            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold' 
            : 'bg-gray-900 text-emerald-400 border border-gray-800';

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-900/50 transition-colors';
        tr.innerHTML = `
            <td class="py-4 px-6 font-mono text-gray-400 text-xs">${p.sku}</td>
            <td class="py-4 px-6 font-medium text-white">${p.name}</td>
            <td class="py-4 px-6"><span class="bg-gray-800 px-2 py-1 rounded text-xs text-gray-300 border border-gray-700">${p.category}</span></td>
            <td class="py-4 px-6 text-right font-mono text-gray-400">${formatCurrency(p.buyPrice)}</td>
            <td class="py-4 px-6 text-right font-mono text-white">${formatCurrency(p.sellPrice)}</td>
            <td class="py-4 px-6 text-center">
                <span class="px-2.5 py-1 rounded-md text-xs border ${stockClass}">
                    ${p.stock} db ${isLowStock ? '⚠️' : ''}
                </span>
            </td>
            <td class="py-4 px-6 text-center">
                <button onclick="deleteProduct('${p.id}')" class="text-rose-500 hover:text-rose-400 p-1 rounded hover:bg-rose-500/10 transition">
                    Törlés
                </button>
            </td>
        `;
        productTableBody.appendChild(tr);
    });
}

// Eladási legördülő lista (Select input) frissítése
function renderSaleSelect() {
    saleProductSelect.innerHTML = '<option value="">-- Válassz terméket --</option>';
    
    products.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.disabled = p.stock === 0; // Letiltja, ha elfogyott
        option.innerText = `${p.name} (Raktáron: ${p.stock} db) - ${formatCurrency(p.sellPrice)}`;
        saleProductSelect.appendChild(option);
    });
}

// Dashboard statisztikai számítások végrehajtása
function calculateStats() {
    let totalRevenue = 0;
    let totalProfit = 0;
    
    sales.forEach(s => {
        totalRevenue += s.totalPrice;
        totalProfit += s.totalProfit;
    });

    // Készlethiányos elemek megszámolása
    const lowStockCount = products.filter(p => p.stock <= p.minStock).length;

    // Bestseller algoritmus (Darabszám alapján csoportosítva)
    const productSalesCount = {};
    sales.forEach(s => {
        productSalesCount[s.productName] = (productSalesCount[s.productName] || 0) + s.quantity;
    });

    let bestseller = '-';
    let maxSales = 0;
    for (const [name, qty] of Object.entries(productSalesCount)) {
        if (qty > maxSales) {
            maxSales = qty;
            bestseller = `${name} (${qty} db)`;
        }
    }

    // Értékek beírása a felületre
    document.getElementById('stats-revenue').innerText = formatCurrency(totalRevenue);
    document.getElementById('stats-profit').innerText = formatCurrency(totalProfit);
    document.getElementById('stats-low-stock').innerText = lowStockCount + ' db';
    document.getElementById('stats-bestseller').innerText = bestseller;
}

// Rendszer indítása az oldal betöltésekor
renderAll();
