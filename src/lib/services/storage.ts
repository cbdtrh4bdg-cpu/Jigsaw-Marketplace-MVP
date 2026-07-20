import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export interface StorageProvider {
  readonly name: string;
  /** Persist a file and return a public URL/path. */
  save(input: { data: Buffer; filename: string; contentType?: string }): Promise<{ url: string }>;
}

/**
 * Writes to /public/uploads and returns a /uploads/... path Next serves
 * statically. Swap for an S3-backed impl behind this same interface later.
 */
class SimulatedStorageProvider implements StorageProvider {
  readonly name = "simulated";

  async save({ data, filename }: { data: Buffer; filename: string }) {
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
    await writeFile(path.join(dir, unique), data);
    return { url: `/uploads/${unique}` };
  }
}

let provider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (provider) return provider;
  switch (process.env.STORAGE_PROVIDER) {
    // case "s3": provider = new S3StorageProvider(); break;
    default:
      provider = new SimulatedStorageProvider();
  }
  return provider;
}
