import { Link } from 'react-router-dom';
import { SignupForm } from '../components/signup-form';

export function SignupPage() {
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="w-full max-w-md space-y-4">
        <SignupForm />
        <p className="text-center text-sm text-muted-foreground">
          Already have one?{' '}
          <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
