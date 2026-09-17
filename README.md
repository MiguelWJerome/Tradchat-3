# TradChat v3 🌐

> A real-time community web application built with Flask, Socket.IO, SQLite, and vanilla JavaScript. It supports live messaging, user permissions, moderation tools, parental controls, and customizable themes.

[![Python 3.10+](https://img.shields.io/badge/Python-3.10%2B-blue.svg?logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/Framework-Flask-black.svg?logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![Socket.IO](https://img.shields.io/badge/Real--Time-Flask--SocketIO-010101.svg?logo=socket.io&logoColor=white)](https://socket.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

TradChat 3 is a full-stack real-time web application built with Python, Flask, Flask-SocketIO, SQLite, and vanilla JavaScript. I designed and maintained features for live messaging, room permissions, moderation, account controls, email notifications, and customizable themes. The project was deployed on Linux/Raspberry Pi and tested with a multi-user community.

---

## 📖 Project Context

TradChat 3 is a full-stack real-time community application that I developed and maintained for a private user group. The project includes live messaging, room and direct-message permissions, moderation workflows, account controls, and configurable themes. This repository contains a cleaned version with sample data for local evaluation.

---

## ✨ Key Technical Features

- **⚡ Real-Time Messaging:** Real-time message delivery and room updates using Flask-SocketIO.
- **🛡️ Safety & Account Controls:**
  - **Automated Curfew:** Restricts login access and message transmission during scheduled overnight hours.
  - **Access Controls:** Role- and age-based access controls for rooms and direct messages.
  - **Admin Verification:** Registration approval workflow requiring administrative review.
  - **Content Moderation:** In-stream keyword detection, reporting workflows, and account freeze/unfreeze controls.
- **🎨 Dynamic Theming:** Customizable client-side themes with selectable palettes and background styling.
- **💬 Rooms & Direct Messages:** Separate rooms and direct-message conversations with configurable permissions.
- **📰 Community News Feed:** Built-in article feed for platform announcements and community updates.
- **🤖 Automated Assistant:** Lightweight bot integration for room rules, commands, and shortcuts.

---

## 🏗️ Architecture & Project Structure

```plaintext
tradchat3/
├── Server.py               # Core application server, WebSocket handlers & API routing
├── send email.py           # Asynchronous SMTP notification service
├── init_clean_db.py        # Database initialization & local test seeder (run locally)
├── accounts.db             # User authentication, profiles & parental controls (sample data)
├── admin.db                # Moderation audit logs, system alerts & approval queues (sample data)
├── rooms.db                # Public/private room registry & access permissions (sample data)
├── mainroom.db             # Primary community lounge message store (sample data)
├── last_read.db            # Unread message badges & timestamp tracking (sample data)
├── gif_whitelist.db        # Whitelisted GIF catalog (sample data)
├── dms/                    # Direct message database store (sample data)
│   ├── boys_dm.db
│   └── girls_dm.db
├── rooms/                  # Individual channel message databases (sample data)
│   ├── announcements.db
│   ├── community-games.db
│   └── reading-and-study.db
├── static/
│   ├── css/                # Application stylesheets (admin, home, settings, etc.)
│   ├── graphics/           # Avatars, maps, and UI graphics
│   ├── javascript/         # Client-side Socket.IO listeners & DOM controllers
│   ├── news/               # Community announcement articles
│   ├── profile-pictures/   # User avatar assets
│   └── themes/             # Dynamic theme bundles
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

Run init_clean_db.py to create local test accounts. Credentials are printed during setup.

| Account | Username | Role |
|---|---|---|
| **Administrator** | `Admin` | Administrator |
| **Community Member 1** | `Alex` | Member (Admin) |
| **Community Member 2** | `Sam` | Member |
| **Community Member 3** | `Jordan` | Member |

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
