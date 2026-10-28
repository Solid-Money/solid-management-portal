"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ExternalLink, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { createListedToken, lookupToken, updateListedToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ContractAddress,
  TokenLogo,
  chainNameOf,
} from "@/components/tokens/token-utils";
import {
  ListedToken,
  ListedTokenChanges,
  TokenChain,
  TokenDraft,
} from "@/types";

/** What the dialog is open for: a new token (maybe prefilled), or a row to edit. */
export type TokenEditorState =
  | { mode: "add"; draft?: TokenDraft }
  | { mode: "edit"; token: ListedToken };

type FormValues = {
  symbol: string;
  name: string;
  logoURI: string;
  tokenId: string;
  commonId: string;
  displayOrder: string;
  isActive: boolean;
  isFeatured: boolean;
  /** The inverse of `swapOnly`, as the question is put to the admin. */
  acceptsDeposits: boolean;
};

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

const fromDraft = (draft: TokenDraft): FormValues => ({
  symbol: draft.symbol,
  name: draft.name,
  logoURI: draft.logoURI ?? "",
  tokenId: draft.tokenId ?? "",
  commonId: draft.commonId ?? "",
  displayOrder: "0",
  isActive: true,
  isFeatured: false,
  acceptsDeposits: !draft.swapOnly,
});

const fromToken = (token: ListedToken): FormValues => ({
  symbol: token.symbol,
  name: token.name,
  logoURI: token.logoURI ?? "",
  tokenId: token.tokenId ?? "",
  commonId: token.commonId ?? "",
  displayOrder: String(token.displayOrder ?? 0),
  isActive: token.isActive,
  isFeatured: token.isFeatured,
  acceptsDeposits: !token.swapOnly,
});

/** What is wrong with the form, field by field; empty when it can be saved. */
function validate(
  values: FormValues
): Partial<Record<keyof FormValues, string>> {
  const errors: Partial<Record<keyof FormValues, string>> = {};
  if (!values.symbol.trim()) errors.symbol = "Required";
  if (!values.name.trim()) errors.name = "Required";
  const logo = values.logoURI.trim();
  if (logo && !/^https:\/\/\S+$/.test(logo)) errors.logoURI = "An https:// URL";
  if (values.tokenId.trim() && !ID_PATTERN.test(values.tokenId.trim()))
    errors.tokenId = "Lowercase letters, digits and dashes, e.g. usd-coin";
  if (values.commonId.trim() && !ID_PATTERN.test(values.commonId.trim()))
    errors.commonId = "Lowercase letters, digits and dashes, e.g. usdc";
  const order = Number(values.displayOrder);
  if (!Number.isInteger(order) || order < 0 || order > 1000)
    errors.displayOrder = "A whole number, 0 to 1000";
  return errors;
}

type EditorProps = {
  chains: TokenChain[];
  tokens: ListedToken[];
  onClose: () => void;
  onEditExisting: (token: ListedToken) => void;
};

/** Each opening, and each token, gets a fresh form. */
const editorKey = (state: TokenEditorState): string =>
  state.mode === "edit"
    ? `edit:${state.token.id}`
    : `add:${state.draft ? `${state.draft.chainId}:${state.draft.address}` : ""}`;

/**
 * Add a token, or edit one.
 *
 * Adding starts from the two things an admin always has — the chain and the
 * contract address — and reads the rest from the contract: name, symbol and
 * decimals, with the logo, price id and cross-chain id the list already uses
 * for that symbol filled in. A contract that is already listed opens that row
 * instead, so the same token is never added twice in two address spellings.
 */
