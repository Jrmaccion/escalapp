// app/auth/register/page.tsx
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import RegisterForm from './RegisterForm';

export default async function RegisterPage() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect(session.user.isAdmin ? '/admin' : '/dashboard');
  }

  return <RegisterForm />;
}