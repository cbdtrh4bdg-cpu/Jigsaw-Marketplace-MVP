import { NextRequest, NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireUser } from "@/lib/permissions";
import { getStorageProvider } from "@/lib/services/storage";
import { uploadConditionProof, RentalError } from "@/lib/services/rentals";

// Accepts multipart/form-data with a `photo` file (and optional `note`), stores
// it via the swappable StorageProvider, and records the ConditionProof.
export const POST = handle(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await ctx.params;

    const form = await req.formData();
    const file = form.get("photo");
    const note = (form.get("note") as string | null) ?? undefined;
    if (!(file instanceof File)) {
      throw new RentalError("A completion photo is required");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { url } = await getStorageProvider().save({
      data: buffer,
      filename: file.name || "proof.jpg",
      contentType: file.type,
    });

    const proof = await uploadConditionProof(
      id,
      { id: user.id, role: user.role },
      { imageUrl: url, note },
    );
    return NextResponse.json({ proof });
  },
);
