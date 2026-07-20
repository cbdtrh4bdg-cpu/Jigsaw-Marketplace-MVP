import { rentalActionRoute } from "@/lib/rentalActions";
import { declineRental } from "@/lib/services/rentals";

export const POST = rentalActionRoute(declineRental);
