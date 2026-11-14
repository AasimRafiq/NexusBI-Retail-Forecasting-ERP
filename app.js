const DEFAULT_SKUS = [
  { sku: "PWR-101", name: "65W GaN Dual USB-C Charger", category: "Chargers & Power", cost: 1850, price: 3200, stock: 16, reorder: 5 },
  { sku: "PWR-102", name: "10,000mAh MagSafe PowerBank", category: "Chargers & Power", cost: 2400, price: 3950, stock: 9, reorder: 4 },
  { sku: "PRT-201", name: "Anti-Static Privacy Glass (iPhone)", category: "Protection & Cases", cost: 220, price: 650, stock: 4, reorder: 8 },
  { sku: "PRT-202", name: "Kevlar Aramid Fiber Case", category: "Protection & Cases", cost: 750, price: 1650, stock: 14, reorder: 5 },
  { sku: "AUD-301", name: "ANC Wireless Earbuds Pro", category: "Audio & Wearables", cost: 2600, price: 4500, stock: 7, reorder: 4 },
  { sku: "CBL-401", name: "100W Braided E-Marker Cable", category: "Cables & Adapters", cost: 340, price: 850, stock: 25, reorder: 6 }
];

const KEYS = {
  SKUS: "nexus_skus_v1",
  INVOICES: "nexus_invoices_v1"
};

let skus = JSON.parse(localStorage.getItem(KEYS.SKUS)) || DEFAULT_SKUS;
let invoices = JSON.parse(localStorage.getItem(KEYS.INVOICES)) || [];
let cart = [];

const $ = (id) => document.getElementById(id);

function saveDB() {
  localStorage.setItem(KEYS.SKUS, JSON.stringify(skus));
  localStorage.setItem(KEYS.INVOICES, JSON.stringify(invoices));
}

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  setTimeout(() => t.classList.add("hidden"), 2500);
}

// TAB ROUTING
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.add("hidden"));
    btn.classList.add("active");
    const target = btn.dataset.tab;
    $(target).classList.remove("hidden");

    const meta = {
      dashboardTab: ["Executive BI & Demand Forecasting", "Real-time profit analytics, 7-day OLS linear regression forecast, and AI copilot"],
      posTab: ["POS Checkout Terminal", "SKU barcode lookup, tax/discount billing, and automated stock deduction"],
      inventoryTab: ["ABC Pareto Inventory Matrix", "Revenue-weighted SKU classification and automated reorder thresholds"],
      ledgerTab: ["Audit & Sales Ledger", "Complete transaction history with COGS and net profit tracking"]
    };
    $("viewTitle").textContent = meta[target][0];
    $("viewDesc").textContent = meta[target][1];

    if (target === "dashboardTab") renderBI();
    if (target === "posTab") renderPOS();
    if (target === "inventoryTab") renderABCInventory();
    if (target === "ledgerTab") renderLedger();
  });
});

// ORDINARY LEAST SQUARES (OLS) LINEAR REGRESSION FOR 7-DAY FORECAST
function computeLinearForecast(dailyTotals) {
  const n = dailyTotals.length;
  if (n < 2) {
    const base = n === 1 ? dailyTotals[0] : 0;
    return { slope: 0, predictions: Array(7).fill(base) };
  }
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += dailyTotals[i];
    sumXY += i * dailyTotals[i];
    sumXX += i * i;
  }
  const denom = (n * sumXX - sumX * sumX);
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  const predictions = [];
  for (let step = 0; step < 7; step++) {
    const val = Math.max(0, Math.round(intercept + slope * (n + step)));
    predictions.push(val);
  }
  return { slope: Math.round(slope), predictions };
}

function getDailyRevenueSeries() {
  const map = {};
  invoices.forEach(inv => {
    map[inv.dateKey] = (map[inv.dateKey] || 0) + inv.total;
  });
  const sortedKeys = Object.keys(map).sort();
  const recentKeys = sortedKeys.slice(-14);
  return recentKeys.map(k => ({ label: k.slice(5), value: map[k] }));
}

