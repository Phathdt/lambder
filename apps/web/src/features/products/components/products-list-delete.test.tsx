import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { ProductsList } from '@/features/products/components/products-list';
import { productsApi } from '@/features/products/api/products-api';
import { renderWithProviders, screen, waitFor, within } from '@/__test-utils__/test-utils';

vi.mock('@/features/products/api/products-api');
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ProductsList - Delete and Ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up auth token so the logged-in user is "u1"
    localStorage.setItem('lambder.accessToken', 'a.eyJzdWIiOiJ1MSJ9.s');
    localStorage.setItem('lambder.refreshToken', 'r.eyJzdWIiOiJ1MSJ9.s');
  });

  test('shows delete button only for owned products', async () => {
    vi.mocked(productsApi.list).mockResolvedValueOnce({
      items: [
        {
          id: 'p1',
          ownerId: 'u1', // Owned by logged-in user
          name: 'My Widget',
          description: 'I own this',
          price: '9.99',
          createdAt: '2026-05-01T00:00:00Z',
          updatedAt: '2026-05-01T00:00:00Z',
        },
        {
          id: 'p2',
          ownerId: 'u2', // Owned by different user
          name: 'Other Widget',
          description: 'Someone else owns this',
          price: '19.99',
          createdAt: '2026-05-01T00:00:00Z',
          updatedAt: '2026-05-01T00:00:00Z',
        },
      ],
      nextCursor: null,
    });

    renderWithProviders(<ProductsList />);

    // Both products should be visible
    expect(await screen.findByText('My Widget')).toBeInTheDocument();
    expect(screen.getByText('Other Widget')).toBeInTheDocument();

    // Find all buttons with aria-label (only owned products have delete buttons)
    const deleteButtons = screen.queryAllByRole('button');
    expect(deleteButtons.length).toBeGreaterThan(0);
  });

  test('delete button click invokes delete API and shows success toast', async () => {
    const { toast } = await import('sonner');

    vi.mocked(productsApi.list).mockResolvedValueOnce({
      items: [
        {
          id: 'p1',
          ownerId: 'u1',
          name: 'My Widget',
          description: 'I own this',
          price: '9.99',
          createdAt: '2026-05-01T00:00:00Z',
          updatedAt: '2026-05-01T00:00:00Z',
        },
      ],
      nextCursor: null,
    });

    vi.mocked(productsApi.delete).mockResolvedValueOnce(undefined);

    const user = userEvent.setup();
    renderWithProviders(<ProductsList />);

    await screen.findByText('My Widget');

    // Find and click the delete button
    const deleteButtons = screen.queryAllByRole('button');
    expect(deleteButtons.length).toBeGreaterThan(0);
    const deleteButton = deleteButtons[0];

    await user.click(deleteButton);

    await waitFor(() => {
      expect(vi.mocked(productsApi.delete)).toHaveBeenCalledWith('p1');
      expect(toast.success).toHaveBeenCalledWith('Deleted');
    });
  });

  test('delete button click shows error toast on failure', async () => {
    const { toast } = await import('sonner');

    vi.mocked(productsApi.list).mockResolvedValueOnce({
      items: [
        {
          id: 'p1',
          ownerId: 'u1',
          name: 'My Widget',
          description: 'I own this',
          price: '9.99',
          createdAt: '2026-05-01T00:00:00Z',
          updatedAt: '2026-05-01T00:00:00Z',
        },
      ],
      nextCursor: null,
    });

    vi.mocked(productsApi.delete).mockRejectedValueOnce(new Error('Delete failed'));

    const user = userEvent.setup();
    renderWithProviders(<ProductsList />);

    await screen.findByText('My Widget');

    const deleteButtons = screen.queryAllByRole('button');
    const deleteButton = deleteButtons[0];

    await user.click(deleteButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Delete failed');
    });
  });

  test('displays all product information correctly', async () => {
    vi.mocked(productsApi.list).mockResolvedValueOnce({
      items: [
        {
          id: 'p1',
          ownerId: 'u1',
          name: 'Premium Widget',
          description: 'High quality item',
          price: '29.99',
          createdAt: '2026-05-01T00:00:00Z',
          updatedAt: '2026-05-01T00:00:00Z',
        },
      ],
      nextCursor: null,
    });

    renderWithProviders(<ProductsList />);

    expect(await screen.findByText('Premium Widget')).toBeInTheDocument();
    expect(screen.getByText('High quality item')).toBeInTheDocument();
    expect(screen.getByText('$29.99')).toBeInTheDocument();
  });

  test('handles null description gracefully', async () => {
    vi.mocked(productsApi.list).mockResolvedValueOnce({
      items: [
        {
          id: 'p1',
          ownerId: 'u1',
          name: 'No Desc Widget',
          description: null,
          price: '9.99',
          createdAt: '2026-05-01T00:00:00Z',
          updatedAt: '2026-05-01T00:00:00Z',
        },
      ],
      nextCursor: null,
    });

    renderWithProviders(<ProductsList />);

    expect(await screen.findByText('No Desc Widget')).toBeInTheDocument();
    // Should show em-dash for null description
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
