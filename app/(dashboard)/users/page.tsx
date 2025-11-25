import UsersTable from '@/components/users-table';

export default function UsersPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Users</h1>
      <UsersTable />
    </div>
  );
}