function renderBI() {
  const totalRev = invoices.reduce((s, i) => s + i.total, 0);
  const totalCogs = invoices.reduce((s, i) => s + i.cogs, 0);
  const netProfit = Math.max(0, totalRev - totalCogs);
  const margin = totalRev ? ((netProfit / totalRev) * 100).toFixed(1) : 0;
  const invCostValue = skus.reduce((s, p) => s + p.cost * p.stock, 0);

  const series = getDailyRevenueSeries();
  const { slope, predictions } = computeLinearForecast(series.map(s => s.value));

  $("kpiRev").textContent = `PKR ${totalRev.toLocaleString()}`;
  $("kpiRevSub").textContent = `${invoices.length} invoice(s) recorded`;
  $("kpiProfit").textContent = `PKR ${netProfit.toLocaleString()}`;
  $("kpiMarginSub").textContent = `${margin}% gross margin`;
  $("kpiForecast").textContent = `PKR ${predictions[0].toLocaleString()}`;
  $("kpiTrendSub").textContent = `Daily trend slope: ${slope >= 0 ? "+" : ""}${slope} PKR/day`;
  $("kpiInvVal").textContent = `PKR ${invCostValue.toLocaleString()}`;
  $("kpiSkuCount").textContent = `${skus.length} active SKUs`;

  const lowCount = skus.filter(s => s.stock <= s.reorder).length;
  $("lowStockBadge").textContent = lowCount;

  // Render Combined Actual + 7-Day Forecast Bar Chart
  const chartBox = $("forecastChartContainer");
  const combined = [
    ...series.map(s => ({ label: s.label, val: s.value, type: "actual" })),
    ...predictions.map((p, idx) => ({ label: `+D${idx + 1}`, val: p, type: "pred" }))
  ];

  if (combined.every(c => c.val === 0)) {
    chartBox.innerHTML = `<p class="muted" style="margin:auto;">No sales data yet. Click "+ Inject 14-Day Sales Data" in the sidebar or record a sale in POS.</p>`;
    return;
  }

  const maxVal = Math.max(...combined.map(c => c.val), 1);
  chartBox.innerHTML = combined.map(bar => {
    const hPct = Math.max(4, Math.round((bar.val / maxVal) * 100));
    return `
      <div class="bar-col" title="${bar.label}: PKR ${bar.val.toLocaleString()}">
        <div class="bar-rect ${bar.type}" style="height:${hPct}%"></div>
        <span class="bar-lbl">${bar.label}</span>
      </div>
    `;
  }).join("");
}

// POS CHECKOUT TERMINAL
function renderPOS() {
  const cats = ["ALL", ...new Set(skus.map(s => s.category))];
  const sel = $("posCatFilter");
  const currentVal = sel.value || "ALL";
  sel.innerHTML = cats.map(c => `<option value="${c}">${c === "ALL" ? "All Categories" : c}</option>`).join("");
  sel.value = currentVal;

  const q = $("posSearch").value.trim().toLowerCase();
  const filtered = skus.filter(p => {
    const catMatch = sel.value === "ALL" || p.category === sel.value;
    const textMatch = p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
    return catMatch && textMatch;
  });

  $("posProductGrid").innerHTML = filtered.map(p => `
    <div class="sku-card ${p.stock === 0 ? "disabled" : ""}">
      <div>
        <div class="sku-top"><span>${p.sku}</span><span>Stock: ${p.stock}</span></div>
        <h4>${p.name}</h4>
        <small class="muted">${p.category}</small>
      </div>
      <div class="sku-bot">
        <strong>PKR ${p.price.toLocaleString()}</strong>
        <button class="btn-accent" style="padding:5px 10px;font-size:0.8rem;" ${p.stock === 0 ? "disabled" : ""} onclick="addPosItem('${p.sku}')">+ Add</button>
      </div>
    </div>
  `).join("");
  renderPosCart();
}

$("posSearch").addEventListener("input", renderPOS);
$("posCatFilter").addEventListener("change", renderPOS);

