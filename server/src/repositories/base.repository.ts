import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '../database/supabase.js';

export abstract class BaseRepository {
  protected get supabase(): SupabaseClient {
    return getSupabase();
  }
}
