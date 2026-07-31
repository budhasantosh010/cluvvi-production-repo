import Link from "next/link";

export function AppHeader() {
  return (
    <header className="border-b border-neutral-200/70 bg-[#fbfbf8]/90 backdrop-blur">
      <div className="mx-auto flex min-h-14 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          className="flex min-h-11 items-center gap-2.5 font-semibold tracking-tight text-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
        >
          <span className="grid size-8 place-items-center rounded-[10px] bg-neutral-950 text-xs font-black text-lime-300">
            C
          </span>
          <span>Cluvvi</span>
        </Link>
        <nav
          className="flex items-center gap-1 text-sm font-medium text-neutral-600"
          aria-label="Primary"
        >
          <Link
            className="min-h-11 rounded-lg px-3 py-3 hover:bg-neutral-100 hover:text-neutral-950"
            href="/runs"
          >
            Runs
          </Link>
          <Link
            className="hidden min-h-11 rounded-lg px-3 py-3 hover:bg-neutral-100 hover:text-neutral-950 sm:block"
            href="/settings/local"
          >
            Settings
          </Link>
        </nav>
      </div>
    </header>
  );
}
