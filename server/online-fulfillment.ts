export interface FulfillmentBranch {
  isActive: boolean;
  onlineFulfillmentEnabled: boolean;
}

/** Branches that are both operational and explicitly customer-selectable. */
export function filterOnlineFulfillmentBranches<T extends FulfillmentBranch>(branches: T[]): T[] {
  return branches.filter((branch) => branch.isActive && branch.onlineFulfillmentEnabled);
}
