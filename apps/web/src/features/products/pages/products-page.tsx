import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { ProductCreateForm } from '../components/product-create-form';
import { ProductsList } from '../components/products-list';

export function ProductsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Products</h1>
          <p className="text-sm text-muted-foreground">
            Signed in as <code className="text-xs">{user?.id.slice(0, 8)}…</code>
          </p>
        </div>
        <Button
          variant="outline"
          onClick={async () => {
            await logout();
            navigate('/login');
          }}
        >
          <LogOut /> Sign out
        </Button>
      </header>
      <section className="rounded-lg border bg-card p-4">
        <ProductCreateForm />
      </section>
      <section>
        <ProductsList />
      </section>
    </div>
  );
}
