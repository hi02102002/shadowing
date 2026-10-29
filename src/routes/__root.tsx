import { HeadContent, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { FormDevtoolsPanel } from '@tanstack/react-form-devtools'

import { AppHeader, THEME_SCRIPT } from '#/components/app-header'
import { QuickLookup } from '#/components/quick-lookup'
import { TooltipProvider } from '#/components/ui/tooltip'
import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Shadowing: luyện nghe nói tiếng Anh từ YouTube' },
      {
        name: 'description',
        content: 'Luyện shadowing, nghe chép chính tả và phát âm tiếng Anh từ bất kỳ video YouTube, có AI phân tích lỗi.',
      },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
    scripts: [{ children: THEME_SCRIPT }],
  }),
  shellComponent: RootDocument,
  notFoundComponent: () => (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">Không tìm thấy trang</h1>
    </div>
  ),
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <TooltipProvider delayDuration={300}>
          <AppHeader />
          <main>{children}</main>
          <QuickLookup />
        </TooltipProvider>
        <TanStackDevtools
          config={{ position: 'bottom-left' }}
          plugins={[
            { name: 'TanStack Router', render: <TanStackRouterDevtoolsPanel /> },
            TanStackQueryDevtools,
            { name: 'TanStack Form', render: <FormDevtoolsPanel /> },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
