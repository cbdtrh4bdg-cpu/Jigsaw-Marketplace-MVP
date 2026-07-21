import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/permissions";
import { markReceived, RentalError } from "@/lib/services/rentals";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const rental = await markReceived({
      rentalId: params.id,
      borrowerId: user.id,
    });
    return NextResponse.json({ rental });
  } catch (err) {
    if (err instanceof RentalError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
