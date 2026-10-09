import { ScrollViewStyleReset } from 'expo-router/html'
import type { ReactNode } from 'react'

/** Web only (for previews): the page is Arabic and right-to-left, as the native app is. */
export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  )
}
