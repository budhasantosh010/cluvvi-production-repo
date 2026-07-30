import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="surface-card max-w-md p-8 text-center">
        <p className="eyebrow">Not found</p>
        <h1 className="mt-3 text-2xl font-semibold">That page is unavailable.</h1>
        <p className="mt-3 text-sm leading-6 text-neutral-600">
          It may not exist, or it may belong to another workspace.
        </p>
        <Link className="button-primary mt-6" href="/dashboard">
          Return to dashboard
        </Link>
      </div>
    </main>
  );
}
