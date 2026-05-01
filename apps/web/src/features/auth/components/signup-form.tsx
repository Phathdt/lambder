import { zodResolver } from '@hookform/resolvers/zod';
import { signupBody, type SignupBody } from '@lambder/contracts';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { extractApiError } from '@/shared/lib/extract-error';
import { useAuth } from '../hooks/use-auth';

export function SignupForm() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const form = useForm<SignupBody>({
    resolver: zodResolver(signupBody),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = form.handleSubmit(async ({ email, password }) => {
    try {
      await signup(email, password);
      toast.success('Account created');
      navigate('/products');
    } catch (err) {
      toast.error(extractApiError(err, 'Signup failed'));
    }
  });

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Create account</CardTitle>
        <CardDescription>≥12 chars with uppercase, digit, and symbol</CardDescription>
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
              autoComplete="new-password"
              {...form.register('password')}
            />
          </FormField>
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Creating…' : 'Create account'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
