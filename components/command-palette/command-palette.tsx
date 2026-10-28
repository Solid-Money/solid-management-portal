"use client";

import { useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import {
  ArrowRight,
  BookOpen,
  CircleAlert,
  Clock,
  CornerDownLeft,
  Headphones,
  Loader2,
  Search,
  Share2,
  User as UserIcon,
  Users,
  Wallet,
  X,
} from "lucide-react";

import api from "@/lib/api";
import { isErrorLookupQuery } from "@/lib/error-ref";
import { useDebounce } from "@/hooks/use-debounce";
import { useRecentUsers, type RecentUser } from "@/lib/recent-users";
import { navigateTo } from "@/lib/section-navigation";
import {
  PROVIDER_LABELS,
  abbreviateId,
  couldBeReferralCode,
  describeMatch,
  isUserId,
  looksLikeIdentifier,
} from "@/lib/search-detect";
import {
  SEARCH_ENTRIES,
  SUGGESTED_PAGE_IDS,
  rankEntries,
  scoreEntry,
  userEntries,
  type SearchEntry,
} from "@/lib/search-index";
import { walletAnchorId } from "@/lib/treasury-anchors";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { User, UsersResponse, WalletStatusResponse } from "@/types";

/** User results shown inline; the rest are one click away in the table. */
const USER_RESULTS = 6;
const PAGE_RESULTS = 5;
const SECTION_RESULTS = 8;
const USER_SECTION_RESULTS = 6;
const WALLET_RESULTS = 5;
/** A label that starts with what was typed: navigation, not a user search. */
const STRONG_NAV_MATCH = 10;

/** The profile sections listed before anything is typed on a user's page. */
const USER_SECTION_SUGGESTIONS = [
  "card",
  "kyc",
  "activity",
  "recovery",
  "support",
  "audit",
];

const PALETTE_CLASSES =
  "[&_[cmdk-group-heading]]:text-muted-foreground **:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input]]:h-12";

/** One selectable row: what cmdk keys it by, and where it goes. */
interface Row {
  value: string;
  href: string;
  render: () => React.ReactNode;
}

interface Group {
  key: string;
  heading: React.ReactNode;
  rows: Row[];
  /** Shown in place of rows, unselectable: "Searching users…". */
  status?: React.ReactNode;
}

function initialOf(name?: string) {
  return (name?.trim()?.[0] ?? "?").toUpperCase();
}

function Avatar({ name, muted }: { name?: string; muted?: boolean }) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
        muted ? "bg-gray-100 text-gray-500" : "bg-indigo-50 text-indigo-700"
      )}
      aria-hidden
    >
      {initialOf(name)}
    </span>
  );
}

function ProviderBadge({ provider }: { provider?: string | null }) {
  if (!provider) return null;
  return (
    <Badge variant="info" className="px-1.5 py-0 text-[10px]">
      {PROVIDER_LABELS[provider] ?? provider}
    </Badge>
  );
}

function UserRow({ user, query }: { user: User; query: string }) {
  const match = describeMatch(user, query);
  return (
    <>
      <Avatar name={user.username || user.email} muted={user.isDeleted} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-medium text-gray-900">
            {user.username || user.email || user._id}
          </span>
          <ProviderBadge provider={user.card?.provider} />
          {user.card?.frozen && (
            <Badge variant="warning" className="px-1.5 py-0 text-[10px]">
              frozen
            </Badge>
          )}
          {user.isDeleted && (
            <Badge variant="danger" className="px-1.5 py-0 text-[10px]">
              closed
            </Badge>
          )}
        </span>
        <span className="truncate text-xs text-gray-500">
          {user.email || "No email"}
          {match && (
            <span className="text-indigo-600"> · matched {match}</span>
          )}
        </span>
      </span>
    </>
  );
}

