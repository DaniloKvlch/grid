import { supabase } from "./supabase.js";

// ========================================
// Змінні
// ========================================

let products = [];
let orders = [];

const pageTitles = {
    dashboard: "Головна",
    products: "Товари",
    orders: "Замовлення"
};

const pageSubtitles = {
    dashboard: "Огляд роботи магазину",
    products: "Управління каталогом товарів",
    orders: "Управління замовленнями"
};

// ========================================
// Ініціалізація
// ========================================

document.addEventListener("DOMContentLoaded", async () => {
    document.getElementById("current-date").textContent =
        new Date().toLocaleDateString("uk-UA", {
            day: "numeric",
            month: "long",
            year: "numeric"
        });

    setupNavigation();
    setupEvents();

    await loadData();
});

// ========================================
// Навігація
// ========================================

function setupNavigation() {
    document.querySelectorAll(".nav-btn").forEach(button => {
        button.addEventListener("click", () => {
            navigate(button.dataset.page);
        });
    });
}

window.navigate = function(page) {
    document.querySelectorAll(".page").forEach(section => {
        section.classList.remove("active");
    });

    document.querySelectorAll(".nav-btn").forEach(button => {
        button.classList.remove("active");
    });

    document.getElementById(`${page}-page`).classList.add("active");

    document.querySelector(
        `.nav-btn[data-page="${page}"]`
    ).classList.add("active");

    document.getElementById("page-title").textContent =
        pageTitles[page];

    document.getElementById("page-subtitle").textContent =
        pageSubtitles[page];
};

// ========================================
// Події
// ========================================

function setupEvents() {
    document.getElementById("product-form")
        .addEventListener("submit", saveProduct);

    document.getElementById("order-form")
        .addEventListener("submit", createOrder);

    document.getElementById("product-search")
        .addEventListener("input", renderProducts);

    document.getElementById("stock-filter")
        .addEventListener("change", renderProducts);

    document.getElementById("order-search")
        .addEventListener("input", renderOrders);

    document.getElementById("order-filter")
        .addEventListener("change", renderOrders);

    document.getElementById("add-order-item")
        .addEventListener("click", addOrderItem);
}

// ========================================
// Завантаження даних із Supabase
// ========================================

async function loadData() {
    try {
        const productResult = await supabase
            .from("products")
            .select("*")
            .order("id", { ascending: false });

        if (productResult.error) {
            throw productResult.error;
        }

        const orderResult = await supabase
            .from("orders")
            .select("*")
            .order("id", { ascending: false });

        if (orderResult.error) {
            throw orderResult.error;
        }

        products = productResult.data || [];
        orders = orderResult.data || [];

        renderAll();

    } catch (error) {
        console.error("Помилка завантаження:", error);
        showToast("Помилка завантаження даних", "error");
    }
}

function renderAll() {
    renderDashboard();
    renderProducts();
    renderOrders();
    updateProductSelect();
}

// Оновлення списків товарів у рядках замовлення
function updateProductSelect() {
    document.querySelectorAll(".order-item-row .order-product")
        .forEach(select => {
            const selectedId = select.value;

            select.innerHTML = `
                <option value="">Оберіть товар</option>

                ${products.map(product => `
                    <option value="${product.id}">
                        ${escapeHTML(product.name)} —
                        ${Number(product.price).toFixed(2)} ₴
                        (залишок: ${product.quantity})
                    </option>
                `).join("")}
            `;

            select.value = selectedId;
        });
}

// ========================================
// Головна сторінка
// ========================================

