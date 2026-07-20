import Link from "next/link";
import { Card } from "@/components/ui";

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">
          Borrow puzzles. Lend puzzles. Never store a finished one again.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
          Piece Together is a hybrid marketplace — borrow from other members
          (peer-to-peer) or from our warehouse. Subscribe, browse, and request a
          rental for the period that fits your pace.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/signup"
            className="rounded-md bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700"
          >
            Get started
          </Link>
          <Link
            href="/browse"
            className="rounded-md border border-slate-300 bg-white px-5 py-2.5 font-medium text-slate-800 hover:bg-slate-50"
          >
            Browse the catalog
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <h3 className="font-semibold">Duration-based rental</h3>
          <p className="mt-2 text-sm text-slate-600">
            Pick 1, 2, or 4 weeks. The fee scales with the period, so owners are
            paid more when a puzzle is out longer.
          </p>
        </Card>
        <Card>
          <h3 className="font-semibold">Refundable deposit + photo proof</h3>
          <p className="mt-2 text-sm text-slate-600">
            Upload a photo of the assembled puzzle before teardown so lenders
            know every piece is present. Your deposit comes back.
          </p>
        </Card>
        <Card>
          <h3 className="font-semibold">Reward for what people want</h3>
          <p className="mt-2 text-sm text-slate-600">
            Owner payouts blend contribution with real demand — a few
            in-demand titles out-earn a hoard of unwanted listings.
          </p>
        </Card>
      </section>
    </div>
  );
}
