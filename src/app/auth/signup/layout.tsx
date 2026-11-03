import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign Up | Embroidery Platform',
  description: 'Create your embroidery business account',
}

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
