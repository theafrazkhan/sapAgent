-- The supplied component export has two distinct columns with the same label.
-- Preserve both without inventing a business meaning for the second quantity.
ALTER TABLE smart_factory.components ADD COLUMN secondary_required_quantity numeric(24,6);
COMMENT ON COLUMN smart_factory.components.secondary_required_quantity IS 'Second Requirement Quantity column in source export. Meaning unverified; excluded from derived calculations.';
