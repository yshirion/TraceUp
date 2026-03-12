import express from 'express';
import { CompanyTypes, createScraper, SCRAPERS } from 'israeli-bank-scrapers';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import session from 'express-session';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ═══ Data Storage ═══

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function loadUsers() {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify({ users: {} }));
        return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } catch {
        return { users: {} };
    }
}

function saveUsers(data) {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

// ═══ Credential Encryption ═══

const ALGO = 'aes-256-gcm';

function deriveKey(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha512');
}

function encryptCredentials(credentials, userPassword) {
    const salt = crypto.randomBytes(16);
    const key = deriveKey(userPassword, salt);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    let encrypted = cipher.update(JSON.stringify(credentials), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();
    return { salt: salt.toString('hex'), iv: iv.toString('hex'), tag: tag.toString('hex'), data: encrypted };
}

function decryptCredentials(encrypted, userPassword) {
    const salt = Buffer.from(encrypted.salt, 'hex');
    const key = deriveKey(userPassword, salt);
    const iv = Buffer.from(encrypted.iv, 'hex');
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(Buffer.from(encrypted.tag, 'hex'));
    let decrypted = decipher.update(encrypted.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
}

// ═══ Express Setup ═══

const app = express();
app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET || 'israeli-bank-scraper-secret-' + uuidv4(),
    resave: false,
    saveUninitialized: false,
    rolling: true, // resets expiry on every request (activity-based timeout)
    cookie: { maxAge: 2 * 60 * 1000 } // 2 minutes of inactivity
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Auth middleware
function requireAuth(req, res, next) {
    if (!req.session.username) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
}

// ═══ Auth Endpoints ═══

app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    if (username.length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    if (password.length < 4) {
        return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    const data = loadUsers();
    if (data.users[username]) {
        return res.status(409).json({ error: 'Username already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    data.users[username] = { passwordHash, companies: {} };
    saveUsers(data);

    req.session.username = username;
    req.session.userPassword = password; // kept in session memory only, for decryption
    res.json({ success: true, username });
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    const data = loadUsers();
    const user = data.users[username];
    if (!user) {
        return res.status(401).json({ error: 'Invalid username or password' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
        return res.status(401).json({ error: 'Invalid username or password' });
    }

    req.session.username = username;
    req.session.userPassword = password;
    res.json({ success: true, username });
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/auth/me', (req, res) => {
    if (req.session.username) {
        res.json({ authenticated: true, username: req.session.username });
    } else {
        res.json({ authenticated: false });
    }
});

// ═══ Scrapers List ═══

app.get('/api/scrapers', (req, res) => {
    const scrapers = {};
    for (const [key, value] of Object.entries(SCRAPERS)) {
        if (key === 'oneZero') continue;
        scrapers[key] = {
            name: value.name,
            loginFields: value.loginFields.filter(f => f !== 'otpCodeRetriever' && f !== 'otpLongTermToken')
        };
    }
    res.json(scrapers);
});

// ═══ Company Management ═══

app.get('/api/companies', requireAuth, (req, res) => {
    const data = loadUsers();
    const user = data.users[req.session.username];
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Return company IDs and names, never credentials
    const banks = [
        'hapoalim', 'beinleumi', 'union', 'otsarHahayal', 'discount', 
        'mercantile', 'mizrahi', 'leumi', 'massad', 'yahav', 'oneZero', 'pagi'
    ];
    
    const companies = {};
    for (const [companyId, info] of Object.entries(user.companies || {})) {
        const scraperInfo = SCRAPERS[companyId];
        companies[companyId] = {
            name: scraperInfo?.name || companyId,
            type: banks.includes(companyId) ? 'bank' : 'creditCard',
            addedAt: info.addedAt
        };
    }
    res.json(companies);
});

app.post('/api/companies/add', requireAuth, (req, res) => {
    const { companyId, credentials } = req.body;
    if (!companyId || !credentials) {
        return res.status(400).json({ error: 'Missing companyId or credentials' });
    }
    if (!SCRAPERS[companyId]) {
        return res.status(400).json({ error: 'Unknown company' });
    }

    const data = loadUsers();
    const user = data.users[req.session.username];
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Block duplicate registration
    if (user.companies[companyId]) {
        return res.status(409).json({
            error: `${SCRAPERS[companyId].name} is already registered. Remove it first if you want to update the credentials.`
        });
    }

    // Encrypt credentials with user's password
    const encrypted = encryptCredentials(credentials, req.session.userPassword);
    user.companies[companyId] = {
        encrypted,
        addedAt: new Date().toISOString()
    };
    saveUsers(data);

    res.json({ success: true, message: `${SCRAPERS[companyId].name} registered successfully` });
});

app.delete('/api/companies/:id', requireAuth, (req, res) => {
    const companyId = req.params.id;
    const data = loadUsers();
    const user = data.users[req.session.username];
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.companies[companyId]) {
        return res.status(404).json({ error: 'Company not registered' });
    }

    delete user.companies[companyId];
    saveUsers(data);
    res.json({ success: true });
});

// ═══ Transaction Processing Helper ═══

function processTransactions(scrapeResult, companyId) {
    const transactions = [];
    scrapeResult.accounts.forEach((account) => {
        account.txns.forEach((txn) => {
            const date = new Date(txn.date);
            if (date > new Date()) return;

            const dd = String(date.getDate()).padStart(2, '0');
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const yyyy = date.getFullYear();

            const isInstallments = txn.type === 'installments';
            // Treat missing/null originalCurrency as ILS
            const isNonILS = !!txn.originalCurrency && txn.originalCurrency !== 'ILS' && txn.originalCurrency !== '₪';

            const chargedAmount = txn.chargedAmount * -1;
            const originalAmountRaw = (isInstallments || isNonILS) ? (txn.originalAmount ? txn.originalAmount * -1 : chargedAmount) : '';

            let originalAmount = '';
            if (originalAmountRaw !== '') {
                originalAmount = isNonILS ? `${originalAmountRaw} ${txn.originalCurrency}` : originalAmountRaw;
            }

            const memo = isInstallments ? (txn.memo || '') : '';

            transactions.push({
                company: companyId,
                account: account.accountNumber,
                date: `${dd}/${mm}/${yyyy}`,
                chargedAmount,
                description: txn.description,
                originalAmount,
                memo,
                category: txn.category || '',
                isNonILS,
                isInstallments,
                companyType: banks.includes(companyId) ? 'bank' : 'creditCard'
            });
        });
    });
    return transactions;
}

// ═══ Single Company Scrape ═══

app.post('/api/scrape', requireAuth, async (req, res) => {
    const { companyId, credentials, startDate } = req.body;

    if (!companyId || !credentials || !startDate) {
        return res.status(400).json({ error: 'Missing companyId, credentials, or startDate' });
    }

    try {
        const scraper = createScraper({
            companyId,
            startDate: new Date(startDate),
            combineInstallments: false,
            showBrowser: false
        });

        const scrapeResult = await scraper.scrape(credentials);

        if (scrapeResult.success) {
            res.json({ success: true, transactions: processTransactions(scrapeResult, companyId) });
        } else {
            res.json({
                success: false,
                errorType: scrapeResult.errorType,
                errorMessage: scrapeResult.errorMessage || ''
            });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ═══ Scrape All Companies (Parallel) ═══

app.post('/api/scrape-all', requireAuth, async (req, res) => {
    const { startDate } = req.body;
    if (!startDate) {
        return res.status(400).json({ error: 'Missing startDate' });
    }

    const data = loadUsers();
    const user = data.users[req.session.username];
    if (!user) return res.status(404).json({ error: 'User not found' });

    const companyIds = Object.keys(user.companies || {});
    if (companyIds.length === 0) {
        return res.status(400).json({ error: 'No companies registered. Add companies first.' });
    }

    // Always fetch data for the last 3 months
    const scrapeStartDate = new Date();
    scrapeStartDate.setMonth(scrapeStartDate.getMonth() - 3);

    // Decrypt all credentials and launch scrapers in parallel
    const scrapePromises = companyIds.map(async (companyId) => {
        try {
            const credentials = decryptCredentials(
                user.companies[companyId].encrypted,
                req.session.userPassword
            );

            const scraper = createScraper({
                companyId,
                startDate: scrapeStartDate,
                combineInstallments: false,
                showBrowser: false,
                includeRawTransaction: true
            });

            const result = await scraper.scrape(credentials);

            if (result.success) {
                if (companyId === 'leumi' && result.accounts[0]?.txns[0]?.rawTransaction) {
                    require('fs').writeFileSync('raw-txn.json', JSON.stringify(result.accounts[0].txns[0].rawTransaction, null, 2));
                }
                return {
                    companyId,
                    companyName: SCRAPERS[companyId]?.name || companyId,
                    success: true,
                    transactions: processTransactions(result, companyId)
                };
            } else {
                return {
                    companyId,
                    companyName: SCRAPERS[companyId]?.name || companyId,
                    success: false,
                    errorType: result.errorType,
                    errorMessage: result.errorMessage || ''
                };
            }
        } catch (e) {
            return {
                companyId,
                companyName: SCRAPERS[companyId]?.name || companyId,
                success: false,
                errorType: 'GENERAL_ERROR',
                errorMessage: e.message
            };
        }
    });

    const results = await Promise.allSettled(scrapePromises);
    const companyResults = results.map(r => r.status === 'fulfilled' ? r.value : {
        success: false, errorType: 'GENERAL_ERROR', errorMessage: 'Unexpected error'
    });

    // Combine all successful transactions
    const allTransactions = [];
    const summary = [];

    for (const result of companyResults) {
        if (result.success) {
            allTransactions.push(...result.transactions);
            summary.push({ companyId: result.companyId, name: result.companyName, status: 'success', count: result.transactions.length });
        } else {
            summary.push({ companyId: result.companyId, name: result.companyName, status: 'error', error: result.errorMessage || result.errorType });
        }
    }

    res.json({ success: true, transactions: allTransactions, summary });
});

// ═══ Global Error Handler ═══

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err.message);
    res.status(500).json({ error: err.message || 'Internal server error' });
});

// ═══ Start Server ═══

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
