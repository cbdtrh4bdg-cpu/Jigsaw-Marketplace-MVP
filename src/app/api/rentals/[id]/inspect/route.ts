import { rentalActionRoute } from "@/lib/rentalActions";
import { inspectComplete } from "@/lib/services/rentals";

export const POST = rentalActionRoute(inspectComplete);
