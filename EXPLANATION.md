# מה עשיתי — הסבר מפורט שלב אחרי שלב
# What I Did — Detailed Step by Step

---

## שלב 1: תיקון הבאג בקובץ check.js

### הבעיה

בקוד המקורי שלך ב-`check.js` היה:

```javascript
account.txns[0].identifier
account.txns[0].installments.number
```

זה קורס כי:
- `account.txns` הוא מערך (array) של עסקאות. `txns[0]` זה העסקה הראשונה.
- אם המערך ריק (אין עסקאות), אז `txns[0]` הוא `undefined`, ואי אפשר לקרוא ממנו `.identifier`
- `installments` הוא שדה **אופציונלי** באובייקט `txn`. הוא קיים רק כשהעסקה היא תשלומים. אם העסקה רגילה, `txn.installments` הוא `undefined`, ואז `txn.installments.number` קורס.

### מאיפה ידעתי?

קראתי את קובץ הטייפים של הספרייה: `israeli-bank-scrapers/lib/transactions.d.ts`

```typescript
// סימן ? אומר שהשדה אופציונלי - יכול להיות או לא להיות
identifier?: string | number;    // אופציונלי!
installments?: TransactionInstallments;  // אופציונלי!
```

### מה תיקנתי

**קובץ: `check.js`**

1. שיניתי מ-`txns[0]` ל-`forEach` — כדי לעבור על **כל** העסקאות, לא רק הראשונה
2. הוספתי `?.` (optional chaining) — כדי לא לקרוס כשהשדה לא קיים

```javascript
// לפני — קורס
account.txns[0].installments.number

// אחרי — בטוח
txn.installments?.number   // אם installments לא קיים, מחזיר undefined במקום לקרוס
```

---

## שלב 2: ייצוא ל-CSV

### מה עשיתי

**קובץ: `check.js`, שורות 22-66**

שיניתי את הקוד כך שבמקום `console.log` הוא בונה מחרוזת CSV ושומר לקובץ.

### איך זה עובד שורה אחרי שורה:

**שורה 23** — הגדרת כותרת ה-CSV:
```javascript
const csvHeader = 'company,account,date,chargedAmount,description,originalAmount,memo';
```

**שורה 24** — מערך ריק שאליו נדחוף את כל השורות:
```javascript
const csvRows = [];
```

**שורה 26** — לולאה על כל החשבונות. הספרייה מחזירה `scrapeResult.accounts` שהוא מערך של חשבונות. כל חשבון (`account`) מכיל:
- `account.accountNumber` — מספר הכרטיס (למשל "5241")
- `account.txns` — מערך של עסקאות

