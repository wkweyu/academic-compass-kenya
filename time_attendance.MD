You are a senior systems architect and backend engineer building a biometric attendance system integrated with fingerprint devices, SMS notifications, and reporting.

I am developing a school management system using PostgreSQL and I need to implement a COMPLETE biometric attendance system for students.

---

## 🎯 OBJECTIVE

Design and implement a modern, scalable attendance system with:

* Fingerprint device integration
* Real-time attendance logging
* SMS notifications to parents
* Multi-device support
* Attendance analytics and reporting

---

## 🚨 REQUIRED FEATURES

### 1. MANAGE UNLIMITED DEVICES

* Register multiple fingerprint devices

* Each device has:

  * device_name
  * device_ip
  * location (e.g. Gate, Dining Hall, Class)
  * type (Check-in / Check-out / General)

* System must support:

  * multiple check-in points
  * multiple check-out points
  * simultaneous device activity

---

### 2. ATTENDANCE EVENT CAPTURE

* Devices send logs (student_id, timestamp)
* System processes logs into:

  * check-in
  * check-out
  * late arrival
  * absence

Define:

* how to distinguish check-in vs check-out
* how to handle duplicate scans
* how to handle missing check-out

---

### 3. SMS NOTIFICATIONS

* Send SMS when:

  * student checks in
  * student checks out
  * student is absent after cutoff time

* SMS should be:

  * customizable templates
  * linked to parent phone number

Example:
"John checked in at 8:05 AM"

---

### 4. ABSENCE & LATE DETECTION

Define rules:

* Check-in cutoff time (e.g. 8:30 AM)
* If no check-in → mark absent
* If after cutoff → mark late

Trigger:

* SMS notification for absence

---

### 5. USER-DEFINED REPORTS

Provide reports for:

* daily attendance (present/absent)
* late arrivals
* attendance trends (weekly/monthly)
* per student attendance history

---

### 6. IMPORT / EXPORT DATA

* Import students into attendance system
* Export attendance logs (CSV)

---

### 7. DEVICE + SMS INTEGRATION

* Link fingerprint devices to system most preferably zkteco devices
* Integrate SMS provider API 

---

## 🧠 YOUR TASK

### 1. DESIGN SYSTEM ARCHITECTURE

Define:

* Models (tables):

  * Student
  * Parent
  * Device
  * AttendanceLog (raw device logs)
  * AttendanceRecord (processed)
  * SMSLog

* Relationships

---

### 2. DEFINE EVENT PROCESSING FLOW (CRITICAL)

Device → API → Raw Log → Processing → Attendance Record → SMS Trigger

Explain step-by-step.

---

### 3. IMPLEMENT BACKEND

Provide:

* API endpoint to receive device logs
* Processing service:

  * determine check-in/out
  * mark late/absent
* SMS sending service
* Reporting queries

---

### 4. HANDLE EDGE CASES

* duplicate scans
* student scans twice
* no checkout
* device offline then sync later

---

### 5. PROVIDE SCALABILITY DESIGN

* queue system (if needed)
* background workers for SMS
* handling multiple devices simultaneously

---

### 6. INTEGRATE WITH EXISTING SYSTEM

* link student to parent
* reuse existing student database
* ensure minimal disruption
* consider some schools are boarding while others are days scholar or both
---

## ⚠️ CONSTRAINTS

* Use PostgreSQL
* Keep it production-ready but simple
* Avoid over-engineering
* Ensure real-time capability

---

## ✅ EXPECTED OUTPUT

1. System architecture (models + relationships)
2. Event flow (device → SMS)
3. Backend implementation routes + services)
4. SMS integration design
5. Reporting queries
6. Step-by-step implementation plan

---

## 💡 CRITICAL REQUIREMENTS

Explain clearly:

* How the system determines check-in vs check-out
* When exactly SMS is triggered
* How absence is detected automatically

No ambiguity allowed.

