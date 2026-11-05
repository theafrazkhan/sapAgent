SET search_path TO smart_factory, public;

CREATE TABLE sales_order_items (
 tenant_id uuid NOT NULL, snapshot_id uuid NOT NULL, source_file_id uuid NOT NULL, source_row integer NOT NULL CHECK(source_row>0),
 sales_order_id text NOT NULL, sales_item text NOT NULL, material_id text NOT NULL, description text, division text, division_name text, quantity numeric(24,6), unit text, net_price numeric(24,6), currency text, pricing_date date,
 PRIMARY KEY(tenant_id,snapshot_id,source_file_id,source_row),
 FOREIGN KEY(tenant_id,snapshot_id,source_file_id) REFERENCES source_files(tenant_id,snapshot_id,id)
);

CREATE INDEX sales_order_items_order_idx ON sales_order_items(tenant_id,snapshot_id,sales_order_id,sales_item);

CREATE INDEX sales_order_items_material_id_idx ON sales_order_items(tenant_id,snapshot_id,material_id);

CREATE TABLE orders (
 tenant_id uuid NOT NULL, snapshot_id uuid NOT NULL, source_file_id uuid NOT NULL, source_row integer NOT NULL CHECK(source_row>0),
 kind text NOT NULL CHECK(kind IN ('planned','production')), order_id text NOT NULL, order_type text, sales_order_id text, sales_item text, material_id text NOT NULL, description text, quantity numeric(24,6), delivered numeric(24,6), committed numeric(24,6), unit text, start_date date, actual_finish date, status text, entered_by text,
 PRIMARY KEY(tenant_id,snapshot_id,source_file_id,source_row),
 FOREIGN KEY(tenant_id,snapshot_id,source_file_id) REFERENCES source_files(tenant_id,snapshot_id,id)
);

CREATE INDEX orders_order_id_idx ON orders(tenant_id,snapshot_id,order_id);

CREATE INDEX orders_material_id_idx ON orders(tenant_id,snapshot_id,material_id);

CREATE TABLE production_links (
 tenant_id uuid NOT NULL, snapshot_id uuid NOT NULL, source_file_id uuid NOT NULL, source_row integer NOT NULL CHECK(source_row>0),
 order_id text, sales_order_id text, sales_item text, material_id text, customer_id text, customer_name text, plant text, order_type text, supervisor text, mrp_controller text, quantity numeric(24,6), unit text, available numeric(24,6), unrestricted numeric(24,6), stock_unit text,
 PRIMARY KEY(tenant_id,snapshot_id,source_file_id,source_row),
 FOREIGN KEY(tenant_id,snapshot_id,source_file_id) REFERENCES source_files(tenant_id,snapshot_id,id)
);

CREATE INDEX production_links_order_id_idx ON production_links(tenant_id,snapshot_id,order_id);

CREATE INDEX production_links_material_id_idx ON production_links(tenant_id,snapshot_id,material_id);

CREATE INDEX production_links_plant_idx ON production_links(tenant_id,snapshot_id,plant);

CREATE TABLE confirmations (
 tenant_id uuid NOT NULL, snapshot_id uuid NOT NULL, source_file_id uuid NOT NULL, source_row integer NOT NULL CHECK(source_row>0),
 order_id text NOT NULL, confirmation_id text, posting_date date, yield_quantity numeric(24,6), scrap_quantity numeric(24,6), unit text, scrap_unit text, work_center text, activity text, suboperation text, final_confirmation boolean NOT NULL DEFAULT false, description text,
 PRIMARY KEY(tenant_id,snapshot_id,source_file_id,source_row),
 FOREIGN KEY(tenant_id,snapshot_id,source_file_id) REFERENCES source_files(tenant_id,snapshot_id,id)
);

CREATE INDEX confirmations_order_id_idx ON confirmations(tenant_id,snapshot_id,order_id);

CREATE INDEX confirmations_work_center_idx ON confirmations(tenant_id,snapshot_id,work_center);

