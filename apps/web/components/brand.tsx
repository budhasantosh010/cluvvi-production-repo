import Link from "next/link";

export function Brand() {
  return (
    <Link
      className="inline-flex items-center gap-2.5 font-semibold tracking-tight"
      href="/dashboard"
    >
      <span className="grid size-8 place-items-center rounded-xl bg-neutral-950 text-sm font-bold text-lime-300 shadow-sm">
        C
      </span>
      <span>Cluvvi</span>
    </Link>
  );
}
