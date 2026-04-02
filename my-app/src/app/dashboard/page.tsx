import { auth } from "@/lib/auth"
import { logout } from "@/lib/auth/actions"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const session = await auth()

  if (!session) redirect("/login")

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Dashboard
        </h1>
        <form
          action={async () => {
            "use server"
            await logout()
          }}
        >
          <button
            type="submit"
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Sign out
          </button>
        </form>
      </header>

      <main className="flex-1 p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {session.error === "RefreshAccessTokenError" && (
            <div className="rounded-lg bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
              Your session has expired. Please sign in again.
            </div>
          )}

          <div className="rounded-xl bg-white p-6 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
            <h2 className="mb-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">
              User
            </h2>
            <div className="space-y-2">
              <p className="text-zinc-900 dark:text-zinc-50">
                <span className="font-medium">Name:</span>{" "}
                {session.user.name ?? "—"}
              </p>
              <p className="text-zinc-900 dark:text-zinc-50">
                <span className="font-medium">Email:</span>{" "}
                {session.user.email ?? "—"}
              </p>
              <p className="text-zinc-900 dark:text-zinc-50">
                <span className="font-medium">ID:</span> {session.user.id}
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-white p-6 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
            <h2 className="mb-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Roles
            </h2>
            {session.user.roles.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {session.user.roles.map((role) => (
                  <span
                    key={role}
                    className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    {role}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">No roles assigned</p>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
