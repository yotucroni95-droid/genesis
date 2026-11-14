// Public configuration. Never put secrets here: this file is published.
// The Supabase "anon" key is designed to be public; security comes from
// Row Level Security in supabase/migrations.

export const CONFIG = {
  version: '0.1.0',
  supabaseUrl: '',      // filled in Phase 2
  supabaseAnonKey: '',  // filled in Phase 2
  emailDomain: 'genesis.local',
  // Logical size of the screen's shorter side (~7 tiles of 32 px).
  // Works with the phone upright or lying down.
  viewShortSide: 224,
  tileSize: 32,
};
