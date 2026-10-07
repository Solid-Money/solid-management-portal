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

/** Whether a hash names a token row, and which wallet card holds it. */
export const walletSlugFromAnchor = (anchor: string): string | undefined => {
  const match = /^token-(.+)-\d+-[a-z0-9]+$/.exec(anchor);
  return match?.[1];
};
