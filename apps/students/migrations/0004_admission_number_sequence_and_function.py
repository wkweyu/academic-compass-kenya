from django.db import migrations

class Migration(migrations.Migration):
    dependencies = [
        ("students", "0003_class_name_unique_per_school"),
    ]

    operations = [
        migrations.RunSQL(
            open("supabase/migrations/20260515010000_admission_number_sequence_and_format.sql").read(),
            reverse_sql="""
            DROP FUNCTION IF EXISTS public.generate_admission_number CASCADE;
            DROP SEQUENCE IF EXISTS public.admission_number_seq CASCADE;
            ALTER TABLE public.students DROP COLUMN IF EXISTS admission_numeric;
            DROP INDEX IF EXISTS idx_students_admission_numeric;
            """
        ),
    ]
