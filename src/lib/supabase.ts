import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// App IDs for our non-profit applications
export const APP_IDS = {
  QR_CODE_GENERATOR: 'qr-gen-v1'
} as const;

// Validate Supabase URL and key
if (!supabaseUrl?.startsWith('https://')) {
  console.error('Invalid or missing Supabase URL. Please check your environment variables.');
  throw new Error('Invalid or missing Supabase URL');
}

if (!supabaseAnonKey) {
  console.error('Missing Supabase anonymous key. Please check your environment variables.');
  throw new Error('Missing Supabase anonymous key');
}

// Initialize Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Type definitions
export interface User {
  id?: string;
  email: string;
  name: string;
  organization?: string;
  ein?: string;
  app_ids?: string[];
  created_at?: string;
}

export interface QRCode {
  id?: string;
  user_id: string;
  url: string;
  org_description: string;
  url_purpose: string;
  qr_color: string;
  bg_color: string;
  size: number;
  has_logo: boolean;
  created_at?: string;
}

export interface Visit {
  id?: string;
  user_id: string;
  app_id: string;
  visit_count: number;
  last_visit: string;
  created_at?: string;
}

export const updateVisit = async (userId: string, appId: string) => {
  if (!userId || !appId) {
    console.warn('Skipping visit update - missing required parameters');
    return null;
  }

  try {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('visits')
      .upsert(
        {
          user_id: userId,
          app_id: appId,
          visit_count: 1,
          last_visit: now
        },
        {
          onConflict: 'user_id,app_id'
        }
      )
      .select(`*, visit_count := COALESCE(visits.visit_count, 0) + 1`)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.warn('Visit tracking failed:', error);
    return null;  // Don't throw error, just return null
  }
};

export const saveUser = async (userData: Omit<User, 'id' | 'created_at' | 'app_ids'>) => {
  try {
    // Prepare user data by ensuring optional fields are undefined if empty
    const cleanUserData = {
      email: userData.email,
      name: userData.name,
      organization: userData.organization || undefined,  // Convert empty string to undefined
      ein: userData.ein || undefined,  // Convert empty string to undefined
    };

    // Check for existing user
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', cleanUserData.email)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (existingUser) {
      // If user exists but doesn't have QR_CODE_GENERATOR in app_ids, add it
      const updatedAppIds = [...(existingUser.app_ids || [])];
      if (!updatedAppIds.includes(APP_IDS.QR_CODE_GENERATOR)) {
        updatedAppIds.push(APP_IDS.QR_CODE_GENERATOR);
        
        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .update({
            app_ids: updatedAppIds,
            // Only update fields that have values
            ...(cleanUserData.name && { name: cleanUserData.name }),
            ...(cleanUserData.organization && { organization: cleanUserData.organization }),
            ...(cleanUserData.ein && { ein: cleanUserData.ein })
          })
          .eq('id', existingUser.id)
          .select()
          .single();

        if (updateError) throw updateError;
        return updatedUser;
      }
      return existingUser;
    }

    // Create new user with QR_CODE_GENERATOR app_id
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([{
        ...cleanUserData,
        app_ids: [APP_IDS.QR_CODE_GENERATOR]
      }])
      .select()
      .single();

    if (insertError) throw insertError;
    
    // Only update visit count after successful user creation/update
    if (newUser?.id) {
      try {
        await updateVisit(newUser.id, APP_IDS.QR_CODE_GENERATOR);
      } catch (visitError) {
        console.error('Visit tracking failed but user was saved:', visitError);
      }
    }

    return newUser;
  } catch (error) {
    console.error('Error in saveUser:', error);
    throw error;
  }
};

export const saveQRCode = async (qrData: Omit<QRCode, 'id' | 'created_at'>) => {
  try {
    console.log('Attempting to save QR code with data:', qrData);

    const { data, error } = await supabase
      .from('qr_codes')
      .insert([qrData])
      .select()
      .single();

    if (error) {
      console.error('Database error saving QR code:', error);
      throw error;
    }

    console.log('Successfully saved QR code:', data);
    return data;
  } catch (error) {
    console.error('Error saving QR code:', error);
    throw error;
  }
};