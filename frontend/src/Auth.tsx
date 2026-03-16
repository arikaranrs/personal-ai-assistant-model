import { useState } from 'react';
import { supabase } from './supabaseClient';
import { Scale, Mail, Lock, Loader2, ArrowRight } from 'lucide-react';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage({ text: 'Registration successful! Please check your email for the verification link.', type: 'success' });
        
      } else if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        setMessage({ text: 'Password reset instructions have been sent to your email.', type: 'success' });
      }
    } catch (error: any) {
      setMessage({ text: error.message || 'An error occurred during authentication.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background flex flex-col justify-center items-center p-4 font-body">
      
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-gold/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-navy/5 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        
        {/* Logo Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-navy text-gold rounded-2xl flex items-center justify-center shadow-lg mb-4">
             <Scale size={32} />
          </div>
          <h1 className="text-3xl font-display font-medium text-navy text-center">Legal Assistant AI</h1>
          <p className="text-muted-foreground text-sm mt-2 text-center">
            {mode === 'signin' && 'Sign in to access your secure legal guidance'}
            {mode === 'signup' && 'Create your account for personalized legal help'}
            {mode === 'forgot' && 'Reset your password securely'}
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
          
          <div className="p-8">
            <form onSubmit={handleAuth} className="space-y-5">
              
              {message && (
                <div className={`p-3 rounded-lg text-sm border ${
                  message.type === 'error' 
                    ? 'bg-destructive/10 text-destructive border-destructive/20' 
                    : 'bg-green-500/10 text-green-600 border-green-500/20'
                  }`}
                >
                  {message.text}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail size={16} className="text-muted-foreground" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors text-sm"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              {mode !== 'forgot' && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">Password</label>
                    {mode === 'signin' && (
                      <button 
                        type="button" 
                        onClick={() => { setMode('forgot'); setMessage(null); }}
                        className="text-xs text-gold hover:text-gold-light transition-colors"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock size={16} className="text-muted-foreground" />
                    </div>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors text-sm"
                      placeholder="••••••••"
                      minLength={6}
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-navy hover:bg-navy-light text-white py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-70 mt-4"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                {mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
                {!loading && <ArrowRight size={16} />}
              </button>
            </form>
          </div>

          {/* Footer Tabs / Toggle */}
          <div className="bg-muted px-8 py-4 border-t border-border flex justify-center text-sm">
            {mode === 'signin' ? (
              <span className="text-muted-foreground">
                Don't have an account? <button type="button" onClick={() => { setMode('signup'); setMessage(null); }} className="text-navy font-medium hover:underline">Sign up</button>
              </span>
            ) : (
              <span className="text-muted-foreground">
                Already have an account? <button type="button" onClick={() => { setMode('signin'); setMessage(null); }} className="text-navy font-medium hover:underline">Sign in</button>
              </span>
            )}
          </div>
          
        </div>

        {/* Legal Disclaimer */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          By signing in, you agree that this AI provides guidance only and does not replace professional legal representation.
        </p>

      </div>
    </div>
  );
}
