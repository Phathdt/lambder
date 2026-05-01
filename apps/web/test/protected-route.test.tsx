import { describe, expect, test } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/features/auth/components/protected-route';
import { renderWithProviders, screen } from './test-utils';

describe('ProtectedRoute', () => {
  test('redirects to /login when not authenticated', () => {
    renderWithProviders(
      <Routes>
        <Route path="/login" element={<div>login screen</div>} />
        <Route
          path="/products"
          element={
            <ProtectedRoute>
              <div>products screen</div>
            </ProtectedRoute>
          }
        />
      </Routes>,
      { route: '/products' },
    );
    expect(screen.getByText('login screen')).toBeInTheDocument();
  });

  test('renders children when an access token exists', () => {
    localStorage.setItem('lambder.accessToken', 'a.eyJzdWIiOiJ1MSJ9.s');
    localStorage.setItem('lambder.refreshToken', 'r.eyJzdWIiOiJ1MSJ9.s');
    renderWithProviders(
      <Routes>
        <Route path="/login" element={<div>login screen</div>} />
        <Route
          path="/products"
          element={
            <ProtectedRoute>
              <div>products screen</div>
            </ProtectedRoute>
          }
        />
      </Routes>,
      { route: '/products' },
    );
    expect(screen.getByText('products screen')).toBeInTheDocument();
  });
});
