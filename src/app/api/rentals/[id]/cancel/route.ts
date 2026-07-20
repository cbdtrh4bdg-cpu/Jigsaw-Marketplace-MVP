import { rentalActionRoute } from "@/lib/rentalActions";
import { cancelRental } from "@/lib/services/rentals";

export const POST = rentalActionRoute(cancelRental);
