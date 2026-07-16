import Link from "next/link";
import { Button } from "../components/ui/button";

export default function ClientDashboardNotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm text-center">
        <h1 className="text-xl font-bold text-foreground">Page not found.</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          This dashboard page does not exist. Check the URL or return to your dashboard home.
        </p>
        <Button asChild className="mt-5 rounded-lg font-bold">
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </section>
    </main>
  );
}
