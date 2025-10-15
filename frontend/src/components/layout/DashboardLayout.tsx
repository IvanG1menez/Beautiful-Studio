'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { Skeleton } from '@/components/ui/skeleton';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="pt-16">
          <div className="flex">
            {/* Sidebar skeleton */}
            <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:pt-16 lg:bg-white lg:border-r lg:border-gray-200">
              <div className="flex-1 flex flex-col overflow-y-auto">
                <div className="p-4 space-y-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              </div>
            </div>
            
            {/* Main content skeleton */}
            <div className="lg:pl-64 flex flex-col flex-1">
              <main className="flex-1">
                <div className="py-6">
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="space-y-6">
                      <Skeleton className="h-8 w-48" />
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <Skeleton key={i} className="h-32 w-full" />
                        ))}
                      </div>
                      <Skeleton className="h-64 w-full" />
                    </div>
                  </div>
                </div>
              </main>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="pt-16">
        <div className="flex">
          {/* Sidebar */}
          <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:pt-16 lg:bg-white lg:border-r lg:border-gray-200">
            <div className="flex-1 flex flex-col overflow-y-auto">
              <Sidebar />
            </div>
          </div>
          
          {/* Main content */}
          <div className="lg:pl-64 flex flex-col flex-1">
            <main className="flex-1">
              {children}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}