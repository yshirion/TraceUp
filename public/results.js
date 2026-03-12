let allTransactions = [];
let visibleTransactions = [];
let currentSort = 'date';
let sortAsc = false; // newest first by default

// Parse dd/mm/yyyy to Date for comparison
function parseDate(str) {
    const [dd, mm, yyyy] = str.split('/');
    return new Date(+yyyy, +mm - 1, +dd);
}

function init() {
    const data = sessionStorage.getItem('scrapeResults');
    if (!data) {
        document.getElementById('tableBody').innerHTML =
            '<tr><td colspan="8" class="no-data">No data — please run a scrape first</td></tr>';
        return;
    }

    const parsed = JSON.parse(data);
    allTransactions = parsed.transactions;

    // Set max/min limits on the filter input
    const dateInput = document.getElementById('filterFromDate');
    const today = new Date();
    
    // Min is 3 months ago (this is the physical limit of the scraped data)
    const minDate = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate());
    
    const fmt = (d) => {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    
    dateInput.max = fmt(today);
    dateInput.min = fmt(minDate);

    // Set initial value based on dashboard choice
    const startDateStr = sessionStorage.getItem('scrapeStartDate');
    if (startDateStr) {
        dateInput.value = startDateStr;
    } else {
        // Fallback to roughly 1 month ago
        const past = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
        dateInput.value = fmt(past);
    }

    populateDropdowns();
    applyFilters();
}

function populateDropdowns() {
    const companies = new Set();
    const accounts = new Set();
    
    let absMaxAmount = 0;

    allTransactions.forEach(t => {
        companies.add(t.company);
        accounts.add(t.account);
        const absVal = Math.abs(t.chargedAmount);
        if (absVal > absMaxAmount) absMaxAmount = absVal;
    });

    const companySel = document.getElementById('filterCompany');
    Array.from(companies).sort().forEach(c => {
        companySel.innerHTML += `<option value="${c}">${c}</option>`;
    });

    const accountSel = document.getElementById('filterAccount');
    Array.from(accounts).sort().forEach(a => {
        accountSel.innerHTML += `<option value="${a}">${a}</option>`;
    });

    // Setup amount sliders
    const maxValRounded = Math.ceil(absMaxAmount);
    document.getElementById('amountMin').min = 0;
    document.getElementById('amountMin').max = maxValRounded;
    document.getElementById('amountMin').value = 0;
    
    document.getElementById('amountMax').min = 0;
    document.getElementById('amountMax').max = maxValRounded;
    document.getElementById('amountMax').value = maxValRounded;

    document.getElementById('amountMinRaw').value = 0;
    document.getElementById('amountMaxRaw').value = maxValRounded;
    document.getElementById('amountDisplay').textContent = `0 to ${maxValRounded}`;
}

function syncAmountInputs(fromRaw) {
    const minSlider = document.getElementById('amountMin');
    const maxSlider = document.getElementById('amountMax');
    const minRaw = document.getElementById('amountMinRaw');
    const maxRaw = document.getElementById('amountMaxRaw');
    const display = document.getElementById('amountDisplay');

    let minVal, maxVal;

    if (fromRaw) {
        minVal = parseInt(minRaw.value) || 0;
        maxVal = parseInt(maxRaw.value) || 0;
        minSlider.value = minVal;
        maxSlider.value = maxVal;
    } else {
        minVal = parseInt(minSlider.value);
        maxVal = parseInt(maxSlider.value);
        
        // Prevent sliders from crossing
        if (minVal > maxVal) {
            if (this.id === 'amountMin') minVal = maxVal;
            else maxVal = minVal;
            minSlider.value = minVal;
            maxSlider.value = maxVal;
        }

        minRaw.value = minVal;
        maxRaw.value = maxVal;
    }

    display.textContent = `${minVal} to ${maxVal}`;
    applyFilters();
}

function resetFilters() {
    document.getElementById('filterCompany').value = 'all';
    document.getElementById('filterAccount').value = 'all';
    document.getElementById('filterCurrency').value = 'all';
    document.getElementById('filterInstallments').value = 'all';
    
    document.getElementById('amountMin').value = 0;
    document.getElementById('amountMax').value = document.getElementById('amountMax').max;
    syncAmountInputs(false); // will trigger applyFilters
}

