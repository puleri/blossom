import "./globals.css";
import { AuthBootstrap } from "@/components/AuthBootstrap";

export const metadata = {
  title: "Blossom",
  description: "Next.js + Firebase starter"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthBootstrap />
        {children}
      </body>
    </html>
  );
}
