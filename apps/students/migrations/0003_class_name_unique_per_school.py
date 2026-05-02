from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('students', '0002_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='class',
            name='name',
            field=models.CharField(max_length=50),
        ),
        migrations.AddConstraint(
            model_name='class',
            constraint=models.UniqueConstraint(fields=('school', 'name'), name='classes_school_name_unique'),
        ),
    ]