function RecentUserRow({
  user,
  onForget,
}: {
  user: RecentUser;
  onForget: () => void;
}) {
  return (
    <>
      <Avatar name={user.username || user.email} muted={user.isDeleted} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-medium text-gray-900">
            {user.username || user.email || user.id}
          </span>
          <ProviderBadge provider={user.cardProvider} />
          {user.isDeleted && (
            <Badge variant="danger" className="px-1.5 py-0 text-[10px]">
              closed
            </Badge>
          )}
        </span>
        <span className="truncate text-xs text-gray-500">
          {user.email || abbreviateId(user.id)}
        </span>
      </span>
      <span className="shrink-0 text-xs text-gray-400">
        {formatDistanceToNowStrict(user.viewedAt, { addSuffix: true })}
      </span>
      <button
        type="button"
        aria-label={`Remove ${user.username || user.id} from recent users`}
        title="Remove from recent"
        // Not the row's own click: removing a user must not also open them.
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
          onForget();
        }}
        className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </>
  );
}

function EntryRow({ entry }: { entry: SearchEntry }) {
  return (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-white">
        <entry.icon className="h-4 w-4 text-gray-500" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">
          {entry.context && (
            <span className="text-gray-400">{entry.context} › </span>
          )}
          <span className="font-medium text-gray-900">{entry.label}</span>
        </span>
        {entry.description && (
          <span className="truncate text-xs text-gray-500">
            {entry.description}
          </span>
        )}
      </span>
      {entry.kind !== "page" && (
        <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
          {entry.kind === "action" ? "Action" : "Section"}
        </span>
      )}
    </>
  );
}

function SimpleRow({
  icon: Icon,
  children,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-white">
        <Icon className="h-4 w-4 text-gray-500" />
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint && <span className="shrink-0 text-xs text-gray-400">{hint}</span>}
    </>
  );
}

const entryRow = (entry: SearchEntry, prefix = "nav"): Row => ({
  value: `${prefix}:${entry.id}`,
  href: entry.href,
  render: () => <EntryRow entry={entry} />,
});

/**
 * The search itself. Lives inside the dialog, so it mounts on open and every
 * opening starts from a clean slate.
 *
 * Results are assembled here rather than filtered by cmdk: users come from the
 * server (and match on ids that are nowhere in the row), and the catalog is
 * ranked by `scoreEntry`, which is stricter than cmdk's fuzzy match.
 */
