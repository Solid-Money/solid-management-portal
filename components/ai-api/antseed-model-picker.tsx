"use client";

import { useMemo, useState } from "react";
import { Loader2, RefreshCw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAiApiUpstreamModels } from "@/hooks/use-ai-api";
import { formatRate, scaledPrice } from "@/lib/ai-api";
import type { AiApiUpstreamModel, AiApiUpstreamOffer } from "@/types/ai-api";

/** What picking a model fills in on its row. */
export interface AntseedPick {
  upstreamModel: string;
  /** The AntSeed id and name, for a row that has none yet. */
  id: string;
  name: string;
  /** Our prices at the chosen multiple, or null to leave the row's as they are. */
  prices: { input: string; output: string; cachedInput: string } | null;
}

/** The gateway routes a request naming only a model to the cheapest trusted seller. */
const CHEAPEST = "cheapest";

const DEFAULT_MULTIPLE = "4";

/**
 * AntSeed's models, to fill a row's gateway model from and price it as a
 * multiple of what a seller charges. The rates are AntSeed's now; they move as
 * sellers come and go, so prices are set once here and stay as typed.
 */
export function AntseedModelPicker({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (pick: AntseedPick) => void;
}) {
  const { data, isLoading, isError, isFetching, refetch } =
    useAiApiUpstreamModels(open);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [seller, setSeller] = useState(CHEAPEST);
  const [multiple, setMultiple] = useState(DEFAULT_MULTIPLE);
  const [setPrices, setSetPrices] = useState(true);

  const models = useMemo(() => {
    const wanted = search.trim().toLowerCase();
    const all = data?.models ?? [];
    if (!wanted) return all;
    return all.filter((model) =>
      [model.id, model.name, ...model.aliases].some((name) =>
        name.toLowerCase().includes(wanted),
      ),
    );
  }, [data, search]);

  const selected =
    data?.models.find((model) => model.id === selectedId) ?? null;
  const offer: AiApiUpstreamOffer | null = selected
    ? ((seller === CHEAPEST
        ? selected.offers[0]
        : selected.offers.find(
            (candidate) => offerKey(candidate) === seller,
          )) ?? null)
    : null;
  const times = Number(multiple);
  const multipleValid =
    multiple.trim() !== "" && Number.isFinite(times) && times > 0;

  const reset = () => {
    setSearch("");
    setSelectedId(null);
    setSeller(CHEAPEST);
    setMultiple(DEFAULT_MULTIPLE);
    setSetPrices(true);
  };

  const choose = (model: AiApiUpstreamModel) => {
    setSelectedId(model.id);
    setSeller(CHEAPEST);
  };

  const apply = () => {
    if (!selected || !offer || (setPrices && !multipleValid)) return;
    onPick({
      upstreamModel:
        seller === CHEAPEST
          ? selected.id
          : `${offer.peerId}@${offer.serviceId}`,
      id: selected.id,
      name: selected.name,
      prices: setPrices
        ? {
            input: scaledPrice(offer.inputUsdPerMTok, times),
            output: scaledPrice(offer.outputUsdPerMTok, times),
            cachedInput:
              offer.cachedInputUsdPerMTok === null
                ? ""
                : scaledPrice(offer.cachedInputUsdPerMTok, times),
          }
        : null,
    });
    onOpenChange(false);
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Pick an AntSeed model</DialogTitle>
          <DialogDescription>
            Fills the gateway model, and the prices as a multiple of what the
            seller charges us. Rates are per million tokens, live from the
            gateway, and move as sellers come and go.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search AntSeed models"
              className="pl-8"
              autoFocus
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="cursor-pointer"
            aria-label="Reload AntSeed models"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
            />
          </Button>
        </div>

        <div className="max-h-64 overflow-y-auto rounded-md border border-gray-200">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
            </div>
          ) : isError ? (
            <p className="px-3 py-6 text-center text-sm text-gray-500">
              Couldn&apos;t reach the AntSeed gateway. Check the gateway key
              above and try again.
            </p>
          ) : models.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-gray-500">
              {data?.models.length
                ? "No model matches."
                : "The gateway lists no priced text models."}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {models.map((model) => {
                const cheapest = model.offers[0];
                const active = model.id === selectedId;
                return (
                  <li key={model.id}>
                    <button
                      type="button"
                      onClick={() => choose(model)}
                      className={`flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                        active ? "bg-indigo-50" : ""
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-gray-900">
                          {model.name}
                        </span>
                        <span className="block truncate font-mono text-xs text-gray-500">
                          {model.id}
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-xs text-gray-600">
                        <span className="block">
                          in {formatRate(cheapest.inputUsdPerMTok)} · out{" "}
                          {formatRate(cheapest.outputUsdPerMTok)}
                        </span>
                        <span className="block text-gray-400">
                          {model.offers.length} seller
                          {model.offers.length === 1 ? "" : "s"}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {selected ? (
          <div className="space-y-3 rounded-md border border-gray-200 p-3">
            <div className="text-sm font-medium text-gray-900">
              {selected.name}: who serves it
            </div>
            <div className="space-y-1.5 text-sm">
              <SellerOption
                checked={seller === CHEAPEST}
                onSelect={() => setSeller(CHEAPEST)}
                label="Cheapest trusted seller"
                detail={`gateway model ${selected.id}; AntSeed routes to the cheapest seller it trusts and fails over, so the rate shown is the lowest listed`}
                offer={selected.offers[0]}
              />
              {selected.offers.map((candidate) => (
                <SellerOption
                  key={offerKey(candidate)}
                  checked={seller === offerKey(candidate)}
                  onSelect={() => setSeller(offerKey(candidate))}
                  label={
                    candidate.seller ??
                    `Seller ${candidate.peerId.slice(0, 10)}…`
                  }
                  detail={`pinned: ${candidate.peerId.slice(0, 10)}…@${candidate.serviceId}; never fails over`}
                  offer={candidate}
                />
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3 text-sm">
              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  checked={setPrices}
                  onCheckedChange={(checked) => setSetPrices(checked === true)}
                />
                Set our prices at
              </label>
              <Input
                value={multiple}
                onChange={(e) => setMultiple(e.target.value)}
                inputMode="decimal"
                className="w-16"
                disabled={!setPrices}
                aria-label="Multiple of the seller's rate"
              />
              <span>× the seller&apos;s rate</span>
              {setPrices && offer && multipleValid ? (
                <span className="text-gray-600">
                  = in{" "}
                  {formatRate(
                    Number(scaledPrice(offer.inputUsdPerMTok, times)),
                  )}{" "}
                  · out{" "}
                  {formatRate(
                    Number(scaledPrice(offer.outputUsdPerMTok, times)),
                  )}
                  {offer.cachedInputUsdPerMTok !== null
                    ? ` · cached ${formatRate(Number(scaledPrice(offer.cachedInputUsdPerMTok, times)))}`
                    : ""}
                </span>
              ) : null}
            </div>
            <p className="text-xs text-gray-500">
              Cashback is paid on what users pay, so below 2× every dollar of
              usage under the cap loses money. Cache-write prices aren&apos;t
              listed by AntSeed and stay as typed.
            </p>
          </div>
        ) : null}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              reset();
            }}
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            onClick={apply}
            disabled={!selected || !offer || (setPrices && !multipleValid)}
            className="cursor-pointer"
          >
            Use this model
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const offerKey = (offer: AiApiUpstreamOffer) =>
  `${offer.peerId}@${offer.serviceId}`;

function SellerOption({
  checked,
  onSelect,
  label,
  detail,
  offer,
}: {
  checked: boolean;
  onSelect: () => void;
  label: string;
  detail: string;
  offer: AiApiUpstreamOffer;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded px-2 py-1.5 hover:bg-gray-50">
      <span className="flex min-w-0 items-start gap-2">
        <input
          type="radio"
          checked={checked}
          onChange={onSelect}
          className="mt-1 cursor-pointer accent-indigo-600"
        />
        <span className="min-w-0">
          <span className="block text-gray-900">{label}</span>
          <span className="block truncate font-mono text-xs text-gray-500">
            {detail}
          </span>
        </span>
      </span>
      <span className="shrink-0 text-right text-xs text-gray-600">
        in {formatRate(offer.inputUsdPerMTok)} · out{" "}
        {formatRate(offer.outputUsdPerMTok)}
        {offer.cachedInputUsdPerMTok !== null
          ? ` · cached ${formatRate(offer.cachedInputUsdPerMTok)}`
          : ""}
      </span>
    </label>
  );
}
