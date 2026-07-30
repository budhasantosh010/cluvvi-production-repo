import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { signOutAction } from "@/app/actions";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const client = await createServerSupabaseClient();
  const { data } = await client.auth.getUser();
  if (!data.user) {
    redirect("/sign-in");
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-neutral-200/80 bg-[#f7f7f5]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Brand />
          <form action={signOutAction}>
            <button
              className="text-sm font-medium text-neutral-600 hover:text-neutral-950"
              type="submit"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">{children}</main>
    </div>
  );
}
