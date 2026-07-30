import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { Brand } from "@/components/brand";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function SignInPage() {
  const client = await createServerSupabaseClient();
  const { data } = await client.auth.getUser();
  if (data.user) {
    redirect("/dashboard");
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <section className="hidden border-r border-neutral-200/80 p-12 lg:flex lg:flex-col lg:justify-between">
        <Brand />
        <div className="max-w-xl pb-10">
          <div className="mb-8 inline-flex rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm">
            Evidence before outreach
          </div>
          <h2 className="text-5xl font-semibold leading-[1.04] tracking-[-0.04em] text-neutral-950">
            Know who is worth contacting before you send a single message.
          </h2>
          <p className="mt-6 max-w-lg text-lg leading-8 text-neutral-600">
            Cluvvi turns your offer into a ranked buyer-discovery mission with transparent evidence
            and honest limitations.
          </p>
        </div>
        <p className="text-sm text-neutral-500">Cluvvi V0 · Customer discovery with proof</p>
      </section>
      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="surface-card w-full max-w-md p-7 sm:p-9">
          <div className="mb-8 lg:hidden">
            <Brand />
          </div>
          <AuthForm />
        </div>
      </section>
    </main>
  );
}