function applyFilters() {
    const dateStr = document.getElementById('filterFromDate').value;
    const company = document.getElementById('filterCompany').value;
    const account = document.getElementById('filterAccount').value;
    const currency = document.getElementById('filterCurrency').value;
    const installments = document.getElementById('filterInstallments').value;
    
    const amountMin = parseFloat(document.getElementById('amountMin').value) || 0;
    const amountMax = parseFloat(document.getElementById('amountMax').value) || Infinity;

    // Base date logic
    const userChoiceDate = dateStr ? new Date(dateStr) : null;
    if (userChoiceDate) userChoiceDate.setHours(0, 0, 0, 0);
    
    visibleTransactions = allTransactions.filter(t => {
        // 1. Date filter
        if (userChoiceDate && parseDate(t.date) < userChoiceDate) return false;

        // 2. Company filter
        if (company !== 'all' && t.company !== company) return false;

        // 3. Account filter
        if (account !== 'all' && t.account !== account) return false;

        // 4. Currency filter
        let isForeign = t.isNonILS;
        if (isForeign === undefined) {
            // Fallback for older cached scrapes that don't have isNonILS yet
            isForeign = !!t.originalCurrency && t.originalCurrency !== 'ILS' && t.originalCurrency !== '₪';
        }

        if (currency === 'ils' && isForeign) return false;
        if (currency === 'foreign' && !isForeign) return false;

        // 5. Installments filter
        const isInstallment = t.installments && t.installments.number > 0;
        if (installments === 'only' && !isInstallment) return false;
        if (installments === 'none' && isInstallment) return false;

        // 6. Amount Amount (Absolute Value) Range
        const absAmount = Math.abs(t.chargedAmount);
        if (absAmount < amountMin || absAmount > amountMax) return false;

        return true;
    });

    document.getElementById('countBadge').textContent = `${visibleTransactions.length} transactions`;
    sortBy(currentSort, true); // re-apply sort with new filtered list
}

function sortBy(field, keepDirection = false) {
    if (!keepDirection && currentSort === field) {
        sortAsc = !sortAsc;
    } else if (!keepDirection) {
        currentSort = field;
        sortAsc = field === 'company' || field === 'account';
    }

    // Update button styling
    document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('sort' + field.charAt(0).toUpperCase() + field.slice(1)).classList.add('active');

    // Update arrows
    document.getElementById('arrowDate').textContent = currentSort === 'date' ? (sortAsc ? '▲' : '▼') : '▼';
    document.getElementById('arrowCompany').textContent = currentSort === 'company' ? (sortAsc ? '▲' : '▼') : '▼';
    document.getElementById('arrowAccount').textContent = currentSort === 'account' ? (sortAsc ? '▲' : '▼') : '▼';

    const sorted = [...visibleTransactions].sort((a, b) => {
        let cmp = 0;
        if (field === 'date') {
            cmp = parseDate(a.date) - parseDate(b.date);
        } else if (field === 'company') {
            cmp = a.company.localeCompare(b.company);
            if (cmp === 0) cmp = parseDate(a.date) - parseDate(b.date); // Fallback date sort
        } else if (field === 'account') {
            // Sort by company first to group accounts correctly
            cmp = a.company.localeCompare(b.company);
            // If same company, sort by account
            if (cmp === 0) cmp = a.account.localeCompare(b.account);
            // If same account, fallback to date
            if (cmp === 0) cmp = parseDate(a.date) - parseDate(b.date);
        }
        return sortAsc ? cmp : -cmp;
    });

    renderTable(sorted);
}

function renderTable(transactions) {
    const tbody = document.getElementById('tableBody');

    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="no-data">No transactions found for the selected date range.</td></tr>';
        return;
    }

    tbody.innerHTML = transactions.map((t, i) => {
        const amountClass = t.chargedAmount >= 0 ? 'amount-positive' : 'amount-negative';
        return `<tr>
        <td class="text-muted">${i + 1}</td>
        <td><span class="company-badge">${t.company}</span></td>
        <td>${t.account}</td>
        <td>${t.date}</td>
        <td class="${amountClass}">${t.chargedAmount.toFixed(2)}</td>
        <td>${t.description}</td>
        <td>${t.originalAmount || '<span class="text-muted">—</span>'}</td>
        <td>${t.memo || '<span class="text-muted">—</span>'}</td>
    </tr>`;
    }).join('');
}

// Boot up
document.addEventListener('DOMContentLoaded', init);
