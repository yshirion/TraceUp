const FIELD_LABELS = {
    username: 'Username', password: 'Password', userCode: 'User Code',
    id: 'ID Number', num: 'Code', card6Digits: 'Last 6 Digits of Card',
    nationalID: 'National ID', email: 'Email', phoneNumber: 'Phone Number'
};

let scrapersData = {};
let currentUser = '';

// ═══ Auth Check ═══
async function checkAuth() {
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (!data.authenticated) {
            window.location.href = 'login.html';
            return;
        }
        currentUser = data.username;
        document.getElementById('greeting').textContent = `🏦 Hey, ${currentUser}`;
        await loadScrapers();
        await loadCompanies();
    } catch {
        window.location.href = 'login.html';
    }
}

async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = 'login.html';
}

// ═══ Scrapers ═══
async function loadScrapers() {
    const res = await fetch('/api/scrapers');
    scrapersData = await res.json();
}

// ═══ Companies ═══
async function loadCompanies() {
    const res = await fetch('/api/companies');
    const companies = await res.json();
    const list = document.getElementById('companyList');
    const empty = document.getElementById('emptyCompanies');

    const keys = Object.keys(companies);
    if (keys.length === 0) {
        list.innerHTML = '';
        list.appendChild(empty);
        empty.style.display = '';
        return;
    }

    const renderItem = (id, c) => {
        const date = c.addedAt ? new Date(c.addedAt).toLocaleDateString() : '';
        return `<li class="company-item">
            <div>
                <div class="name">${c.name}</div>
                <div class="date">Added ${date}</div>
            </div>
            <button class="btn-remove" onclick="removeCompany('${id}')" title="Remove">✕</button>
        </li>`;
    };

    const banks = keys.filter(k => companies[k].type === 'bank');
    const ccs = keys.filter(k => companies[k].type === 'creditCard');

    let html = '';
    if (banks.length > 0) {
        html += `<li class="company-group-title">🏦 Banks</li>`;
        html += banks.map(id => renderItem(id, companies[id])).join('');
    }
    if (ccs.length > 0) {
        html += `<li class="company-group-title">💳 Credit Cards</li>`;
        html += ccs.map(id => renderItem(id, companies[id])).join('');
    }

    list.innerHTML = html;
}

async function removeCompany(id) {
    if (!confirm(`Remove ${scrapersData[id]?.name || id}?`)) return;
    await fetch(`/api/companies/${id}`, { method: 'DELETE' });
    await loadCompanies();
}

// ═══ Add Company Modal ═══
function openAddModal() {
    document.getElementById('addModal').classList.add('active');
    const select = document.getElementById('newCompanySelect');
    select.innerHTML = '<option value="">-- Select a company --</option>';
    
    const banksGroup = document.createElement('optgroup');
    banksGroup.label = 'Banks';
    const ccGroup = document.createElement('optgroup');
    ccGroup.label = 'Credit Cards';

    for (const [key, info] of Object.entries(scrapersData)) {
        const option = `<option value="${key}">${info.name}</option>`;
        if (info.type === 'bank') {
            banksGroup.innerHTML += option;
        } else {
            ccGroup.innerHTML += option;
        }
    }

    if (banksGroup.children.length > 0) select.appendChild(banksGroup);
    if (ccGroup.children.length > 0) select.appendChild(ccGroup);

    document.getElementById('newLoginFields').innerHTML = '';
    setAddStatus(null);
}

function closeAddModal() {
    document.getElementById('addModal').classList.remove('active');
}

document.getElementById('newCompanySelect').addEventListener('change', (e) => {
    const container = document.getElementById('newLoginFields');
    container.innerHTML = '';
    const companyId = e.target.value;
    if (!companyId || !scrapersData[companyId]) return;

    scrapersData[companyId].loginFields.forEach(field => {
        const div = document.createElement('div');
        div.className = 'form-group';
        div.innerHTML = `
            <label for="new-${field}">${FIELD_LABELS[field] || field}</label>
            <input type="${field === 'password' ? 'password' : 'text'}"
                   id="new-${field}" name="${field}"
                   placeholder="${FIELD_LABELS[field] || field}" required>`;
        container.appendChild(div);
    });
});

