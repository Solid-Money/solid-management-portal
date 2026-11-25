"use client";

import { Suspense, useRef, useState } from "react";
import Link from "next/link";
import {
  Gift,
  Link2,
  Loader2,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Plus,
  Star,
  Unlink,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { AttachPerkDialog } from "@/components/kols/attach-perk-dialog";
import { KolConfirmDialog } from "@/components/kols/confirm-dialog";
import { KolDialog } from "@/components/kols/kol-dialog";
import { KolGrantsSheet } from "@/components/kols/kol-grants-sheet";
import { KolPerkDialog } from "@/components/kols/kol-perk-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useAddKol,
  useAttachKolPerk,
  useKols,
  useRemoveKol,
  useSaveKolPerk,
} from "@/hooks/use-kols";
import { useUrlTab } from "@/hooks/use-url-tab";
import {
  formatSepaUsd,
  KOL_PERK_STATUS_LABEL,
  KOL_PERK_STATUS_VARIANT,
  kolReferralLinks,
  perkBenefitsLabel,
  signupsLabel,
} from "@/lib/kols";
import { formatUtc, formatUtcDay } from "@/lib/referral-v4";
import { formatNumber, formatUsd } from "@/lib/utils";
import type { Kol, KolPerk } from "@/types/kols";

const TABS = ["kols", "perks"] as const;

/**
 * Growth → KOLs: the KOLs the growth team works with, and the perks their
 * special referral codes give.
 *
 * A perk's code refers a friend to its KOL exactly as the KOL's own code
 * does — every referral reward keeps working — and grants the perk while it
 * runs: a discount on the first year of a membership, free SEPA deposits for
 * the first months up to a cap. Every admin who can sign in to the portal
 * can manage KOLs and perks. Nothing is deleted: removing a KOL or switching
 * a perk off stops new grants, and every grant already made stands.
 */
export default function KolsPage() {
  return (
    <Suspense fallback={null}>
      <KolsScreen />
    </Suspense>
  );
}

type Confirming =
  | { kind: "remove"; kol: Kol }
  | { kind: "toggle"; perk: KolPerk }
  | { kind: "detach"; perk: KolPerk }
  | null;

