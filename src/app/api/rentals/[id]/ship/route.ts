import { rentalActionRoute } from "@/lib/rentalActions";
import { shipToBorrower } from "@/lib/services/rentals";

export const POST = rentalActionRoute(shipToBorrower);
