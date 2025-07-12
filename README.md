
# CBC Student Exam Management System

A comprehensive Django-based web application for managing CBC (Competency-Based Curriculum) student records, exams, and academic performance.

## Features

### 🎓 Student Management
- Complete student registration with photo upload
- Auto-generated admission numbers (YYYY-NNNN format)
- Personal, academic, and guardian information tracking
- Flexible search by name, admission number, or guardian
- Student photo management
- Transfer and promotion history tracking

### 👨‍🏫 Teacher Management
- Teacher registration with TSC number validation
- Contact information and employment history
- Subject and class assignments
- Years of service tracking

### 📚 Academic Management
- Class and stream organization
- Subject management with grade level specifications
- Exam creation and management
- Score entry and grade calculation
- Student performance tracking

### 📊 Transfer & Promotion System
- Individual student transfers between classes/streams
- Batch promotion functionality
- Complete history tracking
- AJAX-powered dynamic stream loading

### 💯 Grading System
- Exam score entry and management
- Automatic grade calculation (A-E scale)
- Student report generation
- Performance analytics

## Technology Stack

- **Backend**: Django 5.2+, Python 3.13+
- **Database**: PostgreSQL
- **Frontend**: Django Templates + jQuery + Tailwind CSS
- **Authentication**: Django Allauth + DJ-REST-Auth
- **Import/Export**: django-import-export
- **Image Processing**: Pillow

## Installation & Setup

### Prerequisites
- Python 3.13+
- PostgreSQL
- Node.js (for frontend dependencies)

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd cbc_system
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Environment Configuration**
   Create a `.env` file in the project root:
   ```env
   SECRET_KEY=your-secret-key-here
   DEBUG=True
   DB_NAME=cbc_system
   DB_USER=postgres
   DB_PASSWORD=your-password
   DB_HOST=localhost
   DB_PORT=5432
   ALLOWED_HOSTS=localhost,127.0.0.1
   ```

5. **Database Setup**
   ```bash
   # Create PostgreSQL database
   createdb cbc_system
   
   # Run migrations
   python manage.py makemigrations
   python manage.py migrate
   ```

6. **Create Superuser**
   ```bash
   python manage.py createsuperuser
   ```

7. **Load Sample Data (Optional)**
   ```bash
   python manage.py loaddata fixtures/sample_data.json
   ```

8. **Run Development Server**
   ```bash
   python manage.py runserver
   ```

9. **Access the Application**
   - Main Application: http://127.0.0.1:8000/
   - Django Admin: http://127.0.0.1:8000/admin/

## Project Structure

```
cbc_system/
├── cbc_system/          # Main project settings
├── users/               # Custom user management
├── students/            # Student management app
├── teachers/            # Teacher management app
├── subjects/            # Subject management app
├── exams/              # Exam management app
├── grading/            # Grading and reports app
├── templates/          # HTML templates
├── static/             # Static files (CSS, JS, images)
├── media/              # User uploaded files
├── requirements.txt    # Python dependencies
└── manage.py          # Django management script
```

## Key Features Usage

### Student Registration
1. Navigate to Students → Add New Student
2. Fill in personal, academic, and guardian information
3. Upload student photo (optional)
4. System auto-generates admission number
5. Assign to class and stream

### Student Transfers
1. Go to Students → Transfer Student
2. Select student and target class/stream
3. AJAX automatically loads available streams
4. Add reason for transfer
5. System updates student record and logs history

### Batch Promotions
1. Navigate to Students → Batch Promotion
2. Select source class and stream
3. Choose target class and stream
4. Confirm promotion for all students
5. System updates all student records simultaneously

### Exam Management
1. Create subjects in Subjects section
2. Set up exams with term, class, and subject
3. Enter student scores in Grading section
4. System automatically calculates grades
5. Generate student reports

## Admin Interface

The Django admin interface provides comprehensive management capabilities:

- **User Management**: Manage system users and permissions
- **Student Records**: Complete CRUD operations with import/export
- **Teacher Records**: TSC number validation and assignment tracking
- **Academic Setup**: Classes, streams, subjects, and exams
- **Grading System**: Score entry and report generation
- **Import/Export**: CSV import/export for bulk operations

## Security Features

- User authentication and authorization
- Role-based access control (Admin, Teacher, Staff)
- CSRF protection
- Secure file uploads
- Input validation and sanitization
- Password strength requirements

## API Endpoints

- Student stream loading: `/students/api/streams/<class_id>/`
- Authentication endpoints via DJ-REST-Auth
- RESTful API for mobile app integration (future)

## Customization

### Adding New Fields
1. Update model in respective app
2. Create and run migrations
3. Update forms and templates
4. Add to admin interface

### Styling Changes
- Modify `templates/base.html` for global changes
- Update Tailwind classes in templates
- Add custom CSS in the `<style>` section

### Business Logic
- Extend models with custom methods
- Add validation in forms
- Create custom management commands

## Testing

```bash
# Run all tests
python manage.py test

# Run specific app tests
python manage.py test students

# Generate coverage report
coverage run --source='.' manage.py test
coverage html
```

## Deployment

### Production Settings
1. Set `DEBUG=False` in environment
2. Configure proper database settings
3. Set up static file serving
4. Configure email backend
5. Set up backup procedures

### Docker Deployment (Optional)
```dockerfile
# Dockerfile example
FROM python:3.13-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
```

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/new-feature`)
3. Commit changes (`git commit -am 'Add new feature'`)
4. Push to branch (`git push origin feature/new-feature`)
5. Create Pull Request

## Support

For technical support or feature requests:
- Create an issue on GitHub
- Contact the development team
- Check documentation wiki

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Changelog

### Version 1.0.0
- Initial release with core functionality
- Student and teacher management
- Exam and grading system
- Transfer and promotion features
- Django admin integration
- Import/export capabilities

---

**CBC Student Exam Management System** - Streamlining educational administration for the modern era.
