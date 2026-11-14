/** Whether a positive stock write must be rejected because it has no branch. */
export function shouldRejectUnlocatedStockWrite(
  branchId: number | null | undefined,
  quantityInStock: number | undefined,
  branchCount: number,
): boolean {
  return branchId == null && quantityInStock !== undefined && quantityInStock > 0 && branchCount > 0;
}