export default function CommandPaletteBody({
  initialQuery,
  onClose,
}: {
  initialQuery: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { users: recentUsers, forget, clear } = useRecentUsers();

  const [query, setQuery] = useState(initialQuery);
  const trimmed = query.trim();
  const debounced = useDebounce(trimmed, 200);

  // The row cmdk highlights. Follows the top result until the admin moves the
  // highlight themselves — otherwise user results arriving a moment after a
  // paste would leave Enter on whatever happened to be first before them.
  const [highlighted, setHighlighted] = useState("");
  const [steered, setSteered] = useState(false);
  // Set by the key or click that picks a row; read when it is picked.
  const newTabRef = useRef(false);

  const userSearchEnabled = debounced.length >= 2;
  const {
    data: userResults,
    isError: usersFailed,
    isPlaceholderData: usersStale,
  } = useQuery<UsersResponse>({
    queryKey: ["command-palette-users", debounced],
    queryFn: async () =>
      (
        await api.get("/admin/v1/users", {
          params: {
            search: debounced,
            // Not a nullable field: those sort through an aggregation that
            // does not cast the id a pasted user id is matched on.
            sort: "createdAt",
            order: "desc",
            page: 1,
            limit: USER_RESULTS,
          },
          quietErrors: true,
        })
      ).data,
    enabled: userSearchEnabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  // Same key as the wallets board, so whichever loads first serves the other.
  const { data: walletStatus } = useQuery<WalletStatusResponse>({
    queryKey: ["wallets"],
    queryFn: async () =>
      (await api.get("/admin/v1/wallets/status", { quietErrors: true })).data,
    enabled: trimmed.length >= 2,
    staleTime: 5 * 60_000,
  });

  // The profile open behind the search, if any, for its "This user" group.
  const profileId = /^\/users\/([a-f0-9]{24})$/i.exec(pathname)?.[1];
  const profile = profileId
    ? queryClient.getQueryData<User>(["user", profileId])
    : undefined;
  const profileName =
    profile?.username || profile?.email || (profileId ? "This user" : "");

  const groups = useMemo<Group[]>(() => {
    const thisUser = profileId ? userEntries(profileId, profileName) : [];

    if (!trimmed) {
      const result: Group[] = [];
      const recents = recentUsers.filter((user) => user.id !== profileId);
      if (recents.length > 0) {
        result.push({
          key: "recent",
          heading: (
            <span className="flex items-center justify-between">
              <span>Recent users</span>
              <button
                type="button"
                onClick={clear}
                className="cursor-pointer rounded px-1 text-[11px] font-normal text-gray-400 hover:text-gray-700"
              >
                Clear
              </button>
            </span>
          ),
          rows: recents.map((user) => ({
            value: `recent:${user.id}`,
            href: `/users/${user.id}`,
            render: () => (
              <RecentUserRow user={user} onForget={() => forget(user.id)} />
            ),
          })),
        });
      }
      if (thisUser.length > 0) {
        result.push({
          key: "this-user",
          heading: profileName,
          rows: thisUser
            .filter((entry) =>
              USER_SECTION_SUGGESTIONS.some((key) => entry.id.endsWith(`:${key}`))
            )
            .map((entry) => entryRow(entry, "this-user")),
        });
      }
      result.push({
        key: "suggested",
        heading: "Jump to",
        rows: SUGGESTED_PAGE_IDS.flatMap((id) => {
          const entry = SEARCH_ENTRIES.find((candidate) => candidate.id === id);
          return entry ? [entryRow(entry)] : [];
        }),
      });
      return result;
    }

    // ---- Something typed ----
    const detected: Row[] = [];
    if (isErrorLookupQuery(trimmed)) {
      detected.push({
        value: "detect:error-ref",
        href: `/error-lookup?ref=${encodeURIComponent(trimmed)}`,
        render: () => (
          <SimpleRow icon={CircleAlert} hint="Error lookup">
            Look up error Ref <span className="font-mono">{trimmed}</span>
          </SimpleRow>
        ),
      });
    }
    if (isUserId(trimmed)) {
      detected.push({
        value: "detect:user-id",
        href: `/users/${trimmed.toLowerCase()}`,
        render: () => (
          <SimpleRow icon={UserIcon} hint="User ID">
            Open user <span className="font-mono">{trimmed}</span>
          </SimpleRow>
        ),
      });
    }

    // Users: only results for exactly what is in the box, so Enter can never
    // open a user found by an earlier, shorter query.
    const usersCurrent =
      userSearchEnabled && debounced === trimmed && !!userResults && !usersStale;
    const users = usersCurrent ? (userResults?.data ?? []) : [];
    const total = usersCurrent ? (userResults?.meta.total ?? 0) : 0;
    const userRows: Row[] = users.map((user) => ({
      value: `user:${user._id}`,
      href: `/users/${user._id}`,
      render: () => <UserRow user={user} query={trimmed} />,
    }));
    userRows.push({
      value: "users:table",
      href: `/users?search=${encodeURIComponent(trimmed)}`,
      render: () => (
        <SimpleRow
          icon={Users}
          hint={usersCurrent && total > users.length ? `${total} matches` : undefined}
        >
          {usersCurrent && total > users.length
            ? `See all ${total} users matching “${trimmed}”`
            : `Search the Users table for “${trimmed}”`}
        </SimpleRow>
      ),
    });
    const usersGroup: Group = {
      key: "users",
      heading: "Users",
      rows: userRows,
      status:
        usersFailed && debounced === trimmed ? (
          <span className="block px-2 py-2 text-xs text-red-600">
            The user search failed. The Users table may say why.
          </span>
        ) : userSearchEnabled && !usersCurrent ? (
          <span className="flex items-center gap-2 px-2 py-2 text-xs text-gray-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Searching users, cards and wallets…
          </span>
        ) : usersCurrent && users.length === 0 ? (
          <span className="block px-2 py-2 text-xs text-gray-500">
            No user, card ID or wallet matches “{trimmed}”.
          </span>
        ) : undefined,
    };

    const thisUserRanked = rankEntries(thisUser, trimmed, USER_SECTION_RESULTS);
    const thisUserRows = thisUserRanked.map((entry) => entryRow(entry, "this-user"));
    const ranked = rankEntries(SEARCH_ENTRIES, trimmed, PAGE_RESULTS + SECTION_RESULTS);
    const pages = ranked.filter((entry) => entry.kind === "page").slice(0, PAGE_RESULTS);
    const sections = ranked
      .filter((entry) => entry.kind !== "page")
      .slice(0, SECTION_RESULTS);

    // Wallets are ranked like any other place: "admin wallet" should put the
    // Admin Wallet first, and a pasted treasury address should find its owner.
    const walletEntries: SearchEntry[] = (walletStatus?.wallets ?? []).map(
      (wallet) => ({
        id: `wallet:${wallet.name}`,
        kind: "section",
        label: wallet.name,
        context: "Treasury › Wallets",
        description: wallet.funds ?? wallet.description,
        href: `/wallets#${walletAnchorId(wallet.name)}`,
        icon: Wallet,
        keywords: [
          wallet.address,
          wallet.role ?? "",
          wallet.description,
          "wallet",
          "treasury",
        ],
      })
    );
    const wallets = rankEntries(walletEntries, trimmed, WALLET_RESULTS);
    const walletAddress = new Map(
      (walletStatus?.wallets ?? []).map((wallet) => [wallet.name, wallet.address])
    );
    const walletRows: Row[] = wallets.map((entry) => ({
      value: entry.id,
      href: entry.href,
      render: () => (
        <SimpleRow
          icon={Wallet}
          hint={abbreviateId(walletAddress.get(entry.label) ?? "")}
        >
          <span className="font-medium text-gray-900">{entry.label}</span>
          {entry.description && (
            <span className="text-gray-500"> · {entry.description}</span>
          )}
        </SimpleRow>
      ),
    }));

    const elsewhere: Row[] = [
      {
        value: "elsewhere:support",
        href: `/support?q=${encodeURIComponent(trimmed)}`,
        render: () => (
          <SimpleRow icon={Headphones} hint="Support">
            Search support cases for “{trimmed}”
          </SimpleRow>
        ),
      },
      {
        value: "elsewhere:help",
        href: `/support/articles?q=${encodeURIComponent(trimmed)}`,
        render: () => (
          <SimpleRow icon={BookOpen} hint="Help Center">
            Search help articles for “{trimmed}”
          </SimpleRow>
        ),
      },
    ];
    if (couldBeReferralCode(trimmed)) {
      elsewhere.push({
        value: "elsewhere:referral",
        href: `/referrals?code=${encodeURIComponent(trimmed)}`,
        render: () => (
          <SimpleRow icon={Share2} hint="Referral Lookup">
            Look up referral code <span className="font-mono">{trimmed}</span>
          </SimpleRow>
        ),
      });
    }

    const best = (entries: SearchEntry[]) =>
      entries.length ? scoreEntry(entries[0], trimmed) : 0;
    // Navigation groups in order of their best match, so whichever holds the
    // strongest hit — a page, a section, a wallet, this user's KYC — leads.
    const navGroups: Group[] = [
      {
        group: { key: "this-user", heading: profileName, rows: thisUserRows },
        score: best(thisUserRanked),
      },
      {
        group: { key: "pages", heading: "Pages", rows: pages.map((entry) => entryRow(entry)) },
        score: best(pages),
      },
      {
        group: {
          key: "sections",
          heading: "Sections and actions",
          rows: sections.map((entry) => entryRow(entry)),
        },
        score: best(sections),
      },
      {
        group: { key: "wallets", heading: "Wallets", rows: walletRows },
        score: best(wallets),
      },
    ]
      .sort((a, b) => b.score - a.score)
      .map((ranked) => ranked.group);
    const elsewhereGroup: Group = {
      key: "elsewhere",
      heading: "Search elsewhere",
      rows: elsewhere,
    };

    // A paste (email, address, card id) is a user search; a word that names a
    // page, section or wallet is navigation, and goes first.
    const bestNav = Math.max(
      best(thisUserRanked),
      best(pages),
      best(sections),
      best(wallets)
    );
    const navFirst = !looksLikeIdentifier(trimmed) && bestNav >= STRONG_NAV_MATCH;

    const ordered = navFirst ? [...navGroups, usersGroup] : [usersGroup, ...navGroups];
    return [
      { key: "detected", heading: "Best match", rows: detected },
      ...ordered,
      elsewhereGroup,
    ].filter((group) => group.rows.length > 0 || group.status);
  }, [
    trimmed,
    debounced,
    recentUsers,
    profileId,
    profileName,
    userSearchEnabled,
    userResults,
    usersStale,
    usersFailed,
    walletStatus,
    forget,
    clear,
  ]);

  const rows = groups.flatMap((group) => group.rows);
  const firstValue = rows[0]?.value ?? "";
  const value =
    steered && rows.some((row) => row.value === highlighted)
      ? highlighted
      : firstValue;

  const go = (row: Row) => {
    const newTab = newTabRef.current;
    newTabRef.current = false;
    onClose();
    navigateTo(router, row.href, { newTab });
  };

  return (
    <Command
      shouldFilter={false}
      loop
      value={value}
      onValueChange={setHighlighted}
      onKeyDown={(event) => {
        if (
          ["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"].includes(
            event.key
          )
        ) {
          setSteered(true);
        }
        if (event.key === "Enter") {
          newTabRef.current = event.metaKey || event.ctrlKey;
        }
      }}
      className={PALETTE_CLASSES}
    >
      <CommandInput
        value={query}
        onValueChange={(next) => {
          setQuery(next);
          setSteered(false);
        }}
        placeholder="Search users, card IDs, wallets, Refs, pages and settings…"
        // Opened from a search box with text in it: typing replaces it, the
        // arrow keys keep it.
        onFocus={(event) => event.currentTarget.select()}
      />
      <CommandList
        className="max-h-[min(60vh,32rem)]"
        onPointerMove={() => setSteered(true)}
        onPointerDown={(event) => {
          newTabRef.current = event.metaKey || event.ctrlKey;
        }}
      >
        <CommandEmpty>
          <span className="flex flex-col items-center gap-1 text-gray-500">
            <Search className="h-5 w-5 text-gray-300" />
            Nothing matches “{trimmed}”.
          </span>
        </CommandEmpty>
        {groups.map((group) => (
          <CommandGroup key={group.key} heading={group.heading}>
            {group.rows.map((row) => (
              <CommandItem
                key={row.value}
                value={row.value}
                onSelect={() => go(row)}
                className="gap-3 py-2"
              >
                {row.render()}
              </CommandItem>
            ))}
            {group.status}
          </CommandGroup>
        ))}
      </CommandList>
      <div className="flex items-center gap-4 border-t bg-gray-50 px-3 py-2 text-[11px] text-gray-500">
        <span className="flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> navigate
        </span>
        <span className="flex items-center gap-1">
          <Kbd>
            <CornerDownLeft className="h-3 w-3" />
          </Kbd>{" "}
          open
        </span>
        <span className="hidden items-center gap-1 sm:flex">
          <Kbd>⌘</Kbd>
          <Kbd>
            <CornerDownLeft className="h-3 w-3" />
          </Kbd>{" "}
          new tab
        </span>
        <span className="flex items-center gap-1">
          <Kbd>esc</Kbd> close
        </span>
        <span className="ml-auto hidden items-center gap-1 md:flex">
          {trimmed ? (
            <>
              <ArrowRight className="h-3 w-3" />
              Paste a card ID, Wirex user ID, wallet, Safe or Ref
            </>
          ) : (
            <>
              <Clock className="h-3 w-3" />
              Profiles you open are kept here
            </>
          )}
        </span>
      </div>
    </Command>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-5 items-center justify-center rounded border bg-white px-1 font-sans text-[10px] font-medium text-gray-600 shadow-xs">
      {children}
    </kbd>
  );
}