function renderDashboard() {
    document.getElementById("stat-products").textContent =
        products.length;

    document.getElementById("stat-orders").textContent =
        orders.length;

    const revenue = orders
        .filter(order => order.status !== "Скасоване")
        .reduce((sum, order) => {
            return sum + Number(order.total_amount || 0);
        }, 0);

    document.getElementById("stat-revenue").textContent =
        money(revenue);

    const lowStock = products.filter(product =>
        Number(product.quantity) < 5
    ).length;

    document.getElementById("stat-low-stock").textContent =
        lowStock;

    const recent = orders.slice(0, 5);
    const tbody = document.getElementById("recent-orders");

    if (recent.length === 0) {
        tbody.innerHTML = emptyRow(5, "Замовлень поки немає");
        return;
    }

    tbody.innerHTML = recent.map(order => `
        <tr>
            <td>#${order.id}</td>
            <td>${escapeHTML(order.customer_name)}</td>
            <td>${formatDate(order.created_at)}</td>
            <td>${money(order.total_amount)}</td>
            <td>${statusBadge(order.status)}</td>
        </tr>
    `).join("");
}

// ========================================
// Товари
// ========================================

function renderProducts() {
    const search = document.getElementById("product-search")
        .value.toLowerCase();

    const filter = document.getElementById("stock-filter").value;

    let filtered = products.filter(product =>
        product.name.toLowerCase().includes(search)
    );

    if (filter === "available") {
        filtered = filtered.filter(p => p.quantity > 0);
    }

    if (filter === "low") {
        filtered = filtered.filter(p =>
            p.quantity > 0 && p.quantity < 5
        );
    }

    if (filter === "empty") {
        filtered = filtered.filter(p => p.quantity === 0);
    }

    const tbody = document.getElementById("products-table");

    if (!filtered.length) {
        tbody.innerHTML = emptyRow(6, "Товарів не знайдено");
        return;
    }

    tbody.innerHTML = filtered.map(product => {
        const stockClass =
            product.quantity === 0 ? "stock-empty" :
            product.quantity < 5 ? "stock-low" :
            "stock-normal";

        return `
            <tr>
                <td>#${product.id}</td>

                <td>
                    <strong>${escapeHTML(product.name)}</strong>
                </td>

                <td>
                    ${escapeHTML(product.description || "—")}
                </td>

                <td>${money(product.price)}</td>

                <td>
                    <span class="${stockClass}">
                        ${product.quantity} шт.
                    </span>
                </td>

                <td>
                    <button
                        class="action-btn"
                        onclick="editProduct(${product.id})">
                        ✎
                    </button>

                    <button
                        class="action-btn delete-btn"
                        onclick="deleteProduct(${product.id})">
                        ✕
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

// ========================================
// Додавання товару
// ========================================

window.openProductModal = function() {
    document.getElementById("product-form").reset();
    document.getElementById("product-id").value = "";

    document.getElementById("product-modal-title").textContent =
        "Новий товар";

    document.getElementById("product-modal").classList.add("show");
};

// ========================================
// Редагування товару
// ========================================

window.editProduct = function(id) {
    const product = products.find(p => String(p.id) === String(id));

    if (!product) return;

    document.getElementById("product-id").value = product.id;
    document.getElementById("product-name").value = product.name;
    document.getElementById("product-description").value =
        product.description || "";
    document.getElementById("product-price").value = product.price;
    document.getElementById("product-quantity").value =
        product.quantity;

    document.getElementById("product-modal-title").textContent =
        "Редагування товару";

    document.getElementById("product-modal").classList.add("show");
};

// ========================================
// Збереження товару
// ========================================

async function saveProduct(event) {
    event.preventDefault();

    const id = document.getElementById("product-id").value;

    const product = {
        name: document.getElementById("product-name").value.trim(),
        description: document.getElementById("product-description")
            .value.trim(),
        price: Number(document.getElementById("product-price").value),
        quantity: Number(document.getElementById("product-quantity").value)
    };

    if (!product.name || product.price < 0 || product.quantity < 0) {
        showToast("Перевірте введені дані", "error");
        return;
    }

    try {
        let result;

        if (id) {
            result = await supabase
                .from("products")
                .update(product)
                .eq("id", id);
        } else {
            result = await supabase
                .from("products")
                .insert(product);
        }

        if (result.error) throw result.error;

        closeModal("product-modal");

        showToast(
            id ? "Товар оновлено" : "Товар додано",
            "success"
        );

        await loadData();

    } catch (error) {
        console.error("Помилка збереження товару:", error);
        showToast("Не вдалося зберегти товар", "error");
    }
}

// ========================================
// Видалення товару
// ========================================

window.deleteProduct = async function(id) {
    const product = products.find(p => String(p.id) === String(id));

    if (!product) return;

    if (!confirm(`Видалити товар "${product.name}"?`)) {
        return;
    }

    try {
        const result = await supabase
            .from("products")
            .delete()
            .eq("id", id);

        if (result.error) throw result.error;

        showToast("Товар видалено", "success");

        await loadData();

    } catch (error) {
        console.error("Помилка видалення:", error);

        showToast(
            "Не вдалося видалити. Можливо, товар є в замовленнях.",
            "error"
        );
    }
};

// ========================================
// Відкриття вікна замовлення
// ========================================

window.openOrderModal = function() {
    document.getElementById("order-form").reset();
    document.getElementById("order-items").innerHTML = "";

    document.getElementById("order-total").textContent = "0 ₴";

    addOrderItem();

    document.getElementById("order-modal").classList.add("show");
};

// ========================================
// Додавання товару до замовлення
// ========================================

function addOrderItem() {
    const container = document.getElementById("order-items");

    if (products.length === 0) {
        showToast("Спочатку додайте хоча б один товар", "error");
        return;
    }

    const row = document.createElement("div");
    row.className = "order-item-row";

    const options = products.map(product => `
        <option value="${product.id}">
            ${escapeHTML(product.name)} —
            ${Number(product.price).toFixed(2)} ₴
            (залишок: ${product.quantity})
        </option>
    `).join("");

    row.innerHTML = `
        <div class="form-group">
            <select class="order-product" required>
                <option value="">Оберіть товар</option>
                ${options}
            </select>
        </div>

        <div class="form-group">
            <input
                type="number"
                class="order-quantity"
                min="1"
                value="1"
                placeholder="Кількість"
                required
            >
        </div>

        <button
            type="button"
            class="btn btn-danger remove-order-item">
            Видалити
        </button>
    `;

    container.appendChild(row);

    row.querySelector(".order-product")
        .addEventListener("change", updateOrderTotal);

    row.querySelector(".order-quantity")
        .addEventListener("input", updateOrderTotal);

    row.querySelector(".remove-order-item")
        .addEventListener("click", () => {
            row.remove();
            updateOrderTotal();
        });

    updateOrderTotal();
}

// ========================================
// Розрахунок загальної суми
// ========================================

function updateOrderTotal() {
    let total = 0;

    document.querySelectorAll(".order-item-row").forEach(row => {
        const productId = row.querySelector(".order-product").value;

        const quantity = Number(
            row.querySelector(".order-quantity").value
        );

        const product = products.find(
            p => String(p.id) === String(productId)
        );

        if (product && quantity > 0) {
            total += Number(product.price) * quantity;
        }
    });

    document.getElementById("order-total").textContent =
        money(total);
}

// ========================================
// Створення замовлення
// ========================================

async function createOrder(event) {
    event.preventDefault();

    const customerName = document
        .getElementById("customer-name")
        .value.trim();

    const customerEmail = document
        .getElementById("customer-email")
        .value.trim();

    if (!customerName) {
        alert("Вкажіть ім'я клієнта.");
        return;
    }

    const rows = [
        ...document.querySelectorAll(".order-item-row")
    ];

    if (rows.length === 0) {
        alert("Додайте хоча б один товар!");
        return;
    }

    const items = [];

    for (const row of rows) {
        const productId = row.querySelector(".order-product").value;

        const quantity = Number(
            row.querySelector(".order-quantity").value
        );

        const product = products.find(
            p => String(p.id) === String(productId)
        );

        if (!product || !Number.isInteger(quantity) || quantity < 1) {
            alert("Перевірте вибрані товари та їх кількість.");
            return;
        }

        if (items.some(item =>
            String(item.product_id) === String(product.id)
        )) {
            alert(
                "Один і той самий товар не можна додавати двічі. " +
                "Змініть його кількість в одному рядку."
            );
            return;
        }

        if (quantity > Number(product.quantity)) {
            alert(
                `Недостатньо товару "${product.name}". ` +
                `На складі: ${product.quantity}.`
            );
            return;
        }

        items.push({
            product_id: product.id,
            quantity: quantity,
            unit_price: Number(product.price),
            product: product
        });
    }

    const total = items.reduce((sum, item) => {
        return sum + item.quantity * item.unit_price;
    }, 0);

    try {
        // Створення основного замовлення
        const { data: order, error: orderError } = await supabase
            .from("orders")
            .insert([{
                customer_name: customerName,
                customer_email: customerEmail,
                total_amount: total
            }])
            .select()
            .single();

        if (orderError) throw orderError;

        // Додавання товарів до замовлення
        const orderItems = items.map(item => ({
            order_id: order.id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price
        }));

        const { error: itemsError } = await supabase
            .from("order_items")
            .insert(orderItems);

        if (itemsError) throw itemsError;

        // Зменшення залишків на складі
        for (const item of items) {
            const newQuantity =
                Number(item.product.quantity) - item.quantity;

            const { error: stockError } = await supabase
                .from("products")
                .update({ quantity: newQuantity })
                .eq("id", item.product_id);

            if (stockError) throw stockError;
        }

        alert("Замовлення успішно створено!");

        closeModal("order-modal");

        document.getElementById("order-form").reset();
        document.getElementById("order-items").innerHTML = "";
        document.getElementById("order-total").textContent = "0 ₴";

        await loadData();

    } catch (error) {
        console.error("Помилка створення замовлення:", error);

        alert(
            "Не вдалося створити замовлення: " +
            (error.message || "Невідома помилка")
        );
    }
}

// ========================================
// Замовлення
// ========================================

let expandedOrderId = null;

function renderOrders() {
    const search = document.getElementById("order-search")
        .value.toLowerCase();

    const filter = document.getElementById("order-filter").value;

    let filtered = orders.filter(order =>
        order.customer_name.toLowerCase().includes(search) ||
        String(order.id).includes(search)
    );

    if (filter !== "all") {
        filtered = filtered.filter(order =>
            order.status === filter
        );
    }

    const tbody = document.getElementById("orders-table");

    if (!filtered.length) {
        tbody.innerHTML = emptyRow(7, "Замовлень не знайдено");
        return;
    }

    tbody.innerHTML = filtered.map(order => `
        <tr class="order-main-row"
            onclick="toggleOrderDetails(${order.id}, this)"
            title="Натисніть, щоб переглянути товари">

            <td>
                <span class="order-expand-icon">
                    ${expandedOrderId === order.id ? "▼" : "▶"}
                </span>
                #${order.id}
            </td>

            <td><strong>${escapeHTML(order.customer_name)}</strong></td>
            <td>${escapeHTML(order.customer_email || "—")}</td>
            <td>${formatDate(order.created_at)}</td>
            <td>${money(order.total_amount)}</td>
            <td>${statusBadge(order.status)}</td>

            <td onclick="event.stopPropagation()">
                ${
                    order.status !== "Виконане" &&
                    order.status !== "Скасоване"
                    ? `<button class="action-btn"
                        onclick="nextStatus(${order.id})">
                        Змінити статус
                      </button>`
                    : "—"
                }
            </td>
        </tr>

        ${
            expandedOrderId === order.id
            ? `
                <tr class="order-details-row">
                    <td colspan="7">
                        <div class="order-details-content"
                            id="order-details-${order.id}">
                            <div class="order-details-loading">
                                Завантаження товарів...
                            </div>
                        </div>
                    </td>
                </tr>
            `
            : ""
        }
    `).join("");

    // Якщо замовлення було розгорнуте — повторно завантажуємо його товари
    if (expandedOrderId !== null) {
        const expandedOrder = filtered.find(
            order => order.id === expandedOrderId
        );

        if (expandedOrder) {
            loadOrderDetails(expandedOrderId);
        } else {
            expandedOrderId = null;
        }
    }
}

// ========================================
// Розгортання замовлення
// ========================================

window.toggleOrderDetails = async function(orderId) {
    if (expandedOrderId === orderId) {
        expandedOrderId = null;
        renderOrders();
        return;
    }

    expandedOrderId = orderId;
    renderOrders();

    await loadOrderDetails(orderId);
};

// ========================================
// Завантаження товарів замовлення
// ========================================

async function loadOrderDetails(orderId) {
    const container = document.getElementById(
        `order-details-${orderId}`
    );

    if (!container) return;

    const { data, error } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId);

    if (error) {
        console.error("Помилка завантаження товарів замовлення:", error);

        container.innerHTML = `
            <div class="order-details-error">
                Не вдалося завантажити товари замовлення.
            </div>
        `;
        return;
    }

    if (!data || data.length === 0) {
        container.innerHTML = `
            <div class="order-details-empty">
                У цьому замовленні немає товарів.
            </div>
        `;
        return;
    }

    const itemsHTML = data.map(item => {
        const product = products.find(
            p => String(p.id) === String(item.product_id)
        );

        const productName = product
            ? escapeHTML(product.name)
            : "Товар видалено";

        const quantity = Number(item.quantity);
        const price = Number(item.unit_price);
        const sum = quantity * price;

        return `
            <tr>
                <td>${productName}</td>
                <td>${quantity} шт.</td>
                <td>${money(price)}</td>
                <td><strong>${money(sum)}</strong></td>
            </tr>
        `;
    }).join("");

    const total = data.reduce(
        (sum, item) =>
            sum + Number(item.quantity) * Number(item.unit_price),
        0
    );

    container.innerHTML = `
        <div class="order-details-heading">
            <strong>Товари в замовленні #${orderId}</strong>
            <span>${data.length} позицій</span>
        </div>

        <table class="order-details-table">
            <thead>
                <tr>
                    <th>Назва товару</th>
                    <th>Кількість</th>
                    <th>Ціна за одиницю</th>
                    <th>Сума</th>
                </tr>
            </thead>

            <tbody>
                ${itemsHTML}
            </tbody>
        </table>

        <div class="order-details-total">
            Загальна сума: <strong>${money(total)}</strong>
        </div>
    `;
}
// ========================================
// Зміна статусу замовлення
// ========================================

window.nextStatus = async function(id) {
    const order = orders.find(o => String(o.id) === String(id));

    if (!order) return;

    const statuses = ["Нове", "В обробці", "Виконане"];

    const currentIndex = statuses.indexOf(order.status);
    const next = statuses[currentIndex + 1];

    if (!next) return;

    try {
        const result = await supabase
            .from("orders")
            .update({ status: next })
            .eq("id", id);

        if (result.error) throw result.error;

        showToast(`Статус змінено: ${next}`, "success");

        await loadData();

    } catch (error) {
        console.error("Помилка зміни статусу:", error);
        showToast("Помилка зміни статусу", "error");
    }
};

// ========================================
// Допоміжні функції
// ========================================

window.closeModal = function(id) {
    document.getElementById(id).classList.remove("show");
};

function money(value) {
    return Number(value || 0).toLocaleString("uk-UA", {
        style: "currency",
        currency: "UAH",
        maximumFractionDigits: 2
    });
}

function formatDate(date) {
    if (!date) return "—";

    return new Date(date).toLocaleString("uk-UA", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function statusBadge(status) {
    const classes = {
        "Нове": "badge-new",
        "В обробці": "badge-processing",
        "Виконане": "badge-completed",
        "Скасоване": "badge-cancelled"
    };

    return `
        <span class="badge ${classes[status] || "badge-new"}">
            ${escapeHTML(status)}
        </span>
    `;
}

function emptyRow(columns, text) {
    return `
        <tr>
            <td colspan="${columns}" class="empty">
                ${text}
            </td>
        </tr>
    `;
}

function escapeHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function showToast(message, type = "success") {
    const toast = document.getElementById("toast");

    toast.textContent = message;
    toast.className = `toast show ${type}`;

    setTimeout(() => {
        toast.className = "toast";
    }, 3000);
}