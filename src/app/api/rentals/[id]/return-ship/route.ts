import { rentalActionRoute } from "@/lib/rentalActions";
import { returnShip } from "@/lib/services/rentals";

export const POST = rentalActionRoute(returnShip);
