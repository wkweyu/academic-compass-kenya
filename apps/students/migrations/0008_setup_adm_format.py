# apps/students/migrations/0008_setup_adm_format.py
from django.db import migrations, models
from django.db.models.expressions import RawSQL

class Migration(migrations.Migration):
    dependencies = [
        ('students', '0004_alter_stream_year_alter_student_admission_year'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            -- Create sequence if not exists
            CREATE SEQUENCE IF NOT EXISTS public.admission_number_seq
                START WITH 16
                INCREMENT BY 1
                MINVALUE 1
                MAXVALUE 999999
                CACHE 1;
            
            -- Create function
            CREATE OR REPLACE FUNCTION public.generate_admission_number()
            RETURNS text
            LANGUAGE plpgsql
            AS $$
            BEGIN
                RETURN 'ADM/' || LPAD(nextval('public.admission_number_seq')::text, 4, '0');
            END;
            $$;
            
            -- Set default for admission_number column
            ALTER TABLE public.students 
                ALTER COLUMN admission_number 
                SET DEFAULT public.generate_admission_number();
            """,
            reverse_sql="""
            ALTER TABLE public.students ALTER COLUMN admission_number DROP DEFAULT;
            DROP FUNCTION IF EXISTS public.generate_admission_number() CASCADE;
            DROP SEQUENCE IF EXISTS public.admission_number_seq CASCADE;
            """
        ),
        migrations.AlterField(
            model_name='student',
            name='admission_number',
            field=models.CharField(
                db_default=RawSQL("public.generate_admission_number()", []),
                editable=False,
                max_length=20,
                unique=True,
                verbose_name='Admission Number',
                help_text='Format: ADM/0001, ADM/0002, etc.',
            ),
        ),
    ]