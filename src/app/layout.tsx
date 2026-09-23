import type { Metadata, Viewport } from "next";
import "./globals.css";
import { APP_DESCRIPTION, APP_NAME, APP_SUBTITLE, SERVER_LABEL } from "@/lib/constants";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — ${APP_SUBTITLE} · ${SERVER_LABEL}`,
    template: `%s · ${APP_NAME} ${APP_SUBTITLE}`,
  },
  description: APP_DESCRIPTION,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background font-sans text-[13px] leading-relaxed text-neutral-300 antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
