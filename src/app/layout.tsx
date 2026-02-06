import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
