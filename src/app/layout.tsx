import "./globals.css";
import AuthGuard from "./AuthGuard";
import AppShell from "./AppShell";

export const metadata = {
  title: "Inventory Management",
  description: "Inventory & Warehouse Management System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-100 text-slate-900 font-sans">
        <AuthGuard>
          <AppShell>{children}</AppShell>
        </AuthGuard>
      </body>
    </html>
  );
}
