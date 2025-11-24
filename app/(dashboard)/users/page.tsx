import UsersTable from '@/components/users-table';

export default function UsersPage() {
  return (
    <div className="px-4 py-6 sm:px-0">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Users</h1>
      <UsersTable />
    </div>
  );
}
