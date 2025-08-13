export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ maxWidth: 820, margin: '0 auto', padding: 16 }}>{children}</body>
    </html>
  )
}