export default function TokenEditorDialog({
  state,
  ...props
}: EditorProps & { state: TokenEditorState | null }) {
  return (
    <Dialog
      open={!!state}
      onOpenChange={(open) => (!open ? props.onClose() : null)}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {state ? (
          <TokenEditor key={editorKey(state)} state={state} {...props} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function TokenEditor({
  state,
  chains,
  tokens,
  onClose,
  onEditExisting,
}: EditorProps & { state: TokenEditorState }) {
  const queryClient = useQueryClient();
  const preset = state.mode === "add" ? state.draft : undefined;
  const editing = state.mode === "edit" ? state.token : null;
  const [chainId, setChainId] = useState<number>(
    preset?.chainId ?? chains[0]?.chainId ?? 1
  );
  const [address, setAddress] = useState(preset?.address ?? "");
  const [draft, setDraft] = useState<TokenDraft | null>(preset ?? null);
  const [existing, setExisting] = useState<ListedToken | null>(null);
  const [values, setValues] = useState<FormValues | null>(
    editing ? fromToken(editing) : preset ? fromDraft(preset) : null
  );

  const trimmedAddress = address.trim();
  const canLookUp = ADDRESS_PATTERN.test(trimmedAddress);
  // The chain and address now in the form: a lookup answering for any other
  // (the admin changed one while it was out) is dropped.
  const lookingFor = useRef("");
  // Set after commit, not during render, which React may replay or discard;
  // a layout effect runs before the lookup effect below reads it.
  useLayoutEffect(() => {
    lookingFor.current = `${chainId}:${trimmedAddress.toLowerCase()}`;
  }, [chainId, trimmedAddress]);

  const lookup = useMutation({
    mutationFn: async (target: { chainId: number; address: string }) =>
      (await lookupToken(target.chainId, target.address)).data.data,
    onSuccess: (result, target) => {
      if (
        lookingFor.current !==
        `${target.chainId}:${target.address.toLowerCase()}`
      )
        return;
      setExisting(result.existing);
      setDraft(result.draft);
      setValues(result.draft ? fromDraft(result.draft) : null);
    },
  });
  const lookUp = () => lookup.mutate({ chainId, address: trimmedAddress });

  // A pasted address is looked up straight away; there is nothing to decide first.
  useEffect(() => {
    if (editing || preset || !canLookUp) return;
    lookup.mutate({ chainId, address: trimmedAddress });
    // Only a new chain or address asks again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainId, trimmedAddress, canLookUp]);

  const save = useMutation({
    mutationFn: async (form: FormValues) => {
      const shared = {
        symbol: form.symbol.trim(),
        name: form.name.trim(),
        isActive: form.isActive,
        isFeatured: form.isFeatured,
        swapOnly: !form.acceptsDeposits,
        displayOrder: Number(form.displayOrder),
      };
      if (editing) {
        const changes: ListedTokenChanges = {
          ...shared,
          // Empty clears the field on the row.
          logoURI: form.logoURI.trim(),
          tokenId: form.tokenId.trim(),
          commonId: form.commonId.trim(),
        };
        return (await updateListedToken(editing.id, changes)).data.data;
      }
      if (!draft) throw new Error("Look the token up first");
      return (
        await createListedToken({
          ...shared,
          chainId: draft.chainId,
          address: draft.address,
          decimals: draft.decimals,
          ...(form.logoURI.trim() ? { logoURI: form.logoURI.trim() } : {}),
          ...(form.tokenId.trim() ? { tokenId: form.tokenId.trim() } : {}),
          ...(form.commonId.trim() ? { commonId: form.commonId.trim() } : {}),
        })
      ).data.data;
    },
    onSuccess: (token) => {
      toast.success(
        `${token.symbol} on ${chainNameOf(chains, token.chainId)} ${editing ? "saved" : "added"}`
      );
      void queryClient.invalidateQueries({ queryKey: ["tokens"] });
      onClose();
    },
  });

  // Ids the list already uses, offered as suggestions so the same asset is
  // spelled the same way on every chain.
  const knownCommonIds = useMemo(
    () => [...new Set(tokens.map((t) => t.commonId).filter(Boolean))].sort(),
    [tokens]
  );
  const knownTokenIds = useMemo(
    () => [...new Set(tokens.map((t) => t.tokenId).filter(Boolean))].sort(),
    [tokens]
  );

  const errors = values ? validate(values) : {};
  const hasErrors = Object.keys(errors).length > 0;
  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((current) => (current ? { ...current, [key]: value } : current));

  const target = editing ?? draft;
  const targetChain = target
    ? chains.find((chain) => chain.chainId === target.chainId)
    : undefined;

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {editing
            ? `Edit ${editing.symbol} on ${chainNameOf(chains, editing.chainId)}`
            : "Add a token"}
        </DialogTitle>
        <DialogDescription>
          {editing
            ? "The chain, contract and decimals are the token's own and cannot change. To list another contract, add it as a new token."
            : "Pick the chain and paste the contract address. The name, symbol and decimals are read from the contract."}
        </DialogDescription>
      </DialogHeader>

      {!editing ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[12rem_1fr]">
          <div className="grid gap-2">
            <Label htmlFor="token-chain">Chain</Label>
            <select
              id="token-chain"
              value={chainId}
              onChange={(event) => {
                setChainId(Number(event.target.value));
                setDraft(null);
                setExisting(null);
                setValues(null);
              }}
              disabled={!!preset || save.isPending}
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
            >
              {chains.map((chain) => (
                <option key={chain.chainId} value={chain.chainId}>
                  {chain.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="token-address">Contract address</Label>
            <div className="flex gap-2">
              <Input
                id="token-address"
                value={address}
                onChange={(event) => {
                  setAddress(event.target.value);
                  setExisting(null);
                  setDraft(null);
                  setValues(null);
                }}
                placeholder="0x…"
                spellCheck={false}
                autoComplete="off"
                className="font-mono"
                disabled={!!preset || save.isPending}
                aria-invalid={!!trimmedAddress && !canLookUp}
              />
              {!preset ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={lookUp}
                  disabled={!canLookUp || lookup.isPending}
                  className="cursor-pointer"
                >
                  {lookup.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  Look up
                </Button>
              ) : null}
            </div>
            {trimmedAddress && !canLookUp ? (
              <p className="text-xs text-red-600">
                A contract address is 0x followed by 40 hex characters.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {existing ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <span className="flex items-center gap-2">
            <TokenLogo
              symbol={existing.symbol}
              logoURI={existing.logoURI}
              size={24}
            />
            {existing.symbol} is already listed on{" "}
            {chainNameOf(chains, existing.chainId)}.
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onEditExisting(existing)}
            className="cursor-pointer"
          >
            Edit it instead
          </Button>
        </div>
      ) : null}

      {values && target ? (
        <form
          id="token-editor-form"
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (!hasErrors && !save.isPending) save.mutate(values);
          }}
        >
          <div className="flex items-center gap-3 rounded-md border border-gray-200 bg-gray-50 p-3">
            <TokenLogo
              symbol={values.symbol}
              logoURI={values.logoURI.trim()}
              size={40}
            />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-gray-900">
                {values.symbol || "—"}{" "}
                <span className="font-normal text-gray-500">{values.name}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 text-xs text-gray-500">
                <span>{chainNameOf(chains, target.chainId)}</span>
                <ContractAddress address={target.address} chain={targetChain} />
                <span>{target.decimals} decimals</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Symbol" error={errors.symbol} htmlFor="token-symbol">
              <Input
                id="token-symbol"
                value={values.symbol}
                onChange={(event) => set("symbol", event.target.value)}
                maxLength={32}
              />
            </Field>
            <Field label="Name" error={errors.name} htmlFor="token-name">
              <Input
                id="token-name"
                value={values.name}
                onChange={(event) => set("name", event.target.value)}
                maxLength={100}
              />
            </Field>
            <Field
              label="Logo URL"
              error={errors.logoURI}
              htmlFor="token-logo"
              hint="The image the app shows. Check the preview above."
              className="md:col-span-2"
            >
              <Input
                id="token-logo"
                value={values.logoURI}
                onChange={(event) => set("logoURI", event.target.value)}
                placeholder="https://…/logo.png"
                spellCheck={false}
              />
            </Field>
            <Field
              label="Price id"
              error={errors.tokenId}
              htmlFor="token-price-id"
              hint={
                <>
                  The CoinGecko coin id, used when nothing else has a price.
                  {values.tokenId.trim() && !errors.tokenId ? (
                    <>
                      {" "}
                      <a
                        href={`https://www.coingecko.com/en/coins/${values.tokenId.trim()}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-indigo-600 hover:underline"
                      >
                        Check it <ExternalLink className="h-3 w-3" />
                      </a>
                    </>
                  ) : null}
                </>
              }
            >
              <Input
                id="token-price-id"
                value={values.tokenId}
                onChange={(event) => set("tokenId", event.target.value)}
                placeholder="e.g. usd-coin"
                list="token-price-ids"
                spellCheck={false}
              />
              <datalist id="token-price-ids">
                {knownTokenIds.map((id) => (
                  <option key={id} value={id} />
                ))}
              </datalist>
            </Field>
            <Field
              label="Cross-chain id"
              error={errors.commonId}
              htmlFor="token-common-id"
              hint="The same id on each chain's row merges its balances into one line in the wallet."
            >
              <Input
                id="token-common-id"
                value={values.commonId}
                onChange={(event) => set("commonId", event.target.value)}
                placeholder="e.g. usdc"
                list="token-common-ids"
                spellCheck={false}
              />
              <datalist id="token-common-ids">
                {knownCommonIds.map((id) => (
                  <option key={id} value={id} />
                ))}
              </datalist>
            </Field>
          </div>

          <fieldset className="space-y-3 rounded-md border border-gray-200 p-4">
            <legend className="px-1 text-sm font-medium text-gray-900">
              Where it shows
            </legend>
            <Toggle
              checked={values.isActive}
              onChange={(checked) => set("isActive", checked)}
              label="Live in the app"
              description="Shown in the swap picker and the wallet, and its receives show in activity. Off hides it without deleting it."
            />
            <Toggle
              checked={values.isFeatured}
              onChange={(checked) => set("isFeatured", checked)}
              label="Featured"
              description="Pinned to the top of the swap picker."
            />
            <div className="grid max-w-xs gap-2 pl-6">
              <Label htmlFor="token-order">Display order</Label>
              <Input
                id="token-order"
                type="number"
                min={0}
                max={1000}
                step={1}
                value={values.displayOrder}
                onChange={(event) => set("displayOrder", event.target.value)}
                aria-invalid={!!errors.displayOrder}
              />
              <p className="text-xs text-gray-500">
                {errors.displayOrder ??
                  "Lower comes first, after the featured tokens."}
              </p>
            </div>
          </fieldset>

          <fieldset className="space-y-3 rounded-md border border-gray-200 p-4">
            <legend className="px-1 text-sm font-medium text-gray-900">
              Deposit addresses
            </legend>
            <Toggle
              checked={values.acceptsDeposits}
              onChange={(checked) => set("acceptsDeposits", checked)}
              label="Accept on deposit addresses"
              description="A transfer of it to a cardholder's minted deposit address opens a deposit. Off keeps it listed for swapping only. Turning the token off above does not change this."
            />
            {values.acceptsDeposits && draft?.swapOnly ? (
              <p className="flex gap-2 rounded-md bg-amber-50 p-2 text-xs text-amber-900">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                The deposit pipeline only routes the stablecoins it bridges.
                Accepting this token there opens deposits it has no route for.
              </p>
            ) : null}
          </fieldset>
        </form>
      ) : null}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="cursor-pointer"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form="token-editor-form"
          disabled={!values || hasErrors || save.isPending}
          className="cursor-pointer"
        >
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {editing ? "Save" : "Add token"}
        </Button>
      </DialogFooter>
    </>
  );
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`grid content-start gap-2 ${className ?? ""}`}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-gray-500">{hint}</p>
      ) : null}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 rounded"
      />
      <span>
        <span className="font-medium text-gray-900">{label}</span>
        <span className="block text-xs text-gray-500">{description}</span>
      </span>
    </label>
  );
}
