# CBC Student Exam Management System

A comprehensive web application for managing CBC (Competency-Based Curriculum) student records, exams, and academic performance, built with a Django backend and a React frontend.

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

- **Backend**: Django 5.2+, Python 3.13+, Django REST Framework
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Database**: PostgreSQL
- **Authentication**: Django Allauth + DJ-REST-Auth + SimpleJWT
- **Import/Export**: django-import-export
- **Image Processing**: Pillow

## Installation & Setup

### Prerequisites

- Python 3.13+
- PostgreSQL
- Node.js & npm

### Local Development Setup

1.  **Clone the repository**

    ```bash
    git clone <repository-url>
    cd skooltrack_pro
    ```

2.  **Setup Backend**
    - Create and activate a virtual environment:
      ```bash
      python -m venv venv
      source venv/bin/activate  # On Windows: venv\Scripts\activate
      ```
    - Install Python dependencies:
      ```bash
      pip install -r requirements.txt
      ```

3.  **Setup Frontend**
    - Install Node.js dependencies:
      ```bash
      npm install
      ```

4.  **Environment Configuration**
    - Create a `.env` file in the project root by copying the `.env.example` if it exists, or create a new one:
      ```env
      SECRET_KEY=your-secret-key-here
      DEBUG=True
      DB_NAME=skooltrack_pro
      DB_USER=postgres
      DB_PASSWORD=your-password
      DB_HOST=localhost
      DB_PORT=5432
      ALLOWED_HOSTS=localhost,127.0.0.1
      ```

5.  **Database Setup**
    - Ensure your PostgreSQL server is running.
    - Create the database:
      ```bash
      createdb skooltrack_pro
      ```
    - Run Django migrations:
      ```bash
      python manage.py migrate
      ```

6.  **Create Superuser**
    - Create an admin user to access the Django admin panel:
      ```bash
      python manage.py createsuperuser
      ```

## Running the Application

To run the application, you need to start both the backend and frontend development servers in separate terminals.

**Terminal 1: Start the Backend (Django)**

```bash
python manage.py runserver
```
The Django API server will be running at `http://127.0.0.1:8000/`.

**Terminal 2: Start the Frontend (React)**

```bash
npm run dev
```
The React frontend will be running at `http://localhost:8080/`.

You can now access the application by opening `http://localhost:8080/` in your browser.

## Project Structure

```
skooltrack_pro/
├── apps/                  # Core Django applications
│   ├── students/
│   ├── exams/
│   └── ...
├── skooltrack_pro/        # Main project settings
├── src/                   # React frontend source
│   ├── components/
│   ├── pages/
│   ├── services/
│   └── ...
├── templates/             # Legacy HTML templates
├── static/                # Static files (CSS, JS, images)
├── media/                 # User uploaded files
├── requirements.txt       # Python dependencies
├── package.json           # Frontend dependencies
└── manage.py              # Django management script
```

## API Endpoints

-   `/api/students/` - CRUD operations for students.
-   `/api/schools/`
-   `/api/token/` - JWT token authentication.
-   Authentication endpoints via DJ-REST-Auth.

## Testing

```bash
# Run backend tests
python manage.py test
```
