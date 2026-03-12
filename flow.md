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
