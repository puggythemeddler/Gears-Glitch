-- Once an account has branches, positive on-hand or reserved inventory must
-- carry a branch. Existing global rows are left untouched so an operator can
-- reconcile them through the audited stock-location assignment flow first.
-- Decreases remain allowed so legacy stock can be sold down or assigned.
CREATE OR REPLACE FUNCTION prevent_unlocated_stock_in_branch_account()
RETURNS TRIGGER AS $$
DECLARE
  v_has_branches BOOLEAN;
  v_increases_unlocated BOOLEAN := FALSE;
BEGIN
  IF NEW.branch_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (SELECT 1 FROM branches LIMIT 1) INTO v_has_branches;
  IF NOT v_has_branches THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_increases_unlocated := COALESCE(NEW.quantity_in_stock, 0) > 0
      OR COALESCE(NEW.quantity_reserved, 0) > 0;
  ELSE
    v_increases_unlocated := (OLD.branch_id IS NOT NULL AND NEW.branch_id IS NULL
        AND (COALESCE(NEW.quantity_in_stock, 0) > 0 OR COALESCE(NEW.quantity_reserved, 0) > 0))
      OR COALESCE(NEW.quantity_in_stock, 0) > COALESCE(OLD.quantity_in_stock, 0)
      OR COALESCE(NEW.quantity_reserved, 0) > COALESCE(OLD.quantity_reserved, 0);
  END IF;

  IF v_increases_unlocated THEN
    RAISE EXCEPTION 'Inventory must be assigned to a branch when branches are configured.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_unlocated_branch_stock ON stock_levels;
CREATE TRIGGER trg_prevent_unlocated_branch_stock
BEFORE INSERT OR UPDATE OF branch_id, quantity_in_stock, quantity_reserved ON stock_levels
FOR EACH ROW EXECUTE FUNCTION prevent_unlocated_stock_in_branch_account();

CREATE OR REPLACE FUNCTION prevent_unlocated_in_stock_serial()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'in_stock'
     AND NEW.branch_id IS NULL
     AND EXISTS (SELECT 1 FROM branches LIMIT 1) THEN
    RAISE EXCEPTION 'In-stock serial numbers must be assigned to a branch when branches are configured.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_unlocated_in_stock_serial ON serial_numbers;
CREATE TRIGGER trg_prevent_unlocated_in_stock_serial
BEFORE INSERT OR UPDATE OF branch_id, status ON serial_numbers
FOR EACH ROW EXECUTE FUNCTION prevent_unlocated_in_stock_serial();
