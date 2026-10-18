/**
 * The ids a Slack alert links to.
 *
 * Duplicated from the backend's `treasurySlug` deliberately: a link lands on
 * an element only if both sides spell the anchor identically, and the two live
 * in separate repositories with separate deploys. Keeping the rule to three
 * lines that cannot drift is cheaper than a shared package whose versions can.
 *
 * "Paymaster (Fuse)" has a space and two brackets in it, which is why this
 * exists at all.
 */
export const treasurySlug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** The wallet card's id. */
export const walletAnchorId = (walletName: string): string =>
  `wallet-${treasurySlug(walletName)}`;

/** One token row's id, inside a wallet card. */
export const assetAnchorId = (
  walletName: string,
  chainId: number,
  asset: string
): string =>
  `token-${treasurySlug(walletName)}-${chainId}-${treasurySlug(asset)}`;

/**
 * Whether an anchor names this wallet's card, or a token row inside it.
 *
 * Matched against the wallet's own chains rather than by parsing the anchor:
 * a token slug can hold hyphens (`USDC.e` is `usdc-e`) and a wallet slug can
 * end in digits, so `token-main-1-usdc-e` has no unambiguous split on its own.
 * Knowing the wallet's slug and its chain ids, the prefix is exact.
 */
export const anchorNamesWallet = (
  anchor: string | undefined,
  wallet: { name: string; chains: Array<{ chainId: number }> }
): boolean => {
  if (!anchor) return false;
  if (anchor === walletAnchorId(wallet.name)) return true;
  const prefix = `token-${treasurySlug(wallet.name)}-`;
  return wallet.chains.some((chain) =>
    anchor.startsWith(`${prefix}${chain.chainId}-`)
  );
};
