import { describe, expect, test, vi } from 'vitest';
import { ProductsList } from '@/features/products/components/products-list';
import { productsApi } from '@/features/products/api/products-api';
import { renderWithProviders, screen, waitFor } from './test-utils';

vi.mock('@/features/products/api/products-api');

describe('ProductsList', () => {
  test('renders an empty state when API returns no items', async () => {
    vi.mocked(productsApi.list).mockResolvedValueOnce({ items: [], nextCursor: null });
    renderWithProviders(<ProductsList />);
    expect(await screen.findByText(/no products yet/i)).toBeInTheDocument();
  });

  test('renders product cards when items exist', async () => {
    vi.mocked(productsApi.list).mockResolvedValueOnce({
      items: [
        {
          id: 'p1',
          ownerId: 'u1',
          name: 'Widget',
          description: 'Cool',
          price: '9.99',
          createdAt: '2026-05-01T00:00:00Z',
          updatedAt: '2026-05-01T00:00:00Z',
        },
      ],
      nextCursor: null,
    });
    renderWithProviders(<ProductsList />);
    await waitFor(() => expect(screen.getByText('Widget')).toBeInTheDocument());
    expect(screen.getByText('$9.99')).toBeInTheDocument();
  });
});
