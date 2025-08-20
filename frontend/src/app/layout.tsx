import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ maxWidth: 1200, margin: '0 auto'}}>{children}</body>
    </html>
  )
}