function KolsScreen() {
  const { data, isLoading, error } = useKols();
  const [tab, setTab] = useUrlTab(TABS, "kols");
  const kols = data?.kols ?? [];
  const perks = data?.perks ?? [];
  const activeKols = kols.filter((kol) => kol.status === "active");

  const addKol = useAddKol();
  const removeKol = useRemoveKol();
  const savePerk = useSaveKolPerk();
  const attachPerk = useAttachKolPerk();

  const [kolDialog, setKolDialog] = useState<{ kol: Kol | null } | null>(null);
  const [perkDialog, setPerkDialog] = useState<{
    perk: KolPerk | null;
    kolId?: string | null;
  } | null>(null);
  const [attaching, setAttaching] = useState<
    { mode: "kol"; kol: Kol } | { mode: "perk"; perk: KolPerk } | null
  >(null);
  const [grantsOf, setGrantsOf] = useState<{
    kind: "perk" | "kol";
    id: string;
    title: string;
  } | null>(null);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const inFlight = useRef(false);

  const perksOf = (kol: Kol) =>
    kol.perkIds
      .map((id) => perks.find((perk) => perk.id === id))
      .filter((perk): perk is KolPerk => !!perk);

  const confirmPending =
    removeKol.isPending || savePerk.isPending || attachPerk.isPending;

  const runConfirm = () => {
    if (!confirming || inFlight.current) return;
    inFlight.current = true;
    const settle = {
      onSettled: () => {
        inFlight.current = false;
        setConfirming(null);
      },
    };
    if (confirming.kind === "remove") {
      const { kol } = confirming;
      removeKol.mutate(
        { id: kol.id, version: kol.version },
        { onSuccess: () => toast.success(`${kol.username} removed as a KOL`), ...settle },
      );
    } else if (confirming.kind === "toggle") {
      const { perk } = confirming;
      savePerk.mutate(
        { id: perk.id, body: { version: perk.version, enabled: !perk.enabled } },
        {
          onSuccess: () =>
            toast.success(`${perk.code} switched ${perk.enabled ? "off" : "on"}`),
          ...settle,
        },
      );
    } else {
      const { perk } = confirming;
      attachPerk.mutate(
        { id: perk.id, version: perk.version, kolId: null },
        { onSuccess: () => toast.success(`${perk.code} detached`), ...settle },
      );
    }
  };

  const addBack = (kol: Kol) => {
    if (inFlight.current) return;
    inFlight.current = true;
    addKol.mutate(
      { username: kol.username },
      {
        onSuccess: () => toast.success(`${kol.username} is a KOL again`),
        onSettled: () => {
          inFlight.current = false;
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Star className="h-5 w-5 text-gray-400" />
            KOLs
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            KOLs and the perks their special referral codes give. A perk code
            refers friends to its KOL exactly like the KOL&apos;s own code — the{" "}
            <Link href="/referrals" className="text-indigo-600 hover:underline">
              referral program
            </Link>{" "}
            works as usual — and adds a first-year membership discount and free
            SEPA deposits for signups during its window.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">Failed to load KOLs.</p>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="kols" className="cursor-pointer">
              <Users className="h-4 w-4" />
              KOLs ({formatNumber(activeKols.length, 0, 0)})
            </TabsTrigger>
            <TabsTrigger value="perks" className="cursor-pointer">
              <Gift className="h-4 w-4" />
              Perks ({formatNumber(perks.length, 0, 0)})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="kols" className="mt-4">
            <Card>
              <CardHeader>
                <div className="space-y-1">
                  <CardTitle className="text-base">Manage KOLs</CardTitle>
                  <CardDescription>
                    Solid users the growth team works with. Their own code keeps
                    working as it is; attach perks to give their followers a
                    special code.
                  </CardDescription>
                </div>
                <CardAction>
                  <Button
                    onClick={() => setKolDialog({ kol: null })}
                    className="cursor-pointer"
                  >
                    <UserPlus className="h-4 w-4" />
                    Add KOL
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent>
                {kols.length === 0 ? (
                  <div className="text-muted-foreground flex flex-col items-center gap-2 py-12 text-sm">
                    <Users className="h-10 w-10 text-gray-300" />
                    No KOLs yet. Add one by their Solid username.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>KOL</TableHead>
                        <TableHead>Perks</TableHead>
                        <TableHead>Referrals</TableHead>
                        <TableHead>Added</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {kols.map((kol) => {
                        const removed = kol.status === "removed";
                        const kolPerks = perksOf(kol);
                        return (
                          <TableRow
                            key={kol.id}
                            className={removed ? "opacity-60" : undefined}
                          >
                            <TableCell className="align-top">
                              <div className="flex items-center gap-2">
                                <Link
                                  href={`/users/${encodeURIComponent(kol.userId)}`}
                                  className="font-medium text-indigo-600 hover:underline"
                                >
                                  {kol.username}
                                </Link>
                                {removed && <Badge variant="muted">Removed</Badge>}
                              </div>
                              {kol.email && (
                                <p className="text-muted-foreground text-xs">
                                  {kol.email}
                                </p>
                              )}
                              <p className="text-muted-foreground flex items-center gap-1 text-xs">
                                Own code{" "}
                                <span className="font-mono">{kol.referralCode}</span>
                                <CopyButton
                                  value={kol.referralCode}
                                  label="Referral code"
                                />
                              </p>
                              {kol.note && (
                                <p className="mt-1 max-w-xs text-xs whitespace-pre-line text-gray-600">
                                  {kol.note}
                                </p>
                              )}
                            </TableCell>
                            <TableCell className="align-top">
                              {kolPerks.length === 0 ? (
                                <span className="text-muted-foreground text-xs">
                                  No perks
                                </span>
                              ) : (
                                <div className="flex flex-col gap-1">
                                  {kolPerks.map((perk) => (
                                    <div
                                      key={perk.id}
                                      className="flex items-center gap-2"
                                    >
                                      <span className="font-mono text-xs font-medium">
                                        {perk.code}
                                      </span>
                                      <Badge
                                        variant={KOL_PERK_STATUS_VARIANT[perk.status]}
                                      >
                                        {KOL_PERK_STATUS_LABEL[perk.status]}
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {!removed && (
                                <Button
                                  variant="link"
                                  size="xs"
                                  className="mt-1 h-auto cursor-pointer px-0"
                                  onClick={() => setAttaching({ mode: "kol", kol })}
                                >
                                  <Link2 className="h-3 w-3" />
                                  Attach perk
                                </Button>
                              )}
                            </TableCell>
                            <TableCell className="align-top text-sm">
                              <p className="font-medium">
                                {formatNumber(kol.stats.referrals, 0, 0)} total
                              </p>
                              <p className="text-muted-foreground text-xs">
                                {formatNumber(kol.stats.referralsSinceAdded, 0, 0)}{" "}
                                since added ·{" "}
                                {formatNumber(kol.stats.perkSignups, 0, 0)} with a
                                perk
                              </p>
                            </TableCell>
                            <TableCell className="text-muted-foreground align-top text-xs">
                              <p>{formatUtcDay(kol.addedAt)}</p>
                              <p>by {kol.addedByEmail}</p>
                              {removed && kol.removedAt && (
                                <p>
                                  removed {formatUtcDay(kol.removedAt)}
                                  {kol.removedByEmail ? ` by ${kol.removedByEmail}` : ""}
                                </p>
                              )}
                            </TableCell>
                            <TableCell className="text-right align-top">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="cursor-pointer"
                                    aria-label={`Actions for ${kol.username}`}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onSelect={() =>
                                      setGrantsOf({
                                        kind: "kol",
                                        id: kol.id,
                                        title: kol.username,
                                      })
                                    }
                                  >
                                    <Users className="h-4 w-4" />
                                    View perk signups
                                  </DropdownMenuItem>
                                  {!removed && (
                                    <>
                                      <DropdownMenuItem
                                        onSelect={() =>
                                          setAttaching({ mode: "kol", kol })
                                        }
                                      >
                                        <Link2 className="h-4 w-4" />
                                        Attach perk
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onSelect={() =>
                                          setPerkDialog({ perk: null, kolId: kol.id })
                                        }
                                      >
                                        <Plus className="h-4 w-4" />
                                        New perk for {kol.username}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onSelect={() => setKolDialog({ kol })}
                                      >
                                        <NotebookPen className="h-4 w-4" />
                                        Edit note
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        variant="destructive"
                                        onSelect={() =>
                                          setConfirming({ kind: "remove", kol })
                                        }
                                      >
                                        <UserMinus className="h-4 w-4" />
                                        Remove KOL
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {removed && (
                                    <DropdownMenuItem onSelect={() => addBack(kol)}>
                                      <UserPlus className="h-4 w-4" />
                                      Add back
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="perks" className="mt-4">
            <Card>
              <CardHeader>
                <div className="space-y-1">
                  <CardTitle className="text-base">Manage perks</CardTitle>
                  <CardDescription>
                    What a special referral code gives the friends who sign up
                    with it during its window. Attach a perk to a KOL for its
                    code to work. Benefits are fixed for each user when they
                    sign up.
                  </CardDescription>
                </div>
                <CardAction>
                  <Button
                    onClick={() => setPerkDialog({ perk: null })}
                    className="cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    Create perk
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent>
                {perks.length === 0 ? (
                  <div className="text-muted-foreground flex flex-col items-center gap-2 py-12 text-sm">
                    <Gift className="h-10 w-10 text-gray-300" />
                    No perks yet. A perk gives a special code with extra
                    benefits to a KOL&apos;s followers.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Perk</TableHead>
                        <TableHead>Code &amp; links</TableHead>
                        <TableHead>KOL</TableHead>
                        <TableHead>Signups (UTC)</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Given away</TableHead>
                        <TableHead>On</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {perks.map((perk) => {
                        const links = kolReferralLinks(perk.code);
                        const used = perk.stats.granted + perk.stats.ineligible > 0;
                        return (
                          <TableRow key={perk.id}>
                            <TableCell className="align-top">
                              <p className="font-medium">{perk.name}</p>
                              <p className="text-muted-foreground text-xs">
                                {perkBenefitsLabel(perk)}
                              </p>
                              {perk.updatedByEmail && (
                                <p className="text-xs text-gray-400">
                                  last changed by {perk.updatedByEmail}
                                </p>
                              )}
                            </TableCell>
                            <TableCell className="align-top">
                              <p className="flex items-center gap-1 font-mono text-sm font-medium">
                                {perk.code}
                                <CopyButton value={perk.code} label="Code" />
                              </p>
                              <p className="text-muted-foreground flex items-center gap-1 text-xs">
                                Website link
                                <CopyButton value={links.website} label="Website link" />
                              </p>
                              <p className="text-muted-foreground flex items-center gap-1 text-xs">
                                App link
                                <CopyButton value={links.app} label="App link" />
                              </p>
                            </TableCell>
                            <TableCell className="align-top text-sm">
                              {perk.kolUsername ? (
                                <>
                                  <p className="font-medium">{perk.kolUsername}</p>
                                  {perk.attachedAt && (
                                    <p className="text-muted-foreground text-xs">
                                      since {formatUtcDay(perk.attachedAt)}
                                    </p>
                                  )}
                                </>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="xs"
                                  className="cursor-pointer"
                                  onClick={() => setAttaching({ mode: "perk", perk })}
                                >
                                  <Link2 className="h-3 w-3" />
                                  Attach
                                </Button>
                              )}
                            </TableCell>
                            <TableCell className="align-top text-xs whitespace-nowrap">
                              <p>{formatUtc(perk.startsAt)}</p>
                              <p className="text-muted-foreground">
                                to {formatUtc(perk.endsAt)}
                              </p>
                            </TableCell>
                            <TableCell className="align-top">
                              <Badge variant={KOL_PERK_STATUS_VARIANT[perk.status]}>
                                {KOL_PERK_STATUS_LABEL[perk.status]}
                              </Badge>
                            </TableCell>
                            <TableCell className="align-top text-xs">
                              <p className="text-sm font-medium">
                                {signupsLabel(perk.stats.granted, perk.maxSignups)}{" "}
                                signups
                              </p>
                              {perk.stats.ineligible > 0 && (
                                <p className="text-muted-foreground">
                                  +{formatNumber(perk.stats.ineligible, 0, 0)}{" "}
                                  referred without the perk
                                </p>
                              )}
                              {(perk.tierDiscountPct > 0 ||
                                perk.stats.tierDiscountsClaimed > 0 ||
                                perk.stats.tierDiscountsPaid > 0) && (
                                <p className="text-muted-foreground">
                                  {formatNumber(perk.stats.tierDiscountsPaid, 0, 0)}{" "}
                                  memberships paid ·{" "}
                                  {formatNumber(perk.stats.tierDiscountsClaimed, 0, 0)}{" "}
                                  started
                                </p>
                              )}
                              {(perk.sepaFreeMonths > 0 ||
                                perk.stats.sepaDeposits > 0) && (
                                <p className="text-muted-foreground">
                                  {formatNumber(perk.stats.sepaDeposits, 0, 0)} free
                                  deposits · {formatSepaUsd(perk.stats.sepaCoveredUsd)}{" "}
                                  · {formatUsd(perk.stats.sepaWaivedFeeUsd)} fees
                                </p>
                              )}
                            </TableCell>
                            <TableCell className="align-top">
                              <Switch
                                checked={perk.enabled}
                                onCheckedChange={() =>
                                  setConfirming({ kind: "toggle", perk })
                                }
                                disabled={confirmPending}
                                aria-label={`${perk.code} on`}
                              />
                            </TableCell>
                            <TableCell className="text-right align-top">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="cursor-pointer"
                                    aria-label={`Actions for ${perk.code}`}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onSelect={() =>
                                      setGrantsOf({
                                        kind: "perk",
                                        id: perk.id,
                                        title: `${perk.code} · ${perk.name}`,
                                      })
                                    }
                                  >
                                    <Users className="h-4 w-4" />
                                    View signups
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onSelect={() => setPerkDialog({ perk })}
                                  >
                                    <Pencil className="h-4 w-4" />
                                    Edit
                                  </DropdownMenuItem>
                                  {!(perk.kolId && used) && (
                                    <DropdownMenuItem
                                      onSelect={() =>
                                        setAttaching({ mode: "perk", perk })
                                      }
                                    >
                                      <Link2 className="h-4 w-4" />
                                      {perk.kolId ? "Move to another KOL" : "Attach to KOL"}
                                    </DropdownMenuItem>
                                  )}
                                  {perk.kolId && !used && (
                                    <DropdownMenuItem
                                      variant="destructive"
                                      onSelect={() =>
                                        setConfirming({ kind: "detach", perk })
                                      }
                                    >
                                      <Unlink className="h-4 w-4" />
                                      Detach from KOL
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {kolDialog && (
        <KolDialog kol={kolDialog.kol} onClose={() => setKolDialog(null)} />
      )}

      {perkDialog && (
        <KolPerkDialog
          perk={perkDialog.perk}
          kols={activeKols}
          defaultKolId={perkDialog.kolId}
          limits={data?.limits}
          onClose={() => setPerkDialog(null)}
        />
      )}

      {attaching?.mode === "kol" && (
        <AttachPerkDialog
          mode="kol"
          kol={attaching.kol}
          perks={perks}
          onCreatePerk={(kolId) => {
            setAttaching(null);
            setPerkDialog({ perk: null, kolId });
          }}
          onClose={() => setAttaching(null)}
        />
      )}
      {attaching?.mode === "perk" && (
        <AttachPerkDialog
          mode="perk"
          perk={attaching.perk}
          kols={activeKols}
          onClose={() => setAttaching(null)}
        />
      )}

      <KolGrantsSheet target={grantsOf} onClose={() => setGrantsOf(null)} />

      <KolConfirmDialog
        open={!!confirming}
        pending={confirmPending}
        destructive={
          confirming?.kind === "remove" ||
          confirming?.kind === "detach" ||
          (confirming?.kind === "toggle" && !confirming.perk.enabled)
        }
        title={
          confirming?.kind === "remove"
            ? `Remove ${confirming.kol.username}?`
            : confirming?.kind === "detach"
              ? `Detach ${confirming.perk.code}?`
              : confirming?.kind === "toggle"
                ? confirming.perk.enabled
                  ? `Switch ${confirming.perk.code} off?`
                  : `Switch ${confirming.perk.code} on?`
                : ""
        }
        confirmText={
          confirming?.kind === "remove"
            ? "Remove KOL"
            : confirming?.kind === "detach"
              ? "Detach"
              : confirming?.kind === "toggle" && confirming.perk.enabled
                ? "Switch off"
                : "Switch on"
        }
        onConfirm={runConfirm}
        onCancel={() => setConfirming(null)}
      >
        {confirming?.kind === "remove" && (
          <>
            <p>
              Their perks stop being granted from now on. Their perk codes keep
              referring friends to them, without the perk, so shared links still
              work.
            </p>
            <p>Everyone already granted a perk keeps it. You can add them back later.</p>
          </>
        )}
        {confirming?.kind === "detach" && (
          <p>
            Nobody has used {confirming.perk.code} yet. Once detached it refers
            nobody until it is attached again.
          </p>
        )}
        {confirming?.kind === "toggle" &&
          (confirming.perk.enabled ? (
            <p>
              Signups from now on are referred to{" "}
              {confirming.perk.kolUsername ?? "the KOL"} without the perk.
              Everyone already granted keeps theirs.
            </p>
          ) : (
            <>
              <p>
                Between {formatUtc(confirming.perk.startsAt)} and{" "}
                {formatUtc(confirming.perk.endsAt)}, everyone who signs up with{" "}
                <span className="font-mono">{confirming.perk.code}</span> gets:{" "}
                <strong>{perkBenefitsLabel(confirming.perk)}</strong>.
              </p>
              {!confirming.perk.kolId && (
                <p>It is not attached to a KOL, so the code works once you attach it.</p>
              )}
            </>
          ))}
      </KolConfirmDialog>
    </div>
  );
}
