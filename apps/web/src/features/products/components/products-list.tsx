import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useDeleteProduct, useProducts } from '../hooks/use-products';

export function ProductsList() {
  const { user } = useAuth();
  const { data, isLoading, error } = useProducts(50);
  const remove = useDeleteProduct();

  if (isLoading) return <p className="text-muted-foreground text-sm">Loading…</p>;
  if (error) return <p className="text-destructive text-sm">Failed to load products</p>;
  if (!data || data.items.length === 0) {
    return <p className="text-muted-foreground text-sm">No products yet — add one above.</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {data.items.map((p) => {
        const isOwner = user?.id === p.ownerId;
        return (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle>{p.name}</CardTitle>
              <CardDescription>{p.description ?? '—'}</CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-semibold">${p.price}</span>
            </CardContent>
            <CardFooter className="justify-between text-xs text-muted-foreground">
              <span>owner: {p.ownerId.slice(0, 8)}…</span>
              {isOwner ? (
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={remove.isPending}
                  onClick={async () => {
                    try {
                      await remove.mutateAsync(p.id);
                      toast.success('Deleted');
                    } catch {
                      toast.error('Delete failed');
                    }
                  }}
                  aria-label="Delete"
                >
                  <Trash2 />
                </Button>
              ) : null}
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
