"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useKolGrants } from "@/hooks/use-kols";
import { KOL_PERK_INELIGIBLE_LABEL } from "@/lib/kols";
import { formatUtc, formatUtcDay } from "@/lib/referral-v4";
import { formatNumber, formatUsd } from "@/lib/utils";

interface KolGrantsSheetProps {
  /** Whose signups: one perk's code, or every perk code of one KOL. */
  target: { kind: "perk" | "kol"; id: string; title: string } | null;
  onClose: () => void;
}

/**
 * The users who signed up with a perk's code (or any of a KOL's perk codes):
 * whether they got the perk, and what they have used of it so far.
 */
export function KolGrantsSheet({ target, onClose }: KolGrantsSheetProps) {
  const { data, isLoading, error } = useKolGrants(
    target?.kind ?? "perk",
    target?.id ?? null,
  );
  const grants = data?.grants ?? [];
  const granted = grants.filter((grant) => grant.status === "granted").length;

  return (
    <Sheet
      open={!!target}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-4xl">
        <SheetHeader>
          <SheetTitle>Signups · {target?.title}</SheetTitle>
          <SheetDescription>
            {data
              ? `${formatNumber(grants.length, 0, 0)} used the code${data.truncated ? " (latest 500 shown)" : ""} · ${formatNumber(granted, 0, 0)} got the perk.`
              : "Who used the code, and what they have used of the perk."}
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
          ) : error ? (
            <p className="text-sm text-red-600">Failed to load signups.</p>
          ) : grants.length === 0 ? (
            <p className="text-muted-foreground py-12 text-center text-sm">
              Nobody has used this code yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Perk</TableHead>
                  <TableHead>Membership discount</TableHead>
                  <TableHead>Free SEPA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grants.map((grant) => (
                  <TableRow key={grant.id}>
                    <TableCell>
                      <Link
                        href={`/users/${encodeURIComponent(grant.userId)}`}
                        className="font-medium text-indigo-600 hover:underline"
                      >
                        {grant.username ?? grant.userId}
                      </Link>
                      <p className="text-muted-foreground text-xs">
                        {formatUtc(grant.grantedAt)} ·{" "}
                        {grant.source === "signup" ? "at signup" : "added later"}
                      </p>
                    </TableCell>
                    <TableCell>
                      {grant.status === "granted" ? (
                        <Badge variant="success">Granted</Badge>
                      ) : (
                        <Badge variant="muted">
                          {grant.ineligibleReason
                            ? KOL_PERK_INELIGIBLE_LABEL[grant.ineligibleReason]
                            : "Not granted"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {grant.tierDiscountPct > 0 ? (
                        grant.tierDiscountClaimedAt ? (
                          <>
                            <span className="font-medium">
                              {grant.tierDiscountTier ?? "Membership"} ·{" "}
                              {grant.tierDiscountFirstYearUsd
                                ? formatUsd(Number(grant.tierDiscountFirstYearUsd))
                                : "—"}
                            </span>
                            <p className="text-muted-foreground text-xs">
                              {grant.tierDiscountPct}% off · bought{" "}
                              {formatUtcDay(grant.tierDiscountClaimedAt)}
                            </p>
                          </>
                        ) : (
                          <span className="text-muted-foreground">
                            {grant.tierDiscountPct}% off, not used yet
                          </span>
                        )
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {grant.sepaFreeUntil ? (
                        <>
                          <span className="font-medium">
                            {formatUsd(grant.sepaCoveredUsd, 0)} of{" "}
                            {formatUsd(grant.sepaFreeCapUsd, 0)}
                          </span>
                          <p className="text-muted-foreground text-xs">
                            {formatNumber(grant.sepaDepositCount, 0, 0)} deposits ·{" "}
                            {formatUsd(grant.sepaWaivedFeeUsd)} saved · until{" "}
                            {formatUtcDay(grant.sepaFreeUntil)}
                          </p>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
