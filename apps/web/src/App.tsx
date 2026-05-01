import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './features/auth/components/protected-route';
import { LoginPage } from './features/auth/pages/login-page';
import { SignupPage } from './features/auth/pages/signup-page';
import { ProductsPage } from './features/products/pages/products-page';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/products" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route
        path="/products"
        element={
          <ProtectedRoute>
            <ProductsPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
