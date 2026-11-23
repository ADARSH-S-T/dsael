import express from 'express';
import { localDb, supabase, isSupabaseConfigured } from '../config/supabase.js';

const router = express.Router();

/**
 * AUTHENTICATION & ROLE MANAGEMENT
 */

// Mock authentication for development & demo testing
router.post('/login', async (req, res) => {
  const { email, role } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, error: 'Email is required' });
  }

  let profile = null;

  if (isSupabaseConfigured && supabase) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .single();
    profile = data;
  } else {
    profile = localDb.get('profiles').find(p => p.email.toLowerCase() === email.toLowerCase().trim());
  }

  // If user role was specified and profile doesn't exist yet, auto-create for seamless test
  if (!profile) {
    const newProfile = {
      id: crypto.randomUUID(),
      full_name: role === 'admin' ? 'System Administrator' : 'Laboratory Technician',
      email: email.toLowerCase().trim(),
      phone: '+91 98765 00000',
      role: role || 'staff',
      is_active: true,
      created_at: new Date().toISOString()
    };
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.from('profiles').insert([newProfile]).select().single();
      profile = data || newProfile;
    } else {
      profile = localDb.insert('profiles', newProfile);
    }
  }

  if (!profile.is_active) {
    return res.status(403).json({ success: false, error: 'User account is deactivated. Contact administrator.' });
  }

  return res.json({
    success: true,
    message: 'Login successful',
    user: profile,
    token: `labflow_token_${profile.id}`
  });
});

router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    // Default to admin for convenient evaluation
    const admin = localDb.get('profiles').find(p => p.role === 'admin');
    return res.json({ success: true, user: admin });
  }
  const userId = authHeader.replace('Bearer labflow_token_', '');
  const profile = localDb.get('profiles').find(p => p.id === userId);
  return res.json({ success: true, user: profile || null });
});

router.get('/staff-users', async (req, res) => {
  const staff = localDb.get('profiles').filter(p => p.role === 'staff');
  res.json({ success: true, staff });
});

export default router;
