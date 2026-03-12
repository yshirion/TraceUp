# Israeli Bank Scraper — Web Interface

A web application for scraping transaction data from Israeli banks and credit card companies, built on top of the [israeli-bank-scrapers](https://github.com/eshaham/israeli-bank-scrapers) library.

## Files

### `server.js` — Backend Server

An Express.js server that:

- **`GET /api/scrapers`** — Returns the list of supported companies (banks & credit cards) along with the login fields each one requires. This is used by the frontend to dynamically build the login form.
- **`POST /api/scrape`** — Receives the selected company, credentials, and start date. Runs the scraper using `israeli-bank-scrapers`, processes the transactions (formats dates, flips amount signs, handles optional fields), and returns them as JSON.
- **Serves static files** from the `public/` folder (the frontend).

### `public/index.html` — Frontend UI

A single-page web interface with:

- **Company dropdown** — Lists all supported banks and credit cards (Isracard, Visa Cal, Leumi, Hapoalim, etc.)
- **Dynamic login fields** — When you select a company, the form automatically shows the correct fields for that company. For example:
  - **Isracard** → ID Number, Last 6 Digits of Card, Password
  - **Bank Leumi** → Username, Password
  - **Discount Bank** → ID Number, Password, Code
  - **Bank Yahav** → Username, National ID, Password
- **Start date picker** — Choose how far back to fetch transactions
- **CSV download** — After scraping, download all transactions as a CSV file

### `public/style.css` — Styling

Dark theme with modern design (glass-morphism, gradient buttons, smooth animations).

### `check.js` — CLI Script (Original)

The original command-line script that scrapes Isracard and saves transactions directly to `transactions.csv`. This was the starting point before the web interface was built.

## CSV Output Format

The exported CSV contains these columns:

| Column | Description |
|---|---|
| `company` | Company ID (e.g., "isracard", "visaCal") |
| `account` | Card/account number |
| `date` | Transaction date in `dd/mm/yyyy` format |
| `chargedAmount` | Amount charged (positive = charge, negative = refund/credit) |
| `description` | Transaction description (in Hebrew) |
| `originalAmount` | Only shown if the transaction is in installments or in a foreign currency. For foreign currency, includes the currency code (e.g., "110.76 USD") |
| `memo` | Only shown for installment transactions (e.g., "תשלום 1 מתוך 2") |

**Notes:**
- The CSV includes a UTF-8 BOM so Hebrew text displays correctly in Excel
- Future transactions (date after today) are excluded
- Amount signs are flipped: charges are positive, credits/refunds are negative

## How to Run

```bash
# Install dependencies
npm install

# Start the web server
node server.js
# Open http://localhost:3000

# Or use the CLI script directly
node check.js
```

## Supported Companies

| Company | Login Fields |
|---|---|
| Bank Hapoalim | userCode, password |
| Bank Leumi | username, password |
| Mizrahi Bank | username, password |
| Discount Bank | id, password, num |
| Mercantile Bank | id, password, num |
| Bank Otsar Hahayal | username, password |
| Max | username, password |
| Visa Cal | username, password |
| Isracard | id, card6Digits, password |
| Amex | id, card6Digits, password |
| Union | username, password |
| Beinleumi | username, password |
| Massad | username, password |
| Bank Yahav | username, nationalID, password |
| Beyahad Bishvilha | id, password |
| Behatsdaa | id, password |
| Pagi | username, password |
