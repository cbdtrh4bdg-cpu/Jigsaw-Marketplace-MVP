import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 px-6 text-center">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">
          PuzzleShare
        </h1>
        <p className="mt-3 text-lg text-slate-600">
          Borrow puzzles from a shared community library — or lend out the ones
          you own and earn a share of every rental.
        </p>
      </div>
      <div className="flex gap-4">
        <Link
          href="/browse"
          className="rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white shadow-sm transition hover:bg-brand-700"
        >
          Browse the marketplace
        </Link>
        <Link
          href="/signup"
          className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Create an account
        </Link>
      </div>
      <p className="text-sm text-slate-400">
        Puzzles today — board &amp; card games coming soon.
      </p>
    </main>
  );
}
