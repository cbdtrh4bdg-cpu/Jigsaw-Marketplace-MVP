import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/permissions";
import { getStorageProvider } from "@/lib/services/storage";
import { submitReturn, RentalError } from "@/lib/services/rentals";

function toIntOrNull(v: FormDataEntryValue | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
function toFloatOrNull(v: FormDataEntryValue | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Multipart: photo (required) + survey fields. Saves the condition proof via
// the storage provider, records the survey, and ships the item back.
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const photo = form.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return NextResponse.json(
      { error: "A completion photo is required" },
      { status: 400 },
    );
  }

  const bytes = Buffer.from(await photo.arrayBuffer());
  const { url } = await getStorageProvider().save({
    bytes,
    filename: photo.name || "completion.jpg",
    contentType: photo.type,
  });

  try {
    const rental = await submitReturn({
      rentalId: params.id,
      borrowerId: user.id,
      imageUrl: url,
      proofNote: (form.get("proofNote") as string) || undefined,
      survey: {
        timeToCompleteHours: toFloatOrNull(form.get("timeToCompleteHours")),
        difficultyRating: toIntOrNull(form.get("difficultyRating")),
        enjoymentRating: toIntOrNull(form.get("enjoymentRating")),
        missingPiecesReported: toIntOrNull(form.get("missingPiecesReported")) ?? 0,
        notes: (form.get("notes") as string) || null,
      },
    });
    return NextResponse.json({ rental });
  } catch (err) {
    if (err instanceof RentalError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
