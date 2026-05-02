
import psycopg2
from psycopg2.extras import RealDictCursor

conn_string = "postgresql://postgres.basvqricgupbxgznsfms:GOlZg5rNtbXDmuTW@aws-0-eu-north-1.pooler.supabase.com:5432/postgres"

def run_query(query, params=None):
    try:
        conn = psycopg2.connect(conn_string)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, params)
            if cur.description:
                return cur.fetchall()
            conn.commit()
            return None
    except Exception as e:
        return f"Error: {e}"
    finally:
        if 'conn' in locals() and conn:
            conn.close()

print("--- Last 5 Schools ---")
schools = run_query("SELECT id, name, email, updated_at FROM public.schools_school ORDER BY id DESC LIMIT 5;")
print(schools)

print("\n--- Last 5 Onboarding Logs ---")
logs = run_query("SELECT * FROM public.onboarding_logs ORDER BY id DESC LIMIT 5;")
print(logs)

print("\n--- Searching for 'tr@tr.com' ---")
specific_school = run_query("SELECT id, name, email, updated_at FROM public.schools_school WHERE email = %s;", ('tr@tr.com',))
print(specific_school)
