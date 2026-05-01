import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { ProductCreateForm } from '@/features/products/components/product-create-form';
import { productsApi } from '@/features/products/api/products-api';
import { renderWithProviders, screen, waitFor } from './test-utils';

vi.mock('@/features/products/api/products-api');
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ProductCreateForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('shows validation errors when name is missing', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProductCreateForm />);

    // Try to submit without filling name
    await user.click(screen.getByRole('button', { name: /add/i }));

    // Should show validation error for required name field (min 1 char error)
    expect(await screen.findByText(/string must contain at least 1 character/i)).toBeInTheDocument();
    expect(vi.mocked(productsApi.create)).not.toHaveBeenCalled();
  });

  test('shows validation errors when price is invalid', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProductCreateForm />);

    await user.type(screen.getByLabelText(/name/i), 'Widget');
    await user.type(screen.getByLabelText(/price/i), 'invalid-price');
    await user.click(screen.getByRole('button', { name: /add/i }));

    expect(await screen.findByText(/Price must be a decimal/i)).toBeInTheDocument();
    expect(vi.mocked(productsApi.create)).not.toHaveBeenCalled();
  });

  test('successfully creates product and resets form on success', async () => {
    const { toast } = await import('sonner');
    vi.mocked(productsApi.create).mockResolvedValueOnce({
      id: 'p1',
      ownerId: 'u1',
      name: 'Widget',
      description: 'A cool widget',
      price: '9.99',
      createdAt: '2026-05-01T00:00:00Z',
      updatedAt: '2026-05-01T00:00:00Z',
    });

    const user = userEvent.setup();
    renderWithProviders(<ProductCreateForm />);

    await user.type(screen.getByLabelText(/name/i), 'Widget');
    await user.type(screen.getByLabelText(/price/i), '9.99');
    await user.type(screen.getByLabelText(/description/i), 'A cool widget');
    await user.click(screen.getByRole('button', { name: /add/i }));

    await waitFor(() => {
      expect(vi.mocked(productsApi.create)).toHaveBeenCalledWith({
        name: 'Widget',
        price: '9.99',
        description: 'A cool widget',
      });
    });

    // Check success toast and form reset
    expect(toast.success).toHaveBeenCalledWith('Created "Widget"');

    // Verify form was reset (input values are empty)
    expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText(/price/i) as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText(/description/i) as HTMLInputElement).value).toBe('');
  });

  test('shows error toast on create failure', async () => {
    const { toast } = await import('sonner');
    vi.mocked(productsApi.create).mockRejectedValueOnce({
      response: {
        data: {
          error: { message: 'Product name already exists' },
        },
      },
    });

    const user = userEvent.setup();
    renderWithProviders(<ProductCreateForm />);

    await user.type(screen.getByLabelText(/name/i), 'Widget');
    await user.type(screen.getByLabelText(/price/i), '9.99');
    await user.click(screen.getByRole('button', { name: /add/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Product name already exists');
    });
  });

  test('description is optional and not included in payload when empty', async () => {
    vi.mocked(productsApi.create).mockResolvedValueOnce({
      id: 'p1',
      ownerId: 'u1',
      name: 'Widget',
      description: null,
      price: '9.99',
      createdAt: '2026-05-01T00:00:00Z',
      updatedAt: '2026-05-01T00:00:00Z',
    });

    const user = userEvent.setup();
    renderWithProviders(<ProductCreateForm />);

    await user.type(screen.getByLabelText(/name/i), 'Widget');
    await user.type(screen.getByLabelText(/price/i), '9.99');
    await user.click(screen.getByRole('button', { name: /add/i }));

    await waitFor(() => {
      expect(vi.mocked(productsApi.create)).toHaveBeenCalledWith({
        name: 'Widget',
        price: '9.99',
      });
    });
  });

  test('button shows loading state while submitting', async () => {
    vi.mocked(productsApi.create).mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                id: 'p1',
                ownerId: 'u1',
                name: 'Widget',
                description: null,
                price: '9.99',
                createdAt: '2026-05-01T00:00:00Z',
                updatedAt: '2026-05-01T00:00:00Z',
              }),
            100,
          ),
        ),
    );

    const user = userEvent.setup();
    renderWithProviders(<ProductCreateForm />);

    await user.type(screen.getByLabelText(/name/i), 'Widget');
    await user.type(screen.getByLabelText(/price/i), '9.99');
    await user.click(screen.getByRole('button', { name: /add/i }));

    // Should show loading state
    expect(screen.getByRole('button', { name: /adding/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /adding/i })).toBeDisabled();

    // Wait for completion
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^add$/i })).toBeInTheDocument();
    });
  });
});
