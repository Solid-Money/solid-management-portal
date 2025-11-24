# Solid Management Portal

Admin dashboard for managing Solid users and viewing account balances.

## Features

- User list with search, sorting, and pagination
- User detail view with balances and activity
- Public access (no authentication required for v1)

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS
- **Data Fetching**: React Query (TanStack Query)
- **UI Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 20+
- npm or pnpm

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env.local` file:

```bash
NEXT_PUBLIC_SOLID_API_BASE_URL=http://localhost:5001
```

For production, set this to your production backend URL.

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
npm start
```

## Deployment

### Vercel

1. Install Vercel CLI (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. Deploy:
   ```bash
   vercel
   ```

3. Set environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_SOLID_API_BASE_URL`: Your production backend URL

### Environment Variables for Production

Make sure to set these in your Vercel project settings:

- `NEXT_PUBLIC_SOLID_API_BASE_URL`: Production backend URL (e.g., `https://api.solid.com`)

## Project Structure

```
├── app/
│   ├── (auth)/
│   │   └── login/          # Login page (redirects to /users)
│   ├── (dashboard)/
│   │   ├── layout.tsx      # Dashboard layout with header
│   │   └── users/
│   │       ├── page.tsx    # Users list
│   │       └── [id]/
│   │           └── page.tsx # User detail
│   ├── layout.tsx          # Root layout with providers
│   └── page.tsx            # Root page (redirects to /users)
├── components/
│   ├── auth-provider.tsx   # Auth context (mocked for v1)
│   ├── providers.tsx       # Global providers
│   ├── users-table.tsx     # Users list table
│   ├── balances-card.tsx   # User balances display
│   └── activity-list.tsx   # User activity list
├── lib/
│   ├── api.ts              # Axios instance
│   └── firebase.ts         # Firebase config (unused in v1)
├── hooks/
│   └── use-debounce.ts     # Debounce hook
└── types/
    └── index.ts            # TypeScript types
```

## API Endpoints

The frontend expects the following backend endpoints:

- `GET /accounts/v1/admin/users` - List users with pagination
- `GET /accounts/v1/admin/users/:id` - Get user details
- `GET /accounts/v1/admin/users/:id/balances` - Get user balances
- `GET /accounts/v1/admin/users/:id/activity` - Get user activity

## License

Private
