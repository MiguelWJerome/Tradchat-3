"""
TradChat 3 - Clean Database Seeder & Environment Initializer
Standardizes all database tables, sample rooms, admin logs, and test messages
with friendly, wholesome community test fixtures (real-life casual friend interactions).
"""

import os
import shutil
import sqlite3

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def init_all():
    print("==================================================")
    print("  TradChat 3 - Initializing Clean Test Environment")
    print(f"  Target: {BASE_DIR}")
    print("==================================================")

    # 1. Directories setup
    dms_dir = os.path.join(BASE_DIR, "dms")
    rooms_dir = os.path.join(BASE_DIR, "rooms")
    pfp_dir = os.path.join(BASE_DIR, "static", "profile-pictures")
    uploads_dir = os.path.join(BASE_DIR, "static", "uploads")
    news_dir = os.path.join(BASE_DIR, "static", "news")
    themes_dir = os.path.join(BASE_DIR, "static", "themes")

    os.makedirs(dms_dir, exist_ok=True)
    os.makedirs(rooms_dir, exist_ok=True)
    os.makedirs(pfp_dir, exist_ok=True)
    os.makedirs(uploads_dir, exist_ok=True)
    os.makedirs(news_dir, exist_ok=True)

    # Remove ROP theme if present
    rop_theme = os.path.join(themes_dir, "ROP")
    if os.path.exists(rop_theme):
        shutil.rmtree(rop_theme)
        print("[*] Removed 'ROP' theme folder as requested.")

    # Clean existing room DB files in rooms/
    for f in os.listdir(rooms_dir):
        if f.endswith(".db"):
            os.remove(os.path.join(rooms_dir, f))

    # Clean uploads directory
    for f in os.listdir(uploads_dir):
        fp = os.path.join(uploads_dir, f)
        if os.path.isfile(fp):
            os.remove(fp)

    # 2. ACCOUNTS.DB
    print("[*] Seeding accounts.db...")
    acc_path = os.path.join(BASE_DIR, "accounts.db")
    if os.path.exists(acc_path):
        os.remove(acc_path)
    
    conn = sqlite3.connect(acc_path)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            password TEXT,
            first_name TEXT,
            last_name TEXT,
            email TEXT,
            dob TEXT,
            gender TEXT,
            theme TEXT,
            room TEXT,
            dms TEXT,
            show_location INTEGER,
            latitude REAL,
            longitude REAL,
            city TEXT,
            state TEXT,
            admin INTEGER,
            frozen INTEGER,
            pl_read_dms INTEGER,
            pl_block_media INTEGER,
            pl_dm_lock INTEGER,
            pl_restricted_users TEXT,
            pl_curfew INTEGER,
            pl_curfew_offline TEXT,
            pl_curfew_online TEXT,
            pl_block_games INTEGER,
            pl_age_segregation INTEGER,
            friends TEXT,
            country TEXT,
            last_seen TEXT,
            last_login_date TEXT,
            is_solid_color INTEGER DEFAULT 0
        );
    """)

    cur.execute("""
        CREATE TABLE unseen_admin_actions (
            username TEXT,
            sub_tabs TEXT
        );
    """)

    # Friendly test accounts
    test_accounts = [
        (1, 'Server', 'ServerBotSecure_2026!', 'TradChat', 'Bot', 'bot@tradchat.community', '2024-01-01', 'male', 'classic', 'mainroom', '2-3-4-5', 1, 37.7749, -122.4194, 'San Francisco', 'CA', 0, 0, 0, 0, 0, '', 0, '10:00 PM', '6:00 AM', 0, 0, '', 'United States', 'Active Now', '2026-09-10'),
        (2, 'Admin', 'AdminDemo_Pass2026!', 'Community', 'Admin', 'admin@tradchat.community', '2000-01-01', 'male', 'classic', 'mainroom', '1-3-4-5', 1, 30.2672, -97.7431, 'Austin', 'TX', 1, 0, 0, 0, 0, '', 0, '10:00 PM', '6:00 AM', 0, 0, '', 'United States', 'Active Now', '2026-09-10'),
        (3, 'Alex', 'TestPass123!', 'Alex', 'M.', 'alex@tradchat.community', '2001-05-15', 'male', 'High-Mass', 'mainroom', '1-2-4-5', 1, 40.7128, -74.0060, 'New York', 'NY', 1, 0, 0, 0, 0, '', 0, '10:00 PM', '6:00 AM', 0, 0, '4', 'United States', '2026-09-10 16:30:00', '2026-09-10'),
        (4, 'Sam', 'TestPass123!', 'Sam', 'K.', 'sam@tradchat.community', '2002-08-20', 'female', 'Umbria', 'mainroom', '1-2-3-5', 1, 47.6062, -122.3321, 'Seattle', 'WA', 0, 0, 0, 0, 0, '', 0, '10:00 PM', '6:00 AM', 0, 0, '3', 'United States', '2026-09-10 16:15:00', '2026-09-10'),
        (5, 'Jordan', 'TestPass123!', 'Jordan', 'P.', 'jordan@tradchat.community', '2003-11-10', 'male', 'Consecration', 'mainroom', '1-2-3-4', 1, 32.7767, -96.7970, 'Dallas', 'TX', 0, 0, 0, 0, 0, '', 0, '10:00 PM', '6:00 AM', 0, 0, '', 'United States', '2026-09-09 14:00:00', '2026-09-09')
    ]

    for acc in test_accounts:
        cur.execute("""
            INSERT INTO accounts (
                id, username, password, first_name, last_name, email, dob, gender,
                theme, room, dms, show_location, latitude, longitude, city, state,
                admin, frozen, pl_read_dms, pl_block_media, pl_dm_lock, pl_restricted_users,
                pl_curfew, pl_curfew_offline, pl_curfew_online, pl_block_games, pl_age_segregation,
                friends, country, last_seen, last_login_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, acc)

    cur.execute("INSERT INTO unseen_admin_actions (username, sub_tabs) VALUES ('Admin', '');")
    cur.execute("INSERT INTO unseen_admin_actions (username, sub_tabs) VALUES ('Alex', '');")

    conn.commit()
    conn.close()

    # 3. ADMIN.DB
    print("[*] Seeding admin.db...")
    adm_path = os.path.join(BASE_DIR, "admin.db")
    if os.path.exists(adm_path):
        os.remove(adm_path)
    
    conn = sqlite3.connect(adm_path)
    cur = conn.cursor()
    cur.execute("CREATE TABLE alerts (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT, resolved INTEGER, seen INTEGER);")
    cur.execute("CREATE TABLE admin_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, requester TEXT, target_user TEXT, action_type TEXT, approvals TEXT, denials TEXT, resolved INTEGER);")
    cur.execute("CREATE TABLE reports (id INTEGER PRIMARY KEY AUTOINCREMENT, reporter TEXT, text TEXT, resolved INTEGER, seen INTEGER);")

    alerts = [
        ("Automated safety check: Content filtering service active.", 1, 0),
        ("New community member account 'Sam' approved by admin verification.", 1, 0),
        ("Routine open room maintenance completed.", 1, 0),
        ("Parental curfew scheduler: Quiet hours initiated successfully.", 0, 0)
    ]
    for a in alerts:
        cur.execute("INSERT INTO alerts (text, resolved, seen) VALUES (?, ?, ?);", a)

    admin_reqs = [
        ("Admin", "Jordan", "freeze", "Admin,Alex", "", 1),
        ("Admin", "Jordan", "unfreeze", "Admin,Alex", "", 1)
    ]
    for r in admin_reqs:
        cur.execute("INSERT INTO admin_requests (requester, target_user, action_type, approvals, denials, resolved) VALUES (?, ?, ?, ?, ?, ?);", r)

    reports = [
        ("Alex", "Automated sample report: Verifying admin action queue and notification dispatch.", 1, 1)
    ]
    for rep in reports:
        cur.execute("INSERT INTO reports (reporter, text, resolved, seen) VALUES (?, ?, ?, ?);", rep)

    conn.commit()
    conn.close()

    # 4. ROOMS.DB
    print("[*] Seeding rooms.db...")
    rooms_db_path = os.path.join(BASE_DIR, "rooms.db")
    if os.path.exists(rooms_db_path):
        os.remove(rooms_db_path)
    
    conn = sqlite3.connect(rooms_db_path)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE rooms (
            roomid INTEGER PRIMARY KEY AUTOINCREMENT,
            room_name TEXT,
            description TEXT,
            room_type TEXT,
            owners TEXT,
            managers TEXT,
            curators TEXT,
            members TEXT,
            emoji TEXT,
            deleted INTEGER
        );
    """)

    standard_rooms = [
        (1, 'mainroom', 'The main community lounge for all members', 'public', '1', '2', '', '', 'MR', 0),
        (2, 'announcements', 'Community news, platform updates, and event schedules', 'public', '2', '3', '', '', '📢', 0),
        (3, 'community-games', 'Casual board games, chess tournaments, and friendly matches', 'public', '3', '2', '', '', '🎲', 0),
        (4, 'reading-and-study', 'Book discussions, study sessions, and helpful resources', 'public', '3', '4', '', '', '📚', 0)
    ]
    for r in standard_rooms:
        cur.execute("""
            INSERT INTO rooms (roomid, room_name, description, room_type, owners, managers, curators, members, emoji, deleted)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, r)

    conn.commit()
    conn.close()

    # 5. MAINROOM.DB
    print("[*] Seeding mainroom.db with casual friendly messages...")
    mr_path = os.path.join(BASE_DIR, "mainroom.db")
    if os.path.exists(mr_path):
        os.remove(mr_path)

    conn = sqlite3.connect(mr_path)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            message TEXT,
            timestamp TEXT,
            reply_id INTEGER,
            reactions TEXT,
            upload TEXT,
            deleted INTEGER
        );
    """)

    mr_messages = [
        (1, 1, 'Welcome to #mainroom! Hope everyone is having a wonderful day.', '2026-09-10 10:00:00', -1, '', '', 0),
        (2, 3, 'Hey everyone! Who is up for a game of Chess or Connect 4 later tonight?', '2026-09-10 10:05:15', -1, '', '', 0),
        (3, 4, 'Count me in! I have been practicing my openings all week 😄', '2026-09-10 10:07:30', 2, '', '', 0),
        (4, 5, 'Nice! Let us set up a tournament bracket after evening studies.', '2026-09-10 10:10:45', 3, '', '', 0),
        (5, 3, 'Sounds like a plan! See everyone in the games room around 7:00 PM.', '2026-09-10 10:12:00', 4, '', '', 0)
    ]
    for m in mr_messages:
        cur.execute("INSERT INTO messages (id, user_id, message, timestamp, reply_id, reactions, upload, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?);", m)

    conn.commit()
    conn.close()

    # 6. ROOM DBs in rooms/
    print("[*] Seeding room databases in rooms/...")
    room_data = {
        "announcements.db": [
            (1, 2, 'Welcome to the updated TradChat 3! We have added new themes and improved safety controls.', '2026-09-10 09:00:00', -1, '', '', 0),
            (2, 2, 'Reminder: Automatic curfew quiet hours are active from 10:00 PM to 6:00 AM.', '2026-09-10 09:05:00', -1, '', '', 0)
        ],
        "community-games.db": [
            (1, 3, 'Welcome to the games channel! Post here to challenge friends to Chess, Checkers, or Uno.', '2026-09-10 11:00:00', -1, '', '', 0),
            (2, 4, 'Ready whenever you guys are! Opening a new match table now.', '2026-09-10 11:05:00', 1, '', '', 0)
        ],
        "reading-and-study.db": [
            (1, 3, 'Hey Sam, do you have the reading notes from chapter 4?', '2026-09-10 12:00:00', -1, '', '', 0),
            (2, 4, 'Yes! I just finished typing them up. I can share the study guide after lunch.', '2026-09-10 12:04:00', 1, '', '', 0),
            (3, 3, 'Awesome, thank you so much!', '2026-09-10 12:06:00', 2, '', '', 0)
        ]
    }

    for rfile, msgs in room_data.items():
        rp = os.path.join(rooms_dir, rfile)
        conn = sqlite3.connect(rp)
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                message TEXT,
                timestamp TEXT,
                reply_id INTEGER,
                reactions TEXT,
                upload TEXT,
                deleted INTEGER
            );
        """)
        for m in msgs:
            cur.execute("INSERT INTO messages (id, user_id, message, timestamp, reply_id, reactions, upload, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?);", m)
        conn.commit()
        conn.close()

    # 7. DMS (boys_dm.db & girls_dm.db)
    print("[*] Seeding dms/...")
    dm_tables = {
        "boys_dm.db": ("boys_dm", [
            (1, '3-4', 3, 'Hey Sam, did you see the new theme styles in settings?', '2026-09-10 14:00:00', -1, '', '', 0),
            (2, '3-4', 4, 'Yeah! The Umbria and High-Mass themes look really nice on desktop.', '2026-09-10 14:01:20', 1, '', '', 0),
            (3, '3-2', 3, 'Admin check: Everything is running smoothly for tonight.', '2026-09-10 14:05:00', -1, '', '', 0),
            (4, '3-2', 2, 'Great to hear. Thanks for checking in!', '2026-09-10 14:06:00', 3, '', '', 0)
        ]),
        "girls_dm.db": ("girls_dm", [
            (1, '4-2', 4, 'Hi Admin, just testing the direct message safety filters.', '2026-09-10 14:10:00', -1, '', '', 0),
            (2, '4-2', 2, 'All safety settings and message permissions are active.', '2026-09-10 14:11:00', 1, '', '', 0)
        ])
    }

    for db_name, (tbl, msgs) in dm_tables.items():
        p = os.path.join(dms_dir, db_name)
        if os.path.exists(p):
            os.remove(p)
        conn = sqlite3.connect(p)
        cur = conn.cursor()
        cur.execute(f"""
            CREATE TABLE {tbl} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                convo_hash TEXT,
                sender_id INTEGER,
                message TEXT,
                timestamp TEXT,
                reply_id INTEGER,
                reactions TEXT,
                upload TEXT,
                deleted INTEGER
            );
        """)
        for m in msgs:
            cur.execute(f"INSERT INTO {tbl} (id, convo_hash, sender_id, message, timestamp, reply_id, reactions, upload, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);", m)
        conn.commit()
        conn.close()

    # 8. LAST_READ.DB
    print("[*] Seeding last_read.db...")
    lr_path = os.path.join(BASE_DIR, "last_read.db")
    if os.path.exists(lr_path):
        os.remove(lr_path)
    
    conn = sqlite3.connect(lr_path)
    cur = conn.cursor()
    cur.execute("CREATE TABLE last_read (user_id INTEGER, target_id TEXT, is_dm INTEGER, last_viewed TEXT);")
    lr_rows = [
        (2, 'mainroom', 0, '2026-09-10 16:30:00'),
        (3, 'mainroom', 0, '2026-09-10 16:30:00'),
        (4, 'mainroom', 0, '2026-09-10 16:30:00'),
        (5, 'mainroom', 0, '2026-09-10 16:30:00'),
        (3, '3-4', 1, '2026-09-10 16:30:00'),
        (4, '3-4', 1, '2026-09-10 16:30:00')
    ]
    for r in lr_rows:
        cur.execute("INSERT INTO last_read (user_id, target_id, is_dm, last_viewed) VALUES (?, ?, ?, ?);", r)
    conn.commit()
    conn.close()

    # 9. TEMP_MODIFIER.DB
    print("[*] Seeding temp_modifier.db...")
    tm_path = os.path.join(BASE_DIR, "temp_modifier.db")
    if os.path.exists(tm_path):
        os.remove(tm_path)
    conn = sqlite3.connect(tm_path)
    cur = conn.cursor()
    cur.execute("CREATE TABLE alerts (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT, resolved INTEGER, seen INTEGER);")
    cur.execute("INSERT INTO alerts (id, text, resolved, seen) VALUES (1, 'System Health Check: OK', 1, 1);")
    conn.commit()
    conn.close()

    # 10. Profile Pictures Sanitization
    print("[*] Updating static/profile-pictures/...")
    def_male = os.path.join(BASE_DIR, "static", "graphics", "defaultMale.png")
    def_female = os.path.join(BASE_DIR, "static", "graphics", "defaultFemale.png")

    test_pfps = {
        "Alex.png": def_male,
        "Sam.png": def_female,
        "Jordan.png": def_male
    }
    for name, src in test_pfps.items():
        dst = os.path.join(pfp_dir, name)
        if os.path.exists(src):
            shutil.copyfile(src, dst)

    # 11. Employer Showcase News Article
    print("[*] Setting up single employer showcase news article...")
    # Clean other news folders, keep showcase folder
    for item in os.listdir(news_dir):
        if item != "TradChat Customized for Employer Showcase":
            p = os.path.join(news_dir, item)
            if os.path.isdir(p):
                shutil.rmtree(p)

    art_folder = os.path.join(news_dir, "TradChat Customized for Employer Showcase")
    os.makedirs(art_folder, exist_ok=True)
    with open(os.path.join(art_folder, "number.txt"), "w", encoding="utf-8") as f:
        f.write("1")
    with open(os.path.join(art_folder, "bodyInfo.html"), "w", encoding="utf-8") as f:
        f.write("""<h1>TradChat 3: Tailored for Engineering Showcase & Employer Review</h1>
<p class="lead"><strong>Welcome, engineering recruiters and hiring managers!</strong> You are currently viewing the live portfolio demonstration instance of <strong>TradChat 3</strong>.</p>

<hr style="margin: 20px 0; border: 0; border-top: 1px solid rgba(255,255,255,0.15);">

<h3>🚀 Breaking the Fourth Wall: Why This Instance Exists</h3>
<p>TradChat was originally designed from scratch as an authentic, private real-time communication platform for a traditional faith-based community and close circle of friends. Because the production version houses personal conversations and user safety data, this showcase environment was specifically prepared to let engineering teams test drive the codebase safely.</p>

<p>All databases, accounts, messages, and administrative audit logs in this instance have been sanitized and pre-populated with deterministic test fixtures (<code>Alex</code>, <code>Sam</code>, <code>Jordan</code>, and <code>Admin</code>) so you can evaluate the platform's architectural capabilities firsthand.</p>

<h3>🛠️ Core Engineering Highlights to Explore</h3>
<ul>
  <li><strong>⚡ Low-Latency WebSockets:</strong> Experience bi-directional event dispatching and room state synchronization powered by <code>Flask-SocketIO</code> and eventlet concurrency.</li>
  <li><strong>🎨 Dynamic Theming Engine:</strong> Navigate to <em>Settings &rarr; Theme</em> to test runtime CSS token injection (switch between <em>High-Mass</em>, <em>Umbria</em>, <em>Consecration</em>, <em>Classic</em>, and <em>Coding</em> modes).</li>
  <li><strong>🛡️ Granular Safety & Parental Controls:</strong> Inspect the automated curfew time lock scheduler, age-segregation rules, and direct message permissions.</li>
  <li><strong>📊 Role-Based Admin Operations:</strong> Visit the <em>Admin</em> panel to view real-time alert queues, user freeze/unfreeze workflows, and room scan audits.</li>
  <li><strong>💾 Thread-Safe Persistence:</strong> Inspect SQLite connection pool management with parameterized queries protecting against SQL injection.</li>
</ul>

<h3>🤝 Thank You for Reviewing!</h3>
<p>Feel free to explore the rooms, test out the theme customizer, check administrative alerts, and inspect the clean Python backend architecture.</p>
""")

    print("\n[+] TradChat 3 test environment successfully seeded!")
    print("\nLocal Test Accounts:")
    print("  Administrator: Admin / AdminDemo_Pass2026!")
    print("  Member 1:      Alex / TestPass123!")
    print("  Member 2:      Sam / TestPass123!")
    print("  Member 3:      Jordan / TestPass123!")
    print("==================================================")

if __name__ == "__main__":
    init_all()