function addPosItem(skuCode) {
  const prod = skus.find(p => p.sku === skuCode);
  if (!prod || prod.stock <= 0) return;
  const line = cart.find(c => c.sku === skuCode);
  if (line) {
    if (line.qty < prod.stock) line.qty += 1;
    else toast("Max available stock reached.");
  } else {
    cart.push({ sku: prod.sku, name: prod.name, cost: prod.cost, price: prod.price, qty: 1 });
  }
  renderPosCart();
}

function stepPosQty(skuCode, delta) {
  const idx = cart.findIndex(c => c.sku === skuCode);
  if (idx === -1) return;
  const prod = skus.find(p => p.sku === skuCode);
  const next = cart[idx].qty + delta;
  if (next <= 0) cart.splice(idx, 1);
  else if (prod && next <= prod.stock) cart[idx].qty = next;
  renderPosCart();
}

function renderPosCart() {
  const box = $("posCartList");
  if (cart.length === 0) {
    box.innerHTML = `<p class="muted">Cart is empty.</p>`;
    $("cSub").textContent = "PKR 0";
    $("cDisc").textContent = "-PKR 0";
    $("cTax").textContent = "PKR 0";
    $("cNet").textContent = "PKR 0";
    $("finalizeSaleBtn").disabled = true;
    return;
  }

  box.innerHTML = cart.map(c => `
    <div class="c-row">
      <div><strong>${c.name}</strong><br/><small class="muted">PKR ${c.price} x ${c.qty}</small></div>
      <div class="q-btns">
        <button onclick="stepPosQty('${c.sku}', -1)">-</button>
        <span>${c.qty}</span>
        <button onclick="stepPosQty('${c.sku}', 1)">+</button>
      </div>
    </div>
  `).join("");

  const sub = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const discPct = Math.min(50, Math.max(0, Number($("discountPct").value) || 0));
  const disc = Math.round(sub * (discPct / 100));
  const tax = Math.round((sub - disc) * 0.05);
  const net = sub - disc + tax;

  $("cSub").textContent = `PKR ${sub.toLocaleString()}`;
  $("cDisc").textContent = `-PKR ${disc.toLocaleString()}`;
  $("cTax").textContent = `PKR ${tax.toLocaleString()}`;
  $("cNet").textContent = `PKR ${net.toLocaleString()}`;
  $("finalizeSaleBtn").disabled = false;
}

$("discountPct").addEventListener("input", renderPosCart);
$("resetCartBtn").addEventListener("click", () => { cart = []; renderPosCart(); });

$("finalizeSaleBtn").addEventListener("click", () => {
  if (cart.length === 0) return;
  const sub = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const cogs = cart.reduce((s, c) => s + c.cost * c.qty, 0);
  const discPct = Math.min(50, Math.max(0, Number($("discountPct").value) || 0));
  const disc = Math.round(sub * (discPct / 100));
  const tax = Math.round((sub - disc) * 0.05);
  const total = sub - disc + tax;

  cart.forEach(c => {
    const p = skus.find(s => s.sku === c.sku);
    if (p) p.stock = Math.max(0, p.stock - c.qty);
  });

  const today = new Date().toISOString().slice(0, 10);
  invoices.unshift({
    id: "INV-" + String(Date.now()).slice(-5),
    dateKey: today,
    client: $("clientName").value.trim() || "Walk-In Retail",
    items: JSON.parse(JSON.stringify(cart)),
    total,
    cogs
  });

  saveDB();
  cart = [];
  $("clientName").value = "";
  $("discountPct").value = 0;
  renderPOS();
  renderBI();
  toast("Invoice posted & inventory updated!");
});

