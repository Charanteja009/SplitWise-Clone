# Scope Log: Data Schema & Anomaly Resolutions

This log details the relational database schema, data representations, and programmatic resolutions for financial data anomalies in the Splitwise Clone.

---

## 1. Relational Database Schema & Data Models

The database models are designed in Prisma and backed by PostgreSQL to ensure referential integrity, strict financial auditing, and user membership histories.

```
                  ┌──────────────────────┐
                  │         User         │
                  └──────────┬───────────┘
                             │ (1)
                             │
                             │ (N)
                  ┌──────────┴───────────┐
                  │   GroupMembership    │
                  └──────────┬───────────┘
                             │ (N)
                             │
                             │ (1)
                  ┌──────────┴───────────┐
                  │        Group         │
                  └──────┬─────────┬─────┘
                         │ (1)     │ (1)
                         │         │
                   (N)   │         │   (N)
             ┌───────────┴─┐     ┌─┴─────────────┐
             │   Expense   │     │  Settlement   │
             └─────┬───────┘     └───────────────┘
                   │ (1)
                   │
             ┌─────┴───────┐     ┌──────────────────────┐
             │ExpenseSplit │     │  QuarantinedExpense  │
             └─────────────┘     └──────────────────────┘
```

### Relational Schema Models:
1. **`User`**: User accounts containing security credentials (`passwordHash`), linked to groups, expenses paid, splits, and settlements.
2. **`Group`**: The core container of isolation. All expenses, members, and settlements belong strictly to a group.
3. **`GroupMembership`**: Map of User-Group association. Crucially contains **`joinedAt`** and **`leftAt`** columns to record roommate residency intervals for date-bound expense splits.
4. **`Expense`**: Header record storing the description, total `amount` in integer cents, original amount/currency, status (`ACTIVE`, `PENDING_APPROVAL`, `DUPLICATE`), and timestamp.
5. **`ExpenseSplit`**: Joins `Expense` to `User`. Stored in integer cents (`owedAmount`). Sum of splits matches `Expense.amount` exactly.
6. **`Settlement`**: Ledger record tracking direct debt repayments between users inside a group. Stored in integer cents (`amount`).
7. **`QuarantinedExpense`**: Anomaly staging table storing the raw CSV row JSON and list of detected anomalies for Meera's Resolution Board.

---

## 2. Preventing Floating-Point Inaccuracies

Double-precision floats (`Double` or `Float`) store values in binary formats representing approximations, leading to rounding calculations like `0.1 + 0.2 = 0.30000000000000004`. To completely prevent rounding creep or lost pennies in financial reporting:
* All monetary values in the database (`Expense.amount`, `ExpenseSplit.owedAmount`, and `Settlement.amount`) are explicitly defined using the PostgreSQL **`Integer`** (`Int` in Prisma) type representing **cents** (e.g., `$10.00` is stored as `1000`).
* All percentage distributions are stored in raw values at runtime (e.g. `33.33` for `33.33%`).
* This forces the database to store financial entries as precise, scale-aware integers rather than floating-point approximations. Currency conversion (cents to dollars/rupees) only occurs at the UI presentation layer.

---

## 3. Anomaly Detection & Ingestion Resolutions

When importing transactions bulk-wise from the roommate export CSV, our parser evaluates every row against a 12-anomaly engine defined in `server/src/lib/anomalyEngine.js`. The actions taken are:

| Anomaly Code | Anomaly Name | Description | Resolution Strategy |
| :--- | :--- | :--- | :--- |
| **`ZERO_AMOUNT`** | Zero or NaN Amount | The transaction amount is `$0` or is not a valid number. | **Hard Block**: Row is rejected and dropped from ingestion. |
| **`NEGATIVE_AMOUNT`** | Negative Transactions | The transaction amount is negative (e.g., `-50.00`). | **Auto-Resolve**: Converted to absolute positive value, and the expense is flagged as a Refund (`isRefund: true`). |
| **`EMPTY_DESCRIPTION`** | Empty Description | The description column is blank or contains only whitespace. | **Auto-Resolve**: Description is populated with `"Imported Uncategorized Expense"`. |
| **`INVALID_DATE`** | Unparseable Date | The date field cannot be parsed by any normalized date regex. | **Hard Block**: Row is rejected and dropped from ingestion. |
| **`FUTURE_DATE`** | Future Date | The transaction date is in the future. | **Quarantine**: The expense is inserted with status `PENDING_APPROVAL` and staged for manual approval. |
| **`CURRENCY_DISCREPANCY`**| USD Currency Check | The currency column is `"USD"`, or the description contains `$` or `"trip"`. | **Auto-Resolve**: The amount is multiplied by the fixed exchange rate of `83` to convert to INR. The original amount and currency (`USD`) are archived in the record. |
| **`MISSING_TRANSACTION_ID`**| Missing Unique ID | The CSV row lacks a transaction ID. | **Auto-Resolve**: A deterministic MD5 hash of the date, amount, payer name, and description is generated as the unique ID. |
| **`DUPLICATE`** | Duplicate Transactions | The unique ID already exists in the database or within the same CSV batch. | **Quarantine**: The transaction status is set to `DUPLICATE` and quarantined for user confirmation. |
| **`EMPTY_SPLITS`** | Empty Split Details | The CSV specifies splits but lacks names/amounts, or has zero participants. | **Hard Block**: Row is rejected and dropped from ingestion. |
| **`UNKNOWN_USER`** | Unregistered Roommates | The payer or split participants do not exist in the registered user database. | **Quarantine**: Staged in `QuarantinedExpense` database table. Displays on Meera's Resolution Board for manual registration or mapping. |
| **`PERCENTAGE_MISMATCH`** | Percentages Not 100% | For percentage splits, the sum of user percentages does not equal 100.00%. | **Quarantine**: Staged in `QuarantinedExpense` database table. Displays on Meera's Resolution Board. |
| **`UNEQUAL_MISMATCH`** | Unequal Split Sum Mismatch | For unequal splits, the sum of individual user amounts does not match the total bill. | **Quarantine**: Staged in `QuarantinedExpense` database table. Displays on Meera's Resolution Board. |

---

## 4. Resolving Fractional Penny Variances

When splitting a bill evenly across a set of users, division often yields infinite decimal expansions.
* **The Anomaly**: If Alice logs an expense of `$10.00` split equally among 3 users (Alice, Bob, Charlie), the raw division returns `$3.333333...` per person.
* **The Problem**: Writing `$3.33` (333 cents) to each user's record results in a split sum of `$9.99` (999 cents). This leaves `$0.01` (1 cent) unaccounted for, violating ledger balance integrity (splits must sum to total bill exactly).
* **The Resolution**: Our calculation engine (`server/src/lib/splitEngine.js`) processes the split in cents as follows:
  1. Computes the base floor: `Math.floor(1000 / 3)` = `333` cents.
  2. Calculates the remaining penny discrepancy: `1000 - (333 * 3)` = `1` cent.
  3. Identifies the primary bill payer (`paidById`): Alice.
  4. Allocates the leftover micro-rounding penny onto the payer's split line item: `333 + 1` = `334` cents.
  5. The database writes: Alice owes `334` cents (`$3.34`), Bob owes `333` cents (`$3.33`), and Charlie owes `333` cents (`$3.33`). The sum equals `1000` cents (`$10.00`) exactly.
