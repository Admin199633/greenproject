# סיכום פרויקט: Green — מערכת ניהול מסמכים פיננסיים
 
> עודכן: 2026-04-10

---

## תוכן עניינים

1. [סקירה כללית](#סקירה-כללית)
2. [סטאק טכנולוגי](#סטאק-טכנולוגי)
3. [מבנה הפרויקט](#מבנה-הפרויקט)
4. [סכמת מסד הנתונים](#סכמת-מסד-הנתונים)
5. [ניווט ודפים](#ניווט-ודפים)
6. [API Routes](#api-routes)
7. [שכבת השירותים](#שכבת-השירותים)
8. [קומפוננטות](#קומפוננטות)
9. [לוגיקת חישובים](#לוגיקת-חישובים)
10. [PDF Generation](#pdf-generation)
11. [Dashboard](#dashboard)
12. [אימות זהות](#אימות-זהות)
13. [ולידציה](#ולידציה)
14. [בדיקות אוטומטיות](#בדיקות-אוטומטיות)
15. [כלי עזר](#כלי-עזר)
16. [הגדרת סביבה](#הגדרת-סביבה)
17. [נתוני Seed](#נתוני-seed)
18. [חוקי עסק](#חוקי-עסק)
19. [סטטוס פיתוח](#סטטוס-פיתוח)
20. [הוראות הרצה](#הוראות-הרצה)
21. [שינויים אחרונים](#שינויים-אחרונים)

---

## סקירה כללית

מערכת SaaS לניהול מסמכים פיננסיים בעברית עם תמיכה מלאה ב-RTL, מיועדת לעסקים קטנים בישראל.

המערכת מאפשרת:

- ניהול לקוחות
- יצירת טיוטות מסמכים
- עריכת טיוטות ומחיקתן
- הוצאת מסמכים עם מספור רציף
- snapshot של פרטי לקוח ועסק בעת הוצאה
- מעקב תשלומים וחישוב סטטוסים
- ביטול מסמכים בתנאים מוגדרים
- יצירת מסמכי זיכוי ממסמכי מקור מתאימים
- יצירת PDF למסמכים שהוצאו
- דשבורד תפעולי עם KPI, מסמכים אחרונים, תשלומים אחרונים ומסמכים בפיגור
- בדיקות אוטומטיות לשירותים הקריטיים

---

## סטאק טכנולוגי

| טכנולוגיה | גרסה | תפקיד |
|-----------|------|--------|
| **Next.js** | ^15.3.0 | Framework ראשי (App Router) |
| **React** | ^19.0.0 | UI |
| **TypeScript** | ^5.8.2 | שפת פיתוח (strict mode) |
| **Prisma** | ^6.6.0 | ORM + migrations |
| **PostgreSQL** | — | מסד נתונים |
| **NextAuth** | ^4.24.11 | אימות משתמשים (JWT + Credentials) |
| **bcryptjs** | ^2.4.3 | הצפנת סיסמאות |
| **Zod** | ^3.24.2 | ולידציית סכמות |
| **Tailwind CSS** | ^3.4.17 | עיצוב |
| **@react-pdf/renderer** | — | יצירת PDF בצד שרת |
| **@fontsource/heebo** | — | פונט עברי מקומי ל-PDF |
| **Docker Compose** | — | הרצת PostgreSQL מקומית |

---

## מבנה הפרויקט

```text
green/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   ├── (auth)/
│   │   │   └── login/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── customers/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── new/page.tsx
│   │   │   │   ├── [id]/page.tsx
│   │   │   │   ├── [id]/edit/page.tsx
│   │   │   │   └── actions.ts
│   │   │   ├── documents/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── new/page.tsx
│   │   │   │   ├── [id]/page.tsx
│   │   │   │   └── [id]/edit/page.tsx
│   │   │   └── payments/
│   │   │       └── page.tsx
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── documents/
│   │       │   ├── route.ts
│   │       │   └── [id]/
│   │       │       ├── route.ts
│   │       │       ├── issue/route.ts
│   │       │       ├── cancel/route.ts
│   │       │       ├── credit-note/route.ts
│   │       │       └── pdf/route.ts
│   │       └── payments/
│   │           ├── route.ts
│   │           └── [id]/route.ts
│   ├── components/
│   │   ├── Providers.tsx
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   └── Header.tsx
│   │   ├── ui/
│   │   ├── customers/
│   │   ├── documents/
│   │   │   ├── DocumentForm.tsx
│   │   │   ├── DocumentItemsTable.tsx
│   │   │   ├── DocumentStatusBadge.tsx
│   │   │   ├── DocumentFilters.tsx
│   │   │   ├── DeleteDraftButton.tsx
│   │   │   ├── IssueDraftButton.tsx
│   │   │   ├── CancelDocumentButton.tsx
│   │   │   └── CreateCreditNoteButton.tsx
│   │   └── payments/
│   │       ├── AddPaymentForm.tsx
│   │       └── DeletePaymentButton.tsx
│   ├── lib/
│   │   ├── auth.ts
│   │   ├── db.ts
│   │   ├── utils.ts
│   │   ├── pdf/
│   │   │   └── document-pdf.tsx
│   │   ├── documents/
│   │   │   └── calculations.ts
│   │   └── validations/
│   │       ├── customer.ts
│   │       ├── document.ts
│   │       └── payment.ts
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── customer.service.ts
│   │   ├── document.service.ts
│   │   ├── payment.service.ts
│   │   └── dashboard.service.ts
│   ├── test-utils/
│   │   ├── mockDb.ts
│   │   └── factories.ts
│   └── types/
│       └── next-auth.d.ts
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── docker/
├── .env.example
├── CLAUDE.md
└── [config: next.config.ts, tailwind.config.ts, tsconfig.json, jest.config.js]
```

---

## סכמת מסד הנתונים

### מודל User
```prisma
model User {
  id              String    @id @default(cuid())
  email           String    @unique
  name            String?
  passwordHash    String
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  business        Business?
  createdPayments Payment[]
}
```

### מודל Business
```prisma
model Business {
  id          String   @id @default(cuid())
  ownerUserId String   @unique
  name        String
  taxId       String?
  address     String?
  phone       String?
  email       String?
  logo        String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### מודל Customer
```prisma
model Customer {
  id          String   @id @default(cuid())
  businessId  String
  fullName    String?
  companyName String?
  email       String?
  phone       String?
  address     String?
  taxId       String?
  notes       String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### מודל Document
```prisma
model Document {
  id               String         @id @default(cuid())
  businessId       String
  customerId       String

  // קשר למסמך מקור עבור זיכוי:
  sourceDocumentId String?        @unique
  sourceDocument   Document?      @relation("DocumentToCreditNote", fields: [sourceDocumentId], references: [id])
  creditNote       Document?      @relation("DocumentToCreditNote")

  type             DocumentType
  status           DocumentStatus @default(DRAFT)
  number           String?
  issueDate        DateTime?
  dueDate          DateTime?
  notes            String?
  internalNotes    String?
  currency         String         @default("ILS")
  isTaxInclusive   Boolean        @default(false)
  vatRateSnapshot  Decimal        @db.Decimal(5,2) @default(17)

  // Snapshot בעת הוצאה:
  customerName     String?
  customerEmail    String?
  customerAddress  String?
  customerTaxId    String?
  businessName     String?
  businessTaxId    String?
  businessAddress  String?

  // שדות כסף:
  subtotalAmount   Decimal        @db.Decimal(12,2) @default(0)
  taxAmount        Decimal        @db.Decimal(12,2) @default(0)
  totalAmount      Decimal        @db.Decimal(12,2) @default(0)
  amountPaid       Decimal        @db.Decimal(12,2) @default(0)
  amountDue        Decimal        @db.Decimal(12,2) @default(0)

  items            DocumentItem[]
  payments         Payment[]
}
```

### מודל DocumentItem
```prisma
model DocumentItem {
  id              String  @id @default(cuid())
  documentId      String
  lineIndex       Int     @default(0)
  description     String
  quantity        Decimal @db.Decimal(10,3)
  unitPrice       Decimal @db.Decimal(12,2)
  discountAmount  Decimal @db.Decimal(12,2) @default(0)
  subtotalAmount  Decimal @db.Decimal(12,2)
  taxRate         Decimal @db.Decimal(5,2)
  taxAmount       Decimal @db.Decimal(12,2)
  totalAmount     Decimal @db.Decimal(12,2)
}
```

### מודל Payment
```prisma
model Payment {
  id              String   @id @default(cuid())
  businessId      String
  documentId      String
  customerId      String
  createdByUserId String
  amount          Decimal  @db.Decimal(12,2)
  method          String
  paymentDate     DateTime
  reference       String?
  notes           String?
}
```

### מודל DocumentCounter
```prisma
model DocumentCounter {
  id          String       @id @default(cuid())
  businessId  String
  type        DocumentType
  lastNumber  Int          @default(0)

  @@unique([businessId, type])
}
```

### Enums
```prisma
enum DocumentType {
  QUOTE
  INVOICE
  RECEIPT
  INVOICE_RECEIPT
  CREDIT_NOTE
}

enum DocumentStatus {
  DRAFT
  ISSUED
  PARTIALLY_PAID
  PAID
  CANCELLED
}
```

---

## ניווט ודפים

| נתיב | קובץ | תיאור |
|------|------|--------|
| `/` | `app/page.tsx` | redirect לדשבורד |
| `/login` | `(auth)/login/page.tsx` | התחברות |
| `/dashboard` | `(dashboard)/dashboard/page.tsx` | דשבורד עם KPI, מסמכים אחרונים, תשלומים אחרונים ומסמכים בפיגור |
| `/customers` | `customers/page.tsx` | רשימת לקוחות עם חיפוש |
| `/customers/new` | `customers/new/page.tsx` | יצירת לקוח |
| `/customers/[id]` | `customers/[id]/page.tsx` | פרטי לקוח |
| `/customers/[id]/edit` | `customers/[id]/edit/page.tsx` | עריכת לקוח |
| `/documents` | `documents/page.tsx` | רשימת מסמכים עם פילטרים |
| `/documents/new` | `documents/new/page.tsx` | יצירת מסמך |
| `/documents/[id]` | `documents/[id]/page.tsx` | פרטי מסמך, תשלומים, PDF, ביטול, זיכוי, וקישורי מקור/זיכוי |
| `/documents/[id]/edit` | `documents/[id]/edit/page.tsx` | עריכת טיוטה בלבד |
| `/payments` | `payments/page.tsx` | רשימת כל התשלומים |

---

## API Routes

### מסמכים

| Method | Endpoint | תפקיד | מוגן? |
|--------|----------|--------|-------|
| `POST` | `/api/documents` | יצירת טיוטת מסמך | כן |
| `GET` | `/api/documents/[id]` | שליפת מסמך עם פריטים, תשלומים וקשרים רלוונטיים | כן |
| `PATCH` | `/api/documents/[id]` | עדכון טיוטה בלבד | כן |
| `DELETE` | `/api/documents/[id]` | מחיקת טיוטה בלבד | כן |
| `POST` | `/api/documents/[id]/issue` | הוצאת מסמך | כן |
| `POST` | `/api/documents/[id]/cancel` | ביטול מסמך כשמותר לפי הכללים | כן |
| `POST` | `/api/documents/[id]/credit-note` | יצירת טיוטת זיכוי ממסמך מקור | כן |
| `GET` | `/api/documents/[id]/pdf` | יצירת PDF למסמך שהוצא | כן |

### תשלומים

| Method | Endpoint | תפקיד | מוגן? |
|--------|----------|--------|-------|
| `POST` | `/api/payments` | הוספת תשלום + חישוב סטטוס | כן |
| `DELETE` | `/api/payments/[id]` | מחיקת תשלום + חישוב מחדש | כן |

כל ה-routes דורשים `requireBusiness()`.

---

## שכבת השירותים

### `auth.service.ts`
```typescript
requireSession(): Promise<Session>
requireBusiness(): Promise<Business>
```

### `customer.service.ts`
```typescript
listCustomers(businessId, search?): Customer[]
getCustomerById(id, businessId): Customer
createCustomer(businessId, data): Customer
updateCustomer(id, businessId, data): Customer
deactivateCustomer(id, businessId): Customer
getDisplayName(customer): string
```

### `document.service.ts`
```typescript
listDocuments(businessId, filters): Document[]
getDocumentById(id, businessId): Document & { items, payments, sourceDocument?, creditNote? }

createDraft(businessId, data): Document
  // יוצר מסמך ו-items בתוך transaction

updateDraft(id, businessId, data): Document
  // מותר רק ל-DRAFT

deleteDraft(id, businessId): void
  // מותר רק ל-DRAFT

issueDraft(id, businessId): Document
  // מייצר מספר רציף, מעתיק snapshot, מגדיר issueDate
  // מבצע transactional re-check למניעת double issue ו-race conditions

cancelDocument(id, businessId): Document
  // מותר רק אם:
  // status === ISSUED
  // amountPaid === 0
  // מבצע transactional re-check של status ו-amountPaid
  // משנה רק status -> CANCELLED

createCreditNoteFromDocument(id, businessId): Document
  // מותר רק למסמך מקור מסוג:
  // INVOICE | INVOICE_RECEIPT
  // ובסטטוס:
  // ISSUED | PARTIALLY_PAID | PAID
  // יוצר DRAFT חדש מסוג CREDIT_NOTE
  // מעתיק items
  // שומר sourceDocumentId
  // מאפשר רק זיכוי אחד למסמך מקור
  // אינו משנה payments או balances
```

### `payment.service.ts`
```typescript
listPayments(businessId): Payment[]

createPayment(businessId, userId, data): Payment
  // מאמת:
  // - document שייך ל-businessId
  // - status !== CANCELLED
  // - type !== QUOTE
  // - type !== CREDIT_NOTE
  // - amountDue > 0
  // - amount <= amountDue
  // - duplicate payment guard:
  //   חסימה של תשלום זהה לפי:
  //   (documentId, amount, method, reference, paymentDate)
  //   בתוך חלון זמן קצר (~60 שניות)
  // מבצע re-read בתוך transaction למניעת race conditions

deletePayment(id, businessId): void
  // מוחק ומחשב מחדש

recalculateDocumentStatus(tx, documentId): void
  // totalAmount = 0                -> ISSUED
  // amountPaid = 0                 -> ISSUED
  // 0 < amountPaid < totalAmount   -> PARTIALLY_PAID
  // amountPaid >= totalAmount      -> PAID
  // כולל clamp בטוח ל-amountPaid ו-amountDue
```

### `dashboard.service.ts`
```typescript
getDashboardData(businessId): DashboardData
  // מחזיר:
  // - active customers
  // - issued documents count
  // - total paid amount
  // - total open amount
  // - recent documents
  // - recent payments
  // - overdue documents
  //
  // excludes:
  // - DRAFT
  // - CANCELLED
  // - CREDIT_NOTE מחישובי open/overdue
```

---

## קומפוננטות

### Layout
| קומפוננטה | תיאור |
|-----------|--------|
| `Sidebar` | ניווט צדדי RTL |
| `Header` | כותרת עליונה + logout |

### UI Primitives
| קומפוננטה | Variants |
|-----------|---------|
| `Button` | `default`, `ghost`, `outline`, `destructive` |
| `Input` | styled input |
| `Label` | תווית |
| `Card` | Card/Header/Title/Content/Footer |
| `Table` | Table/Header/Body/Row/Head/Cell |
| `Select` | select מעוצב |

### Customers
| קומפוננטה | תיאור |
|-----------|--------|
| `CustomerForm` | טופס יצירה/עריכה |
| `CustomerSearch` | חיפוש עם debounce |
| `DeactivateButton` | השבתת לקוח |

### Documents
| קומפוננטה | תיאור |
|-----------|--------|
| `DocumentForm` | טופס מסמך עם חישובים חיים |
| `DocumentItemsTable` | טבלת שורות פריטים |
| `DocumentStatusBadge` | תגיות סטטוס/סוג |
| `DocumentFilters` | פילטרים לרשימה |
| `DeleteDraftButton` | מחיקת טיוטה |
| `IssueDraftButton` | הוצאת מסמך |
| `CancelDocumentButton` | ביטול מסמך כשמותר |
| `CreateCreditNoteButton` | יצירת זיכוי ממסמך מקור |
| `PDF download action` | הורדת PDF למסמך מותר |

### Payments
| קומפוננטה | תיאור |
|-----------|--------|
| `AddPaymentForm` | הוספת תשלום |
| `DeletePaymentButton` | מחיקת תשלום |

---

## לוגיקת חישובים

**קובץ:** `src/lib/documents/calculations.ts`

כל חישובי הכסף באפליקציה מתבצעים ב-integer cents כדי למנוע שגיאות floating-point, ואז נשמרים במסד כ-Decimal.

```typescript
toCents(n: number): number
fromCents(c: number): number

calcItem(input): ItemCalcResult
calcDocTotals(items, amountPaid=0): DocTotals
```

---

## PDF Generation

**קובץ:** `src/lib/pdf/document-pdf.tsx`

יכולות:

- יצירת PDF בצד שרת דרך `@react-pdf/renderer`
- שימוש ב-Heebo מקומי דרך `@fontsource/heebo`
- תמיכה ב-RTL
- snapshot-first עבור פרטי עסק ולקוח
- fallback בטוח לשדות חיים רק אם snapshot חסר
- הגנה מפני `undefined` / `null`
- תמיכה ב-overflow, page breaks, ושמות/תיאורים ארוכים
- שם קובץ הורדה יציב:
  - `INV-0001.pdf`
  - fallback ל-`document.id.pdf`

ה-PDF זמין רק למסמכים בסטטוסים:

- `ISSUED`
- `PARTIALLY_PAID`
- `PAID`

לא זמין עבור:

- `DRAFT`
- `CANCELLED`

---

## Dashboard

**קובץ:** `src/services/dashboard.service.ts` + `src/app/(dashboard)/dashboard/page.tsx`

כולל:

- 4 KPI cards:
  - סך לקוחות פעילים
  - סך מסמכים שהוצאו
  - סך תשלומים
  - סך פתוח לתשלום
- מסמכים אחרונים
- תשלומים אחרונים
- מסמכים בפיגור

חישובים:

- issued count כולל רק `ISSUED`, `PARTIALLY_PAID`, `PAID`
- open amount כולל רק `ISSUED`, `PARTIALLY_PAID`
- `CREDIT_NOTE` לא נכלל בחישובי open/overdue
- overdue כולל רק מסמכים עם:
  - `dueDate < today`
  - `amountDue > 0`

---

## אימות זהות

**קובץ:** `src/lib/auth.ts`

```text
CredentialsProvider
  -> email validation + bcrypt.compare
  -> JWT callback: token { id, businessId }
  -> session callback: session.user { id, businessId }
```

- אסטרטגיה: JWT
- הצפנה: bcrypt salt=12
- דף כניסה: `/login`

---

## ולידציה

### לקוח
```typescript
fullName/companyName: לפחות אחד חובה
email: optional email
phone/address/taxId/notes: bounded strings
```

### מסמך
```typescript
saveDraftSchema
  - customerId
  - type
  - issueDate / dueDate
  - notes / internalNotes
  - currency
  - isTaxInclusive
  - vatRateSnapshot
  - items לפחות 1
```

### תשלום
```typescript
createPaymentSchema
  - documentId
  - amount > 0
  - paymentDate
  - method enum
  - reference / notes optional
```

---

## בדיקות אוטומטיות

סטטוס נוכחי:

- Jest מוגדר בפרויקט
- 3 test suites
- 39 tests passing

קבצים עיקריים:

- `src/services/document.service.test.ts`
- `src/services/payment.service.test.ts`
- `src/services/dashboard.service.test.ts`
- `src/test-utils/mockDb.ts`
- `src/test-utils/factories.ts`

כיסוי עיקרי:

- issuing
- immutability של draft/non-draft
- payment guards
- duplicate payment rejection
- overpayment rejection
- recalculation של status/totals
- cancel flow
- credit note rules
- dashboard scoping

---

## כלי עזר

### `src/lib/utils.ts`
```typescript
cn(...classes): string
formatCurrency(amount): string
formatDate(date): string
```

### `src/lib/db.ts`
```typescript
const globalForPrisma = global as unknown as { prisma: PrismaClient }
export const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
```

---

## הגדרת סביבה

**קובץ:** `.env.example`

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/green_db"
NEXTAUTH_SECRET="change-me-in-production"
NEXTAUTH_URL="http://localhost:3000"
```

יש ליצור:

- `.env`
- `.env.local`

---

## נתוני Seed

**קובץ:** `prisma/seed.ts`

### משתמש
| שדה | ערך |
|-----|-----|
| email | `admin@example.com` |
| password | `password123` |
| name | `משה ישראלי` |

### עסק
| שדה | ערך |
|-----|-----|
| name | `עסק לדוגמה בע"מ` |
| taxId | `514000000` |
| address | `רחוב הרצל 1, תל אביב` |
| phone | `03-1234567` |
| email | `info@example.co.il` |

---

## חוקי עסק

1. **מספור מסמכים** - מספר מוקצה רק בעת הוצאה
2. **מספור רציף** - `DocumentCounter` לכל `(businessId, type)`
3. **Snapshot** - פרטי לקוח ועסק מוקפאים בעת הוצאה
4. **עריכה** - מותרת רק ל-`DRAFT`
5. **מחיקה** - מותרת רק ל-`DRAFT`
6. **QUOTE** - לא מקבל תשלומים
7. **CREDIT_NOTE** - לא מקבל תשלומים
8. **הגבלת תשלום** - סכום תשלום חייב להיות `<= amountDue`
9. **no outstanding balance** - אי אפשר לשלם כש-`amountDue <= 0`
10. **duplicate payment guard** - תשלום זהה נחסם לפי `(documentId, amount, method, reference, paymentDate)` בתוך חלון קצר של כ-60 שניות
11. **ביטול מסמך** - מותר רק אם `ISSUED` ו-`amountPaid === 0`
12. **CANCELLED** - לא ניתן לבטל שוב, לא ניתן לשלם, לא ניתן להפיק ממנו PDF
13. **זיכוי** - מותר ליצור רק מ-`INVOICE` או `INVOICE_RECEIPT`
14. **זיכוי אחד למסמך מקור** - enforced by `sourceDocumentId @unique`
15. **זיכוי חדש** - נוצר כ-`DRAFT` ולא מונפק אוטומטית
16. **זיכוי** - אינו משנה payments או balances אוטומטית
17. **PDF** - זמין רק ל-`ISSUED`, `PARTIALLY_PAID`, `PAID`
18. **Dashboard scoping** - תמיד לפי `businessId`
19. **Multi-tenant isolation** - כל השאילתות מסוננות לפי `businessId`

---

## סטטוס פיתוח

| שלב | תיאור | סטטוס |
|-----|--------|--------|
| **Phase 1** | Foundation: auth, RTL layout, Prisma schema, UI primitives | ✅ הושלם |
| **Phase 2** | Customers: list, detail, create, edit, deactivate, search | ✅ הושלם |
| **Phase 3A** | Documents Draft: list, filters, create, edit, delete, live totals | ✅ הושלם |
| **Phase 3B** | Issuing + sequential numbering + snapshots | ✅ הושלם |
| **Phase 4** | Payments + hardening + recalculation | ✅ הושלם |
| **Phase 5** | PDF Export MVP | ✅ הושלם |
| **Phase 6** | Dashboard MVP | ✅ הושלם |
| **Phase 7** | Cancel Flow | ✅ הושלם |
| **Phase 8** | Credit Note MVP | ✅ הושלם |
| **Phase 9** | Core Service Tests | ✅ הושלם |
| **Next** | Business Settings MVP | ⬜ השלב הבא |

---

## הוראות הרצה

```bash
# 1. הפעל את Postgres
docker compose up -d

# 2. צור קבצי סביבה
cp .env.example .env
cp .env.example .env.local

# 3. הרץ migrations
npx prisma migrate dev

# 4. Seed נתוני דוגמה
npx prisma db seed

# 5. הפעל שרת פיתוח
npm run dev
# -> http://localhost:3000
```

### פקודות נוספות

| פקודה | תיאור |
|-------|--------|
| `npm run build` | Build לייצור |
| `npm run lint` | ESLint |
| `npm run test` | Jest |
| `npx prisma migrate dev` | הרץ migrations |
| `npx prisma studio` | ממשק ויזואלי ל-DB |
| `docker compose down` | עצור Postgres |

---

## שינויים אחרונים

- הושלם hardening ל-payments עם guards, transactional re-read ו-idempotency בסיסי
- הושלם hardening ל-issue flow עם transactional re-check
- נוספה יצירת PDF עם תמיכה מלאה בעברית ו-RTL
- נוסף Dashboard MVP עם KPI ורשימות תפעוליות
- נוסף cancel flow למסמכים
- נוסף Credit Note MVP עם self-reference למסמך מקור
- נוספו בדיקות אוטומטיות לשירותים הקריטיים


עדכון מצב פרויקט — Post Debug (מצב אמיתי)

עודכן: 2026-04-12

סטאק טכנולוגי (מעודכן)
Next.js 14.x (downgrade מ-15)
React 18.x (downgrade מ-19)
Prisma ORM
PostgreSQL (Docker)
TailwindCSS
Zod
Auth — מצב בפועל

האפליקציה לא משתמשת כרגע ב-NextAuth בצד הלקוח.

שינויים שבוצעו:

הוסר שימוש ב־next-auth/react (useSession, signIn, signOut)
הוסר SessionProvider
התחברות מתבצעת דרך fetch ל־/api/auth/login
cookie נוצר ידנית בצד שרת

משמעות:

auth עובד
אינו לפי flow סטנדרטי של NextAuth
נדרש refactor בעתיד
Providers

Providers.tsx אינו מנהל session כרגע.

שימש כגורם לקריסת runtime
הוסר/הופשט ל-wrapper ריק
Known Issues שטופלו
Service Worker Conflict
Service Worker מפרויקט אחר (Gym) היה רשום על localhost
גרם לטעינת JS שגוי ולקריסות

פתרון:

unregister דרך DevTools
Clear site data
Webpack / Hydration Crash

שגיאות:

Cannot read properties of undefined (reading 'call')
webpack_modules is not a function

גורם:

חוסר תאימות בין Next 15 + React 19 + next-auth

פתרון:

downgrade ל־Next 14
downgrade ל־React 18
הסרת next-auth/react
Prisma / Database Setup

סדר חובה להרצה:

npx prisma generate
npx prisma migrate dev
npx prisma db seed

הערות:

seed לא עובד בלי migration
generate חובה לפני שימוש ב־PrismaClient
DATABASE_URL חייב להיות מוגדר
Docker / Environment

נדרש:

Docker Desktop פועל
Virtualization מופעל ב־BIOS
Hyper-V / WSL2 פעיל

בעיות שנצפו:

Docker daemon לא רץ
Virtualization disabled
next.config

יש להשתמש ב:

next.config.mjs

לא נתמך:
next.config.ts

סטטוס פיצ'רים
פיצ'ר	סטטוס
Auth	עובד (custom)
Customers	עובד
Documents	עובד
Payments	עובד
PDF	לא אומת
Dashboard	לא אומת
Tests	לא הורצו
הערת מצב

המערכת עובדת בסביבת פיתוח, אך:

auth הוא workaround זמני
יש סטייה מהארכיטקטורה המקורית
נדרש ייצוב לפני פריסה ל־production
