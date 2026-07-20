import { rentalActionRoute } from "@/lib/rentalActions";
import { markReturned } from "@/lib/services/rentals";

export const POST = rentalActionRoute(markReturned);
