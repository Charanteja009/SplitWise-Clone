# Ingestion Report: Roommate CSV Import

This report logs the execution results of importing our standard `expenses_export.csv` file into the Splitwise Clone's ingestion pipeline. It details how the engine validates math, handles fractional pennies, auto-resolves anomalies, and quarantines dirty records on Meera's Resolution Board.

---

## 1. Run Summary

* **Source File**: `expenses_export.csv`
* **Target Group**: `Flatmates`
* **Total Rows Evaluated**: 10
* **Successful Ingests (Active)**: 4
* **Quarantined Rows (Staged/Approval)**: 6
* **Rejected Rows (Dropped)**: 0

---

## 2. Row Ingestion Log Stream

### Row 1: Valid Equal Split
* **Raw Row**: `TX_001,2026-02-15,120.00,Aisha,Weekly Grocery Bill,INR,EQUAL,"Aisha, Rohan, Priya",`
* **Evaluated Anomalies**: None
* **Action**: **SUCCESS (ACTIVE)**
* **Ledger Allocations (in cents)**:
  * Aisha owes: `4000` ($40.00)
  * Rohan owes: `4000` ($40.00)
  * Priya owes: `4000` ($40.00)
* **Status**: Committed to database as `ACTIVE`.

---

### Row 2: Negative Amount Auto-Correction
* **Raw Row**: `TX_002,2026-02-18,-45.50,Rohan,Taxi Ride Refund,INR,EQUAL,"Rohan, Priya",`
* **Evaluated Anomalies**: `NEGATIVE_AMOUNT`
* **Action**: **SUCCESS (ACTIVE)** (Auto-resolved amount to absolute `$45.50`, marked transaction parameter `isRefund = true`).
* **Ledger Allocations (in cents)**:
  * Rohan owes: `2275` ($22.75)
  * Priya owes: `2275` ($22.75)
* **Status**: Committed to database as `ACTIVE` refund.

---

### Row 3: Future Transaction Date
* **Raw Row**: `TX_003,2026-07-20,350.00,Priya,Advance Rent Payment,INR,EQUAL,"Rohan, Priya",`
* **Evaluated Anomalies**: `FUTURE_DATE`
* **Action**: **QUARANTINED** (Future date detected. Saved to DB with status `PENDING_APPROVAL` to wait for manual confirmation).
* **Ledger Allocations (in cents)**:
  * Rohan owes: `17500` ($175.00)
  * Priya owes: `17500` ($175.00)
* **Status**: Quarantined under **Pending Approvals Panel**.

---

### Row 4: Currency Discrepancy & Fractional Penny Remainder
* **Raw Row**: `TX_004,2026-02-22,10.00,Aisha,USD Dinner Trip,USD,EQUAL,"Aisha, Rohan, Priya",`
* **Evaluated Anomalies**: `CURRENCY_DISCREPANCY`
* **Action**: **SUCCESS (ACTIVE)** (Converted `$10.00` USD to INR using a fixed exchange rate of `83`, yielding `83000` cents / `830.00` INR. Logged original amount and currency for audit logs).
* **Ledger Allocations (in cents)**:
  * Base division: `83000 / 3 = 27666` cents each.
  * Discrepancy remainder: `83000 - (27666 * 3) = 2` cents.
  * Allocates remainder onto primary payer (Aisha): `27666 + 2 = 27668` cents.
  * Aisha owes: `27668` cents ($276.68)
  * Rohan owes: `27666` cents ($276.66)
  * Priya owes: `27666` cents ($276.66)
* **Status**: Committed to database as `ACTIVE`.

---

### Row 5: Duplicate Unique ID
* **Raw Row**: `TX_001,2026-02-15,120.00,Aisha,Weekly Grocery Bill (Duplicate Check),INR,EQUAL,"Aisha, Rohan, Priya",`
* **Evaluated Anomalies**: `DUPLICATE`
* **Action**: **QUARANTINED** (Unique transaction ID `TX_001` already exists in database. To avoid unique-key database crashes, the record status is set to `DUPLICATE`, and the primary key is appended with a suffix).
* **Status**: Quarantined under **Duplicates Panel** for verification.

---

### Row 6: Missing Description
* **Raw Row**: `TX_006,2026-02-28,80.00,Rohan,,INR,EQUAL,"Rohan, Priya",`
* **Evaluated Anomalies**: `EMPTY_DESCRIPTION`
* **Action**: **SUCCESS (ACTIVE)** (Auto-resolved empty string to standard placeholder `"Imported Uncategorized Expense"`).
* **Ledger Allocations (in cents)**:
  * Rohan owes: `4000` ($40.00)
  * Priya owes: `4000` ($40.00)
* **Status**: Committed to database as `ACTIVE`.

---

### Row 7: Unregistered Roommate Participant
* **Raw Row**: `TX_007,2026-02-28,200.00,Aisha,Unregistered Roommate Dinner,INR,PERCENTAGE,,"Aisha:50; Rohan:25; UnknownGuy:25"`
* **Evaluated Anomalies**: `UNKNOWN_USER`
* **Action**: **QUARANTINED (STAGED)** (Split list contains unregistered roommate `"UnknownGuy"`. Cannot map to any database user ID).
* **Status**: Staged in `QuarantinedExpense` table. Displayed on **Meera's Resolution Board** for mapping.

---

### Row 8: Percentage Split Total Mismatch
* **Raw Row**: `TX_008,2026-03-05,150.00,Rohan,Broken Percentage Bill,INR,PERCENTAGE,,"Rohan:50; Priya:40"`
* **Evaluated Anomalies**: `PERCENTAGE_MISMATCH`
* **Action**: **QUARANTINED (STAGED)** (Percentage splits total `50% + 40% = 90%` instead of exactly `100.00%`).
* **Status**: Staged in `QuarantinedExpense` table. Displayed on **Meera's Resolution Board** for adjustment.

---

### Row 9: Unequal Amount Sum Mismatch
* **Raw Row**: `TX_009,2026-03-10,300.00,Priya,Unequal Amount Split Mismatch,INR,UNEQUAL,,"Priya:100.00; Rohan:150.00"`
* **Evaluated Anomalies**: `UNEQUAL_MISMATCH`
* **Action**: **QUARANTINED (STAGED)** (Unequal amounts sum to `100.00 + 150.00 = 250.00` instead of the stated bill total `300.00`).
* **Status**: Staged in `QuarantinedExpense` table. Displayed on **Meera's Resolution Board** for verification.

---

### Row 10: Timeline residency exclusion
* **Raw Row**: `TX_010,2026-04-10,180.00,Aisha,Post-Residency Split with Meera,INR,EQUAL,"Aisha, Rohan, Meera",`
* **Evaluated Anomalies**: `TEMPORAL_EXCLUSION_ERROR`
* **Action**: **QUARANTINED (STAGED)** (The transaction date is `2026-04-10`. Meera left the group residency on `2026-03-31`, meaning she was not an active member on the date of this transaction. Under dynamic residency boundaries, splits cannot be allocated to inactive members).
* **Status**: Staged in `QuarantinedExpense` table. Displayed on **Meera's Resolution Board** for date-residency reconciliation.
