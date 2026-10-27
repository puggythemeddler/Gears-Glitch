export interface CloudinaryFolderClient {
  id: number;
  cloudinary_folder?: string | null;
}

export interface CloudinaryFolderAssignment {
  folder: string;
  changed: boolean;
}

function normalizedFolder(folder: string): string {
  return folder.replace(/^\/+|\/+$/g, "");
}

function clientFolder(clientId: number, suffix = ""): string {
  if (!Number.isSafeInteger(clientId) || clientId <= 0) {
    throw new Error("A valid control-plane client ID is required for an isolated Cloudinary folder.");
  }
  return `gear-glitch/client-${clientId}${suffix}`;
}

export function newCloudinaryFolder(clientId: number, occupiedFolders: Iterable<string> = []): string {
  const reserved = new Set(Array.from(occupiedFolders, (folder) => normalizedFolder(folder.trim())));
  let candidate = clientFolder(clientId);
  let normalized = normalizedFolder(candidate);
  let suffix = 2;
  while (reserved.has(normalized)) {
    candidate = clientFolder(clientId, `-isolated-${suffix++}`);
    normalized = normalizedFolder(candidate);
  }
  return candidate;
}

/** Retain unique legacy folders; repair missing or duplicated assignments. */
export function assignCloudinaryFolders<T extends CloudinaryFolderClient>(
  clients: T[],
): Map<number, CloudinaryFolderAssignment> {
  const ownersByFolder = new Map<string, number[]>();
  for (const client of clients) {
    if (!Number.isSafeInteger(client.id) || client.id <= 0) {
      throw new Error("A valid control-plane client ID is required for an isolated Cloudinary folder.");
    }
    const folder = typeof client.cloudinary_folder === "string"
      ? normalizedFolder(client.cloudinary_folder.trim())
      : "";
    if (folder) ownersByFolder.set(folder, [...(ownersByFolder.get(folder) || []), client.id]);
  }

  const collidingIds = new Set<number>();
  for (const owners of ownersByFolder.values()) {
    if (owners.length > 1) owners.forEach((id) => collidingIds.add(id));
  }

  const assignments = new Map<number, CloudinaryFolderAssignment>();
  const reserved = new Set<string>();
  for (const client of clients) {
    const saved = typeof client.cloudinary_folder === "string" ? client.cloudinary_folder.trim() : "";
    if (saved && !collidingIds.has(client.id)) {
      assignments.set(client.id, { folder: saved, changed: false });
      reserved.add(normalizedFolder(saved));
    }
  }

  for (const client of clients) {
    if (assignments.has(client.id)) continue;
    const candidate = newCloudinaryFolder(client.id, reserved);
    const normalized = normalizedFolder(candidate);
    reserved.add(normalized);
    const saved = typeof client.cloudinary_folder === "string" ? client.cloudinary_folder.trim() : "";
    assignments.set(client.id, { folder: candidate, changed: saved !== candidate });
  }

  return assignments;
}