// ABC PARETO INVENTORY CLASSIFICATION
function computeAbcTiers() {
  const revBySku = {};
  skus.forEach(s => revBySku[s.sku] = 0);
  invoices.forEach(inv => inv.items.forEach(item => {
    revBySku[item.sku] = (revBySku[item.sku] || 0) + item.price * item.qty;
  }));

  const sorted = [...skus].sort((a, b) => revBySku[b.sku] - revBySku[a.sku]);
  const grandRev = Object.values(revBySku).reduce((s, v) => s + v, 0);

  let cumulative = 0;
  const tierMap = {};
  sorted.forEach(s => {
    if (grandRev === 0) {
      tierMap[s.sku] = "C";
      return;
    }
    cumulative += revBySku[s.sku];
    const share = cumulative / grandRev;
    if (share <= 0.70) tierMap[s.sku] = "A";
    else if (share <= 0.90) tierMap[s.sku] = "B";
    else tierMap[s.sku] = "C";
  });
  return tierMap;
}

function restockSku(skuCode) {
  const item = skus.find(s => s.sku === skuCode);
  if (!item) return;
  item.stock += 10;
  saveDB();
  renderABCInventory();
  renderBI();
  toast(`Added +10 units to ${item.sku}`);
}

function renderABCInventory() {
  const tiers = computeAbcTiers();
  $("abcTableBody").innerHTML = skus.map(s => {
    const margin = Math.round(((s.price - s.cost) / s.price) * 100);
    const isLow = s.stock <= s.reorder;
    const tier = tiers[s.sku] || "C";
    return `
      <tr>
        <td><strong>${s.sku}</strong></td>
        <td>${s.name}</td>
        <td><span class="tier-pill tier-${tier}">Class ${tier}</span></td>
        <td>${margin}% (PKR ${s.price - s.cost})</td>
        <td>${s.stock} / ${s.reorder}</td>
        <td class="${isLow ? "st-low" : "st-ok"}">${isLow ? "Reorder Needed" : "Optimal"}</td>
        <td><button class="mini-btn" onclick="restockSku('${s.sku}')">+10 Restock</button></td>
      </tr>
    `;
  }).join("");
}

$("skuForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const code = $("sSku").value.trim().toUpperCase();
  const existing = skus.find(s => s.sku === code);
  const payload = {
    sku: code,
    name: $("sName").value.trim(),
    category: $("sCat").value,
    cost: Number($("sCost").value),
    price: Number($("sPrice").value),
    stock: Number($("sStock").value),
    reorder: Number($("sReorder").value)
  };
  if (existing) Object.assign(existing, payload);
  else skus.push(payload);

  saveDB();
  e.target.reset();
  renderABCInventory();
  renderBI();
  toast(`SKU ${code} saved.`);
});

// LEDGER
function renderLedger() {
  $("ledgerCount").textContent = `${invoices.length} transaction(s)`;
  $("ledgerTableBody").innerHTML = invoices.map(inv => {
    const profit = Math.max(0, inv.total - inv.cogs);
    return `
      <tr>
        <td><strong>${inv.id}</strong></td>
        <td>${inv.dateKey}</td>
        <td>${inv.client}</td>
        <td>${inv.items.map(i => `${i.qty}x ${i.name}`).join(", ")}</td>
        <td>PKR ${inv.total.toLocaleString()}</td>
        <td>PKR ${inv.cogs.toLocaleString()}</td>
        <td class="st-ok">PKR ${profit.toLocaleString()}</td>
      </tr>
    `;
  }).join("");
}

// BI COPILOT (NATURAL LANGUAGE ENGINE)
function postBiMsg(text, sender) {
  const feed = $("biChatFeed");
  const div = document.createElement("div");
  div.className = `bubble ${sender}`;
  div.textContent = text;
  feed.appendChild(div);
  feed.scrollTop = feed.scrollHeight;
}

