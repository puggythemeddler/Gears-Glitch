export interface ClientResumptionResult {
  appResumed: boolean;
  renderResumed: boolean;
  resumed: boolean;
}

export interface ClientResumptionOperations {
  resumeApp?: () => Promise<boolean>;
  resumeRender?: () => Promise<boolean>;
  markActive: () => Promise<void>;
}

/** Keep Control Plane status suspended until every configured serving layer confirms resume. */
export async function resumeClientWithConfirmation(
  operations: ClientResumptionOperations,
): Promise<ClientResumptionResult> {
  const configured = [operations.resumeApp, operations.resumeRender].filter((operation): operation is () => Promise<boolean> => Boolean(operation));
  const [appResumed, renderResumed] = await Promise.all([
    operations.resumeApp ? attempt(operations.resumeApp) : Promise.resolve(false),
    operations.resumeRender ? attempt(operations.resumeRender) : Promise.resolve(false),
  ]);
  const resumed = configured.length > 0 &&
    (!operations.resumeApp || appResumed) &&
    (!operations.resumeRender || renderResumed);
  if (resumed) await operations.markActive();
  return { appResumed, renderResumed, resumed };
}

async function attempt(action: () => Promise<boolean>): Promise<boolean> {
  try { return await action(); }
  catch { return false; }
}
