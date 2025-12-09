import CardTransactionsTable from "@/components/card-transactions-table";

export default function CardTransactionsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">
        Card Transactions
      </h1>
      <CardTransactionsTable />
    </div>
  );
}