**שורה 27** — לולאה פנימית על כל העסקאות בכל חשבון. כל עסקה (`txn`) מכילה:
- `txn.date` — תאריך, מגיע כ-ISO string (למשל `"2026-01-01T22:00:00.000Z"`)
- `txn.chargedAmount` — סכום שחויב (הספרייה מחזירה שלילי לחיוב, למשל `-180`)
- `txn.description` — תיאור (למשל `"סונול הר נוף"`)
- `txn.originalAmount` — סכום מקורי (רלוונטי בתשלומים או מט"ח)
- `txn.originalCurrency` — מטבע מקורי (למשל `"ILS"` או `"USD"`)
- `txn.type` — סוג: `"normal"` או `"installments"`
- `txn.memo` — הערה (קיים רק בתשלומים, למשל `"תשלום 1 מתוך 2"`)
- `txn.installments` — אובייקט עם `.number` ו-`.total` (רק בתשלומים)

**שורה 28-29** — פורמט תאריך + סינון עתידיים:
```javascript
const date = new Date(txn.date);       // הופך את ה-string לאובייקט Date
if (date > new Date()) return;         // אם התאריך אחרי היום — דלג
```

**שורות 30-33** — המרת תאריך לפורמט `dd/mm/yyyy`:
```javascript
const dd = String(date.getDate()).padStart(2, '0');     // יום עם אפס מוביל
const mm = String(date.getMonth() + 1).padStart(2, '0'); // חודש (getMonth מחזיר 0-11, לכן +1)
const yyyy = date.getFullYear();
const formattedDate = `${dd}/${mm}/${yyyy}`;            // למשל "02/01/2026"
```

**שורות 35-36** — בדיקות מותנות:
```javascript
const isInstallments = txn.type === 'installments'; // האם תשלומים?
const isNonILS = txn.originalCurrency !== 'ILS';    // האם מטבע זר?
```

**שורות 38-44** — פונקציה `escapeCsv` שמטפלת בתיאורים שמכילים פסיקים:
```javascript
// אם הטקסט מכיל פסיק, גרשיים, או שורה חדשה — עוטף אותו בגרשיים
// לדוגמה: באשר פרומז'רי מחנה י → ללא שינוי (אין פסיק)
// לדוגמה: בזק ENERGY בזק ג'ן)) → ללא שינוי
// לדוגמה: "טקסט, עם, פסיקים" → """טקסט, עם, פסיקים"""
```

**שורה 47** — הפיכת סימן הסכום:
```javascript
const chargedAmount = txn.chargedAmount * -1;
// הספרייה מחזירה: -180 (חיוב), 14.2 (זיכוי)
// אחרי ההפיכה: 180 (חיוב), -14.2 (זיכוי)
```

**שורות 48-49** — `originalAmount` מותנה:
```javascript
// מציג originalAmount רק אם יש תשלומים או מט"ח
const originalAmountRaw = (isInstallments || isNonILS) ? txn.originalAmount * -1 : '';
// אם מט"ח — מוסיף את שם המטבע: "110.76 USD"
const originalAmount = originalAmountRaw !== '' && isNonILS
    ? `${originalAmountRaw} ${txn.originalCurrency}`
    : originalAmountRaw;
```

**שורה 50** — `memo` מותנה:
```javascript
const memo = isInstallments ? escapeCsv(txn.memo) : '';
// מציג memo רק אם העסקה היא תשלומים
```

**שורות 52-60** — מחבר את כל השדות לשורת CSV אחת הפרודים בפסיקים, ודוחף למערך `csvRows`

**שורה 64** — בונה את הקובץ הסופי:
```javascript
const csvContent = '\uFEFF' + [csvHeader, ...csvRows].join('\n');
// '\uFEFF' = BOM — סימון מיוחד בתחילת הקובץ שאומר לאקסל "זה UTF-8, תציג עברית נכון"
```

**שורה 65** — שומר לקובץ:
```javascript
fs.writeFileSync('transactions.csv', csvContent, 'utf8');
```

---

## שלב 3: ממשק וובי

### קובץ: `server.js`

**שורה 2** — מייבא מהספרייה את `SCRAPERS` — אובייקט שמכיל את כל החברות עם שדות ההתחברות שלהן:
```javascript
import { CompanyTypes, createScraper, SCRAPERS } from 'israeli-bank-scrapers';
```

`SCRAPERS` נראה ככה (מתוך `israeli-bank-scrapers/lib/definitions.js`):
```javascript
{
    isracard: { name: 'Isracard', loginFields: ['id', 'card6Digits', 'password'] },
    leumi:    { name: 'Bank Leumi', loginFields: ['username', 'password'] },
    discount: { name: 'Discount Bank', loginFields: ['id', 'password', 'num'] },
    // ... עוד 15 חברות
}
```

**שורות 9-11** — יצירת שרת Express ששומע על פורט 3000:
```javascript
const app = express();
app.use(express.json());                              // מאפשר לקבל JSON ב-POST
app.use(express.static(path.join(__dirname, 'public'))); // מגיש קבצים מתיקיית public
```

**שורות 14-25** — `GET /api/scrapers` — כשהדפדפן טוען את הדף, הוא שולח בקשה לכאן ומקבל בחזרה את רשימת החברות + שדות ההתחברות שלהן. הדפדפן משתמש בזה כדי לבנות את הדרופדאון ואת שדות הטופס.

**שורות 28-91** — `POST /api/scrape` — כשלוחצים "Scrape Transactions":
1. **שורה 29** — מקבל מהדפדפן: `companyId` (למשל "isracard"), `credentials` (למשל `{id: "305444580", ...}`), `startDate`
2. **שורות 36-41** — בונה אובייקט `options` — אותו דבר כמו ב-`check.js` שורות 6-11
3. **שורות 43-44** — יוצר scraper ומריץ אותו — אותו דבר כמו ב-`check.js` שורות 19-20
4. **שורות 49-77** — עובר על העסקאות ומעבד אותן — **אותה לוגיקה בדיוק** כמו ב-`check.js` שורות 26-61, רק שבמקום לבנות שורת CSV, הוא דוחף אובייקט JavaScript למערך `transactions`
5. **שורה 80** — שולח את מערך העסקאות בחזרה לדפדפן כ-JSON

### קובץ: `public/index.html`

ה-HTML (שורות 1-42) מכיל:
- **שורה 21** — `<select id="companySelect">` — הדרופדאון לבחירת חברה
- **שורה 26** — `<div id="loginFields">` — מיכל ריק. כשבוחרים חברה, JavaScript ממלא אותו בשדות
- **שורה 30** — `<input type="date" id="startDate">` — בוחר תאריך
- **שורה 33** — `<button>` — כפתור הסריקה

ה-JavaScript (שורות 43-228) מכיל את הפונקציות הבאות:

**`FIELD_LABELS` (שורות 44-54)** — מילון שממפה שמות שדות טכניים לתוויות ידידותיות:
```javascript
{
    username: 'Username',
    card6Digits: 'Last 6 Digits of Card',
    id: 'ID Number',
    // ...
}
```

**`loadScrapers()` (שורות 60-77)** — נקראת בטעינת הדף:
1. שולחת `GET /api/scrapers` לשרת
2. מקבלת את רשימת החברות
3. שומרת ב-`scrapersData` (שורה 63) — אובייקט גלובלי שמשמש גם פונקציות אחרות
4. ממלאת את הדרופדאון: לכל חברה יוצרת `<option>` עם ה-value שהוא ה-key (למשל "isracard") וה-text שהוא השם (למשל "Isracard")

**`renderLoginFields(companyId)` (שורות 79-105)** — נקראת כשבוחרים חברה בדרופדאון:
1. מנקה את ה-div `#loginFields` (שורה 81)
2. מחפשת ב-`scrapersData` את החברה שנבחרה ולוקחת את ה-`loginFields` שלה (שורה 85)
   - למשל ישראכרט: `['id', 'card6Digits', 'password']`
3. לכל שדה (שורות 86-104):
   - יוצרת `<label>` עם תווית מ-`FIELD_LABELS`
   - יוצרת `<input>` — אם השדה הוא `password` אז `type="password"` (מוסתר), אחרת `type="text"`
   - מוסיפה ל-`#loginFields`

**`buildCsv(transactions)` (שורות 117-139)** — בונה מחרוזת CSV מהעסקאות:
- מוסיפה `\uFEFF` (BOM) בתחילה לתמיכה בעברית באקסל
- מחברת כותרת + שורות עם פסיקים

**`downloadCsv()` (שורות 141-152)** — נקראת כשלוחצים "Download CSV":
1. בונה את ה-CSV מ-`lastTransactions` (שנשמר מהסריקה האחרונה)
2. יוצרת `Blob` — אובייקט בינארי שמייצג קובץ בזיכרון הדפדפן
3. יוצרת URL זמני לקובץ
4. יוצרת `<a>` נסתר עם `download` ולוחצת עליו — מה שמפעיל הורדה של הקובץ

**ה-submit handler (שורות 177-219)** — כשלוחצים "Scrape Transactions":
1. **שורות 180-187** — אוסף את הערכים מהשדות הדינמיים לתוך אובייקט `credentials`:
   ```javascript
   // למשל לישראכרט:
   credentials = {
       id: "305444580",
       card6Digits: "127037",
       password: "..."
   }
   ```
2. **שורות 198-202** — שולח `POST /api/scrape` לשרת עם `companyId`, `credentials`, `startDate`
3. **שורות 206-213** — כשמקבל תשובה: אם הצליח → מציג כמה עסקאות נמצאו + כפתור הורדה. אם נכשל → מציג שגיאה.

### קובץ: `public/style.css`

עיצוב ויזואלי בלבד, לא לוגיקה. הנקודות העיקריות:
- רקע כהה (`#0a0e1a`) עם גרדיאנטים סגולים עדינים
- הכרטיסייה (`card.`) — רקע שקוף עם `backdrop-filter: blur` (אפקט זכוכית)
- הכפתור הסגול — גרדיאנט `#6366f1` → `#7c3aed` עם אפקט hover
- אנימציות `fadeInUp` ו-`fadeInDown` — כדי שהאלמנטים "יגלשו" למקום כשהדף נטען

---

## תרשים זרימה

```
המשתמש פותח http://localhost:3000
         │
         ▼
   index.html נטען
         │
         ▼
   loadScrapers() שולח GET /api/scrapers
         │                    │
         │                    ▼
         │          server.js קורא SCRAPERS מהספרייה
         │          ומחזיר: { isracard: {name, loginFields}, ... }
         │                    │
         ◄────────────────────┘
         │
         ▼
   ממלא את הדרופדאון עם שמות החברות
         │
         ▼
   המשתמש בוחר חברה (למשל Isracard)
         │
         ▼
   renderLoginFields('isracard')
   מציג: ID Number, Last 6 Digits of Card, Password
         │
         ▼
   המשתמש ממלא פרטים ולוחץ Scrape
         │
         ▼
   שולח POST /api/scrape עם { companyId, credentials, startDate }
         │                    │
         │                    ▼
         │          server.js מריץ createScraper() + scrape()
         │          (הספרייה פותחת דפדפן נסתר, נכנסת לאתר, וגורדת עסקאות)
         │          מעבד את העסקאות (תאריכים, סכומים, שדות מותנים)
         │          מחזיר: { success: true, transactions: [...] }
         │                    │
         ◄────────────────────┘
         │
         ▼
   מציג "Found X transactions" + כפתור Download CSV
         │
         ▼
   המשתמש לוחץ Download CSV
         │
         ▼
   buildCsv() + downloadCsv()
   בונה קובץ CSV בדפדפן ומוריד אותו
```
