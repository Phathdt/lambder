import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { SignupForm } from '@/features/auth/components/signup-form';
import { authApi } from '@/features/auth/api/auth-api';
import { renderWithProviders, screen, waitFor } from './test-utils';

vi.mock('@/features/auth/api/auth-api');
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('SignupForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('rejects weak password client-side (zod from @lambder/contracts)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignupForm />);
    await user.type(screen.getByLabelText(/email/i), 'a@b.com');
    await user.type(screen.getByLabelText(/password/i), 'short'); // <12 chars
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText(/at least 12/i)).toBeInTheDocument();
    expect(authApi.signup).not.toHaveBeenCalled();
  });

  test('rejects password missing required character classes', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignupForm />);
    await user.type(screen.getByLabelText(/email/i), 'a@b.com');
    // 12 chars, all lowercase — missing uppercase + digit + symbol.
    await user.type(screen.getByLabelText(/password/i), 'allsmallchar');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText(/uppercase letter/i)).toBeInTheDocument();
    expect(authApi.signup).not.toHaveBeenCalled();
  });

  test('shows error toast on signup failure', async () => {
    const { toast } = await import('sonner');
    vi.mocked(authApi.signup).mockRejectedValueOnce(
      new Error('Email already exists'),
    );

    const user = userEvent.setup();
    renderWithProviders(<SignupForm />);
    await user.type(screen.getByLabelText(/email/i), 'existing@b.com');
    await user.type(screen.getByLabelText(/password/i), 'StrongPass1!@');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(vi.mocked(toast).error).toHaveBeenCalledWith('Signup failed');
    });
  });
});
