import { zodResolver } from '@hookform/resolvers/zod';
import { loginBody, type LoginBody } from '@lambder/contracts';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { extractApiError } from '@/shared/lib/extract-error';
import { useAuth } from '../hooks/use-auth';

export function LoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const form = useForm<LoginBody>({
    resolver: zodResolver(loginBody),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = form.handleSubmit(async ({ email, password }) => {
    try {
      await login(email, password);
      toast.success('Logged in');
      navigate('/products');
    } catch (err) {
      toast.error(extractApiError(err, 'Login failed'));
    }
  });

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Log in</CardTitle>
        <CardDescription>Use your Lambder account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField label="Email" htmlFor="email" error={form.formState.errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
          </FormField>
          <FormField
            label="Password"
            htmlFor="password"
            error={form.formState.errors.password?.message}
          >
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...form.register('password')}
            />
          </FormField>
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Logging in…' : 'Log in'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
