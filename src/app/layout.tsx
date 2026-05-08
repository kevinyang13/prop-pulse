import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PropPulse — Know before you buy.',
  description: 'Personalized property investment analysis for W2 investors.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  )
}
