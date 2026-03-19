from django.db import migrations, models


def _get_column_names(schema_editor, table_name):
    with schema_editor.connection.cursor() as cursor:
        return {
            column.name
            for column in schema_editor.connection.introspection.get_table_description(cursor, table_name)
        }


def add_auth_user_id_column(apps, schema_editor):
    User = apps.get_model('users', 'User')
    table_name = User._meta.db_table
    column_names = _get_column_names(schema_editor, table_name)

    if 'auth_user_id' not in column_names:
        field = models.UUIDField(blank=True, null=True)
        field.set_attributes_from_name('auth_user_id')
        schema_editor.add_field(User, field)

    schema_editor.execute(
        'CREATE UNIQUE INDEX IF NOT EXISTS users_auth_user_id_uniq ON users (auth_user_id)'
    )


def remove_auth_user_id_column(apps, schema_editor):
    User = apps.get_model('users', 'User')
    table_name = User._meta.db_table
    column_names = _get_column_names(schema_editor, table_name)

    schema_editor.execute('DROP INDEX IF EXISTS users_auth_user_id_uniq')

    if 'auth_user_id' in column_names:
        field = models.UUIDField(blank=True, null=True)
        field.set_attributes_from_name('auth_user_id')
        schema_editor.remove_field(User, field)


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0004_user_notification_preferences'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(add_auth_user_id_column, remove_auth_user_id_column),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='user',
                    name='auth_user_id',
                    field=models.UUIDField(blank=True, null=True, unique=True),
                ),
            ],
        ),
    ]