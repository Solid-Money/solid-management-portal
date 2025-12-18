import { Suspense } from "react";
import UsersTable from "@/components/users-table";
import { Loader2 } from "lucide-react";

function UsersTableFallback() {
  return (
    <div className="flex justify-center py-12">
      <Loader2 className="animate-spin h-8 w-8 text-indigo-600" />
    </div>
  );
}

export default function UsersPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Users</h1>
      <Suspense fallback={<UsersTableFallback />}>
        <UsersTable />
      </Suspense>
    </div>
  );
}