document.getElementById('addCompanyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const companyId = document.getElementById('newCompanySelect').value;
    if (!companyId) return;

    const credentials = {};
    scrapersData[companyId].loginFields.forEach(field => {
        credentials[field] = document.getElementById(`new-${field}`).value;
    });

    const btn = document.getElementById('btnAddCompany');
    btn.disabled = true;
    btn.textContent = 'Saving...';
    setAddStatus('loading', 'Saving credentials...');

    try {
        const res = await fetch('/api/companies/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ companyId, credentials })
        });
        const data = await res.json();

        if (data.success) {
            setAddStatus('success', data.message);
            await loadCompanies();
            setTimeout(closeAddModal, 800);
        } else {
            setAddStatus('error', data.error);
        }
    } catch (err) {
        setAddStatus('error', err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save Company';
    }
});

function setAddStatus(type, message) {
    const el = document.getElementById('addStatus');
    if (!type) { el.innerHTML = ''; return; }
    const icon = type === 'loading' ? '<div class="spinner"></div>' : '';
    el.innerHTML = `<div class="status-message status-${type}" style="margin-top:14px">${icon} ${message}</div>`;
}

// ═══ Scrape All ═══
async function scrapeAll() {
    const startDate = document.getElementById('startDate').value;
    if (!startDate) {
        setScrapeStatus('error', 'Please select a start date');
        return;
    }

    const btn = document.getElementById('btnScrapeAll');
    btn.disabled = true;
    btn.textContent = '⏳ Scraping...';
    setScrapeStatus('loading', 'Scraping all companies in parallel — this may take a few minutes...');
    document.getElementById('scrapeSummary').innerHTML = '';

    try {
        const res = await fetch('/api/scrape-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ startDate })
        });
        const data = await res.json();

        if (data.error) {
            setScrapeStatus('error', data.error);
            return;
        }

        // Show per-company summary
        const summaryEl = document.getElementById('scrapeSummary');
        summaryEl.innerHTML = data.summary.map(s => {
            if (s.status === 'success') {
                return `<div class="summary-item success">
                    <span class="label">✅ ${s.name}</span>
                    <span>${s.count} transactions</span>
                </div>`;
            } else {
                return `<div class="summary-item error">
                    <span class="label">❌ ${s.name}</span>
                    <span>${s.error}</span>
                </div>`;
            }
        }).join('');

        if (data.transactions.length > 0) {
            setScrapeStatus('success', `Found ${data.transactions.length} total transactions`);
            // Store and navigate to results
            sessionStorage.setItem('scrapeStartDate', startDate);
            sessionStorage.setItem('scrapeResults', JSON.stringify({
                transactions: data.transactions,
                companyId: 'all',
                summary: data.summary
            }));
            setTimeout(() => window.location.href = 'results.html', 1500);
        } else {
            setScrapeStatus('error', 'No transactions found across any company');
        }

    } catch (err) {
        setScrapeStatus('error', err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = '⚡ Scrape All Companies';
    }
}

function setScrapeStatus(type, message) {
    const el = document.getElementById('scrapeStatus');
    if (!type) { el.innerHTML = ''; return; }
    const icon = type === 'loading' ? '<div class="spinner"></div>' : '';
    el.innerHTML = `<div class="status-message status-${type}" style="margin-top:14px">${icon} ${message}</div>`;
}

// Boot up
document.addEventListener('DOMContentLoaded', () => {
    // Default start date: the last 9th of the month
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), 9);
    if (now.getDate() < 9) {
        d.setMonth(d.getMonth() - 1);
    }
    
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    document.getElementById('startDate').value = `${yyyy}-${mm}-${dd}`;

    checkAuth();
});
