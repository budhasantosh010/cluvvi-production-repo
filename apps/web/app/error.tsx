"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="grid min-h-screen place-items-center bg-neutral-50 p-6">
        <div className="max-w-md rounded-3xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
            Cluvvi stopped safely
          </p>
          <h1 className="mt-3 text-2xl font-semibold">Something did not complete.</h1>
          <p className="mt-3 text-sm leading-6 text-neutral-600">
            No hidden success was reported. Try the action again.
          </p>
          <button
            className="mt-6 rounded-xl bg-neutral-950 px-5 py-3 text-sm font-semibold text-white"
            onClick={reset}
            type="button"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