CREATE TABLE components (
 tenant_id uuid NOT NULL, snapshot_id uuid NOT NULL, source_file_id uuid NOT NULL, source_row integer NOT NULL CHECK(source_row>0),
 order_id text, planned_order_id text, material_id text NOT NULL, description text, plant text, requirement_date date, required_quantity numeric(24,6), withdrawn_quantity numeric(24,6), unit text, missing boolean NOT NULL DEFAULT false,
 PRIMARY KEY(tenant_id,snapshot_id,source_file_id,source_row),
 FOREIGN KEY(tenant_id,snapshot_id,source_file_id) REFERENCES source_files(tenant_id,snapshot_id,id)
);

CREATE INDEX components_order_id_idx ON components(tenant_id,snapshot_id,order_id);

CREATE INDEX components_material_id_idx ON components(tenant_id,snapshot_id,material_id);

CREATE INDEX components_plant_idx ON components(tenant_id,snapshot_id,plant);

CREATE TABLE procurement (
 tenant_id uuid NOT NULL, snapshot_id uuid NOT NULL, source_file_id uuid NOT NULL, source_row integer NOT NULL CHECK(source_row>0),
 requisition_id text NOT NULL, requisition_item text NOT NULL, purchase_order_id text, material_id text NOT NULL, description text, plant text, quantity numeric(24,6), unit text, requisition_date date, purchase_order_date date, delivery_date date, deleted boolean NOT NULL DEFAULT false, closed boolean NOT NULL DEFAULT false, purchasing_group text,
 PRIMARY KEY(tenant_id,snapshot_id,source_file_id,source_row),
 FOREIGN KEY(tenant_id,snapshot_id,source_file_id) REFERENCES source_files(tenant_id,snapshot_id,id)
);

CREATE INDEX procurement_po_idx ON procurement(tenant_id,snapshot_id,purchase_order_id);

CREATE INDEX procurement_material_id_idx ON procurement(tenant_id,snapshot_id,material_id);

CREATE INDEX procurement_plant_idx ON procurement(tenant_id,snapshot_id,plant);

CREATE TABLE inspections (
 tenant_id uuid NOT NULL, snapshot_id uuid NOT NULL, source_file_id uuid NOT NULL, source_row integer NOT NULL CHECK(source_row>0),
 lot_id text NOT NULL, material_id text NOT NULL, plant text, sales_order_id text, sales_item text, quantity numeric(24,6), unit text, start_date date, end_date date, status text,
 PRIMARY KEY(tenant_id,snapshot_id,source_file_id,source_row),
 FOREIGN KEY(tenant_id,snapshot_id,source_file_id) REFERENCES source_files(tenant_id,snapshot_id,id)
);

CREATE INDEX inspections_sales_idx ON inspections(tenant_id,snapshot_id,sales_order_id,sales_item);

CREATE INDEX inspections_material_id_idx ON inspections(tenant_id,snapshot_id,material_id);

CREATE INDEX inspections_plant_idx ON inspections(tenant_id,snapshot_id,plant);

CREATE TABLE capacity (
 tenant_id uuid NOT NULL, snapshot_id uuid NOT NULL, source_file_id uuid NOT NULL, source_row integer NOT NULL CHECK(source_row>0),
 work_center text NOT NULL, description text, plant text, category text, period text, requirements numeric(24,6), available numeric(24,6), load_percent numeric(24,6), remaining numeric(24,6), unit text,
 PRIMARY KEY(tenant_id,snapshot_id,source_file_id,source_row),
 FOREIGN KEY(tenant_id,snapshot_id,source_file_id) REFERENCES source_files(tenant_id,snapshot_id,id)
);

CREATE INDEX capacity_plant_idx ON capacity(tenant_id,snapshot_id,plant);

CREATE INDEX capacity_work_center_idx ON capacity(tenant_id,snapshot_id,work_center);

ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshots FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON snapshots USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid);

ALTER TABLE source_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_files FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON source_files USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON conversations USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON messages USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid);

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON audit_events USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid);

ALTER TABLE sales_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_items FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON sales_order_items USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON orders USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid);

ALTER TABLE production_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_links FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON production_links USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid);

ALTER TABLE confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE confirmations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON confirmations USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid);

ALTER TABLE components ENABLE ROW LEVEL SECURITY;
ALTER TABLE components FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON components USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid);

ALTER TABLE procurement ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON procurement USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid);

ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspections FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON inspections USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid);

ALTER TABLE capacity ENABLE ROW LEVEL SECURITY;
ALTER TABLE capacity FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON capacity USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid);
