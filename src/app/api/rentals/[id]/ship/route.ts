import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/permissions";
import { shipToBorrower, RentalError } from "@/lib/services/rentals";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const rental = await shipToBorrower({
      rentalId: params.id,
      actorId: user.id,
      actorIsAdmin: user.role === "ADMIN",
    });
    return NextResponse.json({ rental });
  } catch (err) {
    if (err instanceof RentalError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
