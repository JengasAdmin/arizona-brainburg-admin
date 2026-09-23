import { redirect } from "next/navigation";
import { getAuth } from "@/server/auth/access";
import { APP_DESCRIPTION, SERVER_LABEL } from "@/lib/constants";
import { MessageSquare, ShieldCheck } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  oauth_failed: "Sign-in failed with the identity provider. Please try again.",
  session_expired: "Your session has expired. Please sign in again.",
  access_denied: "Access to this instance is restricted. Contact an administrator.",
  provider_already_linked: "This account is already linked to another user.",
  not_seeded: "The database is not seeded yet. Run `npm run db:seed`.",
};

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M20.317 4.369A19.8 19.8 0 0 0 15.432 3c-.24.427-.513.998-.704 1.452a18.3 18.3 0 0 0-5.457 0A13 13 0 0 0 8.56 3a19.7 19.7 0 0 0-4.885 1.372C.568 8.99-.276 13.499.146 17.945A19.9 19.9 0 0 0 6.205 21c.486-.664.917-1.373 1.287-2.123a12.9 12.9 0 0 1-2.032-.976c.17-.124.337-.253.498-.386a14.2 14.2 0 0 0 12.084 0c.163.133.33.262.499.386-.647.381-1.325.707-2.033.977.37.75.8 1.459 1.287 2.123a19.8 19.8 0 0 0 6.06-3.055c.5-5.177-.838-9.644-3.534-13.577ZM8.02 15.331c-1.183 0-2.157-1.086-2.157-2.42 0-1.333.955-2.419 2.157-2.419 1.201 0 2.176 1.086 2.156 2.42 0 1.333-.955 2.419-2.156 2.419Zm7.975 0c-1.183 0-2.157-1.086-2.157-2.42 0-1.333.955-2.419 2.157-2.419 1.201 0 2.176 1.086 2.156 2.42 0 1.333-.955 2.419-2.156 2.419Z" />
    </svg>
  );
}

function VkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12.785 16.241s.288-.032.436-.194c.136-.148.132-.427.132-.427s-.02-1.304.58-1.496c.59-.189 1.35 1.26 2.154 1.816.608.422 1.07.33 1.07.33l2.158-.03s1.127-.071.593-.952c-.044-.072-.312-.652-1.606-1.844-1.355-1.25-1.173-1.047.458-3.206.995-1.314 1.393-2.116 1.268-2.459-.119-.327-.85-.24-.85-.24l-2.416.015s-.178-.024-.31.055c-.129.078-.212.261-.212.261s-.381 1.012-.888 1.872c-1.07 1.814-1.498 1.91-1.673 1.796-.407-.263-.305-1.058-.305-1.623 0-1.762.267-2.497-.521-2.687-.262-.064-.454-.106-1.123-.113-.857-.009-1.585.003-2 .203-.3.133-.53.427-.39.445.172.022.563.106.77.387.267.362.257 1.174.257 1.174s.153 2.23-.357 2.505c-.348.188-.826-.195-1.85-1.935-.525-.892-.921-1.877-.921-1.877s-.076-.187-.213-.288c-.165-.12-.396-.158-.396-.158l-2.296.015s-.345.01-.471.16c-.112.134-.009.411-.009.411s1.787 4.178 3.812 6.282c1.858 1.931 3.968 1.806 3.968 1.806h.957Z" />
    </svg>
  );
}

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const auth = await getAuth();
  if (auth) redirect("/dashboard");

  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  const providers = [
    {
      key: "discord",
      label: "Continue with Discord",
      href: "/api/auth/discord?redirectTo=/dashboard",
      icon: <DiscordIcon className="h-4 w-4" />,
    },
    {
      key: "vk",
      label: "Continue with VK",
      href: "/api/auth/vk?redirectTo=/dashboard",
      icon: <VkIcon className="h-4 w-4" />,
    },
  ];

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-line bg-card p-6 shadow-panel sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-line2 bg-raised text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-semibold tracking-tight text-white">ARIZONA RP</div>
              <div className="text-[11px] font-medium uppercase tracking-[0.25em] text-neutral-500">
                Brainburg
              </div>
            </div>
            <span className="ml-auto rounded border border-line2 bg-raised px-2 py-1 text-[11px] font-semibold text-neutral-300">
              {SERVER_LABEL}
            </span>
          </div>

          <div className="mt-5 border-t border-line pt-5">
            <p className="text-[13px] leading-relaxed text-neutral-400">
              {APP_DESCRIPTION}
            </p>
            <p className="mt-2 text-xs text-neutral-600">
              Closed instance — access requires an invited Discord or VK identity. Every action is
              permission-checked and audit-logged.
            </p>
          </div>

          {errorMessage ? (
            <div
              role="alert"
              className="mt-4 rounded-md border border-[#3d1a1c] bg-[#210f10] px-3 py-2 text-xs text-red-300"
            >
              {errorMessage}
            </div>
          ) : null}

          <div className="mt-6 space-y-2.5">
            {providers.map((provider) => (
              <a
                key={provider.key}
                href={provider.href}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-line2 bg-raised text-[13px] font-medium text-white transition-colors hover:border-neutral-500 hover:bg-[#262626]"
              >
                {provider.icon}
                {provider.label}
              </a>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-line pt-4 text-[11px] text-neutral-600">
            <span className="inline-flex items-center gap-1.5">
              <MessageSquare className="h-3 w-3" /> Support: contact the administration
            </span>
            <span>Server #5</span>
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] text-neutral-700">
          Leadership · Deputies · Factions · Budgets · Audit
        </p>
      </div>
    </main>
  );
}
