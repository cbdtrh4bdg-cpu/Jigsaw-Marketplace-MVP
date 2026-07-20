import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { supabaseAdmin } from "@/lib/supabase";

export interface StorageProvider {
  readonly name: string;
  /** Persist a file and return a public URL/path. */
  save(input: { data: Buffer; filename: string; contentType?: string }): Promise<{ url: string }>;
}

function uniqueName(filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
}

/**
 * Writes to /public/uploads and returns a /uploads/... path Next serves
 * statically. Handy for local dev with no Supabase project.
 */
class SimulatedStorageProvider implements StorageProvider {
  readonly name = "simulated";

  async save({ data, filename }: { data: Buffer; filename: string }) {
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    const unique = uniqueName(filename);
    await writeFile(path.join(dir, unique), data);
    return { url: `/uploads/${unique}` };
  }
}

/**
 * Uploads completion-photo proofs to a Supabase Storage bucket and returns the
 * public URL. Uses the service-role client (server-side), so uploads succeed
 * regardless of storage RLS policies. The bucket is created on first use
 * (public) so no manual setup step is required.
 */
class SupabaseStorageProvider implements StorageProvider {
  readonly name = "supabase";
  private bucket = process.env.SUPABASE_STORAGE_BUCKET || "condition-proofs";
  private ensured: Promise<void> | null = null;

  private ensureBucket(): Promise<void> {
    // Cache the check so we only hit the API once per process.
    if (!this.ensured) {
      this.ensured = (async () => {
        const storage = supabaseAdmin().storage;
        const { data } = await storage.getBucket(this.bucket);
        if (!data) {
          const { error } = await storage.createBucket(this.bucket, {
            public: true,
          });
          // Ignore "already exists" races between concurrent requests.
          if (error && !/exist/i.test(error.message)) {
            throw new Error(`Could not create bucket: ${error.message}`);
          }
        }
      })();
    }
    return this.ensured;
  }

  async save({
    data,
    filename,
    contentType,
  }: {
    data: Buffer;
    filename: string;
    contentType?: string;
  }) {
    await this.ensureBucket();
    const storage = supabaseAdmin().storage.from(this.bucket);
    const key = uniqueName(filename);

    const { error } = await storage.upload(key, data, {
      contentType: contentType || "application/octet-stream",
      upsert: false,
    });
    if (error) throw new Error(`Upload failed: ${error.message}`);

    const { data: pub } = storage.getPublicUrl(key);
    return { url: pub.publicUrl };
  }
}

let provider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (provider) return provider;
  switch (process.env.STORAGE_PROVIDER) {
    case "supabase":
      provider = new SupabaseStorageProvider();
      break;
    default:
      provider = new SimulatedStorageProvider();
  }
  return provider;
}
