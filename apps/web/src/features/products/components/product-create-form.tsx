import { zodResolver } from '@hookform/resolvers/zod';
import { createProductBody, type CreateProductBody } from '@lambder/contracts';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { extractApiError } from '@/shared/lib/extract-error';
import { useCreateProduct } from '../hooks/use-products';

export function ProductCreateForm() {
  const create = useCreateProduct();
  const form = useForm<CreateProductBody>({
    resolver: zodResolver(createProductBody),
    defaultValues: { name: '', price: '', description: '' },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    const payload: CreateProductBody = {
      name: data.name,
      price: data.price,
      ...(data.description ? { description: data.description } : {}),
    };
    try {
      await create.mutateAsync(payload);
      toast.success(`Created "${data.name}"`);
      form.reset();
    } catch (err) {
      toast.error(extractApiError(err, 'Create failed'));
    }
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[1fr_140px_1fr_auto] items-start">
      <FormField label="Name" htmlFor="name" error={form.formState.errors.name?.message}>
        <Input id="name" {...form.register('name')} />
      </FormField>
      <FormField label="Price (USD)" htmlFor="price" error={form.formState.errors.price?.message}>
        <Input id="price" placeholder="9.99" {...form.register('price')} />
      </FormField>
      <FormField
        label="Description"
        htmlFor="description"
        error={form.formState.errors.description?.message}
      >
        <Input id="description" {...form.register('description')} />
      </FormField>
      <div className="sm:pt-7">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Adding…' : 'Add'}
        </Button>
      </div>
    </form>
  );
}
