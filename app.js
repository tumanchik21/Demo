// Global variables
let sessionId = '';
let currentProducts = [];
let currentCart = {};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Generate or get session ID
    sessionId = localStorage.getItem('sessionId') || generateSessionId();
    localStorage.setItem('sessionId', sessionId);
    document.getElementById('sessionId').textContent = sessionId;
    
    // Load initial data
    loadProducts();
    loadCart();
    loadCategories();
    
    // Set up search functionality
    document.getElementById('productSearch').addEventListener('input', debounce(loadProducts, 500));
    document.getElementById('categoryFilter').addEventListener('change', loadProducts);
    document.getElementById('statusFilter').addEventListener('change', loadOrders);
    document.getElementById('emailFilter').addEventListener('input', debounce(loadOrders, 500));
    
    // Load orders when tab is activated
    document.getElementById('orders-tab').addEventListener('shown.bs.tab', loadOrders);
});

// Utility functions
function generateSessionId() {
    return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function showLoading() {
    document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

function showAlert(message, type = 'danger') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    const container = document.querySelector('.container');
    container.insertBefore(alertDiv, container.firstChild);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

// API functions
async function apiCall(url, options = {}) {
    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        if (!response.ok) {
            let errorMessage = `HTTP error! status: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
            } catch (e) {
                // If response is not JSON, use status text
                errorMessage = response.statusText || errorMessage;
            }
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
}

// Products functions
async function loadProducts() {
    try {
        showLoading();
        
        const search = document.getElementById('productSearch').value;
        const category = document.getElementById('categoryFilter').value;
        
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (category) params.append('category', category);
        
        const data = await apiCall(`/api/products?${params.toString()}`);
        currentProducts = data.products;
        displayProducts(currentProducts);
    } catch (error) {
        showAlert(`Failed to load products: ${error.message}`);
    } finally {
        hideLoading();
    }
}

function displayProducts(products) {
    const container = document.getElementById('productsList');
    
    if (products.length === 0) {
        container.innerHTML = `
            <div class="col-12">
                <div class="text-center py-4">
                    <i class="bi bi-box display-1 text-muted"></i>
                    <h5 class="text-muted mt-2">No products found</h5>
                </div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = products.map(product => `
        <div class="col-md-6 col-lg-4 mb-3">
            <div class="card h-100">
                ${product.image_url ? `<img src="${product.image_url}" class="card-img-top" style="height: 200px; object-fit: cover;" alt="${product.name}">` : ''}
                <div class="card-body d-flex flex-column">
                    <h6 class="card-title">${product.name}</h6>
                    <p class="card-text small text-muted flex-grow-1">${product.description || 'No description'}</p>
                    <div class="mb-2">
                        <span class="h5 text-success">$${product.price.toFixed(2)}</span>
                        ${product.category ? `<span class="badge bg-secondary ms-2">${product.category}</span>` : ''}
                    </div>
                    <div class="mb-2">
                        <small class="text-muted">Stock: ${product.stock_quantity}</small>
                    </div>
                    <div class="btn-group" role="group">
                        <button class="btn btn-primary btn-sm" onclick="addToCart('${product.id}')" ${product.stock_quantity === 0 ? 'disabled' : ''}>
                            <i class="bi bi-cart-plus"></i> Add to Cart
                        </button>
                        <button class="btn btn-outline-secondary btn-sm" onclick="editProduct('${product.id}')">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-outline-danger btn-sm" onclick="deleteProduct('${product.id}')">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

async function loadCategories() {
    try {
        const data = await apiCall('/api/products/categories');
        const select = document.getElementById('categoryFilter');
        const currentValue = select.value;
        
        select.innerHTML = '<option value="">All Categories</option>';
        data.categories.forEach(category => {
            select.innerHTML += `<option value="${category}">${category}</option>`;
        });
        
        select.value = currentValue;
    } catch (error) {
        console.error('Failed to load categories:', error);
    }
}

function editProduct(productId) {
    const product = currentProducts.find(p => p.id === productId);
    if (!product) return;
    
    document.getElementById('productModalTitle').textContent = 'Edit Product';
    document.getElementById('productId').value = product.id;
    document.getElementById('productName').value = product.name;
    document.getElementById('productDescription').value = product.description || '';
    document.getElementById('productPrice').value = product.price;
    document.getElementById('productStock').value = product.stock_quantity;
    document.getElementById('productCategory').value = product.category || '';
    document.getElementById('productImage').value = product.image_url || '';
    
    new bootstrap.Modal(document.getElementById('productModal')).show();
}

async function saveProduct() {
    try {
        const productId = document.getElementById('productId').value;
        const productData = {
            name: document.getElementById('productName').value,
            description: document.getElementById('productDescription').value,
            price: parseFloat(document.getElementById('productPrice').value),
            stock_quantity: parseInt(document.getElementById('productStock').value),
            category: document.getElementById('productCategory').value || null,
            image_url: document.getElementById('productImage').value || null
        };
        
        const url = productId ? `/api/products/${productId}` : '/api/products';
        const method = productId ? 'PUT' : 'POST';
        
        await apiCall(url, {
            method: method,
            body: JSON.stringify(productData)
        });
        
        bootstrap.Modal.getInstance(document.getElementById('productModal')).hide();
        document.getElementById('productForm').reset();
        loadProducts();
        loadCategories();
        showAlert(`Product ${productId ? 'updated' : 'created'} successfully!`, 'success');
    } catch (error) {
        showAlert(`Failed to save product: ${error.message}`);
    }
}

async function deleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product?')) return;
    
    try {
        await apiCall(`/api/products/${productId}`, { method: 'DELETE' });
        loadProducts();
        loadCategories();
        showAlert('Product deleted successfully!', 'success');
    } catch (error) {
        showAlert(`Failed to delete product: ${error.message}`);
    }
}

// Cart functions
async function loadCart() {
    try {
        const data = await apiCall(`/api/cart/${sessionId}`);
        currentCart = data;
        displayCart(data);
        updateCartBadge(data.items_count);
    } catch (error) {
        console.error('Failed to load cart:', error);
        currentCart = { items: [], total_amount: 0, items_count: 0 };
        displayCart(currentCart);
    }
}

function displayCart(cart) {
    const container = document.getElementById('cartItems');
    const totalElement = document.getElementById('cartTotal');
    const checkoutBtn = document.getElementById('checkoutBtn');
    
    totalElement.textContent = cart.total_amount.toFixed(2);
    
    if (cart.items.length === 0) {
        container.innerHTML = `
            <div class="text-center py-4">
                <i class="bi bi-cart-x display-1 text-muted"></i>
                <h5 class="text-muted mt-2">Your cart is empty</h5>
            </div>
        `;
        checkoutBtn.disabled = true;
        return;
    }
    
    checkoutBtn.disabled = false;
    
    container.innerHTML = cart.items.map(item => `
        <div class="card mb-2">
            <div class="card-body">
                <div class="row align-items-center">
                    <div class="col-md-6">
                        <h6 class="mb-1">${item.product.name}</h6>
                        <small class="text-muted">$${item.product.price.toFixed(2)} each</small>
                    </div>
                    <div class="col-md-3">
                        <div class="input-group input-group-sm">
                            <button class="btn btn-outline-secondary" onclick="updateCartItemQuantity('${item.product.id}', ${item.quantity - 1})">-</button>
                            <input type="number" class="form-control text-center" value="${item.quantity}" min="1" max="${item.product.stock_quantity}" onchange="updateCartItemQuantity('${item.product.id}', this.value)">
                            <button class="btn btn-outline-secondary" onclick="updateCartItemQuantity('${item.product.id}', ${item.quantity + 1})" ${item.quantity >= item.product.stock_quantity ? 'disabled' : ''}>+</button>
                        </div>
                    </div>
                    <div class="col-md-2 text-end">
                        <strong>$${item.subtotal.toFixed(2)}</strong>
                    </div>
                    <div class="col-md-1 text-end">
                        <button class="btn btn-sm btn-outline-danger" onclick="removeFromCart('${item.product.id}')">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function updateCartBadge(count) {
    const badge = document.getElementById('cartBadge');
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline';
    } else {
        badge.style.display = 'none';
    }
}

async function addToCart(productId, quantity = 1) {
    try {
        await apiCall(`/api/cart/${sessionId}/items`, {
            method: 'POST',
            body: JSON.stringify({ product_id: productId, quantity: quantity })
        });
        
        loadCart();
        showAlert('Item added to cart!', 'success');
    } catch (error) {
        showAlert(`Failed to add item to cart: ${error.message}`);
    }
}

async function updateCartItemQuantity(productId, quantity) {
    try {
        const qty = parseInt(quantity);
        if (qty <= 0) {
            await removeFromCart(productId);
            return;
        }
        
        await apiCall(`/api/cart/${sessionId}/items/${productId}`, {
            method: 'PUT',
            body: JSON.stringify({ quantity: qty })
        });
        
        loadCart();
    } catch (error) {
        showAlert(`Failed to update cart: ${error.message}`);
        loadCart(); // Reload to show correct values
    }
}

async function removeFromCart(productId) {
    try {
        await apiCall(`/api/cart/${sessionId}/items/${productId}`, {
            method: 'DELETE'
        });
        
        loadCart();
        showAlert('Item removed from cart!', 'success');
    } catch (error) {
        showAlert(`Failed to remove item: ${error.message}`);
    }
}

async function clearCart() {
    if (!confirm('Are you sure you want to clear your cart?')) return;
    
    try {
        await apiCall(`/api/cart/${sessionId}`, { method: 'DELETE' });
        loadCart();
        showAlert('Cart cleared!', 'success');
    } catch (error) {
        showAlert(`Failed to clear cart: ${error.message}`);
    }
}

// Checkout functions
function showCheckout() {
    new bootstrap.Modal(document.getElementById('checkoutModal')).show();
}

async function placeOrder() {
    try {
        const orderData = {
            session_id: sessionId,
            customer_name: document.getElementById('customerName').value,
            customer_email: document.getElementById('customerEmail').value,
            customer_phone: document.getElementById('customerPhone').value || null,
            shipping_address: document.getElementById('shippingAddress').value,
            notes: document.getElementById('orderNotes').value || null
        };
        
        const order = await apiCall('/api/orders', {
            method: 'POST',
            body: JSON.stringify(orderData)
        });
        
        bootstrap.Modal.getInstance(document.getElementById('checkoutModal')).hide();
        document.getElementById('checkoutForm').reset();
        
        loadCart(); // Cart should be empty now
        showAlert(`Order placed successfully! Order number: ${order.order_number}`, 'success');
        
        // Switch to orders tab
        document.getElementById('orders-tab').click();
        setTimeout(loadOrders, 500);
    } catch (error) {
        showAlert(`Failed to place order: ${error.message}`);
    }
}

// Orders functions
async function loadOrders() {
    try {
        showLoading();
        
        const status = document.getElementById('statusFilter').value;
        const email = document.getElementById('emailFilter').value;
        
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        if (email) params.append('customer_email', email);
        
        const data = await apiCall(`/api/orders?${params.toString()}`);
        displayOrders(data.orders);
    } catch (error) {
        showAlert(`Failed to load orders: ${error.message}`);
    } finally {
        hideLoading();
    }
}

function displayOrders(orders) {
    const container = document.getElementById('ordersList');
    
    if (orders.length === 0) {
        container.innerHTML = `
            <div class="text-center py-4">
                <i class="bi bi-receipt display-1 text-muted"></i>
                <h5 class="text-muted mt-2">No orders found</h5>
            </div>
        `;
        return;
    }
    
    container.innerHTML = orders.map(order => `
        <div class="card mb-3">
            <div class="card-header d-flex justify-content-between align-items-center">
                <div>
                    <strong>Order #${order.order_number}</strong>
                    <small class="text-muted ms-2">${new Date(order.created_at).toLocaleString()}</small>
                </div>
                <div>
                    <span class="badge bg-${getStatusColor(order.status)}">${order.status.toUpperCase()}</span>
                    <button class="btn btn-sm btn-outline-primary ms-2" onclick="updateOrderStatus('${order.id}', '${order.status}')">
                        <i class="bi bi-pencil"></i> Update Status
                    </button>
                </div>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-6">
                        <h6>Customer Information</h6>
                        <p class="mb-1"><strong>${order.customer_name}</strong></p>
                        <p class="mb-1">${order.customer_email}</p>
                        ${order.customer_phone ? `<p class="mb-1">${order.customer_phone}</p>` : ''}
                        <p class="mb-0"><small class="text-muted">${order.shipping_address}</small></p>
                    </div>
                    <div class="col-md-6">
                        <h6>Order Items</h6>
                        ${order.items.map(item => `
                            <div class="d-flex justify-content-between">
                                <span>${item.product_name} x${item.quantity}</span>
                                <span>$${item.subtotal.toFixed(2)}</span>
                            </div>
                        `).join('')}
                        <hr>
                        <div class="d-flex justify-content-between">
                            <strong>Total: $${order.total_amount.toFixed(2)}</strong>
                        </div>
                    </div>
                </div>
                ${order.notes ? `<div class="mt-2"><small class="text-muted"><strong>Notes:</strong> ${order.notes}</small></div>` : ''}
            </div>
        </div>
    `).join('');
}

function getStatusColor(status) {
    const colors = {
        'new': 'primary',
        'processing': 'warning',
        'shipped': 'info',
        'delivered': 'success',
        'cancelled': 'danger'
    };
    return colors[status] || 'secondary';
}

async function updateOrderStatus(orderId, currentStatus) {
    const statuses = ['new', 'processing', 'shipped', 'delivered', 'cancelled'];
    const newStatus = prompt(`Current status: ${currentStatus}\nEnter new status (${statuses.join(', ')}):`, currentStatus);
    
    if (!newStatus || newStatus === currentStatus) return;
    
    if (!statuses.includes(newStatus)) {
        showAlert('Invalid status. Valid statuses: ' + statuses.join(', '));
        return;
    }
    
    try {
        await apiCall(`/api/orders/${orderId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
        });
        
        loadOrders();
        showAlert('Order status updated successfully!', 'success');
    } catch (error) {
        showAlert(`Failed to update order status: ${error.message}`);
    }
}

// Reset product modal when hidden
document.getElementById('productModal').addEventListener('hidden.bs.modal', function() {
    document.getElementById('productModalTitle').textContent = 'Add Product';
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
});
