# Quizora Web Application 🚀

**Quizora** is a modern, responsive, full-stack online examination, assignment, and activity management platform built with **React**, **Vite**, and **Firebase**. It provides intuitive workflows for educators/admins to create multi-part activities, design rich MCQ and written questions, collect participant data, grade submissions, and share permanent activity links across all screen sizes.

---

## ✨ Features

### 🔐 Authentication & Profile System
- **Google & Email Authentication**: Secure login, signup, and Google OAuth integration powered by Firebase Auth.
- **Email Verification**: Resend verification link flow with active cooldown timer logic.
- **Profile Management**: Profile picture upload with automatic client-side image compression, full name, gender, and date of birth updates.

### ⚡ Activity Creator Wizard
- **4-Step Streamlined Wizard**: Basic Information → Question Creation → Participant Form Setup → Permanent Link Sharing.
- **Flexible Purpose Modes**: Create **Exams**, **Assignments**, **Custom**, or **Other** activities.
- **Time Configurations**: Support for "Start when user begins", "Start when link is shared", "Individual question time", or "No time limit".
- **Multi-Part Navigation Modes**: Support for Sequential (Part A → B → C), Free navigation between parts, or Individual Part Time limits.
- **Scoring & Penalties**: Configurable total marks, optional compulsory exam marks, negative marking values (e.g. -0.25, -0.5), and percentage score display toggles.

### 📝 Question Editors & Paper Uploads
- **Full-Screen MCQ Editor**: Dedicated full-screen MCQ editor with live Option selector, ON/OFF toggle for multiple correct choices, answer explanation box, and drag/click image & PDF file attachments.
- **Written & Paper Questions**: Support for open-ended written questions, uploaded PDF/image question papers, and customizable instructions.
- **Multi-File Media Support**: Attach multiple images or PDF reference documents per question with SVG Replace & Remove action buttons and in-browser previewing.

### 📋 Participant Details Form & Link Sharing
- **Custom Participant Registration**: Quick-add presets for Roll Number, Registration Number, Class, Section, Student ID, Email Address, or custom detail fields before taking an activity.
- **Permanent Link Generation**: Unique permanent activity URLs for deep-linking across mobile apps, messaging platforms (WhatsApp, Telegram, Instagram), and browsers.

### 📊 Dashboard & Real-Time Grading
- **Dual Section View**: Unified Admin and User sections with time-based greetings and daily motivational quotes.
- **Activity Lifecycle Management**: Categorized **Active** (live/scheduled) vs **Completed** (finished/expired) activity sections with status tracking.
- **Submission Checking & Grading**: Interactive submission inspection modal for admins to review participant answers, award partial/full marks, write custom feedback, and publish final results.
- **Activity Operations**: Duplicate existing activities into draft mode or safely delete activities with confirmation modals.

### 📱 Responsive UI/UX System
- **Universal Adaptability**: Engineered to fluidly adapt to small phones (320px+), tablets, laptops, desktop monitors, and ultrawide displays (2560px+).
- **Safe Layout Rules**: Max-width containers, contained table scrolling, text-wrap protection, and touch-optimized buttons.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, JavaScript (ES6+), Vanilla CSS3 (Custom Design System with CSS Variables)
- **Build Tool**: Vite
- **Backend & Storage**: Firebase Authentication, Cloud Firestore, Firebase Storage
- **Code Quality**: ESLint

---

## 📁 Project Structure

```
Quizora-web/
├── public/                # Static assets (favicon, icons)
├── src/
│   ├── assets/            # App media assets
│   ├── components/        # UI components
│   │   ├── Admin/         # Admin Dashboard, Wizard, MCQ Editor, Submissions
│   │   ├── Auth/          # Login, Register, VerifyEmail components
│   │   └── Profile/       # CompleteProfile, ProfileModal components
│   ├── pages/             # Main view pages (Dashboard.jsx)
│   ├── services/          # Firebase API services (auth, user, activity, admin)
│   ├── utils/             # Helper utilities (time greetings, date formatters)
│   ├── App.css            # Component-level styles & responsive media queries
│   ├── App.jsx            # Main app router & session controller
│   ├── firebase.js        # Firebase SDK initialization
│   ├── index.css          # Design system CSS tokens & global resets
│   └── main.jsx           # App entry point
├── eslint.config.js       # ESLint configuration
├── package.json           # Project dependencies & scripts
└── vite.config.js         # Vite build configuration
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v18.0.0 or higher recommended)
- **npm** or **yarn**

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ganeshnanda120/Quizora-web.git
   cd Quizora-web
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Build for production**:
   ```bash
   npm run build
   ```

5. **Run ESLint check**:
   ```bash
   npm run lint
   ```

---

## 📄 License

This project is created for educational and activity management purposes. All rights reserved.
