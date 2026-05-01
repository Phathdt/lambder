import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { LoginForm } from '@/features/auth/components/login-form';
import { authApi } from '@/features/auth/api/auth-api';
import { renderWithProviders, screen, waitFor } from '@/__test-utils__/test-utils';

vi.mock('@/features/auth/api/auth-api');
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('shows zod errors when fields are empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);
    await user.click(screen.getByRole('button', { name: /^log in$/i }));
    expect(await screen.findAllByText(/email|invalid/i)).not.toHaveLength(0);
    expect(authApi.login).not.toHaveBeenCalled();
  });

  test('submits and routes to /products on success', async () => {
    vi.mocked(authApi.login).mockResolvedValueOnce({
      // sub = "u1" → header.payload.sig (payload base64-encoded JSON below)
      accessToken: 'a.eyJzdWIiOiJ1MSJ9.s',
      refreshToken: 'r.eyJzdWIiOiJ1MSJ9.s',
      expiresIn: 60,
    });
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);
    await user.type(screen.getByLabelText(/email/i), 'a@b.com');
    await user.type(screen.getByLabelText(/password/i), 'StrongPass1!@');
    await user.click(screen.getByRole('button', { name: /^log in$/i }));

    await waitFor(() =>
      expect(authApi.login).toHaveBeenCalledWith({ email: 'a@b.com', password: 'StrongPass1!@' }),
    );
  });

  test('shows error toast on login failure', async () => {
    const { toast } = await import('sonner');
    vi.mocked(authApi.login).mockRejectedValueOnce(
      new Error('Invalid credentials'),
    );

    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);
    await user.type(screen.getByLabelText(/email/i), 'a@b.com');
    await user.type(screen.getByLabelText(/password/i), 'WrongPassword');
    await user.click(screen.getByRole('button', { name: /^log in$/i }));

    await waitFor(() => {
      expect(vi.mocked(toast).error).toHaveBeenCalledWith('Login failed');
    });
  });
});
