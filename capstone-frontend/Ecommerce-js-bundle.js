;(() => {
  // -----------------------------------------------
  // utils/storage.js
  // -----------------------------------------------
  const storage = {
    get(key, fallback = null) {
      try {
        const raw = localStorage.getItem(key)
        return raw ? JSON.parse(raw) : fallback
      } catch (e) {
        console.warn('storage.get failed', key, e)
        return fallback
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value))
      } catch (e) {
        console.warn('storage.set failed', key, e)
      }
    },
    remove(key) {
      try { localStorage.removeItem(key) } catch { /* ignore error */ }
    }
  }




  // -----------------------------------------------
  // utils/dom.js
  // -----------------------------------------------
  const $ = (sel, ctx = document) => ctx.querySelector(sel)
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel))
  const on = (el, evt, selectorOrHandler, handler) => {
    if (!el) return
    if (typeof selectorOrHandler === 'function') {
      el.addEventListener(evt, selectorOrHandler)
    } else {
      el.addEventListener(evt, e => {
        const t = e.target.closest(selectorOrHandler)
        if (t && el.contains(t)) handler(e, t)
      })
    }
  }




 
  // data/products.js 

  const PRODUCT_KEY = 'p2t_products_v1'
  const seedProducts = [
    {
      id: 'p1',
      brand: 'Medicinal',
      name: 'Aloe',
      price: 15,
      rating: 4.5,
      image: 'src/img/aloe.jpg',
      stock: 25,
        tags: ['indoor', 'easy']
    },
    {
      id: 'p2',
      brand: 'Herb',
      name: 'Basil',
      price: 5,
      rating: 4.5,
      image: 'src/img/basil.jpg',
      stock: 40,
      tags: ['indoor', 'easy']
    },
     {
      id: 'p3',
      brand: 'Succulent',
      name: 'Cactus',
      price: 5,
      rating: 4.5,
      image: 'src/img/cactus.jpg',
      stock: 40,
      tags: ['indoor', 'easy']
    },
     {
      id: 'p4',
      brand: 'Flower',
      name: 'Orchid',
      price: 5,
      rating: 4.5,
      image: 'src/img/Orchids.jpg',
      stock: 40,
      tags: ['indoor', 'easy']
    }
  ]




  const Products = {
    list() {
      let items = storage.get(PRODUCT_KEY)
      if (!items) {
        storage.set(PRODUCT_KEY, seedProducts)
        items = seedProducts
      }
      return items
    },
    get(id) {
      return this.list().find(p => p.id === id) || null
    },
    upsert(prod) {
      const list = this.list()
      const idx = list.findIndex(p => p.id === prod.id)
      if (idx >= 0) list[idx] = prod
      else list.push({ ...prod, id: prod.id || crypto.randomUUID() })
      storage.set(PRODUCT_KEY, list)
      return prod
    },
    remove(id) {
      const list = this.list().filter(p => p.id !== id)
      storage.set(PRODUCT_KEY, list)
    }
  }




  // -----------------------------------------------
  // auth/auth.js
  // -----------------------------------------------
  const USERS_KEY = 'p2t_users_v1'
  const SESSION_KEY = 'p2t_session_v1'




  const seedAdmin = () => {
    const users = storage.get(USERS_KEY, [])
    if (!users.some(u => u.email === 'admin@example.com')) {
      users.push({
        id: 'u-admin',
        name: 'Site Admin',
        email: 'admin@example.com',
        password: hash('Admin123!'), // demo only
        role: 'admin',
        createdAt: Date.now()
      })
      storage.set(USERS_KEY, users)
    }
  }




  const hash = (s) => {
    // Extremely naive hash for demo (DO NOT use in production)???
    let h = 0
    for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i)
    return String(h >>> 0)
  }




  const Auth = {
    current() {
      const id = storage.get(SESSION_KEY)
      if (!id) return null
      return (storage.get(USERS_KEY, []).find(u => u.id === id) || null)
    },
    login(email, password) {
      const users = storage.get(USERS_KEY, [])
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase())
      if (!user) throw new Error('No account found for this email.')
      if (user.password !== hash(password)) throw new Error('Incorrect password.')
      storage.set(SESSION_KEY, user.id)
      return user
    },
    signup({ name, email, password }) {
      const users = storage.get(USERS_KEY, [])
      if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        throw new Error('An account with this email already exists.')
      }
      const user = {
        id: crypto.randomUUID(),
        name: name || email.split('@')[0],
        email: email.trim(),
        password: hash(password),
        role: 'user',
        createdAt: Date.now()
      }
      users.push(user)
      storage.set(USERS_KEY, users)
      storage.set(SESSION_KEY, user.id) // auto-login after signup
      return user
    },
    logout() { storage.remove(SESSION_KEY) },
    requireAdmin() {
      const u = this.current()
      if (!u || u.role !== 'admin') throw new Error('Admin access required.')
      return u
    }
  }




  // initialize admin seed once
  seedAdmin()




  // -----------------------------------------------
  // cart/cart.js
  // -----------------------------------------------
  const CARTS_KEY = 'p2t_carts_v1' // object mapping userId|guest => cart




  const Cart = {
    _key() {
      const u = Auth.current()
      return u ? `user:${u.id}` : 'guest'
    },
    _all() { return storage.get(CARTS_KEY, {}) },
    _save(all) { storage.set(CARTS_KEY, all) },
    _ensure() {
      const all = this._all()
      const key = this._key()
      if (!all[key]) all[key] = { items: [], updatedAt: Date.now() }
      this._save(all)
      return all[key]
    },
    get() { return this._ensure() },
    add(productId, qty = 1) {
      const all = this._all(); const key = this._key()
      const cart = all[key] || { items: [] }
      const p = Products.get(productId)
      if (!p) throw new Error('Product not found')
      const line = cart.items.find(i => i.productId === productId)
      if (line) line.qty = Math.min(line.qty + qty, p.stock)
      else cart.items.push({ productId, qty: Math.min(qty, p.stock) })
      cart.updatedAt = Date.now()
      all[key] = cart
      this._save(all)
      UI.cartCount()
      return cart
    },
    update(productId, qty) {
      qty = Math.max(0, qty)
      const all = this._all(); const key = this._key()
      const cart = all[key] || { items: [] }
      const line = cart.items.find(i => i.productId === productId)
      if (!line) return cart
      if (qty === 0) cart.items = cart.items.filter(i => i.productId !== productId)
      else {
        const p = Products.get(productId)
        line.qty = Math.min(qty, p ? p.stock : qty)
      }
      cart.updatedAt = Date.now()
      all[key] = cart
      this._save(all)
      UI.cartCount()
      return cart
    },
    clear() {
      const all = this._all(); const key = this._key()
      all[key] = { items: [], updatedAt: Date.now() }
      this._save(all)
      UI.cartCount()
    },
    total() {
      const cart = this.get()
      let subtotal = 0
      const enriched = cart.items.map(line => {
        const p = Products.get(line.productId)
        const lineTotal = p ? p.price * line.qty : 0
        subtotal += lineTotal
        return { ...line, product: p, lineTotal }
      })
      const shipping = subtotal > 75 || subtotal === 0 ? 0 : 7.99
      const tax = +(subtotal * 0.07).toFixed(2)
      const total = +(subtotal + shipping + tax).toFixed(2)
      return { items: enriched, subtotal, shipping, tax, total }
    }
  }




  // -----------------------------------------------
  // ui/common.js
  // -----------------------------------------------
  const UI = {
    cartCount() {
      const el = $('#cart-count')
      if (!el) return
      const count = Cart.get().items.reduce((n, i) => n + i.qty, 0)
      el.textContent = String(count)
      if (count > 0) el.style.display = 'inline-block'
    },
    authToggles() {
      const u = Auth.current()
      const showIf = (sel, cond) => $$(sel).forEach(n => n.style.display = cond ? '' : 'none')
      showIf('[data-auth="signed-in"]', !!u)
      showIf('[data-auth="signed-out"]', !u)
      showIf('[data-auth="admin"]', u && u.role === 'admin')
      const nameEl = $('#user-name')
      if (nameEl) nameEl.textContent = u ? (u.name || u.email) : 'Guest'
    },
    flash(msg, type = 'info') {
      let bar = $('#flash')
      if (!bar) {
        bar = document.createElement('div')
        bar.id = 'flash'
        bar.style.position = 'fixed'
        bar.style.bottom = '20px'
        bar.style.left = '50%'
        bar.style.transform = 'translateX(-50%)'
        bar.style.padding = '10px 14px'
        bar.style.borderRadius = '6px'
        bar.style.boxShadow = '0 8px 20px rgba(0,0,0,.12)'
        bar.style.zIndex = '9999'
        document.body.appendChild(bar)
      }
      // Style based on type
      if (type === 'error') {
        bar.style.background = '#ffdddd'
        bar.style.color = '#a00'
        bar.style.border = '1px solid #a00'
      } else if (type === 'success') {
        bar.style.background = '#ddffdd'
        bar.style.color = '#080'
        bar.style.border = '1px solid #080'
      } else {
        bar.style.background = '#E3E6F3'
        bar.style.color = '#1a1a1a'
        bar.style.border = 'none'
      }
      bar.textContent = msg
      bar.style.opacity = '1'
      setTimeout(() => { bar.style.opacity = '0' }, 1800)
    }
  }




  // Run common UI on load
  document.addEventListener('DOMContentLoaded', () => {
    UI.cartCount(); UI.authToggles();
    // Wire global logout buttons
    on(document, 'click', '[data-action="logout"]', () => {
      Auth.logout(); UI.authToggles(); UI.flash('Logged out')
      // Optional hard redirect to home or login
      // location.href = 'index.html'
    })
  })




  // -----------------------------------------------
  // shop/shop.js — render product grid + add-to-cart
  // -----------------------------------------------
  const renderProductCard = (p) => {
    return `
      <div class="pro" data-id="${p.id}">
        <img src="${p.image}" alt="${p.name}">
        <div class="des">
          <span>${p.brand}</span>
          <h5>${p.name}</h5>
          <div class="star">
            ${'★'.repeat(Math.floor(p.rating))}${p.rating % 1 ? '½' : ''}
          </div>
          <h4>$${p.price}</h4>
        </div>
        <button class="add-to-cart normal" data-id="${p.id}"><i class="fa fa-shopping-cart"></i> Add</button>
      </div>`
  }




  const Shop = {
    mount() {
      const grid = document.querySelector('#productGrid');
    if (!grid) return;
    const products = Products.list();
    grid.innerHTML = products.map(renderProductCard).join('');




      on(grid, 'click', '.add-to-cart', (e, btn) => {
        const id = btn.getAttribute('data-id')
        Cart.add(id, 1)
        UI.flash('Added to cart')
      })
    }
  }




  document.addEventListener('DOMContentLoaded', Shop.mount)




  // -----------------------------------------------
  // auth/signup.js — handle signup form
  // -----------------------------------------------
  const Signup = {
    mount() {
      const form = $('#signupForm')
      if (!form) return
      on(form, 'submit', async (e) => {
        e.preventDefault()
        const fd = new FormData(form)
        try {
          const user = Auth.signup({
            name: fd.get('name'),
            email: fd.get('email'),
            password: fd.get('password')
          })
          UI.flash(`Welcome, ${user.name}!`)
          form.reset()
          UI.authToggles()
          // location.href = 'shop.html'
        } catch (err) {
          UI.flash(err.message || 'Signup failed', 'error')
        }
      })
    }
  }
  document.addEventListener('DOMContentLoaded', Signup.mount)




  // -----------------------------------------------
  // auth/login.js — handle login form
  // -----------------------------------------------
  const Login = {
    mount() {
      const form = $('#loginForm'); if (!form) return
      const emailEl = form.querySelector('input[name="email"]')
      const pwEl = form.querySelector('input[name="password"]')




      on(form, 'submit', (e) => {
        e.preventDefault()
        try {
          const u = Auth.login(emailEl.value, pwEl.value)
          UI.flash(`Hello ${u.name || u.email}`)
          UI.authToggles()
          // If this is the admin, nudge them
          if (u.role === 'admin') {
            // location.href = 'admin.html'
          } else {
            // location.href = 'shop.html'
          }
        } catch (err) {
          UI.flash(err.message || 'Login failed', 'error')
        }
      })
    }
  }
  document.addEventListener('DOMContentLoaded', Login.mount)




  // -----------------------------------------------
  // cart/cart-page.js — render cart table & controls
  // -----------------------------------------------
  const CartPage = {
    mount() {
      const table = document.querySelector('#cartTable');
    if (!table) return;
    const tbody = table.querySelector('tbody') || table;




      const render = () => {
        const totals = Cart.total()
        if (tbody.tagName.toLowerCase() === 'tbody') {
          tbody.innerHTML = totals.items.map(({ product, qty, lineTotal }) => `
            <tr data-id="${product.id}">
              <td><img src="${product.image}" alt="${product.name}" style="width:60px;border-radius:8px"></td>
              <td>${product.name}</td>
              <td>$${product.price.toFixed(2)}</td>
              <td>
                <input type="number" class="qty" min="0" value="${qty}" style="width:64px">
              </td>
              <td>$${lineTotal.toFixed(2)}</td>
              <td><button class="remove normal">Remove</button></td>
            </tr>
          `).join('')
        } else {
          // Fallback if #cartTable is not a <table>
          tbody.innerHTML = totals.items.map(({ product, qty, lineTotal }) => `
            <div class="cart-line" data-id="${product.id}">
              <strong>${product.name}</strong> — $${product.price} ×
              <input type="number" class="qty" min="0" value="${qty}" style="width:64px"> = $${lineTotal.toFixed(2)}
              <button class="remove normal">Remove</button>
            </div>
          `).join('')
        }
        const subtotalEl = $('#cart-subtotal'); if (subtotalEl) subtotalEl.textContent = `$${totals.subtotal.toFixed(2)}`
        const shipEl = $('#cart-shipping'); if (shipEl) shipEl.textContent = `$${totals.shipping.toFixed(2)}`
        const taxEl = $('#cart-tax'); if (taxEl) taxEl.textContent = `$${totals.tax.toFixed(2)}`
        const totalEl = $('#cart-total'); if (totalEl) totalEl.textContent = `$${totals.total.toFixed(2)}`
        UI.cartCount()
      }




      render()




      on(tbody, 'change', '.qty', (e, input) => {
        const id = input.closest('[data-id]').getAttribute('data-id')
        const qty = parseInt(input.value || '0', 10)
        Cart.update(id, qty)
        render()
      })




      on(tbody, 'click', '.remove', (e, btn) => {
        const id = btn.closest('[data-id]').getAttribute('data-id')
        Cart.update(id, 0)
        render(); UI.flash('Removed from cart')
      })




      const clearBtn = $('#cart-clear')
      on(clearBtn, 'click', () => { Cart.clear(); render() })
    }
  }
  document.addEventListener('DOMContentLoaded', CartPage.mount)




  // -----------------------------------------------
  // checkout/checkout.js — guest & user checkout
  // -----------------------------------------------
  const Checkout = {
    mount() {
      const form = $('#checkoutForm'); if (!form) return
      const orderOut = $('#orderSummary')




      const renderOrder = () => {
        const t = Cart.total()
        if (!orderOut) return
        orderOut.innerHTML = `
          <h4>Order Summary</h4>
          <ul>
            ${t.items.map(i => `<li>${i.product.name} × ${i.qty} — $${i.lineTotal.toFixed(2)}</li>`).join('')}
          </ul>
          <p>Subtotal: $${t.subtotal.toFixed(2)}</p>
          <p>Shipping: $${t.shipping.toFixed(2)}</p>
          <p>Tax: $${t.tax.toFixed(2)}</p>
          <h3>Total: $${t.total.toFixed(2)}</h3>
        `
      }




      renderOrder()




      on(form, 'submit', (e) => {
        e.preventDefault()
        const fd = new FormData(form)
        const shipping = {
          email: fd.get('email'),
          name: fd.get('name'),
          address: fd.get('address'),
          city: fd.get('city'),
          state: fd.get('state'),
          zip: fd.get('zip')
        }
        const order = {
          id: 'ord_' + Date.now(),
          userId: Auth.current()?.id || null,
          items: Cart.total().items.map(i => ({ id: i.productId, qty: i.qty, price: i.product.price })),
          amounts: Cart.total(),
          shipping,
          createdAt: Date.now(),
          status: 'paid' // simulated
        }
        // Persist to a simple orders list (demo only)
        const orders = storage.get('p2t_orders_v1', [])
        orders.push(order)
        storage.set('p2t_orders_v1', orders)




        Cart.clear()
        UI.flash('Order placed! Thank you.')
        if (orderOut) orderOut.innerHTML = `<h3>Thanks ${shipping.name || 'Friend'}! Your order #${order.id} is confirmed.</h3>`
        form.reset(); UI.cartCount()
      })
    }
  }
  document.addEventListener('DOMContentLoaded', Checkout.mount)




  // -----------------------------------------------
  // admin/admin.js — simple product CRUD
  // -----------------------------------------------
  const Admin = {
    mount() {
      const wrap = document.querySelector('#adminPanel') || document.querySelector('#admin');
    if (!wrap) return;




      const form = $('#adminProductForm')
      const listEl = $('#adminProductList')




      const render = () => {
        const items = Products.list()
        if (listEl) listEl.innerHTML = items.map(p => `
          <div class="admin-row" data-id="${p.id}" style="display:grid;grid-template-columns:80px 1fr 1fr 120px 80px 80px;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid #eee;">
            <img src="${p.image}" alt="${p.name}" style="width:72px;border-radius:8px;object-fit:cover;">
            <input class="name" value="${p.name}">
            <input class="image" value="${p.image}">
            <input class="brand" value="${p.brand}">
            <input class="price" type="number" min="0" step="0.01" value="${p.price}">
            <input class="stock" type="number" min="0" value="${p.stock}">
            <button class="save normal">Save</button>
            <button class="delete normal">Delete</button>
          </div>
        `).join('')
      }




      render()




      on(form, 'submit', (e) => {
        e.preventDefault()
        const fd = new FormData(form)
        const prod = {
          id: 'p-' + crypto.randomUUID().slice(0,8),
          name: fd.get('name'),
          image: fd.get('image') || 'src/img/placeholder.png',
          brand: fd.get('brand') || 'brand',
          price: parseFloat(fd.get('price') || '0') || 0,
          rating: 4.5,
          stock: parseInt(fd.get('stock') || '0', 10) || 0,
          tags: (fd.get('tags') || '').split(',').map(s => s.trim()).filter(Boolean)
        }
        Products.upsert(prod)
        render(); form.reset(); UI.flash('Product created')
      })




      on(listEl, 'click', '.save', (e, btn) => {
        const row = btn.closest('[data-id]')
        const id = row.getAttribute('data-id')
        const prod = Products.get(id)
        if (!prod) return
        prod.name = row.querySelector('.name').value
        prod.image = row.querySelector('.image').value
        prod.brand = row.querySelector('.brand').value
        prod.price = parseFloat(row.querySelector('.price').value)
        prod.stock = parseInt(row.querySelector('.stock').value, 10)
        Products.upsert(prod)
        UI.flash('Saved')
      })




      on(listEl, 'click', '.delete', (e, btn) => {
        const id = btn.closest('[data-id]').getAttribute('data-id')
        Products.remove(id); render(); UI.flash('Deleted')
      })
    }
  }
  document.addEventListener('DOMContentLoaded', Admin.mount)


})()
