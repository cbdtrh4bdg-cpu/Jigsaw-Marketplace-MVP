import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

export interface StoredFile {
  url: string;
}

// The seam to any object store (S3, GCS…). SimulatedStorageProvider writes to
// the local /public/uploads dir and returns a served URL.
export interface StorageProvider {
  save(input: {
    bytes: Buffer;
    filename: string;
    contentType?: string;
  }): Promise<StoredFile>;
}

class SimulatedStorageProvider implements StorageProvider {
  private dir = path.join(process.cwd(), "public", "uploads");

  async save(input: { bytes: Buffer; filename: string }): Promise<StoredFile> {
    await mkdir(this.dir, { recursive: true });
    const ext = path.extname(input.filename) || ".bin";
    const name = `${randomUUID()}${ext}`;
    await writeFile(path.join(this.dir, name), input.bytes);
    return { url: `/uploads/${name}` };
  }
}

let provider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!provider) {
    switch (process.env.STORAGE_PROVIDER) {
      case "simulated":
      default:
        provider = new SimulatedStorageProvider();
    }
  }
  return provider;
}
