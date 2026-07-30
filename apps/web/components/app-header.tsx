import Link from "next/link";

export function AppHeader() {
  return (
    <header className="border-b border-neutral-200/80 bg-white/85 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-3 font-semibold tracking-tight text-neutral-950"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-neutral-950 text-sm font-black text-lime-300">
            C
          </span>
          <span>Cluvvi</span>
        </Link>
        <nav
          className="flex items-center gap-1 text-sm font-medium text-neutral-600"
          aria-label="Primary"
        >
          <Link
            className="rounded-lg px-3 py-2 hover:bg-neutral-100 hover:text-neutral-950"
            href="/runs"
          >
            Runs
          </Link>
          <Link
            className="rounded-lg px-3 py-2 hover:bg-neutral-100 hover:text-neutral-950"
            href="/settings/local"
          >
            Local settings
          </Link>
        </nav>
      </div>
    </header>
  );
}
