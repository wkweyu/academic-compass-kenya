import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://basvqricgupbxgznsfms.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhc3ZxcmljZ3VwYnhnem5zZm1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwMzc2NzAsImV4cCI6MjA2OTYxMzY3MH0.NMw_FM-eJUHTg1t7xWtjbiYQtQ-iscj3oq_HxXQHWsY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
