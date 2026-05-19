import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, LogIn, AlertCircle, Loader2, Building2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const FloatingOrb = ({ style }) => (
  <motion.div
    style={style}
    animate={{ y: [0, -20, 0], opacity: [0.4, 0.7, 0.4] }}
    transition={{ duration: 6 + Math.random() * 4, repeat: Infinity, ease: 'easeInOut' }}
    className="absolute rounded-full blur-3xl pointer-events-none"
  />
);

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || null;

  const [role, setRole] = useState('hr');
  const [form, setForm] = useState({ companyEmail: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const user = await login(form.companyEmail, form.password);
      const dest = from || (user.role === 'hr' ? '/hr/dashboard' : '/employee/dashboard');
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials.');
      setShake(true);
      setTimeout(() => setShake(false), 600);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy relative overflow-hidden flex items-center justify-center p-4">

      {/* Background orbs */}
      <FloatingOrb style={{ width: 400, height: 400, background: 'rgba(201,168,76,0.12)', top: -100, right: -100 }} />
      <FloatingOrb style={{ width: 300, height: 300, background: 'rgba(26,47,94,0.6)', bottom: -50, left: -50 }} />
      <FloatingOrb style={{ width: 200, height: 200, background: 'rgba(201,168,76,0.08)', top: '60%', right: '20%' }} />

      {/* Gold geometric accent */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gold to-transparent opacity-40" />
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gold to-transparent opacity-20" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md relative z-10"
      >
        {/* Card */}
        <motion.div
          animate={shake ? { x: [-8, 8, -8, 8, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="bg-white bg-opacity-5 backdrop-blur-xl border border-white border-opacity-10 rounded-3xl p-8 shadow-2xl"
        >
          {/* Logo */}
          <div className="text-center mb-8">
            <motion.div
              whileHover={{ scale: 1.05, rotate: 5 }}
              className="w-20 h-20 bg-gradient-to-br from-gold to-gold-light rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-gold"
            >
              <span className="font-heading font-bold text-navy text-4xl">T</span>
            </motion.div>
            <h1 className="font-heading text-white text-3xl font-bold mb-1">Teuly Connect</h1>
            <p className="text-white text-opacity-50 text-sm tracking-wide">Internal Employee Portal</p>
          </div>

          {/* Role Toggle */}
          <div className="bg-white bg-opacity-5 rounded-2xl p-1 flex mb-8 border border-white border-opacity-10">
            {[
              { key: 'hr',       label: '👔 HR',       desc: 'Human Resources' },
              { key: 'employee', label: '👤 Employee',  desc: 'Staff Member' },
            ].map(({ key, label, desc }) => (
              <button
                key={key}
                onClick={() => { setRole(key); setError(''); }}
                className="flex-1 relative py-3 rounded-xl text-sm font-semibold transition-all duration-300"
              >
                {role === key && (
                  <motion.div
                    layoutId="roleTab"
                    className="absolute inset-0 bg-gold rounded-xl"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className={`relative z-10 transition-colors duration-200 ${role === key ? 'text-navy' : 'text-white text-opacity-60'}`}>
                  {label}
                </span>
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-white text-opacity-60 text-xs font-semibold uppercase tracking-wider mb-2">
                Company Email
              </label>
              <input
                name="companyEmail"
                type="email"
                value={form.companyEmail}
                onChange={handleChange}
                placeholder={role === 'hr' ? 'hr@teulyitsolutions.com' : 'employee@teulyitsolutions.com'}
                required
                autoComplete="email"
                className="w-full bg-white bg-opacity-5 border border-white border-opacity-15 rounded-xl px-4 py-3.5
                           text-white placeholder-white placeholder-opacity-30 text-sm
                           focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold focus:ring-opacity-25
                           transition-all duration-200"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-white text-opacity-60 text-xs font-semibold uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  className="w-full bg-white bg-opacity-5 border border-white border-opacity-15 rounded-xl px-4 py-3.5 pr-12
                             text-white placeholder-white placeholder-opacity-30 text-sm
                             focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold focus:ring-opacity-25
                             transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-opacity-40 hover:text-opacity-80 transition-opacity"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="flex items-center gap-2 bg-red-500 bg-opacity-15 border border-red-400 border-opacity-30 rounded-xl px-4 py-3"
                >
                  <AlertCircle size={16} className="text-error flex-shrink-0" />
                  <p className="text-error text-sm font-medium">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              className="w-full bg-gold text-navy font-bold py-4 rounded-xl text-sm tracking-wide
                         hover:bg-gold-light transition-all duration-200 shadow-gold
                         disabled:opacity-60 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Signing In...
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  Sign In to Teuly Connect
                </>
              )}
            </motion.button>
          </form>
        </motion.div>

        {/* Footer */}
        <div className="text-center mt-6 space-y-2">
          <a
            href="/"
            className="flex items-center justify-center gap-2 text-white text-opacity-40 hover:text-opacity-70 text-sm transition-colors"
          >
            <Building2 size={14} />
            Back to Teuly IT Solutions
          </a>
          <p className="text-white text-opacity-20 text-xs">
            Teuly Connect © {new Date().getFullYear()} · Teuly IT Solutions Pvt. Ltd.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
