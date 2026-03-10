import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';

export const VerifyPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const handleEmailVerification = async () => {
      try {
        const token = searchParams.get('token');
        const type = searchParams.get('type');

        console.log('Verification params:', { token, type });

        if (!token || type !== 'signup') {
          setError('Invalid verification link');
          setLoading(false);
          return;
        }

        // Verify the token with Supabase
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: 'email'
        });

        if (verifyError) {
          console.error('Verification error:', verifyError);
          setError(`Verification failed: ${verifyError.message}`);
          setLoading(false);
          return;
        }

        if (data.user && data.session) {
          setSuccess(true);
          console.log('User verified successfully:', data.user);
          
          // Wait a moment for the auth context to update
          setTimeout(() => {
            navigate('/dashboard');
          }, 2000);
        } else {
          setError('Verification completed but no session created. Please try logging in.');
          setLoading(false);
        }

      } catch (err) {
        console.error('Verification error:', err);
        setError('An unexpected error occurred during verification.');
        setLoading(false);
      }
    };

    // Only run verification if we have search params
    if (searchParams.get('token')) {
      handleEmailVerification();
    } else {
      // If no token, check if user is already logged in
      if (!authLoading) {
        if (user) {
          navigate('/');
        } else {
          setError('No verification token found');
          setLoading(false);
        }
      }
    }
  }, [searchParams, navigate, user, authLoading]);

  // Show loading while auth context is loading
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md w-full mx-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Verifying your email...
          </h2>
          <p className="text-gray-600">Please wait while we confirm your account.</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md w-full mx-4">
          <div className="text-green-600 text-6xl mb-4">✓</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Email Verified Successfully!
          </h1>
          <p className="text-gray-600 mb-4">
            Your account has been confirmed. Redirecting you to the dashboard...
          </p>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full animate-pulse w-full"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md w-full mx-4">
          <div className="text-red-600 text-6xl mb-4">✗</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Verification Failed
          </h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Go to Login
            </button>
            <button
              onClick={() => navigate('/signup')}
              className="w-full bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
            >
              Sign Up Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};