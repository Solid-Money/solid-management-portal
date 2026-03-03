import WalletsTable from "@/components/wallets-table";

export default function WalletsPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Wallets</h1>
      <WalletsTable />
    </div>
  );
}
