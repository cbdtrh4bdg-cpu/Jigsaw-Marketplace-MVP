"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Category, RentalStatus } from "@prisma/client";
import { getCategoryModule } from "@/lib/categories";
import { Badge, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { formatCents } from "@/lib/money";
import type { Perspective, RentalView } from "./types";

const STATUS_TONE: Record<string, "slate" | "green" | "amber" | "red" | "indigo"> = {
  REQUESTED: "amber",
  APPROVED: "indigo",
  SHIPPED_TO_BORROWER: "indigo",
  IN_HAND: "indigo",
  RETURN_SHIPPED: "indigo",
  RETURNED: "amber",
  DISPUTED: "red",
  COMPLETED: "green",
  DECLINED: "slate",
  CANCELED: "slate",
};

export function RentalActions({
  rental,
  perspective,
  isAdmin = false,
}: {
  rental: RentalView;
  perspective: Perspective;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mod = getCategoryModule(rental.category as Category);
  const isLender = perspective === "lender";

  async function post(path: string, body?: unknown) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/rentals/${rental.id}/${path}`, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Action failed");
      return false;
    }
    router.refresh();
    return true;
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🧩</span>
          <div>
            <p className="font-semibold">{rental.title}</p>
            <p className="text-xs text-slate-500">
              {isLender ? "Borrower" : "From"}: {rental.otherPartyName} ·{" "}
              {rental.periodDays / 7}wk
            </p>
          </div>
        </div>
        <Badge tone={STATUS_TONE[rental.status] ?? "slate"}>
          {rental.status.replaceAll("_", " ")}
        </Badge>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-slate-500">Rental fee</dt>
        <dd className="text-right font-medium">{formatCents(rental.quotedFeeCents)}</dd>
        {rental.depositAmountCents !== null ? (
          <>
            <dt className="text-slate-500">Deposit</dt>
            <dd className="text-right font-medium">
              {formatCents(rental.depositAmountCents)}{" "}
              {rental.depositStatus ? (
                <span className="text-xs text-slate-400">
                  ({rental.depositStatus.toLowerCase().replaceAll("_", " ")})
                </span>
              ) : null}
            </dd>
          </>
        ) : null}
        {rental.dueAt ? (
          <>
            <dt className="text-slate-500">Due</dt>
            <dd className="text-right">{new Date(rental.dueAt).toLocaleDateString()}</dd>
          </>
        ) : null}
        {rental.outboundShipCents !== null ? (
          <>
            <dt className="text-slate-500">Outbound shipping</dt>
            <dd className="text-right">{formatCents(rental.outboundShipCents)}</dd>
          </>
        ) : null}
        {rental.returnShipCents !== null ? (
          <>
            <dt className="text-slate-500">Return shipping</dt>
            <dd className="text-right">{formatCents(rental.returnShipCents)}</dd>
          </>
        ) : null}
      </dl>

      {rental.missingPiecesReported && rental.missingPiecesReported > 0 ? (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          ⚠ Borrower reported {rental.missingPiecesReported} missing piece(s).
        </p>
      ) : null}

      {rental.proofImageUrl ? (
        <div className="mt-3">
          <p className="mb-1 text-xs font-medium text-slate-500">Completion photo</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={rental.proofImageUrl}
            alt="Completion proof"
            className="max-h-48 rounded-lg border border-slate-200"
          />
          {rental.proofNote ? (
            <p className="mt-1 text-xs text-slate-500">{rental.proofNote}</p>
          ) : null}
        </div>
      ) : null}

      {rental.disputeReason ? (
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Dispute: {rental.disputeReason}
        </p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {/* Lender / owner actions */}
        {isLender && rental.status === RentalStatus.REQUESTED ? (
          <>
            <Button disabled={busy} onClick={() => post("approve")}>Approve</Button>
            <Button variant="secondary" disabled={busy} onClick={() => post("decline")}>
              Decline
            </Button>
          </>
        ) : null}
        {isLender && rental.status === RentalStatus.APPROVED ? (
          <Button disabled={busy} onClick={() => post("ship")}>
            Ship to borrower
          </Button>
        ) : null}
        {isLender && rental.status === RentalStatus.RETURN_SHIPPED ? (
          <Button disabled={busy} onClick={() => post("receive-return")}>
            Confirm return received
          </Button>
        ) : null}
        {isLender && rental.status === RentalStatus.RETURNED ? (
          <InspectActions rental={rental} busy={busy} post={post} />
        ) : null}

        {/* Borrower actions */}
        {!isLender &&
        (rental.status === RentalStatus.REQUESTED ||
          rental.status === RentalStatus.APPROVED) ? (
          <Button variant="secondary" disabled={busy} onClick={() => post("cancel")}>
            Cancel request
          </Button>
        ) : null}
        {!isLender && rental.status === RentalStatus.SHIPPED_TO_BORROWER ? (
          <Button disabled={busy} onClick={() => post("receive")}>
            Confirm received
          </Button>
        ) : null}

        {/* Admin dispute resolution */}
        {isAdmin && rental.status === RentalStatus.DISPUTED ? (
          <ResolveDisputeForm
            rental={rental}
            busy={busy}
            post={post}
          />
        ) : null}
      </div>

      {/* Borrower completion step: proof + survey, gated return */}
      {!isLender && rental.status === RentalStatus.IN_HAND ? (
        <CompletionStep rental={rental} mod={mod} busy={busy} post={post} />
      ) : null}
    </Card>
  );
}

function InspectActions({
  rental,
  busy,
  post,
}: {
  rental: RentalView;
  busy: boolean;
  post: (p: string, b?: unknown) => Promise<boolean>;
}) {
  const [showDispute, setShowDispute] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <div className="w-full space-y-2">
      <div className="flex gap-2">
        <Button disabled={busy} onClick={() => post("inspect")}>
          Complete & refund deposit
        </Button>
        <Button
          variant="danger"
          disabled={busy}
          onClick={() => setShowDispute((v) => !v)}
        >
          Open dispute
        </Button>
      </div>
      {showDispute ? (
        <div className="rounded-md border border-slate-200 p-3">
          <Field label="What's wrong? (missing/damaged pieces)">
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </Field>
          <Button
            variant="danger"
            disabled={busy || !reason}
            onClick={async () => {
              if (await post("dispute", { reason })) setShowDispute(false);
            }}
          >
            Submit dispute
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ResolveDisputeForm({
  rental,
  busy,
  post,
}: {
  rental: RentalView;
  busy: boolean;
  post: (p: string, b?: unknown) => Promise<boolean>;
}) {
  const [resolution, setResolution] = useState("");
  const [forfeitCents, setForfeitCents] = useState(0);
  const max = rental.depositAmountCents ?? 0;
  return (
    <div className="w-full rounded-md border border-slate-200 p-3">
      <p className="mb-2 text-sm font-medium">Resolve dispute (admin)</p>
      <Field label="Resolution notes">
        <Textarea
          value={resolution}
          onChange={(e) => setResolution(e.target.value)}
          rows={2}
        />
      </Field>
      <Field label={`Deposit to forfeit (max ${formatCents(max)})`}>
        <Input
          type="number"
          min={0}
          max={max}
          value={forfeitCents}
          onChange={(e) => setForfeitCents(Number(e.target.value))}
        />
        <p className="mt-1 text-xs text-slate-500">
          = {formatCents(forfeitCents)} forfeited to the lender.
        </p>
      </Field>
      <Button
        disabled={busy || !resolution}
        onClick={() => post("resolve-dispute", { resolution, forfeitCents })}
      >
        Resolve & complete
      </Button>
    </div>
  );
}

function CompletionStep({
  rental,
  mod,
  busy,
  post,
}: {
  rental: RentalView;
  mod: ReturnType<typeof getCategoryModule>;
  busy: boolean;
  post: (p: string, b?: unknown) => Promise<boolean>;
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);

  // Survey state
  const [time, setTime] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [enjoyment, setEnjoyment] = useState("");
  const [missing, setMissing] = useState("0");

  async function uploadProof() {
    if (!file) return;
    setUploading(true);
    setErr(null);
    const fd = new FormData();
    fd.append("photo", file);
    if (note) fd.append("note", note);
    const res = await fetch(`/api/rentals/${rental.id}/proof`, {
      method: "POST",
      body: fd,
    });
    setUploading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(data.error ?? "Upload failed");
      return;
    }
    router.refresh();
  }

  async function saveSurvey() {
    await post("survey", {
      timeToCompleteHours: time ? Number(time) : undefined,
      difficultyRating: difficulty ? Number(difficulty) : undefined,
      enjoymentRating: enjoyment ? Number(enjoyment) : undefined,
      missingPiecesReported: Number(missing || "0"),
    });
  }

  return (
    <div className="mt-4 space-y-4 border-t border-slate-200 pt-4">
      <div>
        <p className="mb-1 font-medium">1. Completion photo</p>
        <p className="mb-2 text-sm text-slate-600">{mod.conditionProofPrompt}</p>
        {rental.hasProof ? (
          <Badge tone="green">Photo uploaded ✓</Badge>
        ) : (
          <div className="space-y-2">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block text-sm"
            />
            <Input
              placeholder="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            {err ? <p className="text-sm text-red-600">{err}</p> : null}
            <Button disabled={uploading || !file} onClick={uploadProof}>
              {uploading ? "Uploading…" : "Upload photo"}
            </Button>
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 font-medium">2. Quick survey</p>
        {rental.hasExperience ? (
          <Badge tone="green">Survey saved ✓</Badge>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label={mod.surveyFields[0]?.label ?? "Time"}>
              <Input
                type="number"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </Field>
            <Field label="Missing pieces">
              <Input
                type="number"
                min={0}
                value={missing}
                onChange={(e) => setMissing(e.target.value)}
              />
            </Field>
            <Field label="Difficulty (1–5)">
              <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="">—</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </Select>
            </Field>
            <Field label="Enjoyment (1–5)">
              <Select value={enjoyment} onChange={(e) => setEnjoyment(e.target.value)}>
                <option value="">—</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </Select>
            </Field>
            <div className="col-span-2">
              <Button variant="secondary" disabled={busy} onClick={saveSurvey}>
                Save survey
              </Button>
            </div>
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 font-medium">3. Ship it back</p>
        <Button
          disabled={busy || !rental.hasProof}
          onClick={() => post("return-ship")}
        >
          Ship return
        </Button>
        {!rental.hasProof ? (
          <p className="mt-1 text-xs text-slate-500">
            Upload the completion photo first — returns are gated on it.
          </p>
        ) : null}
      </div>
    </div>
  );
}
