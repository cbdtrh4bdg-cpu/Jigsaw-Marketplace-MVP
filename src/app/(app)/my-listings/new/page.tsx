import { ListingForm } from "@/components/listing-form";

export default function NewListingPage() {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold text-slate-900">List a puzzle</h1>
      <p className="mt-1 text-sm text-slate-500">
        Make a puzzle you own available for others to borrow.
      </p>
      <div className="mt-6">
        <ListingForm
          endpoint="/api/listings"
          submitLabel="Create listing"
          redirectTo="/my-listings"
        />
      </div>
    </div>
  );
}
