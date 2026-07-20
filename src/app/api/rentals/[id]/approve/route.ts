import { rentalActionRoute } from "@/lib/rentalActions";
import { approveRental } from "@/lib/services/rentals";

export const POST = rentalActionRoute(approveRental);
