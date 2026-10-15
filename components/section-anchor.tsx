import { cn } from "@/lib/utils";

/**
 * A place on a page the admin search can link to (`#user-kyc`).
 *
 * For panels that are their own components and do not take an `id`. Rounded
 * to match the cards it wraps, so the highlight a search lands with follows
 * the card's corners.
 */
export function SectionAnchor({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className={cn("rounded-xl", className)}>
      {children}
    </div>
  );
}
