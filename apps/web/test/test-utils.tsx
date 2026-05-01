import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/hooks/use-auth';

// All providers a feature component might transitively need under test.
function AllProviders({ children, route = '/' }: { children: ReactNode; route?: string }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>{children}</AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options?: { route?: string } & Omit<RenderOptions, 'wrapper'>,
) {
  const { route, ...rest } = options ?? {};
  return render(ui, {
    wrapper: ({ children }) => <AllProviders route={route}>{children}</AllProviders>,
    ...rest,
  });
}

export * from '@testing-library/react';
