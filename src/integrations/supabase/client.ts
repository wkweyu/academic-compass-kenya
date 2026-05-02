import { createClient } from '@supabase/supabase-js'

const DEFAULT_SUPABASE_URL = 'https://basvqricgupbxgznsfms.supabase.co'
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhc3ZxcmljZ3VwYnhnem5zZm1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwMzc2NzAsImV4cCI6MjA2OTYxMzY3MH0.NMw_FM-eJUHTg1t7xWtjbiYQtQ-iscj3oq_HxXQHWsY'

function resolveSupabaseUrl() {
	const configuredUrl = import.meta.env.VITE_SUPABASE_URL?.trim()

	if (!configuredUrl) {
		return DEFAULT_SUPABASE_URL
	}

	try {
		const parsedUrl = new URL(configuredUrl)

		if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
			return parsedUrl.toString().replace(/\/+$/, '')
		}
	} catch {
	}

	console.warn('Invalid VITE_SUPABASE_URL provided. Falling back to default Supabase URL.')
	return DEFAULT_SUPABASE_URL
}

const supabaseUrl = resolveSupabaseUrl()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || DEFAULT_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
