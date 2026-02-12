import { Providers } from './providers'

export const metadata = {
  title: 'PDF 해상도 스케일러',
  description: 'PDF 파일의 해상도를 1280에서 1920으로 변경',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