$("biChatForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = $("biQueryInput").value.trim();
  if (!q) return;
  postBiMsg(q, "user");
  $("biQueryInput").value = "";

  const lower = q.toLowerCase();
  const series = getDailyRevenueSeries();
  const { slope, predictions } = computeLinearForecast(series.map(s => s.value));
  const lowItems = skus.filter(s => s.stock <= s.reorder);

  let ans = "";
  if (lower.includes("forecast") || lower.includes("predict") || lower.includes("next week")) {
    const weekSum = predictions.reduce((s, v) => s + v, 0);
    ans = `7-Day OLS Forecast projects PKR ${weekSum.toLocaleString()} total revenue (Day +1 est: PKR ${predictions[0].toLocaleString()}, trend slope: ${slope >= 0 ? "+" : ""}${slope}/day).`;
  } else if (lower.includes("reorder") || lower.includes("low") || lower.includes("stock")) {
    ans = lowItems.length
      ? `Reorder Plan (${lowItems.length} SKUs): ${lowItems.map(i => `${i.name} [${i.stock} left, min ${i.reorder}]`).join("; ")}.`
      : "All SKUs are currently above their reorder threshold.";
  } else if (lower.includes("margin") || lower.includes("profit") || lower.includes("highest")) {
    const bestMargin = [...skus].sort((a, b) => ((b.price - b.cost) / b.price) - ((a.price - a.cost) / a.price))[0];
    const pct = Math.round(((bestMargin.price - bestMargin.cost) / bestMargin.price) * 100);
    ans = `Highest margin SKU is "${bestMargin.name}" at ${pct}% gross margin (PKR ${bestMargin.price - bestMargin.cost} profit/unit).`;
  } else if (lower.includes("dead") || lower.includes("slow")) {
    const soldSet = new Set();
    invoices.forEach(inv => inv.items.forEach(i => soldSet.add(i.sku)));
    const unsold = skus.filter(s => !soldSet.has(s.sku));
    ans = unsold.length
      ? `Slow/Zero-movement SKUs: ${unsold.map(u => u.name).join(", ")}. Consider bundling or promotional discounting.`
      : "Every SKU in your catalog has recorded active sales.";
  } else {
    ans = `BI Summary: ${skus.length} SKUs tracked, ${lowItems.length} low-stock alerts, and next-day projected sales of PKR ${predictions[0].toLocaleString()}.`;
  }
  postBiMsg(ans, "bot");
});

// INJECT 14-DAY HISTORICAL DATA FOR DEMO & REGRESSION TESTING
$("seedSampleDataBtn").addEventListener("click", () => {
  const generated = [];
  const clients = ["Walk-In Retail", "TechHub Larkana", "Corporate Order", "Online Store"];
  for (let d = 13; d >= 0; d--) {
    const dt = new Date();
    dt.setDate(dt.getDate() - d);
    const dateKey = dt.toISOString().slice(0, 10);
    const ordersToday = 2 + Math.floor((14 - d) / 4); // upward growth trend

    for (let k = 0; k < ordersToday; k++) {
      const p1 = skus[Math.floor(Math.random() * skus.length)];
      const p2 = skus[Math.floor(Math.random() * skus.length)];
      const items = [{ sku: p1.sku, name: p1.name, cost: p1.cost, price: p1.price, qty: 1 }];
      if (p2.sku !== p1.sku) {
        items.push({ sku: p2.sku, name: p2.name, cost: p2.cost, price: p2.price, qty: 1 });
      }
      const sub = items.reduce((s, i) => s + i.price * i.qty, 0);
      const cogs = items.reduce((s, i) => s + i.cost * i.qty, 0);
      generated.push({
        id: "INV-" + Math.floor(10000 + Math.random() * 89999),
        dateKey,
        client: clients[Math.floor(Math.random() * clients.length)],
        items,
        total: Math.round(sub * 1.05),
        cogs
      });
    }
  }
  invoices = [...generated, ...invoices];
  saveDB();
  renderBI();
  toast("14 days of historical sales injected for forecasting!");
});

// EXPORT CSV
$("exportCsvBtn").addEventListener("click", () => {
  const rows = [
    ["Invoice_ID", "Date", "Client", "Revenue_PKR", "COGS_PKR", "Net_Profit_PKR"],
    ...invoices.map(i => [i.id, i.dateKey, i.client, i.total, i.cogs, Math.max(0, i.total - i.cogs)])
  ];
  const csv = rows.map(r => r.join(",")).join("
");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "nexus-bi-financial-ledger.csv";
  a.click();
});

// INIT
renderBI();
