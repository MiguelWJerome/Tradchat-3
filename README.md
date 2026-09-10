# TradChat v3 🌐
> **A Private, Wholesome Real-Time Community Platform with Event-Driven WebSockets, Granular Safety Controls, and Dynamic Theming**

[![Python 3.10+](https://img.shields.io/badge/Python-3.10%2B-blue.svg?logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/Framework-Flask-black.svg?logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![Socket.IO](https://img.shields.io/badge/Real--Time-Flask--SocketIO-010101.svg?logo=socket.io&logoColor=white)](https://socket.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 📖 Project Context & Mission

> [!NOTE]
> **About this Project & Portfolio Demo:**  
> **TradChat 3** is a private, real-time social platform built for a traditional Catholic community and circle of friends, featuring built-in safety controls, parental curfew locks, and admin verification.
>
> While actively used by the community, this repository has been cleaned, seeded with test data, and prepared as a portfolio showcase for employers and hiring managers to evaluate my full-stack Python/Flask, event-driven WebSockets (`Flask-SocketIO`), dynamic CSS theming, and database design.

---

## ✨ Key Technical & Safety Features

- **⚡ Event-Driven WebSocket Architecture:** Low-latency bi-directional message broadcasting and room state synchronization powered by `Flask-SocketIO`.
- **🛡️ Granular Safety & Parental Controls:**
  - **Automated Curfew Engine:** Restricts login access and message transmission during scheduled overnight hours.
  - **Age Segregation Protocols:** Isolates direct messaging and channel permissions across distinct age tiers.
  - **Admin Onboarding & Verification:** Gatekept registration pipeline requiring administrative approval.
  - **Content Moderation:** In-stream keyword detection, reporting workflows, and real-time account freeze/unfreeze controls.
- **🎨 Dynamic Theming & Design Token Engine:** Hot-swappable client-side themes with custom palettes and background styling (e.g. *High-Mass*, *Umbria*, *Consecration*, *Classic*, *Coding*).
- **💬 Multi-Tenant Room & DM System:** Dynamic room creation, owner/manager role delegation, and segregated direct messaging threads.
- **📰 Integrated Community News & Feed:** Built-in article feed for platform announcements, safety updates, and community tournament schedules.
- **🤖 Roombot Automated Assistant:** Lightweight bot integration for room rules, commands, and navigational shortcuts.

---

## 🏗️ Architecture & Project Structure

```plaintext
tradchat3/
├── Server.py               # Core application server, WebSocket handlers & API routing
├── send email.py           # Asynchronous SMTP notification service
├── accounts.db             # User authentication, profiles, parental locks & geolocation
├── admin.db                # Moderation audit logs, system alerts & approval queues
├── rooms.db                # Public/private room registry & access permissions
├── mainroom.db             # Primary community lounge message store
├── last_read.db            # Unread message badges & timestamp tracking
├── dms/                    # Direct message database pools
├── rooms/                  # Individual channel message databases
├── static/
│   ├── css/                # Base layouts & master design tokens
│   ├── javascript/         # Client-side Socket.IO listeners & DOM reconcilers
│   ├── news/               # Community announcement articles & release guides
│   ├── profile-pictures/   # User avatar assets
│   └── themes/             # Dynamic theme bundles (palettes & background artwork)
└── templates/              # Jinja2 HTML5 view templates
```

---

## 🚀 Local Development Setup

### 1. Clone the Repository
```bash
git clone https://github.com/MiguelWJerome/Tradchat-3.git
cd Tradchat-3
```

### 2. Set Up Virtual Environment & Dependencies
```bash
python -m venv venv

# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install flask flask-socketio eventlet requests
```

### 3. Initialize Clean Sample Environment (Optional)
```bash
python init_clean_db.py
```

### 4. Run the Server
```bash
python Server.py
```
*Access the local instance at `http://127.0.0.1:5000`.*

---

## 👥 Demo Test Accounts (For Local Testing)

When running with sample test data, you can log in with:

| Account | Username | Role | Password |
|---|---|---|---|
| **Administrator** | `Admin` | Platform Admin | `AdminDemo_Pass2026!` |
| **Community Member 1** | `Alex` | Member (Admin) | `TestPass123!` |
| **Community Member 2** | `Sam` | Member | `TestPass123!` |
| **Community Member 3** | `Jordan` | Member | `TestPass123!` |

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Backend & Real-Time** | Python 3, Flask, Flask-SocketIO, Eventlet |
| **Persistence** | SQLite3, Thread-Safe Connection Pools |
| **Frontend** | HTML5, Modern Vanilla CSS3, JavaScript (ES6+), Socket.IO Client |
| **Integrations** | SMTP Email Services, Geolocation APIs |

---

## 📄 License
This project is open-source under the [MIT License](LICENSE).
