# Import and calculation contracts

## Required sample sources

sales_order_items → sale order Numbers open.xlsx; planned_orders → Plan Orders.xlsx; production_orders → Prod_Order_header.xlsx; production_links → Prod_List_SD.xlsx; confirmations → Prod_Order_Confirmation.xlsx; components → component missing part.xlsx; procurement → PUR Req _ PUR ORD.xlsx; inspections → QM33_List.xlsx; capacity → CAPACITY.SLK. Each upload slot chooses the source kind explicitly; filenames are not trusted as authorization or paths.

Required headers are versioned in the parser registry. CSV and XLSX use the same mappings. SYLK inherits coordinates from both F and C records; a C record without X/Y must not overwrite A1. Reject formulas without a cached result, invalid numeric values, impossible dates, duplicate source kinds, oversized expanded XLSX files and files exceeding row limits. Source row numbers are physical worksheet rows. The first non-empty worksheet is used; additional populated worksheets are rejected to avoid silent omission.

## Known export limitations

- Missing-part X is a reported shortage flag, not a calculated shortage quantity.
- Required minus withdrawn means not yet withdrawn; it does not establish stock availability.
- No planned finish field in the supplied production header: overdue-production metric is unavailable.
- Confirmation totals may span operations and units; do not call the sum finished output.
- Sales order + item is the exact sales reference; a material-only purchasing match is a candidate, not allocation.
- Production headers lack plant. Preserve null rather than inventing plant from another row. Filters that lack coverage disclose this.
- QM usage decision and rejected quantity are not explicit; do not infer accepted/rejected quantity from lot quantity or inspection end date.
- Capacity rows can be blank. Exclude null measurements from numeric charts; show available coverage.
- Duplicate Customer headers mean customer ID/name by position. Duplicate Requirement Quantity columns are checked for agreement.

## MVP metrics

Count source rows and distinct identifiers separately with honest labels. Production/planned order counts use DISTINCT order_id within kind. Missing components counts flagged source rows; affected order count excludes blank order references. Purchase requests lacking a PO are distinct requisition/item pairs where not deleted and not closed. Inspection metric is recorded lots, not inferred overdue lots. Capacity utilization is reported load (%) for populated rows; do not average incompatible periods/categories or sum percentages.

Use the user's extraction date as snapshot context. Never use current wall-clock time to imply historic exports are live. Historical trend charts require multiple comparable snapshots and are deferred.
