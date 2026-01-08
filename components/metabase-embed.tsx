"use client";

interface MetabaseEmbedProps {
  publicToken: string;
  type: "dashboard" | "question";
  height?: string | number;
  className?: string;
}

export default function MetabaseEmbed({
  publicToken,
  type,
  height = 600,
  className = "",
}: MetabaseEmbedProps) {
  const baseUrl = process.env.NEXT_PUBLIC_METABASE_SITE_URL;

  if (!baseUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg text-center p-4">
        <p className="text-gray-500 text-sm font-medium">
          Metabase site URL not configured
        </p>
        <p className="text-gray-400 text-xs mt-1 font-mono">
          NEXT_PUBLIC_METABASE_SITE_URL
        </p>
      </div>
    );
  }

  const url = `${baseUrl}/public/${type}/${publicToken}#bordered=true&titled=true`;

  return (
    <div className={`w-full overflow-hidden rounded-lg shadow-sm border border-gray-200 bg-white ${className}`}>
      <iframe
        src={url}
        className="border-0"
        width="100%"
        height={height}
        title={`Metabase ${type} ${publicToken}`}
      />
    </div>
  );
}
