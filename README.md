# Green — Hebrew Financial Document Management

Next.js 14 app for managing invoices, receipts, quotes, and payments. Hebrew RTL UI, PDF generation, and multi-document type support.

## Tech Stack

- **Next.js 14** (App Router, server components)
- **PostgreSQL** via **Prisma ORM**
- **NextAuth.js** (custom credentials provider)
- **Tailwind CSS** (RTL)
- **@react-pdf/renderer** (PDF generation)
- **TypeScript**

---

## Prerequisites  X

- Node.js 18+
- Docker (for local PostgreSQL)

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
# Git Bash / Mac / Linux
cp .env.example .env
cp .env.example .env.local

# Windows cmd
copy .env.example .env
copy .env.example .env.local
```

Edit `.env.local` and set a real `NEXTAUTH_SECRET`:

```bash
openssl rand -base64 32   # Mac/Linux/Git Bash
```

### 3. Start the database

```bash
docker compose up -d
```

This starts a PostgreSQL 16 container on port 5432.

### 4. Run migrations

```bash
npx prisma migrate dev
```

### 5. Seed the database

```bash
npx prisma db seed
```

Seed creates:
- **User**: `admin@example.com` / `password123`
- **Business**: example Israeli business with tax ID and contact info

---

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | Runtime DB URL. On Vercel with Supabase, use Supavisor transaction mode on port `6543` and add `?pgbouncer=true` | `postgresql://postgres.PROJECT_REF:password@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `DIRECT_URL` | Direct DB URL for Prisma migrations | `postgresql://postgres:password@db.PROJECT_REF.supabase.co:5432/postgres` |
| `NEXTAUTH_SECRET` | JWT signing secret (generate with `openssl rand -base64 32`) | `abc123...` |
| `NEXTAUTH_URL` | Full URL of the app | `http://localhost:3000` |

> **Note**: Prisma CLI reads `.env`. Next.js reads both `.env` and `.env.local` (`.env.local` takes priority). Create both files for local development.

---

## Running

```bash
# Development
npm run dev

# Production build
npm run build
npm start
```

---

## Testing

```bash
npm test
```

Runs Jest unit tests for service layer (document, payment, dashboard services). Tests use a mocked Prisma client and do not require a running database.

---

## Database Migrations

```bash
# Apply pending migrations (development)
npx prisma migrate dev

# Apply migrations in production (no schema changes)
npx prisma migrate deploy

# View schema in Prisma Studio
npx prisma studio
```

---

## Database Backup

### Manual backup

```bash
# Make the script executable (once)
chmod +x scripts/db-backup.sh

# Run a backup
./scripts/db-backup.sh
```

Backup files are saved to `./backups/` as `green_db_YYYYMMDD_HHMMSS.sql.gz`.  
The script automatically removes all but the last 30 dumps.

### Environment variables used by the backup script

| Variable | Default | Description |
|---|---|---|
| `POSTGRES_HOST` | `localhost` | DB host |
| `POSTGRES_PORT` | `5432` | DB port |
| `POSTGRES_USER` | `postgres` | DB user |
| `POSTGRES_PASSWORD` | — | DB password (required) |
| `POSTGRES_DB` | `green_db` | Database name |
| `BACKUP_DIR` | `./backups` | Where dumps are written |

The script sources `.env` automatically if present.

### Scheduled backup (cron example)

```cron
# Daily at 03:00
0 3 * * * /path/to/project/scripts/db-backup.sh >> /var/log/green-backup.log 2>&1
```

### Restore from backup

```bash
# Decompress and restore
gunzip -c backups/green_db_20260412_030000.sql.gz | \
  PGPASSWORD=password psql -h localhost -U postgres -d green_db
```

> **Important**: Back up your `.env` and `.env.local` files separately — they contain `NEXTAUTH_SECRET` and database credentials that cannot be recovered from the database dump.

---

## Data Retention Policy

Financial documents (invoices, receipts, credit notes) and their associated audit logs are subject to a **7-year mandatory retention period** in accordance with Israeli accounting regulations (חוק עסקאות גופים ציבוריים and standard bookkeeping requirements).

### What this means operationally

| Data | Retention requirement |
|---|---|
| Issued documents (INVOICE, RECEIPT, INVOICE_RECEIPT, CREDIT_NOTE) | 7 years from issue date |
| Audit log records | 7 years from creation |
| Payment records | 7 years from payment date |
| Draft documents (never issued) | No mandatory period — may be purged |

### Database-level safeguards

- Issued financial documents **cannot be physically deleted** from the database (enforced by a DB trigger). Soft-delete (`status = DELETED`) applies only to drafts.
- Audit log records **cannot be updated or deleted** at the database level — append-only, enforced by a DB trigger.
- Each issued document carries a **SHA256 integrity hash** over its immutable data. This hash can be used to verify that a document has not been tampered with after issue.

### Backup and archival

The local backup script (`scripts/db-backup.sh`) retains the **last 30 daily dumps** for operational recovery. To meet the 7-year retention requirement:

1. **Archive daily/weekly dumps to off-site storage** (e.g. Amazon S3 Glacier, Azure Blob cold tier, or a separate tape/disk system).
2. Set a lifecycle policy on the archive storage to expire objects after **7 years + 90 days** (the extra buffer accounts for year-end audit windows).
3. Keep at minimum **one full dump per month** in the archive for the full 7-year period.
4. Store the dump files alongside the corresponding `.env` backup so that encryption keys and DB credentials are available for restoration.

> **Cron example for archival-grade daily backup:**
> ```cron
> # Daily at 03:00 — backup, then sync to S3 archive
> 0 3 * * * /path/to/project/scripts/db-backup.sh >> /var/log/green-backup.log 2>&1
> 5 3 * * * aws s3 sync /path/to/project/backups/ s3://your-bucket/green/backups/ --storage-class GLACIER >> /var/log/green-backup.log 2>&1
> ```

---

## Features

- **Documents**: Quotes, Invoices, Receipts, Invoice-Receipts, Credit Notes
- **Customers**: Full CRUD with search and document history
- **Payments**: Record and track payments against documents
- **PDF Export**: RTL Hebrew PDFs with business logo
- **CSV Export**: Export filtered document lists
- **Reports**: Revenue by month, open documents, payments, customer balances
- **Business Settings**: Configurable VAT, currency, document number prefixes
