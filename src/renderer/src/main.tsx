import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { router } from './router'
import './styles/index.css'
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Music libraries change rarely; refetching on every window focus would
      // hammer a self-hosted server for no benefit.
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Never retry a rejected credential — it will not start working.
        const message = (error as Error).message.toLowerCase()
        if (message.includes('password') || message.includes('not authorized')) return false
        return failureCount < 2
      },
      staleTime: 5 * 60_000
    }
  }
})

const container = document.getElementById('root')
if (!container) throw new Error('Root container is missing from index.html')

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* `App` is the root route's component, rendered by the router. */}
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
)
