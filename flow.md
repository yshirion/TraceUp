# Application Change Flow

This file documents all changes made to the application. It is appended to sequentially so you can read and understand exactly what was changed and where in the code it was modified.

---

### Initial Setup (2026-03-12)
**What was done:**
- Initialized a Git repository.
- Created branches for current features (`main`, `feature/authentication`, `feature/dashboard-ui`, `feature/parallel-scraping`).
- Created a `.gitignore` to securely exclude `node_modules/`, `data/` (where `users.json` is), and `.env`.
- Linked local repository to remote `https://github.com/yshirion/TraceUp.git` and pushed all branches.

**Where in code:**
- Project root (Git initialized, branches created, `.gitignore` File created).
- `flow.md` created to track future modifications.

---

### Scraping Date Logic & Results Filter (2026-03-12)
**What was done:**
- Modified the backend `/api/scrape-all` endpoint to always pull data from exactly 3 months ago, regardless of user input.
- Added session storage tracking for `startDate` in `index.html`.
- Rewrote the `results.html` page to perform client-side filtering. It now initially hides transactions older than the user's chosen `startDate`.
- Added a "Load X Older Transactions" button to the results page to reveal the historically scraped data without hitting the API again.
- Fixed an issue where Visacal transactions were incorrectly showing an `originalAmount` by strictly checking that `originalCurrency` exists and is a foreign currency.
- Committed these changes to the `feature/parallel-scraping` branch.

**Where in code:**
- `server.js` (Lines ~234-245 for Visacal fix, Lines ~311-320 for 3-month backdate).
- `public/index.html` (Added session storage of start date).
- `public/results.html` (Complete rewrite of JS rendering logic to handle filtering and sorting).

---

### Extracting Logic to Extracted JS Files & UI Filter Fixes (2026-03-12)
**What was done:**
- Fixed a buggy local timezone conversion in `index.html` that caused the dashboard's default date to be off by a day (the 8th instead of the 9th).
- Extracted all large blocks of `<script>` logic from the HTML templates and separated them into standard JavaScript files.
- Removed the "Load Older Transactions" button from `results.html`.
- Added a full date filter `<input type="date">` to `results.html`, which strictly enforces a maximum past date of 3 months exactly (since we only scraped 3 months of data).
- Removed the "Sort by Amount" button entirely per user request.

**Where in code:**
- `public/login.html` & `public/login.js`
- `public/index.html` & `public/index.js`
- `public/results.html` & `public/results.js`

---

### Account Sorting and Table UI Enhancements (2026-03-12)
**What was done:**
- Added an "Account" sort button to the results page.
- Implemented sorting logic for Account to always group by Company first. If comparing two transactions from the same company, they will sort by Account, and further fallback to sorting by Date.
- Updated the transactions table header (`thead`) to have an opaque background and slight drop-shadow, preventing data rows from confusingly showing through the header when scrolling down.

**Where in code:**
- `public/results.html` (Added `#sortAccount` button and updated `thead` CSS).
- `public/results.js` (Added `account` case inside `sortBy()` logic).

---

### Advanced Multi-Filter Implementation (2026-03-12)
**What was done:**
- Converted the simple date filter on the results page into a robust multi-filter panel.
- Added dynamic dropdowns for filtering by **Company** and **Account**. These dropdowns auto-populate based on the scraped transactions data.
- Added a dropdown to filter by **Currency** (All, Local ILS Only, Foreign Currency Only).
- Added a dropdown to filter by **Installments** (Include Everything, Installments Only, Hide Installments).
- Added a dual-thumb slider and raw number inputs to filter the absolute value of the **Amount**.
- Extensively updated the JavaScript (`applyFilters`) to handle evaluating all of these filters simultaneously and redrawing the table in real-time.

**Where in code:**
- `public/results.html` (Complete rewrite of `.results-controls` to include the new grid layout of select fields and sliders).
- `public/results.js` (Replaced `applyDateFilter` with unified `applyFilters`, added `populateDropdowns` and `syncAmountInputs` logic).

---

### Currency Filter Bug Fix (2026-03-12)
**What was done:**
- Fixed a bug where the Currency filter was not working. The frontend originally tried to read the `originalCurrency` field, but the backend was only sending the formatted `originalAmount` string to the UI.
- Updated the backend scrape function to explicitly send the `isNonILS` variable to the frontend for every transaction.
- Updated the frontend `results.js` currency filter logic to directly check true/false on the `isNonILS` property.
- Added a backwards-compatibility fallback in the frontend Javascript so that if `isNonILS` is `undefined` (because the user still has old data stored in their browser cache from before this fix), it safely falls back to checking if the formatted `originalAmount` string contains letters or currency symbols (like $).

**Where in code:**
- `server.js` (Added `isNonILS` to the array exported to the client).
- `public/results.js` (Updated Currency filter `if` statements with backwards compatibility).

---

### Installments Filter Bug Fix (2026-03-12)
**What was done:**
- Identified that the Installments filter was also failing to filter out rows for the same reason: the frontend expected a `t.installments` object, but the backend was never sending it. This caused the "Hide Installments" filter to mistakenly ignore old installments that had values in the `originalAmount` column.
- Updated the backend scrape function to calculate and send the `isInstallments` flag to the frontend.
- Updated the frontend `results.js` code to natively filter using the new `isInstallments` flag.
- Implemented a fallback for cached browser data: if `isInstallments` is missing, check if the row has an `originalAmount` populated, but WITHOUT any currency symbols (such as $). If true, it must be an installment row.

**Where in code:**
- `server.js` (Added `isInstallments` to the array exported to the client).
- `public/results.js` (Updated Installments filter `if` statements with backwards compatibility).

---

### Grouping Companies into Banks vs Credit Cards (2026-03-12)
**What was done:**
- Updated backend API configurations to explicitly flag each financial institution as either a "bank" or a "creditCard" based on whether it is a formalized banking institution.
- Updated the Dashboard's "Add Connection" dropdown to separate Banks and Credit Cards visually using `<optgroup>`.
- Updated the Dashboard's "My Companies" list view to separate the saved connections under "Banks" and "Credit Cards" headers.
- Updated the Results page "Company" filter dropdown to also separate the available scraped companies using `<optgroup>`.

**Where in code:**
- `server.js` (Added `type` string to `/api/scrapers` and `/api/companies` endpoint responses).
- `public/index.js` (Updated `openAddModal()` and `loadCompanies()` to group elements using the semantic `type`).
- `public/index.html` (Added `.company-group-title` CSS to visually differentiate list headers).
- `public/results.js` (Updated `populateDropdowns()` to divide the scraped companies using `<optgroup>`).
