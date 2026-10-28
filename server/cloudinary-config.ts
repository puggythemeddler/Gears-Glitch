export interface CloudinaryConfigSources {
  cloudinaryCloudName?: string | null;
  cloudinaryApiKey?: string | null;
  cloudinaryApiSecret?: string | null;
  cloudinaryFolder?: string | null;
}

export interface CloudinaryEnvironment {
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
  CLOUDINARY_FOLDER?: string;
}

export interface ResolvedCloudinaryConfig {
  cloudinaryCloudName: string;
  cloudinaryApiKey: string;
  cloudinaryApiSecret: string;
  cloudinaryFolder: string;
}

/**
 * Control Plane-synced Render variables are authoritative when present. The
 * database remains a fallback for older or locally configured stores that do
 * not have Cloudinary environment variables set.
 */
export function resolveCloudinaryConfig(
  stored: CloudinaryConfigSources,
  env: CloudinaryEnvironment,
): ResolvedCloudinaryConfig {
  return {
    cloudinaryCloudName: env.CLOUDINARY_CLOUD_NAME || stored.cloudinaryCloudName || "",
    cloudinaryApiKey: env.CLOUDINARY_API_KEY || stored.cloudinaryApiKey || "",
    cloudinaryApiSecret: env.CLOUDINARY_API_SECRET || stored.cloudinaryApiSecret || "",
    cloudinaryFolder: env.CLOUDINARY_FOLDER || stored.cloudinaryFolder || "gear-glitch",
  };
}
