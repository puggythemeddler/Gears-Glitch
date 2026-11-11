-- stock_levels is the inventory ledger. Keep products.stock_on_hand as the
-- available-quantity mirror consumed by the POS and storefront.
-- A branchless database can migrate its existing POS quantities to one global
-- stock row. Branch-enabled databases need a location-level physical count and
-- are deliberately not auto-allocated from a company-wide total.

CREATE OR REPLACE FUNCTION refresh_product_available_stock(p_product_id TEXT)
RETURNS VOID AS $$
DECLARE
  v_available BIGINT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM stock_levels WHERE product_id = p_product_id AND branch_id IS NOT NULL
  ) THEN
    SELECT COALESCE(SUM(GREATEST(quantity_in_stock - quantity_reserved, 0)), 0)
      INTO v_available
      FROM stock_levels
      WHERE product_id = p_product_id AND branch_id IS NOT NULL;
  ELSE
    SELECT GREATEST(quantity_in_stock - quantity_reserved, 0)
      INTO v_available
      FROM stock_levels
      WHERE product_id = p_product_id AND branch_id IS NULL;
  END IF;

  IF v_available IS NOT NULL THEN
    UPDATE products
      SET stock_on_hand = GREATEST(v_available, 0)::INTEGER
      WHERE id = p_product_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION stock_levels_sync_product_available()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM refresh_product_available_stock(OLD.product_id);
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.product_id IS DISTINCT FROM NEW.product_id THEN
    PERFORM refresh_product_available_stock(OLD.product_id);
  END IF;
  PERFORM refresh_product_available_stock(NEW.product_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stock_levels_sync_product_available ON stock_levels;
CREATE TRIGGER trg_stock_levels_sync_product_available
AFTER INSERT OR UPDATE OR DELETE ON stock_levels
FOR EACH ROW EXECUTE FUNCTION stock_levels_sync_product_available();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM branches) THEN
    -- POS exposes available units. Add existing holds back to get physical
    -- quantity_in_stock while preserving quantity_reserved and quantity_sold.
    INSERT INTO stock_movements
      (product_id, movement_type, quantity, reference_type, reference_id, notes)
    SELECT p.id, 'opening_balance',
      GREATEST(COALESCE(p.stock_on_hand, 0), 0) + COALESCE(sl.quantity_reserved, 0)
        - COALESCE(sl.quantity_in_stock, 0),
      'migration', '0047_stock_ledger_opening_balance_and_pos_mirror',
      'Opening inventory aligned from POS catalog quantity.'
    FROM products p
    LEFT JOIN stock_levels sl ON sl.product_id = p.id AND sl.branch_id IS NULL
    WHERE GREATEST(COALESCE(p.stock_on_hand, 0), 0) + COALESCE(sl.quantity_reserved, 0)
      <> COALESCE(sl.quantity_in_stock, 0);

    INSERT INTO stock_levels
      (product_id, branch_id, quantity_in_stock, quantity_reserved, quantity_sold, low_stock_threshold)
    SELECT p.id, NULL, GREATEST(COALESCE(p.stock_on_hand, 0), 0), 0, 0, 5
    FROM products p
    ON CONFLICT (product_id) WHERE branch_id IS NULL
    DO UPDATE SET
      quantity_in_stock = EXCLUDED.quantity_in_stock + stock_levels.quantity_reserved,
      updated_at = NOW()::text;

    RAISE NOTICE 'Stock opening balances initialized from POS catalog quantities (branchless database).';
  ELSE
    RAISE NOTICE 'Stock opening balance import skipped: branch quantities require location-level reconciliation.';
  END IF;
END;
$$;
