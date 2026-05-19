import { motion } from 'framer-motion';
import { ShieldOff, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Unauthorized() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="text-center max-w-md"
      >
        <div className="w-24 h-24 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <ShieldOff size={48} className="text-error" />
        </div>
        <h1 className="font-heading text-navy text-4xl font-bold mb-3">Access Denied</h1>
        <p className="text-navy text-opacity-60 mb-8 leading-relaxed">
          You do not have permission to view this page. This area is restricted to your role.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="btn-primary mx-auto"
        >
          <ArrowLeft size={18} />
          Go Back
        </button>
      </motion.div>
    </div>
  );
}
