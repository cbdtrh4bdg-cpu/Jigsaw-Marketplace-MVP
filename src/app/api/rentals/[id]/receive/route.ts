import { rentalActionRoute } from "@/lib/rentalActions";
import { receiveByBorrower } from "@/lib/services/rentals";

export const POST = rentalActionRoute(receiveByBorrower);
