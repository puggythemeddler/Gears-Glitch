export interface ClientSuspensionResult {
  appSuspended: boolean;
  renderSuspended: boolean;
}

export interface ClientSuspensionOperations {
  suspendApp: () => Promise<boolean>;
  suspendRender: () => Promise<boolean>;
  markSuspended: () => Promise<void>;
}

/**
 * Confirm suspension with at least one remote enforcement mechanism before
 * recording the client as suspended in the control-plane database.
 */
export async function suspendClientWithConfirmation(
  operations: ClientSuspensionOperations,
): Promise<ClientSuspensionResult> {
  const [appSuspended, renderSuspended] = await Promise.all([
    attempt(operations.suspendApp),
    attempt(operations.suspendRender),
  ]);

  if (!appSuspended && !renderSuspended) {
    throw new Error("Client suspension was not confirmed by the tenant app or Render.");
  }

  await operations.markSuspended();
  return { appSuspended, renderSuspended };
}

async function attempt(action: () => Promise<boolean>): Promise<boolean> {
  try {
    return await action();
  } catch {
    return false;
  }
}
