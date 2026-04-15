from flask import Flask, render_template, render_template_string, redirect, request, flash, session 
from flask_socketio import SocketIO, join_room, leave_room
from werkzeug.utils import secure_filename
import werkzeug
import sqlite3
import datetime
import os
import shutil
import secrets
from threading import Thread, Lock
import ast
import base64
import io
from PIL import Image, ImageOps 
import re

def clean_keyword(kw):
    """Lowercase, remove punctuation and leading/trailing spaces."""
    kw = kw.lower().strip()
    kw = re.sub(r'[^\w\s]', '', kw)
    kw = kw.strip()
    return kw

def db_sql(sql, db_string, params=[], chat_room=False, provide_id=False):
    # The 'with' statement handles the "waiting" and "releasing" for you!
    lock = None
    db_path = None
    if chat_room:
        lock = room_dict[db_string]['lock']
        db_path = room_dict[db_string]['file_path']
    else:
        if db_string == "accounts":
            lock = accounts_lock
            db_path = 'accounts.db'
        elif db_string == "rooms":
            lock = rooms_lock
            db_path = 'rooms.db'
        elif db_string == "boys_dm":
            lock = boys_dm_lock
            db_path = 'dms/boys_dm.db'
        elif db_string == "girls_dm":
            lock = girls_dm_lock
            db_path = 'dms/girls_dm.db'
        elif db_string == "last_read":
            lock = last_read_lock
            db_path = 'last_read.db'
        elif db_string == "gif_whitelist":
            lock = gif_whitelist_lock
            db_path = 'gif_whitelist.db'
    
    with lock:
        try:
            conn = sqlite3.connect(db_path)
            conn.execute("PRAGMA foreign_keys = ON;")
            cursor = conn.cursor()
            cursor.execute(sql, params)
            
            result = None
            if remove_go_spaces(sql.lower()).strip().startswith("select"):
                result = cursor.fetchall()
            else:
                conn.commit()
                result = True
                if chat_room or provide_id:
                    result = cursor.lastrowid
            
            conn.close()
            return result
        except Exception as e:
            print(f"DB ERROR: {e}")
            print(f"SQL: {sql[:100]}...")
            print(f"Params: {params}")
            conn.close()
            return []

def check_room_access(room_name, username):
    user_id = find_account_id_or_password_or_gender(username, 'id')
    queryResults = db_sql("""SELECT room_type, owners, managers, curators, members, deleted FROM rooms WHERE room_name = ?;""", 'rooms', params=[room_name], chat_room=False)
    
    if not queryResults or queryResults[0][5]: # Room not found or deleted
        return False
        
    if queryResults[0][0] == 'private':
        owners = split(queryResults[0][1])
        managers = split(queryResults[0][2])
        curators = split(queryResults[0][3])
        members = split(queryResults[0][4])

        all_members = owners+managers+curators+members
        
        if str(user_id) in all_members:
            return True
        else:
            return False
    else:
        return True

def check_dm_access(dm_room, username):
    """Check if user is a participant in the DM conversation."""
    if '.$@-@&.' not in dm_room:
        return False
    dm_parts = dm_room.split('.$@-@&.')
    return username == dm_parts[0] or username == dm_parts[1]

def check_credentials(username, password):
    stored_password = find_account_id_or_password_or_gender(username, 'password', RGS=True)
    return (stored_password and stored_password == password)


def fetch_room_messages(room_name, limit, offset, underhead, username=None):
    messages = []
    lastTimeStamp = False
    
    if offset == -1 and username:
        user_id = find_account_id_or_password_or_gender(username, 'id')
        last_read_entry = db_sql("""SELECT last_viewed FROM last_read WHERE user_id = ? AND target_id = ? AND is_dm = 0;""", 'last_read', params=[user_id, room_name], chat_room=False)
        lv = last_read_entry[0][0] if last_read_entry else '1970-01-01 00:00:00'
        
        fum = db_sql("SELECT id FROM messages WHERE timestamp > ? ORDER BY id ASC LIMIT 1;", room_name, params=[lv], chat_room=True)
        if fum:
            lastTimeStamp = lv
            fum_id = fum[0][0]
            half = limit // 2
            
            before_msgs = db_sql("SELECT id, user_id, message, timestamp, reply_id, upload, reactions, deleted FROM messages WHERE id < ? ORDER BY id DESC LIMIT ?", room_name, params=[fum_id, half], chat_room=True)
            before_msgs.reverse()
            after_msgs = db_sql("SELECT id, user_id, message, timestamp, reply_id, upload, reactions, deleted FROM messages WHERE id >= ? ORDER BY id ASC LIMIT ?", room_name, params=[fum_id, limit - half], chat_room=True)
            
            raw_messages = before_msgs + after_msgs
        else:
            raw_messages = db_sql("""SELECT id, user_id, message, timestamp, reply_id, upload, reactions, deleted FROM messages ORDER BY id DESC LIMIT ?""", room_name, params=[limit], chat_room=True)
    else:
        if underhead:
            raw_messages = db_sql("""SELECT id, user_id, message, timestamp, reply_id, upload, reactions, deleted FROM messages WHERE id > ? ORDER BY id DESC LIMIT ?""", room_name, params=[offset, limit], chat_room=True)
        else:
            if offset == -1:
                raw_messages = db_sql("""SELECT id, user_id, message, timestamp, reply_id, upload, reactions, deleted FROM messages ORDER BY id DESC LIMIT ?""", room_name, params=[limit], chat_room=True)
            else:
                raw_messages = db_sql("""SELECT id, user_id, message, timestamp, reply_id, upload, reactions, deleted FROM messages WHERE id < ? ORDER BY id DESC LIMIT ?""", room_name, params=[offset, limit], chat_room=True)    

    for t in raw_messages:
        message = {}
        message['id'] = t[0]
        message['username'] = find_username_from_id(t[1])
        
        # Soft-delete masking: If deleted, hide content and upload
        if t[7]: # t[7] is 'deleted'
            message['message'] = "(message has been deleted)"
            message['upload'] = ""
        else:
            message['message'] = t[2]
            message['upload'] = t[5]
            
        message['timestamp'] = t[3]
        message['reply_id'] = t[4]
        message['reactions'] = get_reactions_with_usernames(t[6])
        message['deleted'] = t[7]
        messages.append(message)

    if not (offset == -1 and username and lastTimeStamp is not False):
        if offset == -1 or underhead:
            messages.reverse()
    
    at_bottom = True
    if messages:
        max_id_row = db_sql("SELECT MAX(id) FROM messages;", room_name, chat_room=True)
        if max_id_row and max_id_row[0][0] is not None:
            max_id = max_id_row[0][0]
            current_max_id = max(m['id'] for m in messages)
            at_bottom = (current_max_id >= max_id)
    
    return messages, lastTimeStamp, at_bottom


def fetch_dm_messages(dm_string, username, limit, offset, underhead):
    primary_user_id = find_account_id_or_password_or_gender(dm_string.split('.$@-@&.')[0], 'id')
    primaryGender = find_account_id_or_password_or_gender(dm_string.split('.$@-@&.')[0], 'gender')
    secondary_user_id = find_account_id_or_password_or_gender(dm_string.split('.$@-@&.')[1], 'id')

    genderDict = {'male': 'boys_dm', 'female': 'girls_dm'}

    convo_hash = f"{primary_user_id}-{secondary_user_id}"
    anti_convo_hash = f"{secondary_user_id}-{primary_user_id}"

    lastTimeStamp = False

    if offset == -1:
        user_id = find_account_id_or_password_or_gender(username, 'id')
        primary_id = int(convo_hash.split('-')[0])
        secondary_id = int(convo_hash.split('-')[1])
        target_id = f"{min(primary_id, secondary_id)}-{max(primary_id, secondary_id)}"
        
        last_read_entry = db_sql("""SELECT last_viewed FROM last_read WHERE user_id = ? AND target_id = ? AND is_dm = 1;""", 'last_read', params=[user_id, target_id], chat_room=False)
        lv = last_read_entry[0][0] if last_read_entry else '1970-01-01 00:00:00'
        
        fum = db_sql(f"SELECT id FROM {genderDict[primaryGender]} WHERE (convo_hash = ? OR convo_hash = ?) AND timestamp > ? ORDER BY id ASC LIMIT 1;", genderDict[primaryGender], params=[convo_hash, anti_convo_hash, lv], chat_room=False)
        if fum:
            lastTimeStamp = lv
            fum_id = fum[0][0]
            half = limit // 2
            
            before_msgs = db_sql(f"SELECT id, sender_id, message, timestamp, reply_id, upload, reactions, deleted FROM {genderDict[primaryGender]} WHERE (convo_hash = ? OR convo_hash = ?) AND id < ? ORDER BY id DESC LIMIT ?", genderDict[primaryGender], params=[convo_hash, anti_convo_hash, fum_id, half], chat_room=False)
            before_msgs.reverse()
            after_msgs = db_sql(f"SELECT id, sender_id, message, timestamp, reply_id, upload, reactions, deleted FROM {genderDict[primaryGender]} WHERE (convo_hash = ? OR convo_hash = ?) AND id >= ? ORDER BY id ASC LIMIT ?", genderDict[primaryGender], params=[convo_hash, anti_convo_hash, fum_id, limit - half], chat_room=False)
            
            raw_messages = before_msgs + after_msgs
        else:
            raw_messages = db_sql(f"""SELECT id, sender_id, message, timestamp, reply_id, upload, reactions, deleted FROM {genderDict[primaryGender]} WHERE (convo_hash = ? OR convo_hash = ?) ORDER BY id DESC LIMIT ?""", genderDict[primaryGender], params=[convo_hash, anti_convo_hash, limit], chat_room=False)
    else:
        if underhead:
            raw_messages = db_sql(f"""SELECT id, sender_id, message, timestamp, reply_id, upload, reactions, deleted FROM {genderDict[primaryGender]} WHERE (convo_hash = ? OR convo_hash = ?) AND id > ? ORDER BY id DESC LIMIT ?""", genderDict[primaryGender], params=[convo_hash, anti_convo_hash, offset, limit], chat_room=False)
        else:
            raw_messages = db_sql(f"""SELECT id, sender_id, message, timestamp, reply_id, upload, reactions, deleted FROM {genderDict[primaryGender]} WHERE (convo_hash = ? OR convo_hash = ?) AND id < ? ORDER BY id DESC LIMIT ?""", genderDict[primaryGender], params=[convo_hash, anti_convo_hash, offset, limit], chat_room=False)

    actual_user_dm_username = dm_string.split('.$@-@&.')[1] if dm_string.split('.$@-@&.')[0] == username else dm_string.split('.$@-@&.')[0]
    
    messages = []
    for message in raw_messages:
        # Soft-delete masking: If deleted, hide content and upload
        msg_text = message[2]
        upload_data = message[5]
        if message[7]: # message[7] is 'deleted'
            msg_text = "(message has been deleted)"
            upload_data = ""

        messages.append({
            'id': message[0],
            'username': find_username_from_id(message[1]),
            'message': msg_text,
            'timestamp': message[3],
            'reply_id': message[4],
            'upload': upload_data,
            'reactions': get_reactions_with_usernames(message[6]),
            'deleted': message[7]
        })

    if not (offset == -1 and lastTimeStamp is not False):
        if offset == -1 or underhead:
            messages.reverse()
    
    at_bottom = True
    if messages:
        max_id_row = db_sql(f"SELECT MAX(id) FROM {genderDict[primaryGender]} WHERE convo_hash = ? OR convo_hash = ?;", genderDict[primaryGender], params=[convo_hash, anti_convo_hash], chat_room=False)
        if max_id_row and max_id_row[0][0] is not None:
            max_id = max_id_row[0][0]
            current_max_id = max(m['id'] for m in messages)
            at_bottom = (current_max_id >= max_id)
            
    return messages, actual_user_dm_username, lastTimeStamp, at_bottom


accounts_dict = {}
id_to_accounts_dict = {}
sid_to_room_state = {}

def process_room_leave(sid):
    if sid in sid_to_room_state:
        state = sid_to_room_state[sid]
        user_id = state['user_id']
        room = state['room']
        is_dm = state['is_dm']
        
        # If the user recently manually marked a message as unread, don't overwrite it on disconnect/leave
        if state.get('ignore_next_leave'):
            del sid_to_room_state[sid]
            return

        now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        
        target_id = room
        if is_dm:
            user1 = find_account_id_or_password_or_gender(room.split('.$@-@&.')[0], 'id')
            user2 = find_account_id_or_password_or_gender(room.split('.$@-@&.')[1], 'id')
            ids = sorted([int(user1), int(user2)])
            target_id = f"{ids[0]}-{ids[1]}"
            
        db_sql("INSERT OR REPLACE INTO last_read (user_id, target_id, is_dm, last_viewed) VALUES (?, ?, ?, ?);", 'last_read', params=[user_id, target_id, is_dm, now_str], chat_room=False)
        del sid_to_room_state[sid]

def process_room_join(sid, username, room):
    user_id = find_account_id_or_password_or_gender(username, 'id')
    is_dm = '.$@-@&.' in room
    sid_to_room_state[sid] = {'user_id': user_id, 'room': room, 'is_dm': is_dm}

def find_account_id_or_password_or_gender(user, id_or_password_or_gender='id', RGS=False, RU=False):
    if RGS:
        user = remove_go_spaces(user)

    try:
        if id_or_password_or_gender == 'id':
            if RU:
                return [user, accounts_dict[user]['id']]
            return accounts_dict[user]['id']
            
        elif id_or_password_or_gender == 'password':
            if RU:
                return [user, accounts_dict[user]['password']]
            return accounts_dict[user]['password']

        elif id_or_password_or_gender == 'gender':
            if RU:
                return [user, accounts_dict[user]['gender']]
            return accounts_dict[user]['gender']
        

    except KeyError:
        data_list = db_sql("""SELECT username, password, id, gender FROM accounts WHERE LOWER(username) = ?;""", 'accounts', params=[user.lower()], chat_room=False)
        if data_list:
            data = data_list[0]
            accounts_dict[data[0]] = {'password': data[1], 'id': data[2], 'gender': data[3]}
            id_to_accounts_dict[data[2]] = data[0]
            returnable = data[1] if id_or_password_or_gender == 'password' else data[2] if id_or_password_or_gender == 'id' else data[3]
            if RU:
                return [data[0], returnable]
            return returnable
        return None

def find_username_from_id(user_id):
    try:
        return id_to_accounts_dict[user_id]
    except KeyError:
        username = db_sql("""SELECT username FROM accounts WHERE id = ?;""", 'accounts', params=[user_id], chat_room=False)[0][0]
        if username:
            id_to_accounts_dict[user_id] = username
            return username
        return None


true = True
false = False

def remove_go_spaces(string):
    try:
        while True:
            if list(string)[0] == ' ':
                string = list(string)
                string.pop(0)
                string = ''.join(string)
            else:
                break
        while True:
            if list(string)[-1] == ' ':
                string = list(string)
                string.pop()
                string = ''.join(string)
            else:
                break
        return string
    except IndexError:
        return string


def split(string):
    if string == '' or string is None:
        return []
    return string.split('-')


def join(lst):
    clean_list = []
    for item in lst:
        if item is not None and item != '':
            clean_list.append(item)
    return '-'.join(clean_list) if clean_list else ''


def parse_reactions_ids(reaction_str):
    if not reaction_str:
        return {}
    reactions = {}
    parts = reaction_str.split(',')
    for part in parts:
        if part:
            emoji = part[0]
            ids = part[1:].split('-')
            reactions[emoji] = [uid for uid in ids if uid]
    return reactions

def encode_reactions_ids(reaction_dict):
    parts = []
    for emoji, ids in reaction_dict.items():
        if ids:
            parts.append(emoji + '-'.join(ids))
    return ','.join(parts)

def get_reactions_with_usernames(reaction_str):
    parsed = parse_reactions_ids(reaction_str)
    result = []
    for emoji, ids in parsed.items():
        users = []
        for uid in ids:
            username = find_username_from_id(int(uid))
            if username:
                users.append(username)
        if users:
            result.append({'emoji': emoji, 'users': users})
    return result



# Create application and Server

app = Flask(__name__)
app.secret_key = secrets.token_hex(64)
Server = SocketIO(app, max_http_payload_size=50 * 1024 * 1024)


accounts_lock = Lock()
rooms_lock = Lock()
boys_dm_lock = Lock()
girls_dm_lock = Lock()
last_read_lock = Lock()
gif_whitelist_lock = Lock()

if not os.path.exists("mainroom.db"):
    room_db = sqlite3.connect("mainroom.db")
    room_cursor = room_db.cursor()
    room_cursor.execute('''
        CREATE TABLE messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            message TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            reply_id INTEGER NOT NULL,
            reactions TEXT NOT NULL,
            upload TEXT NOT NULL,
            deleted BOOLEAN NOT NULL DEFAULT 0
        );
    ''')
    room_db.close()


# Create tables if databases didn't exist
if not os.path.exists("accounts.db"):
    accounts_db = sqlite3.connect("accounts.db")
    accounts_cursor = accounts_db.cursor()
    accounts_cursor.execute('''
        CREATE TABLE accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            password TEXT NOT NULL,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            email TEXT NOT NULL,
            dob TEXT NOT NULL,
            gender TEXT NOT NULL,
            theme TEXT NOT NULL,
            room TEXT NOT NULL,
            dms TEXT NOT NULL
        );
    ''')
    accounts_db.close()

# Ensure last_read table exists in dedicated database
if not os.path.exists("last_read.db"):
    lr_db = sqlite3.connect("last_read.db")
    lr_cursor = lr_db.cursor()
    lr_cursor.execute('''
        CREATE TABLE last_read (
            user_id INTEGER,
            target_id TEXT,
            is_dm BOOLEAN,
            last_viewed TEXT,
            PRIMARY KEY (user_id, target_id)
        );
    ''')
    lr_db.commit()
    lr_db.close()


if not os.path.exists("rooms.db"):
    rooms_db = sqlite3.connect("rooms.db")
    rooms_cursor = rooms_db.cursor()
    rooms_cursor.execute('''
        CREATE TABLE rooms (
            roomid INTEGER PRIMARY KEY AUTOINCREMENT,
            room_name TEXT NOT NULL,
            description TEXT NOT NULL,
            room_type TEXT NOT NULL,
            owners TEXT NOT NULL,
            managers TEXT NOT NULL,
            curators TEXT NOT NULL,
            members TEXT NOT NULL,
            emoji TEXT NOT NULL,
            deleted BOOLEAN NOT NULL DEFAULT 0
        );
    ''')
    rooms_cursor.execute("""INSERT INTO rooms (room_name, room_type, description, owners, managers, curators, members, emoji) VALUES (?, ?, ?, ?, ?, ?, ?, ?);""", ('mainroom', 'public', 'The main room for all users', '1', '', '', '', 'MR'))
    rooms_db.commit()
    rooms_db.close()

if not os.path.exists("dms/boys_dm.db"):
    boys_dm_db = sqlite3.connect("dms/boys_dm.db")
    boys_dm_cursor = boys_dm_db.cursor()
    boys_dm_cursor.execute('''
        CREATE TABLE boys_dm (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            convo_hash TEXT NOT NULL,
            sender_id INTEGER NOT NULL,
            message TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            reply_id INTEGER NOT NULL,
            reactions TEXT NOT NULL,
            upload TEXT NOT NULL,
            deleted BOOLEAN NOT NULL DEFAULT 0
        );
    ''')
    boys_dm_db.close()

if not os.path.exists("dms/girls_dm.db"):
    girls_dm_db = sqlite3.connect("dms/girls_dm.db")
    girls_dm_cursor = girls_dm_db.cursor()
    girls_dm_cursor.execute('''
        CREATE TABLE girls_dm (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            convo_hash TEXT NOT NULL,
            sender_id INTEGER NOT NULL,
            message TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            reply_id INTEGER NOT NULL,
            reactions TEXT NOT NULL,
            upload TEXT NOT NULL,
            deleted BOOLEAN NOT NULL DEFAULT 0
        );
    ''')
    girls_dm_db.close()


if not os.path.exists("gif_whitelist.db"):
    gw_db = sqlite3.connect("gif_whitelist.db")
    gw_cursor = gw_db.cursor()
    gw_cursor.execute('''
        CREATE TABLE whitelist_gifs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            giphy_id TEXT NOT NULL UNIQUE
        );
    ''')
    gw_cursor.execute('''
        CREATE TABLE gif_tags (
            gif_id INTEGER NOT NULL,
            keyword TEXT NOT NULL,
            FOREIGN KEY (gif_id) REFERENCES whitelist_gifs(id) ON DELETE CASCADE
        );
    ''')
    gw_cursor.execute('CREATE INDEX idx_gif_tags_keyword ON gif_tags(keyword);')
    gw_db.commit()
    gw_db.close()
else:
    # Migration: check if new schema exists, if not, migrate from old format
    gw_db = sqlite3.connect("gif_whitelist.db")
    gw_cursor = gw_db.cursor()
    gw_cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='whitelist_gifs';")
    if not gw_cursor.fetchone():
        # Old schema exists — migrate
        gw_cursor.execute("SELECT giphy_id FROM gif_whitelist;")
        old_ids = [row[0] for row in gw_cursor.fetchall()]
        gw_cursor.execute('DROP TABLE IF EXISTS gif_whitelist;')
        gw_cursor.execute('''
            CREATE TABLE whitelist_gifs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                giphy_id TEXT NOT NULL UNIQUE
            );
        ''')
        gw_cursor.execute('''
            CREATE TABLE gif_tags (
                gif_id INTEGER NOT NULL,
                keyword TEXT NOT NULL,
                FOREIGN KEY (gif_id) REFERENCES whitelist_gifs(id) ON DELETE CASCADE
            );
        ''')
        gw_cursor.execute('CREATE INDEX idx_gif_tags_keyword ON gif_tags(keyword);')
        for gid in old_ids:
            gw_cursor.execute("INSERT INTO whitelist_gifs (giphy_id) VALUES (?);", (gid,))
        gw_db.commit()
    gw_db.close()

def convert_to_gmt(timestamp):
    # Input example: "Sat Mar 07 2026 15:15:11 GMT-0500 (Eastern Standard Time)"
    try:
        # 1. Clean the string to get just the date and the offset
        # Parts will be: ["Sat Mar 07 2026 15:15:11", "-0500"]
        parts = timestamp.split(' GMT')
        dt_str = parts[0].strip()
        
        # Extract just the numeric offset (e.g., "-0500") before the "(Time Name)"
        offset_str = parts[1].split(' (')[0]
        
        # 2. Parse the main datetime
        dt = datetime.datetime.strptime(dt_str, "%a %b %d %Y %H:%M:%S")
        
        # 3. Calculate the offset hours and minutes
        # The first character is + or -
        sign = -1 if offset_str[0] == '-' else 1
        hours = int(offset_str[1:3])
        minutes = int(offset_str[3:5])
        
        # 4. Apply the inverse of the offset to get back to GMT
        # If user is GMT-0500, we ADD 5 hours to get to 0.
        # If user is GMT+0200, we SUBTRACT 2 hours to get to 0.
        gmt_dt = dt + datetime.timedelta(hours=sign * -hours, minutes=sign * -minutes)
        
        # 5. Return in Military Format (24h)
        return gmt_dt.strftime("%Y-%m-%d %H:%M:%S")
    except Exception as e:
        print(f"Time conversion error: {e}")
        # Fallback to local time if parsing fails
        return datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

room_dict = {'mainroom': {'file_path': 'mainroom.db', 'lock': Lock()}}

#make room databases dict
if os.path.exists("rooms"):
    for file in os.listdir("rooms"):
        if file.endswith(".db"):
            room_nameList = list(file)
            for i in range(3): room_nameList.pop()
            room_name = ''.join(room_nameList)
            file_path = os.path.join("rooms", file)
            file_lock = Lock() 

            room_dict[room_name] = {
                'file_path': file_path,
                'lock': file_lock
            }


@app.route('/<smth>/')
def smth(smth):
    return redirect('/')

@app.route('/<smth>/<smth2>/')
def smth_smth(smth, smth2):
    return redirect('/')

@app.route('/<smth>/<smth2>/<smth3>/')
def smth_smth_smth(smth, smth2, smth3):
    return redirect('/')

@app.route('/<smth>/<smth2>/<smth3>/<smth4>/')
def smth_smth_smth_smth(smth, smth2, smth3, smth4):
    return redirect('/')

@app.route('/<smth>/<smth2>/<smth3>/<smth4>/<smth5>/')
def smth_smth_smth_smth_smth(smth, smth2, smth3, smth4, smth5):
    return redirect('/')


@app.route('/')
def index():
    try:
        username = request.form['username']
        password = request.form['password']

        if check_credentials(username, password):   
            session['username'] = username
            session['password'] = password

            return redirect('/home/')

        else:
            raise werkzeug.exceptions.BadRequestKeyError('Lets get him directed back to the welcome page')

    except werkzeug.exceptions.BadRequestKeyError:
        return render_template('welcome.html')

@app.route('/computer-log-into-server/', methods=['POST'])
def computer_log_into_server():
    try:
        username = request.form['username']
        password = request.form['password']

        if check_credentials(username, password):
            session['username'] = username
            session['password'] = password
            return redirect('/home/')
        else:
            raise werkzeug.exceptions.BadRequestKeyError('Lets get him directed back to the welcome page')

    except werkzeug.exceptions.BadRequestKeyError:
        return redirect('/')

@app.route('/logout/')
def logout():
    session.pop('username', None)
    session.pop('password', None)
    return render_template('logout.html')


@app.route('/home/')
def home():
    try:
        username = session['username']
        password = session['password']

        if check_credentials(username, password):

            theme = db_sql("SELECT theme FROM accounts WHERE username = ?;", 'accounts', params=[username], chat_room=False)[0][0]


            colorsFile = open(f'static/themes/{theme}/colors.txt', 'r')
            colors = ast.literal_eval(colorsFile.read())
            colorsFile.close()

            room = db_sql("SELECT room FROM accounts WHERE username = ?;", 'accounts', params=[username], chat_room=False)[0][0]
            
            if '.$@-@&.' in room:
                room_type = 'dm'
                actual_user_dm_username = room.split('.$@-@&.')[1] if room.split('.$@-@&.')[0] == username else room.split('.$@-@&.')[0]
                room_emoji = f"/static/profile-pictures/{actual_user_dm_username}.png"
            else:
                room_info = db_sql("SELECT room_type, emoji FROM rooms WHERE room_name = ?;", 'rooms', params=[room], chat_room=False)
                room_type = room_info[0][0] if room_info else 'public'
                room_emoji = room_info[0][1] if room_info else '💬'

            return render_template(
                'home.html',
                theme=theme,
                color_dark=colors['color_dark'],
                color_medium=colors['color_medium'],
                color_light=colors['color_light'],
                room=room,
                room_type=room_type,
                room_emoji=room_emoji
            )

        else:
            raise KeyError('Why do people try to hack accounts?')

    except (KeyError, SyntaxError, ValueError):
        return redirect('/')



# Configure upload settings
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
ALLOWED_EXTENSIONS = {'css', 'html', 'js', 'png', 'jpg', 'jpeg', 'gif', 'svg'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/upload/', methods=['GET', 'POST'])
def upload_file():
    if request.method == 'POST':
        if 'file' not in request.files:
            flash('No file selected')
            return redirect(request.url)
        
        file = request.files['file']
        if file.filename == '':
            flash('No file selected')
            return redirect(request.url)
        
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            file_ext = filename.rsplit('.', 1)[1].lower()
            
            # Determine upload directory based on file type
            if file_ext == 'css':
                upload_dir = 'static/css'
            elif file_ext in ['png', 'jpg', 'jpeg', 'gif', 'svg']:
                upload_dir = 'static/graphics'
            elif file_ext == 'js':
                upload_dir = 'static/javascript'
            elif file_ext == 'html':
                upload_dir = 'templates'
            else:
                flash('File type not allowed')
                return redirect(request.url)
            
            # Ensure directory exists
            os.makedirs(upload_dir, exist_ok=True)
            
            # Save file
            file_path = os.path.join(upload_dir, filename)
            file.save(file_path)
            flash(f'File {filename} uploaded successfully to {upload_dir}')
            return redirect(request.url)
        else:
            flash('File type not allowed')
    
    return render_template('upload.html')
    
@app.route('/gif-approve/')
def gif_approve():
    try:
        username = session['username']
        password = session['password']
        if check_credentials(username, password):
            user_id = find_account_id_or_password_or_gender(username, 'id')
            if int(user_id) in [1, 2, 3, 4]:
                return render_template('gif_approve.html', username=username)
            else:
                return "Unauthorized: Admin Only", 403
        return redirect('/')
    except:
        return redirect('/')



def Recv(message, sid):
    print(message)
    msg = ast.literal_eval(message)
    if msg[0] == 'Image Upload':
        print(['Image Upload', {k: (v if k != 'image' else f'<{len(v)} bytes of image data>') for k, v in msg[1].items()}])
    else:
        print(msg)

    if msg[0] == 'Message':
        data = msg[1]
        try:
            setting = data['setting']
            room = data['room']
            username = data['username']
            password = data['password']
            timestamp = data['time-stamp']
            user_message = data['message']
            reply_index = data['reply-index']
            upload = data['upload']
        
        except KeyError:
            return # Dont bother to return a response to someone who is trying to alter the code

        if check_credentials(username, password):
            if setting == 'room':
                
                if check_room_access(room, username):
                    user_id = find_account_id_or_password_or_gender(username, 'id')
                    gmt_timestamp = convert_to_gmt(timestamp)

                    message_id = db_sql("""INSERT INTO messages (user_id, message, timestamp, reply_id, upload, reactions, deleted) VALUES (?, ?, ?, ?, ?, ?, ?);""", room, params=[user_id, user_message, gmt_timestamp, reply_index, upload, "", 0], chat_room=True)
                    if not upload or upload.startswith('http'):
                        Server.send(str(['Message', {'id': message_id, 'username': username, 'message': user_message, 'timestamp': gmt_timestamp, 'reply_id': int(reply_index), 'reactions': [], 'deleted': 0, 'upload': upload}]), room=room)
                else:
                    print(f"[ERROR] User {username} does not have access to room {room}")
            
            elif setting == 'dm':
                # Verify user is a participant in this DM before sending
                if check_dm_access(room, username):
                    actual_user_dm_username = room.split('.$@-@&.')[1] if room.split('.$@-@&.')[0] == username else room.split('.$@-@&.')[0]

                    username_id = find_account_id_or_password_or_gender(username, 'id')

                    important_id = find_account_id_or_password_or_gender(room.split('.$@-@&.')[0], 'id')
                    important_gender = find_account_id_or_password_or_gender(room.split('.$@-@&.')[0], 'gender')
                    un_important_id = find_account_id_or_password_or_gender(room.split('.$@-@&.')[1], 'id')

                    fm_to_gb = {'female': 'girl', 'male': 'boy'}

                    gmt_timestamp = convert_to_gmt(timestamp)

                    convo_hash = f"{important_id}-{un_important_id}"
                    anti_convo_hash = f"{un_important_id}-{important_id}"

                    message_id = db_sql(f"""INSERT INTO {fm_to_gb[important_gender]}s_dm (convo_hash, sender_id, message, timestamp, reply_id, upload, reactions, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?);""", f"{fm_to_gb[important_gender]}s_dm", params=[convo_hash, username_id, user_message, gmt_timestamp, reply_index, upload, "", 0], chat_room=False, provide_id=True)
                    if not upload or upload.startswith('http'):
                        Server.send(str(['Message', {'id': message_id, 'username': username, 'message': user_message, 'timestamp': gmt_timestamp, 'reply_id': int(reply_index), 'reactions': [], 'deleted': 0, 'upload': upload}]), room=room)
                else:
                    print(f"[ERROR] User {username} does not have access to DM room {room}")
            else:
                print(f"[ERROR] Unknown setting '{setting}' for message from {username}")
        else:
            print(f"[ERROR] Invalid credentials for user {username}")

    elif msg[0] == 'Image Upload':
        data = msg[1]
        upload_id = data['upload_id']
        image_data = data['image'] # base64 string
        username = data['username']
        password = data['password']

        if check_credentials(username, password):
            # 1. Process Image
            try:
                # Remove header if present
                if ',' in image_data:
                    image_data = image_data.split(',')[1]
                
                image_bytes = base64.b64decode(image_data)
                img = Image.open(io.BytesIO(image_bytes))
                img = ImageOps.exif_transpose(img) # Fix rotation from phone cameras 
                
                w, h = img.size
                narrowest = min(w, h)
                if narrowest > 800:
                    scale = 800 / narrowest
                    img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
                
                # Save processed image
                while True:
                    save_filename = f"{secrets.token_hex(8)}.jpg"
                    save_path = os.path.join('static', 'uploads', save_filename)
                    if not os.path.exists(save_path):
                        break
                
                img.convert('RGB').save(save_path, 'JPEG', quality=85)
                final_url = f"/static/uploads/{save_filename}"
                
                # 2. Update Database & Check for completion
                # Search across all room databases and DM databases
                all_room_names = list(room_dict.keys())
                target_msg = None
                target_db = None
                is_chat_room = False

                for r in all_room_names:
                    res = db_sql("SELECT id, upload FROM messages WHERE upload LIKE ?;", r, params=[f'%{upload_id}%'], chat_room=True)
                    if res:
                        target_msg = res[0]
                        target_db = r
                        is_chat_room = True
                        break
                
                if not target_msg:
                    # Check DMs
                    for dm_db in ['boys_dm', 'girls_dm']:
                        res = db_sql(f"SELECT id, upload, convo_hash FROM {dm_db} WHERE upload LIKE ?;", dm_db, params=[f'%{upload_id}%'], chat_room=False)
                        if res:
                            target_msg = res[0]
                            target_db = dm_db
                            is_chat_room = False
                            break
                
                if target_msg:
                    msg_id, current_upload = target_msg[0], target_msg[1]
                    # Replace ID with actual URL
                    ids = current_upload.split('|')
                    new_ids = [final_url if x == upload_id else x for x in ids]
                    new_upload = '|'.join(new_ids)
                    
                    if is_chat_room:
                        db_sql("UPDATE messages SET upload = ? WHERE id = ?;", target_db, params=[new_upload, msg_id], chat_room=True)
                    else:
                        db_sql(f"UPDATE {target_db} SET upload = ? WHERE id = ?;", target_db, params=[new_upload, msg_id], chat_room=False)
                    
                    # 3. Broadcast if finished
                    is_finished = True
                    for part in new_upload.split('|'):
                        if not part.startswith('/static/uploads/'):
                            is_finished = False
                            break
                    
                    if is_finished:
                        if is_chat_room:
                            msg_data = db_sql("SELECT user_id, message, timestamp, reply_id, reactions, deleted FROM messages WHERE id = ?;", target_db, params=[msg_id], chat_room=True)[0]
                            room_name = target_db
                        else:
                            msg_data = db_sql(f"SELECT sender_id, message, timestamp, reply_id, reactions, deleted, convo_hash FROM {target_db} WHERE id = ?;", target_db, params=[msg_id], chat_room=False)[0]
                            user1 = find_username_from_id(int(msg_data[6].split('-')[0]))
                            user2 = find_username_from_id(int(msg_data[6].split('-')[1]))
                            room_name = f"{user1}.$@-@&.{user2}" if user1 and user2 else None

                        if room_name:
                            broadcast_data = {
                                'id': msg_id,
                                'username': find_username_from_id(msg_data[0]),
                                'message': msg_data[1],
                                'timestamp': msg_data[2],
                                'reply_id': int(msg_data[3]),
                                'reactions': [],
                                'deleted': msg_data[5],
                                'upload': new_upload
                            }
                            Server.send(str(['Message', broadcast_data]), room=room_name)
                    else:
                        pass # still pending
                else:
                    print(f"[ERROR] Could not find message associated with upload_id: {upload_id}")

            except Exception as e:
                print(f"[ERROR] Image Processing Failure: {e}")
                import traceback
                traceback.print_exc()

    elif msg[0] == 'Fetch Room Messages' or msg[0] == 'Fetch DM Messages':
        data = msg[1]
        username = data['username']
        password = data['password']
        room = data['room']
        limit = data['limit']
        offset = data['offset']

        underhead = False

        if str(offset).startswith('>'):
            offset = int(offset[1:])
            underhead = True
        
        elif str(offset).startswith('<'):
            offset = int(offset[1:])

        
        if not check_credentials(username, password):
            return
            
        is_dm = '.$@-@&.' in room
        
        if is_dm:
            if not check_dm_access(room, username):
                return
            messages, actual_user_dm_username, lastTimeStamp, at_bottom = fetch_dm_messages(room, username, limit, offset, underhead)
            db_sql("""UPDATE accounts SET room = ? WHERE username = ?;""", 'accounts', params=[room, username], chat_room=False)
            Server.send(str(['Fetch DM Messages', {'messages': messages, 'room': room, 'profile_picture': f'/static/profile-pictures/{actual_user_dm_username}.png', 'overhead': (offset != -1 and not underhead), 'underhead': underhead, 'lastTimeStamp': lastTimeStamp, 'at_bottom': at_bottom}]), room=sid)
        else:
            if not check_room_access(room, username):
                # Check if it was deleted
                is_deleted = db_sql("SELECT deleted FROM rooms WHERE room_name = ?;", 'rooms', params=[room], chat_room=False)
                if is_deleted and is_deleted[0][0]:
                    Server.send(str(['Room Deleted', {'room': room}]), room=sid)
                return
            messages, lastTimeStamp, at_bottom = fetch_room_messages(room, limit, offset, underhead, username)
            Server.send(str(['Fetch Room Messages', {'messages': messages, 'room': room, 'emoji': db_sql("""SELECT emoji FROM rooms WHERE room_name = ?;""", 'rooms', params=[room], chat_room=False)[0][0], 'overhead': (offset != -1 and not underhead), 'underhead': underhead, 'lastTimeStamp': lastTimeStamp, 'at_bottom': at_bottom}]), room=sid)

    elif msg[0] == 'Join Room':
        data = msg[1]
        room = data['room']
        username = data['username']
        password = data['password']
        
        if check_credentials(username, password):
            # DMs don't need room access check - but we must verify user is a participant
            if check_dm_access(room, username):
                process_room_leave(sid)
                process_room_join(sid, username, room)
                Server.server.enter_room(sid, room)
            elif check_room_access(room, username):
                process_room_leave(sid)
                process_room_join(sid, username, room)
                Server.server.enter_room(sid, room)
            else:
                is_deleted = db_sql("SELECT deleted FROM rooms WHERE room_name = ?;", 'rooms', params=[room], chat_room=False)
                if is_deleted and is_deleted[0][0]:
                    Server.send(str(['Room Deleted', {'room': room}]), room=sid)
                return # User not allowed in room or it is deleted
        else:
            return 

    elif msg[0] == 'Switch Room':
        data = msg[1]
        old_group = data['old-group']
        new_room = data['room']
        username = data['username']
        password = data['password']
        limit = data['limit']
        
        if check_credentials(username, password):
            if check_room_access(new_room, username):
                process_room_leave(sid)
                Server.server.leave_room(sid, old_group)
                Server.server.enter_room(sid, new_room)
                process_room_join(sid, username, new_room)

                db_sql("""UPDATE accounts SET room = ? WHERE username = ?;""", 'accounts', params=[new_room, username], chat_room=False)

                room_info = db_sql("SELECT owners, managers, curators, members, room_type, emoji FROM rooms WHERE room_name = ?;", 'rooms', params=[new_room], chat_room=False)
                my_role = 'Member'
                if room_info:
                    owners_list = split(room_info[0][0])
                    managers_list = split(room_info[0][1])
                    curators_list = split(room_info[0][2])
                    room_data = room_info[0]
                    user_id_str = str(find_account_id_or_password_or_gender(username, 'id'))
                    if user_id_str in owners_list: my_role = 'Owner'
                    elif user_id_str in managers_list: my_role = 'Manager'
                    elif user_id_str in curators_list: my_role = 'Curator'

                messages, lastTimeStamp, at_bottom = fetch_room_messages(new_room, limit, -1, False, username)

                Server.send(str(['Fetch Room Messages', {
                    'messages': messages,
                    'room': new_room,
                    'emoji': room_data[5] if room_data[5] else '💬',
                    'myRole': my_role,
                    'clear': False,
                    'lastTimeStamp': lastTimeStamp,
                    'at_bottom': at_bottom
                }]), room=sid)
            else:
                is_deleted = db_sql("SELECT deleted FROM rooms WHERE room_name = ?;", 'rooms', params=[new_room], chat_room=False)
                if is_deleted and is_deleted[0][0]:
                    Server.send(str(['Room Deleted', {'room': new_room}]), room=sid)
                return # User not allowed in room or it is deleted
        else:
            return 

    elif msg[0] == 'Switch DM':
        data = msg[1]
        old_group = data['old-group']
        new_dm = data['new-dm']
        username = data['username']
        password = data['password']
        limit = data['limit']
        
        if check_credentials(username, password) and check_dm_access(new_dm, username):
            process_room_leave(sid)
            Server.server.leave_room(sid, old_group)
            Server.server.enter_room(sid, new_dm)
            process_room_join(sid, username, new_dm)
            
            messages, actual_user_dm_username, lastTimeStamp, at_bottom = fetch_dm_messages(new_dm, username, limit, -1, False)

            db_sql("""UPDATE accounts SET room = ? WHERE username = ?;""", 'accounts', params=[new_dm, username], chat_room=False)
            
            Server.send(str(['Fetch DM Messages', {'messages': messages, 'room': new_dm, 'profile_picture': f'/static/profile-pictures/{actual_user_dm_username}.png', 'clear': False, 'lastTimeStamp': lastTimeStamp, 'at_bottom': at_bottom}]), room=sid)

    elif msg[0] == 'Leave Room':
        data = msg[1]
        room = data['room']
        username = data['username']
        password = data['password']
        
        if check_credentials(username, password):
            process_room_leave(sid)
            Server.server.leave_room(sid, room)

    elif msg[0] == 'Get Rooms':
        data = msg[1]
        username = data['username']
        password = data['password']
        roomtype = data['roomtype']
        
        if check_credentials(username, password):
                all_rooms = db_sql("""SELECT room_name, room_type, description, owners, managers, curators, members, emoji FROM rooms WHERE deleted = 0;""", 'rooms', chat_room=False)
                user_rooms = []

                user_id = find_account_id_or_password_or_gender(username, 'id')
                
                for room in all_rooms:
                    room_name = room[0]
                    has_access = False
                    
                    if room[1] == 'public' and roomtype == 'public':
                        has_access = True
                    elif room[1] == 'private' and roomtype == 'private':
                        owners = split(room[3])
                        managers = split(room[4])
                        curators = split(room[5])
                        members = split(room[6])

                        all_members = owners+managers+curators+members
                        
                        if str(user_id) in all_members:
                            has_access = True

                    if has_access:
                        last_read_entry = db_sql("""SELECT last_viewed FROM last_read WHERE user_id = ? AND target_id = ? AND is_dm = 0;""", 'last_read', params=[user_id, room_name], chat_room=False)
                        lastTimeStamp = False
                        
                        if last_read_entry:
                            lv = last_read_entry[0][0]
                            res = db_sql("SELECT id FROM messages WHERE timestamp > ? LIMIT 1;", room_name, params=[lv], chat_room=True)
                            if res:
                                lastTimeStamp = lv
                        else:
                            lastTimeStamp = '1970-01-01 00:00:00'
                            
                        user_rooms.append({'name': room_name, 'description': room[2], 'emoji': room[7], 'lastTimeStamp': lastTimeStamp})

                Server.send(str(['Get Rooms', user_rooms]), room=sid)


    elif msg[0] == 'Get Dms':
        data = msg[1]
        username = data['username']
        password = data['password']
        
        if check_credentials(username, password):
            dms = []
            dms_ids = split(db_sql("""SELECT dms FROM accounts WHERE username = ?;""", 'accounts', params=[username], chat_room=False)[0][0])
            user_id = find_account_id_or_password_or_gender(username, 'id')
            
            if dms_ids:
                for dm in dms_ids:
                    actual_dm_id = str(dm)
                    if actual_dm_id[0] == 'u':
                        actual_dm_id = actual_dm_id[1:]
                        
                    dm_info_row = db_sql("""SELECT username, first_name, last_name, id FROM accounts WHERE id = ?;""", 'accounts', params=[actual_dm_id], chat_room=False)
                    if dm_info_row:
                        dm_info = dm_info_row[0]
                        target_id = f"{min(int(user_id), int(dm_info[3]))}-{max(int(user_id), int(dm_info[3]))}"
                        last_read_entry = db_sql("""SELECT last_viewed FROM last_read WHERE user_id = ? AND target_id = ? AND is_dm = 1;""", 'last_read', params=[user_id, target_id], chat_room=False)
                        
                        lastTimeStamp = False
                        
                        convo_hash = f"{user_id}-{dm_info[3]}"
                        anti_convo_hash = f"{dm_info[3]}-{user_id}"
                        
                        if last_read_entry:
                            lv = last_read_entry[0][0]
                            # check if there are new messages
                            res_b = db_sql("SELECT id FROM boys_dm WHERE (convo_hash = ? OR convo_hash = ?) AND timestamp > ? LIMIT 1;", 'boys_dm', params=[convo_hash, anti_convo_hash, lv], chat_room=False)
                            res_g = db_sql("SELECT id FROM girls_dm WHERE (convo_hash = ? OR convo_hash = ?) AND timestamp > ? LIMIT 1;", 'girls_dm', params=[convo_hash, anti_convo_hash, lv], chat_room=False)
                            if res_b or res_g:
                                lastTimeStamp = lv
                        else:
                            lastTimeStamp = '1970-01-01 00:00:00'
                            
                        dms.append({'username': dm_info[0], 'first_name': dm_info[1], 'last_name': dm_info[2], 'lastTimeStamp': lastTimeStamp})
                        
            Server.send(str(['Get Dms', dms]), room=sid)

    elif msg[0] == 'Added Reaction':
        data = msg[1]
        username = data['username']
        password = data['password']
        index = data['index']
        room = data['room']
        reaction = data['emoji']

        if check_credentials(username, password):
            user_id = str(find_account_id_or_password_or_gender(username, 'id'))
            if '.$@-@&.' in room:
                if check_dm_access(room, username):
                    primary_user_id = find_account_id_or_password_or_gender(room.split('.$@-@&.')[0], 'id')
                    primary_gender = find_account_id_or_password_or_gender(room.split('.$@-@&.')[0], 'gender')
                    secondary_user_id = find_account_id_or_password_or_gender(room.split('.$@-@&.')[1], 'id')

                    convo_hash = f"{primary_user_id}-{secondary_user_id}"
                    anti_convo_hash = f"{secondary_user_id}-{primary_user_id}"

                    genderDict = {'male': 'boys_dm', 'female': 'girls_dm'}

                    current_str = db_sql(f"""SELECT reactions FROM {genderDict[primary_gender]} WHERE (convo_hash = ? OR convo_hash = ?) AND id = ?;""", genderDict[primary_gender], params=[convo_hash, anti_convo_hash, index], chat_room=False)[0][0]
                    reactions_dict = parse_reactions_ids(current_str)
                    if reaction not in reactions_dict:
                        reactions_dict[reaction] = []
                    if user_id not in reactions_dict[reaction]:
                        reactions_dict[reaction].append(user_id)
                    new_str = encode_reactions_ids(reactions_dict)
                    
                    db_sql(f"""UPDATE {genderDict[primary_gender]} SET reactions = ? WHERE (convo_hash = ? OR convo_hash = ?) AND id = ?;""", genderDict[primary_gender], params=[new_str, convo_hash, anti_convo_hash, index], chat_room=False)

                    Server.send(str(['Added Reaction', {'emoji': reaction, 'username': username, 'index': index}]), room=room)
            else:
                if check_room_access(room, username):
                    current_str = db_sql("""SELECT reactions FROM messages WHERE id = ?;""", room, params=[index], chat_room=True)[0][0]
                    reactions_dict = parse_reactions_ids(current_str)
                    if reaction not in reactions_dict:
                        reactions_dict[reaction] = []
                    if user_id not in reactions_dict[reaction]:
                        reactions_dict[reaction].append(user_id)
                    new_str = encode_reactions_ids(reactions_dict)
                    
                    db_sql("""UPDATE messages SET reactions = ? WHERE id = ?;""", room, params=[new_str, index], chat_room=True)
                    
                    Server.send(str(['Added Reaction', {'emoji': reaction, 'username': username, 'index': index}]), room=room)

    elif msg[0] == 'Removed Reaction':
        data = msg[1]
        username = data['username']
        password = data['password']
        index = data['index']
        room = data['room']
        reaction = data['emoji']

        if check_credentials(username, password):
            user_id = str(find_account_id_or_password_or_gender(username, 'id'))
            if '.$@-@&.' in room:
                if check_dm_access(room, username):
                    primary_user_id = find_account_id_or_password_or_gender(room.split('.$@-@&.')[0], 'id')
                    primary_gender = find_account_id_or_password_or_gender(room.split('.$@-@&.')[0], 'gender')
                    secondary_user_id = find_account_id_or_password_or_gender(room.split('.$@-@&.')[1], 'id')

                    convo_hash = f"{primary_user_id}-{secondary_user_id}"
                    anti_convo_hash = f"{secondary_user_id}-{primary_user_id}"

                    genderDict = {'male': 'boys_dm', 'female': 'girls_dm'}

                    current_str = db_sql(f"""SELECT reactions FROM {genderDict[primary_gender]} WHERE (convo_hash = ? OR convo_hash = ?) AND id = ?;""", genderDict[primary_gender], params=[convo_hash, anti_convo_hash, index], chat_room=False)[0][0]
                    reactions_dict = parse_reactions_ids(current_str)
                    if reaction in reactions_dict and user_id in reactions_dict[reaction]:
                        reactions_dict[reaction].remove(user_id)
                        if not reactions_dict[reaction]:
                            del reactions_dict[reaction]
                    new_str = encode_reactions_ids(reactions_dict)

                    db_sql(f"""UPDATE {genderDict[primary_gender]} SET reactions = ? WHERE (convo_hash = ? OR convo_hash = ?) AND id = ?;""", genderDict[primary_gender], params=[new_str, convo_hash, anti_convo_hash, index], chat_room=False)

                    Server.send(str(['Removed Reaction', {'emoji': reaction, 'username': username, 'index': index}]), room=room)  
            else:
                if check_room_access(room, username):
                    current_str = db_sql("""SELECT reactions FROM messages WHERE id = ?;""", room, params=[index], chat_room=True)[0][0]
                    reactions_dict = parse_reactions_ids(current_str)
                    if reaction in reactions_dict and user_id in reactions_dict[reaction]:
                        reactions_dict[reaction].remove(user_id)
                        if not reactions_dict[reaction]:
                            del reactions_dict[reaction]
                    new_str = encode_reactions_ids(reactions_dict)
                    
                    db_sql("""UPDATE messages SET reactions = ? WHERE id = ?;""", room, params=[new_str, index], chat_room=True)
                    
                    Server.send(str(['Removed Reaction', {'emoji': reaction, 'username': username, 'index': index}]), room=room)  

    elif msg[0] == 'Fetch Special Reply Message':
        data = msg[1]
        print(data)
        username = data['username']
        password = data['password']
        index = data['index']
        orgIndex = data['orgIndex']
        room = data['room']

        if check_credentials(username, password):
            if '.$@-@&.' in room:
                if check_dm_access(room, username):
                    primary_user_id = find_account_id_or_password_or_gender(room.split('.$@-@&.')[0], 'id')
                    primary_gender = find_account_id_or_password_or_gender(room.split('.$@-@&.')[0], 'gender')
                    secondary_user_id = find_account_id_or_password_or_gender(room.split('.$@-@&.')[1], 'id')

                    convo_hash = f"{primary_user_id}-{secondary_user_id}"
                    anti_convo_hash = f"{secondary_user_id}-{primary_user_id}"

                    genderDict = {'male': 'boys_dm', 'female': 'girls_dm'}

                    user_id, message_text, timestamp, reply_id, upload, reactions, is_deleted = db_sql(f"""SELECT sender_id, message, timestamp, reply_id, upload, reactions, deleted FROM {genderDict[primary_gender]} WHERE (convo_hash = ? OR convo_hash = ?) AND id = ?;""", genderDict[primary_gender], params=[convo_hash, anti_convo_hash, index], chat_room=False)[0]

                    original_username = find_username_from_id(user_id)
                    
                    # Soft-delete masking
                    if is_deleted:
                        message_text = "(message has been deleted)"
                        upload = ""

                    message = {
                        'id': index,
                        'username': original_username,
                        'message': message_text,
                        'timestamp': timestamp,
                        'reply_id': reply_id,
                        'upload': upload,
                        'reactions': get_reactions_with_usernames(reactions),
                        'deleted': is_deleted
                    }
                    Server.send(str(['Fetch Special Reply Message', {'message': message, 'orgIndex': orgIndex}]), room=sid)
            else:
                if check_room_access(room, username):
                    user_id, message_text, timestamp, reply_id, upload, reactions, is_deleted = db_sql("""SELECT user_id, message, timestamp, reply_id, upload, reactions, deleted FROM messages WHERE id = ?;""", room, params=[index], chat_room=True)[0]
                    original_username = find_username_from_id(user_id)
                    
                    # Soft-delete masking
                    if is_deleted:
                        message_text = "(message has been deleted)"
                        upload = ""

                    message = {
                        'id': index,
                        'username': original_username,
                        'message': message_text,
                        'timestamp': timestamp,
                        'reply_id': reply_id,
                        'upload': upload,
                        'reactions': get_reactions_with_usernames(reactions),
                        'deleted': is_deleted
                    }
                    Server.send(str(['Fetch Special Reply Message', {'message': message, 'orgIndex': orgIndex}]), room=sid)

    elif msg[0] == 'Fetch Special Reply Messages':
        data = msg[1]
        username = data['username']
        password = data['password']
        index = data['index']
        room = data['room']
        limit = data['limit']
        
        if check_credentials(username, password):
            if '.$@-@&.' in room:
                if check_dm_access(room, username):
                    primary_user_id = find_account_id_or_password_or_gender(room.split('.$@-@&.')[0], 'id')
                    primary_gender = find_account_id_or_password_or_gender(room.split('.$@-@&.')[0], 'gender')
                    secondary_user_id = find_account_id_or_password_or_gender(room.split('.$@-@&.')[1], 'id')

                    convo_hash = f"{primary_user_id}-{secondary_user_id}"
                    anti_convo_hash = f"{secondary_user_id}-{primary_user_id}"

                    genderDict = {'male': 'boys_dm', 'female': 'girls_dm'}

                    raw_messages = db_sql(f"""
                        SELECT id, sender_id, message, timestamp, reply_id, upload, reactions, deleted 
                        FROM {genderDict[primary_gender]} 
                        WHERE (convo_hash = ? OR convo_hash = ?) AND id >= ? AND id <= ?
                        ORDER BY id ASC;
                    """, genderDict[primary_gender], params=[convo_hash, anti_convo_hash, index - limit, index + limit], chat_room=False)
                                        

                    messages = []
                    for msg in raw_messages:
                        # Soft-delete masking
                        msg_text = msg[2]
                        upload_data = msg[5]
                        if msg[7]: # deleted
                            msg_text = "(message has been deleted)"
                            upload_data = ""

                        messages.append({
                            'id': msg[0],
                            'username': find_username_from_id(msg[1]),
                            'message': msg_text,
                            'timestamp': msg[3],
                            'reply_id': msg[4],
                            'upload': upload_data,
                            'reactions': get_reactions_with_usernames(msg[6])
                        })
                    Server.send(str(['Fetch Special Reply Messages', {'messages': messages, 'index': index}]), room=sid)
            else:
                if check_room_access(room, username):
                    raw_messages = db_sql("""SELECT id, user_id, message, timestamp, reply_id, upload, reactions, deleted FROM messages WHERE id >= ? AND id <= ?;""", room, params=[index - limit, index + limit], chat_room=True)
                    messages = []
                    for msg in raw_messages:
                        # Soft-delete masking
                        msg_text = msg[2]
                        upload_data = msg[5]
                        if msg[7]: # deleted
                            msg_text = "(message has been deleted)"
                            upload_data = ""

                        messages.append({
                            'id': msg[0],
                            'username': find_username_from_id(msg[1]),
                            'message': msg_text,
                            'timestamp': msg[3],
                            'reply_id': msg[4],
                            'upload': upload_data,
                            'reactions': get_reactions_with_usernames(msg[6])
                        })
                    Server.send(str(['Fetch Special Reply Messages', {'messages': messages, 'index': index}]), room=sid)


    elif msg[0] == 'Secret Log In':
        data = msg[1]
        username = data['username']
        password = data['password']

        password = find_account_id_or_password_or_gender(username, 'password', RGS=True)

        if password:
            if remove_go_spaces(password.lower()) == remove_go_spaces(password.lower()):
                Server.send(str(['Log In Results', username, 'Success', password]), room=sid)

            else:
                return # Invalid password
    
        else:
            return # User not found
    
            
    elif msg[0] == 'Log In':
        data = msg[1]
        username = data['username']
        password = data['password']

        username, password = find_account_id_or_password_or_gender(username, 'password', RGS=True, RU=True)

        if password:
            if remove_go_spaces(password.lower()) == remove_go_spaces(password.lower()):
                Server.send(str(['Log In Results', username, 'Success', password]), room=sid)

            else:
                Server.send(str(['Log In Results', username, 'Wrong Password']), room=sid)
    
        else:
            Server.send(str(['Log In Results', username, 'Wrong Username']), room=sid)

    elif msg[0] == 'Create DM':
        data = msg[1]
        username = data['username']
        password = data['password']
        user = data['user']

        if check_credentials(username, password):
            username_id = find_account_id_or_password_or_gender(username, 'id')
            user_id = find_account_id_or_password_or_gender(user, 'id')

            query = split(remove_go_spaces(db_sql("""SELECT dms FROM accounts WHERE username = ?;""", 'accounts', params=[username], chat_room=False)[0][0]).replace('u', ''))
            if remove_go_spaces(str(user_id)) in query:
                Server.send(str(['Create DM Results', 'DM Already Exists']), room=sid)
                return
            
            else:
                query.append(str(user_id))
                db_sql("""UPDATE accounts SET dms = ? WHERE username = ?;""", 'accounts', params=[join(query), username], chat_room=False)
                user_dms = split(remove_go_spaces(db_sql("""SELECT dms FROM accounts WHERE username = ?;""", 'accounts', params=[user], chat_room=False)[0][0]).replace('u', ''))
                if remove_go_spaces(str(username_id)) not in user_dms:
                    user_dms.append(str(username_id))
                    db_sql("""UPDATE accounts SET dms = ? WHERE username = ?;""", 'accounts', params=[join(user_dms), user], chat_room=False)
                
                Server.send(str(['Create DM Results', 'DM Created']), room=sid)

    elif msg[0] == 'Create Account':
        data = msg[1]
        
        username = remove_go_spaces(data['username'])

        # Check if username already exists (case-insensitive and no spaces)
        clean_username = remove_go_spaces(username.lower())
        queryResult = db_sql("SELECT username FROM accounts;", 'accounts', chat_room=False)
        existing_usernames = [remove_go_spaces(row[0].lower()) for row in queryResult]

        if clean_username in existing_usernames:
            Server.send(str(['Create Account Results', data['username'], 'Username Exists']), room=sid)
            return

        password = remove_go_spaces(data['password'])
        first_name = remove_go_spaces(data['first_name'])
        last_name = remove_go_spaces(data['last_name'])
        email = remove_go_spaces(data['email'])
        dob = data['dob']
        gender = data['gender']

        # Username available - create account
        db_sql("""INSERT INTO accounts (username, password, first_name, last_name, email, dob, gender, theme, room, dms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);""", 'accounts', params=[username, password, first_name, last_name, email, dob, gender, 'classic', 'mainroom', '1-2'], chat_room=False)

        # Get new user ID and add to Server/Admin dms
        new_id = str(find_account_id_or_password_or_gender(username, 'id'))
        server_dms = split(db_sql("SELECT dms FROM accounts WHERE id = 1;", 'accounts', chat_room=False)[0][0])
        if new_id not in server_dms:
            server_dms.append(new_id)
            db_sql("UPDATE accounts SET dms = ? WHERE id = 1;", 'accounts', params=[join(server_dms)], chat_room=False)
        admin_dms = split(db_sql("SELECT dms FROM accounts WHERE id = 2;", 'accounts', chat_room=False)[0][0])
        if new_id not in admin_dms:
            admin_dms.append(new_id)
            db_sql("UPDATE accounts SET dms = ? WHERE id = 2;", 'accounts', params=[join(admin_dms)], chat_room=False)

        shutil.copyfile(f'static/graphics/default{gender.capitalize()}.png', f'static/profile-pictures/{username}.png')
        
        Server.send(str(['Create Account Results', data['username'], 'Success']), room=sid)

    elif msg[0] == 'Create Room':
        data = msg[1]
        username = data['username']
        password = data['password']
        roomname = data['roomname']
        description = data['description']
        emoji = data['emoji']
        roomtype = data['roomtype']

        if check_credentials(username, password):
            # Check for ANY existing room with this name (even deleted ones)
            query = db_sql("""SELECT * FROM rooms WHERE LOWER(room_name) = ?;""", 'rooms', params=[roomname.lower()], chat_room=False)
            if query:
                Server.send(str(['Create Room Results', 'Someone already chose this room name, please choose another.']), room=sid)
                return
            
            else:
                new_room_connection = sqlite3.connect(f'rooms/{roomname}.db')
                new_room_cursor = new_room_connection.cursor()

                new_room_cursor.execute('''
                    CREATE TABLE messages (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        message TEXT NOT NULL,
                        timestamp TEXT NOT NULL,
                        reply_id INTEGER NOT NULL,
                        reactions TEXT NOT NULL,
                        upload TEXT NOT NULL,
                        deleted BOOLEAN NOT NULL DEFAULT 0
                    );
                ''')
                
                new_room_connection.close()

                room_dict[roomname] = {'file_path': f'rooms/{roomname}.db', 'lock': Lock()}

                db_sql("""INSERT INTO rooms (room_name, description, room_type, owners, managers, curators, members, emoji) VALUES (?, ?, ?, ?, ?, ?, ?, ?);""", 'rooms', params=[roomname, description, roomtype, str(find_account_id_or_password_or_gender(username, 'id')), '', '', '', emoji], chat_room=False)
                
                Server.send(str(['Create Room Results', 'Room Created']), room=sid)

    elif msg[0] == 'Get Room Members':
        data = msg[1]
        username = data['username']
        password = data['password']
        room = data['room']
        
        if check_credentials(username, password) and check_room_access(room, username):
            room_info = db_sql("SELECT owners, managers, curators, members, room_type FROM rooms WHERE room_name = ?;", 'rooms', params=[room], chat_room=False)
            if room_info:
                owners_list = split(room_info[0][0])
                managers_list = split(room_info[0][1])
                curators_list = split(room_info[0][2])
                members_list = split(room_info[0][3])
                room_type = room_info[0][4]
                
                my_id = str(find_account_id_or_password_or_gender(username, 'id'))
                my_role = 'Member'
                if my_id in owners_list: my_role = 'Owner'
                elif my_id in managers_list: my_role = 'Manager'
                elif my_id in curators_list: my_role = 'Curator'
                
                members_data = []
                # Fetch usernames and names for each id
                def append_users(id_list, role_name):
                    for uid in id_list:
                        if not uid.strip(): continue
                        u_info = db_sql("SELECT username, first_name, last_name FROM accounts WHERE id = ?;", 'accounts', params=[uid], chat_room=False)
                        if u_info:
                            members_data.append({
                                'username': u_info[0][0],
                                'firstName': u_info[0][1],
                                'lastName': u_info[0][2],
                                'role': role_name
                            })
                
                append_users(owners_list, 'Owner')
                append_users(managers_list, 'Manager')
                append_users(curators_list, 'Curator')
                append_users(members_list, 'Member')
                
                Server.send(str(['Get Room Members Results', {'members': members_data, 'myRole': my_role, 'roomType': room_type}]), room=sid)

    elif msg[0] == 'Update Room Member':
        data = msg[1]
        username = data['username']
        password = data['password']
        room = data['room']
        target_username = data['target_username']
        action = data['action'] # 'promote', 'demote', 'remove'
        
        if check_credentials(username, password) and check_room_access(room, username):
            room_info = db_sql("SELECT owners, managers, curators, members, room_type FROM rooms WHERE room_name = ?;", 'rooms', params=[room], chat_room=False)
            if room_info:
                owners_list = split(room_info[0][0])
                managers_list = split(room_info[0][1])
                curators_list = split(room_info[0][2])
                members_list = split(room_info[0][3])
                room_type = room_info[0][4]
                
                my_id = str(find_account_id_or_password_or_gender(username, 'id'))
                target_id = str(find_account_id_or_password_or_gender(target_username, 'id'))
                
                if not target_id: return
                if my_id == target_id: return # CANNOT EDIT YOURSELF
                
                my_role = 'Member'
                if my_id in owners_list: my_role = 'Owner'
                elif my_id in managers_list: my_role = 'Manager'
                elif my_id in curators_list: my_role = 'Curator'
                
                target_role = 'Member'
                if target_id in owners_list: target_role = 'Owner'
                elif target_id in managers_list: target_role = 'Manager'
                elif target_id in curators_list: target_role = 'Curator'
                
                # Role Permission Check:
                # Owners can edit their own rank (other Owners) and below.
                # Managers can edit ranks STRICTLY below them (Curator, Member).
                # Curators can edit ranks STRICTLY below them (Member).
                can_this_role_edit = False
                if my_role == 'Owner':
                    can_this_role_edit = True # Can edit Other Owners, Managers, Curators, Members
                elif my_role == 'Manager':
                    if target_role in ['Curator', 'Member']: can_this_role_edit = True
                elif my_role == 'Curator':
                    if target_role == 'Member': can_this_role_edit = True

                if not can_this_role_edit: return
                
                # Check permissions and linearity
                success = False
                
                if action == 'promote':
                    if target_role == 'Member':
                        if room_type == 'public' and (my_role in ['Owner', 'Manager']):
                            members_list.remove(target_id)
                            managers_list.append(target_id)
                            success = True
                        elif room_type == 'private' and (my_role in ['Owner', 'Manager', 'Curator']):
                            members_list.remove(target_id)
                            curators_list.append(target_id)
                            success = True
                            
                    elif target_role == 'Curator' and room_type == 'private' and my_role in ['Owner', 'Manager']:
                        curators_list.remove(target_id)
                        managers_list.append(target_id)
                        success = True
                        
                    elif target_role == 'Manager' and my_role == 'Owner':
                        managers_list.remove(target_id)
                        owners_list.append(target_id)
                        success = True
                        
                elif action == 'demote':
                    if target_role == 'Owner' and my_role == 'Owner':
                        owners_list.remove(target_id)
                        managers_list.append(target_id)
                        success = True
                    elif target_role == 'Manager':
                        if my_role == 'Owner':
                           managers_list.remove(target_id)
                           if room_type == 'public': 
                               success = True
                           else: 
                               curators_list.append(target_id)
                               success = True
                    elif target_role == 'Curator' and room_type == 'private' and (my_role in ['Owner', 'Manager']):
                        curators_list.remove(target_id)
                        members_list.append(target_id)
                        success = True
                        
                elif action == 'remove':
                    # Member can be removed by Curator+
                    # Curator can be removed by Manager+
                    # Manager can be removed by Owner+
                    # Other Owner can be removed by Owner+
                    
                    if target_role == 'Member' and my_role in ['Owner', 'Manager', 'Curator']:
                        members_list.remove(target_id)
                        success = True
                    elif target_role == 'Curator' and my_role in ['Owner', 'Manager']:
                        curators_list.remove(target_id)
                        success = True
                    elif target_role == 'Manager' and my_role == 'Owner':
                        managers_list.remove(target_id)
                        success = True
                    elif target_role == 'Owner' and my_role == 'Owner':
                        owners_list.remove(target_id)
                        success = True
                        
                if success:
                    db_sql("UPDATE rooms SET owners=?, managers=?, curators=?, members=? WHERE room_name=?;", 'rooms', params=[join(owners_list), join(managers_list), join(curators_list), join(members_list), room], chat_room=False)
                    Server.send(str(['Room Member Updated', {}]), room=room)

    elif msg[0] == 'Add Room Member':
        data = msg[1]
        username = data['username']
        password = data['password']
        room = data['room']
        new_username = data['new_username']
        
        if check_credentials(username, password) and check_room_access(room, username):
            room_info = db_sql("SELECT owners, managers, curators, members, room_type FROM rooms WHERE room_name = ?;", 'rooms', params=[room], chat_room=False)
            if room_info:
                owners_list = split(room_info[0][0])
                managers_list = split(room_info[0][1])
                curators_list = split(room_info[0][2])
                members_list = split(room_info[0][3])
                room_type = room_info[0][4]
                
                my_id = str(find_account_id_or_password_or_gender(username, 'id'))
                
                # Check if I have permission to add (Owner, Manager, Curator)
                if my_id not in owners_list and my_id not in managers_list and my_id not in curators_list:
                    return
                
                target_user = find_account_id_or_password_or_gender(new_username, 'id')
                
                if not target_user:
                    Server.send(str(['Room Error', f"User '{new_username}' not found."]), room=sid)
                    return
                
                new_id = str(target_user)
                
                if new_id not in owners_list and new_id not in managers_list and new_id not in curators_list and new_id not in members_list:
                    if room_type == 'public':
                        managers_list.append(new_id)
                        db_sql("UPDATE rooms SET managers=? WHERE room_name=?;", 'rooms', params=[join(managers_list), room], chat_room=False)
                    else:
                        members_list.append(new_id)
                        db_sql("UPDATE rooms SET members=? WHERE room_name=?;", 'rooms', params=[join(members_list), room], chat_room=False)
                    Server.send(str(['Room Member Updated', {}]), room=room)

    elif msg[0] == 'Delete Room':
        data = msg[1]
        username = data['username']
        password = data['password']
        room = data['room']
        
        if check_credentials(username, password) and room.lower() != 'mainroom':
            room_info = db_sql("SELECT owners FROM rooms WHERE room_name = ?;", 'rooms', params=[room], chat_room=False)
            if room_info:
                owners_list = split(room_info[0][0])
                my_id = str(find_account_id_or_password_or_gender(username, 'id'))
                
                if my_id in owners_list:
                    # 1. Soft-delete in rooms.db
                    db_sql("UPDATE rooms SET deleted = 1 WHERE room_name = ?;", 'rooms', params=[room], chat_room=False)
                    
                    # 2. DO NOT delete room database file (Data Retention)
                    
                    # 3. Update room_dict
                    if room in room_dict:
                        del room_dict[room]
                    
                    # 4. Notify everyone in the room to leave
                    Server.send(str(['Room Deleted', {'room': room}]), room=room)
                    print(f"Room '{room}' soft-deleted by owner '{username}'")
                else:
                    Server.send(str(['Room Error', "Only owners can delete this room."]), room=sid)
        elif room.lower() == 'mainroom':
            Server.send(str(['Room Error', "The mainroom cannot be deleted."]), room=sid)

    elif msg[0] == 'Mark Unread':
        data = msg[1]
        username = data['username']
        password = data['password']
        room = data['room']
        index = data['index']
        
        if check_credentials(username, password):
            try:
                index = int(index)
            except (ValueError, TypeError):
                return
                
            user_id = find_account_id_or_password_or_gender(username, 'id')
            is_dm = '.$@-@&.' in room
            has_access = False
            
            if is_dm:
                has_access = check_dm_access(room, username)
            else:
                has_access = check_room_access(room, username)
                
            if has_access:
                prev_timestamp = None
                target_id = room
                
                if is_dm:
                    primary_user_id = find_account_id_or_password_or_gender(room.split('.$@-@&.')[0], 'id')
                    primary_gender = find_account_id_or_password_or_gender(room.split('.$@-@&.')[0], 'gender')
                    secondary_user_id = find_account_id_or_password_or_gender(room.split('.$@-@&.')[1], 'id')
                    
                    ids = sorted([int(primary_user_id), int(secondary_user_id)])
                    target_id = f"{ids[0]}-{ids[1]}"
                    
                    convo_hash = f"{primary_user_id}-{secondary_user_id}"
                    anti_convo_hash = f"{secondary_user_id}-{primary_user_id}"
                    
                    fm_to_gb = {'female': 'girls_dm', 'male': 'boys_dm'}
                    db_table = fm_to_gb[primary_gender]
                    
                    curr_msg = db_sql(f"SELECT timestamp FROM {db_table} WHERE (convo_hash = ? OR convo_hash = ?) AND id = ?;", db_table, params=[convo_hash, anti_convo_hash, index], chat_room=False)
                    if curr_msg:
                        try:
                            dt = datetime.datetime.strptime(curr_msg[0][0], "%Y-%m-%d %H:%M:%S") - datetime.timedelta(seconds=1)
                            prev_timestamp = dt.strftime("%Y-%m-%d %H:%M:%S")
                        except Exception:
                            prev_timestamp = "1970-01-01 00:00:00"
                else:
                    target_id = room
                    curr_msg = db_sql("SELECT timestamp FROM messages WHERE id = ?;", room, params=[index], chat_room=True)
                    if curr_msg:
                        try:
                            dt = datetime.datetime.strptime(curr_msg[0][0], "%Y-%m-%d %H:%M:%S") - datetime.timedelta(seconds=1)
                            prev_timestamp = dt.strftime("%Y-%m-%d %H:%M:%S")
                        except Exception:
                            prev_timestamp = "1970-01-01 00:00:00"
                
                if prev_timestamp:
                    db_sql("INSERT OR REPLACE INTO last_read (user_id, target_id, is_dm, last_viewed) VALUES (?, ?, ?, ?);", 'last_read', params=[user_id, target_id, is_dm, prev_timestamp], chat_room=False)
                    
                    if sid in sid_to_room_state:
                        sid_to_room_state[sid]['ignore_next_leave'] = True

    elif msg[0] == 'Delete Message':
        data = msg[1]
        username = data['username']
        password = data['password']
        index = data['index']
        room = data['room']

        if not index: return # Safety check

        if check_credentials(username, password):
            is_dm = '.$@-@&.' in room
            my_id = find_account_id_or_password_or_gender(username, 'id')
            
            can_delete = False
            
            if is_dm:
                # Check if it's the sender
                if check_dm_access(room, username):
                    primary_user_id = find_account_id_or_password_or_gender(room.split('.$@-@&.')[0], 'id')
                    primary_gender = find_account_id_or_password_or_gender(room.split('.$@-@&.')[0], 'gender')
                    fm_to_gb = {'female': 'girl', 'male': 'boy'}
                    db_table = f"{fm_to_gb[primary_gender]}s_dm"
                    
                    message_info = db_sql(f"SELECT sender_id FROM {db_table} WHERE id = ?;", db_table, params=[index], chat_room=False)
                    if message_info and message_info[0][0] == my_id:
                        can_delete = True
            else:
                # Check if it's the sender or admin
                if check_room_access(room, username):
                    message_info = db_sql("SELECT user_id FROM messages WHERE id = ?;", room, params=[index], chat_room=True)
                    if message_info:
                        sender_id = message_info[0][0]
                        if sender_id == my_id:
                            can_delete = True
                        else:
                            # Check if user is owner/manager
                            room_info = db_sql("SELECT owners, managers FROM rooms WHERE room_name = ?;", 'rooms', params=[room], chat_room=False)
                            if room_info:
                                owners = split(room_info[0][0])
                                managers = split(room_info[0][1])
                                if str(my_id) in owners or str(my_id) in managers:
                                    can_delete = True
            
            if can_delete:
                if is_dm:
                    primary_gender = find_account_id_or_password_or_gender(room.split('.$@-@&.')[0], 'gender')
                    fm_to_gb = {'female': 'girl', 'male': 'boy'}
                    db_table = f"{fm_to_gb[primary_gender]}s_dm"
                    db_sql(f"UPDATE {db_table} SET deleted = 1 WHERE id = ?;", db_table, params=[index], chat_room=False)
                else:
                    db_sql("UPDATE messages SET deleted = 1 WHERE id = ?;", room, params=[index], chat_room=True)
                
                Server.send(str(['Message Deleted', {'id': index, 'room': room}]), room=room)

    elif msg[0] == 'Add GIF':
        data = msg[1]
        username = data['username']
        password = data['password']
        giphy_id = data['giphy_id']
        keywords = data['keywords']

        if check_credentials(username, password):
            user_id = find_account_id_or_password_or_gender(username, 'id')
            if int(user_id) in [1, 2, 3, 4]: # Admin accounts
                # Validate giphy_id
                if not giphy_id or not str(giphy_id).strip():
                    print(f"Add GIF Error: Empty giphy_id received from user {username}")
                    Server.send(str(['Add GIF Result', {'status': 'error', 'message': 'Invalid GIF ID'}]), room=sid)
                    return

                giphy_id = str(giphy_id).strip()

                # Clean keywords: lowercase, strip punctuation and spaces
                cleaned_keywords = []
                for kw in keywords:
                    cleaned = clean_keyword(kw)
                    if cleaned and cleaned not in cleaned_keywords:
                        cleaned_keywords.append(cleaned)

                if len(cleaned_keywords) < 1:
                    Server.send(str(['Add GIF Result', {'status': 'error', 'message': 'At least 1 keyword required'}]), room=sid)
                    return

                # Insert gif into whitelist_gifs (or get existing id)
                existing = db_sql("SELECT id FROM whitelist_gifs WHERE giphy_id = ?;", 'gif_whitelist', params=[giphy_id], chat_room=False)
                if existing:
                    gif_db_id = existing[0][0]
                    print(f"Add GIF: Using existing gif_db_id={gif_db_id} for giphy_id={giphy_id}")
                else:
                    gif_db_id = db_sql("INSERT INTO whitelist_gifs (giphy_id) VALUES (?);", 'gif_whitelist', params=[giphy_id], chat_room=False, provide_id=True)
                    print(f"Add GIF: Inserted new gif with gif_db_id={gif_db_id}, giphy_id={giphy_id}")

                if not gif_db_id:
                    print(f"Add GIF Error: Failed to get gif_db_id for giphy_id={giphy_id}")
                    Server.send(str(['Add GIF Result', {'status': 'error', 'message': 'Database error inserting GIF'}]), room=sid)
                    return

                # Insert keywords into gif_tags
                for kw in cleaned_keywords:
                    db_sql("INSERT INTO gif_tags (gif_id, keyword) VALUES (?, ?);", 'gif_whitelist', params=[gif_db_id, kw], chat_room=False)

                Server.send(str(['Add GIF Result', {'status': 'success', 'giphy_id': giphy_id}]), room=sid)
            else:
                Server.send(str(['Add GIF Result', {'status': 'error', 'message': 'Unauthorized - Admin only'}]), room=sid)
        else:
            Server.send(str(['Add GIF Result', {'status': 'error', 'message': 'Invalid password'}]), room=sid)

    elif msg[0] == 'GIF Search':
        data = msg[1]
        username = data['username']
        password = data['password']
        query = data['query']

        if check_credentials(username, password):
            try:
                # Clean the search query same way as keywords
                clean_query = clean_keyword(query)
                if not clean_query:
                    Server.send(str(['GIF Search Results', {'status': 'success', 'results': []}]), room=sid)
                    return

                # Local DB search: find giphy_ids where any keyword STARTS WITH the query
                results = db_sql(
                    "SELECT DISTINCT wg.giphy_id FROM whitelist_gifs wg JOIN gif_tags gt ON wg.id = gt.gif_id WHERE gt.keyword LIKE ? LIMIT 50;",
                    'gif_whitelist', params=[clean_query + '%'], chat_room=False
                )

                gif_list = [{'giphy_id': row[0]} for row in results]
                Server.send(str(['GIF Search Results', {'status': 'success', 'results': gif_list}]), room=sid)
            except Exception as e:
                print(f"GIF Search Error: {e}")
                Server.send(str(['GIF Search Results', {'status': 'error', 'message': 'Internal search error'}]), room=sid)

    elif msg[0] == 'Delete Whitelisted GIF':
        data = msg[1]
        username = data['username']
        password = data['password']
        giphy_id = data['giphy_id']

        if check_credentials(username, password):
            user_id = find_account_id_or_password_or_gender(username, 'id')
            if int(user_id) in [1, 2, 3, 4]: # Admin accounts
                # Delete from whitelist_gifs (gif_tags will be deleted by ON DELETE CASCADE)
                db_sql("DELETE FROM whitelist_gifs WHERE giphy_id = ?;", 'gif_whitelist', params=[giphy_id], chat_room=False)
                print(f"Delete GIF: Removed giphy_id={giphy_id} from whitelist (User: {username})")
                Server.send(str(['Delete Whitelisted GIF Result', {'status': 'success', 'giphy_id': giphy_id}]), room=sid)
            else:
                Server.send(str(['Delete Whitelisted GIF Result', {'status': 'error', 'message': 'Unauthorized - Admin only'}]), room=sid)
        else:
            Server.send(str(['Delete Whitelisted GIF Result', {'status': 'error', 'message': 'Invalid password'}]), room=sid)

    elif msg[0] == 'Get Matching Keywords':
        data = msg[1]
        username = data['username']
        password = data['password']
        query = data.get('query', '')

        if check_credentials(username, password):
            try:
                # Clean query
                clean_query = clean_keyword(query)
                
                # If query is empty, show all unique keywords (limited)
                if not clean_query:
                    results = db_sql(
                        "SELECT DISTINCT keyword FROM gif_tags ORDER BY keyword ASC LIMIT 100;",
                        'gif_whitelist', chat_room=False
                    )
                else:
                    # Match keywords that START WITH the query
                    results = db_sql(
                        "SELECT DISTINCT keyword FROM gif_tags WHERE keyword LIKE ? ORDER BY keyword ASC LIMIT 50;",
                        'gif_whitelist', params=[clean_query + '%'], chat_room=False
                    )
                
                keyword_list = [row[0] for row in results]
                Server.send(str(['Matching Keywords Result', {'status': 'success', 'keywords': keyword_list, 'query': query}]), room=sid)
            except Exception as e:
                print(f"Get Matching Keywords Error: {e}")
                Server.send(str(['Matching Keywords Result', {'status': 'error', 'message': 'Failed to fetch keywords'}]), room=sid)
        else:
            Server.send(str(['Matching Keywords Result', {'status': 'error', 'message': 'Invalid credentials'}]), room=sid)

    elif msg[0] == 'Get GIF Keywords':
        data = msg[1]
        username = data['username']
        password = data['password']
        giphy_id = data['giphy_id']

        if check_credentials(username, password):
            try:
                # Find current keywords for this GIF
                results = db_sql(
                    "SELECT gt.keyword FROM gif_tags gt JOIN whitelist_gifs wg ON gt.gif_id = wg.id WHERE wg.giphy_id = ?;",
                    'gif_whitelist', params=[giphy_id], chat_room=False
                )
                keyword_list = [row[0] for row in results]
                Server.send(str(['Get GIF Keywords Result', {'status': 'success', 'giphy_id': giphy_id, 'keywords': keyword_list}]), room=sid)
            except Exception as e:
                print(f"Get GIF Keywords Error: {e}")
                Server.send(str(['Get GIF Keywords Result', {'status': 'error', 'message': 'Failed to fetch keywords'}]), room=sid)
        else:
            Server.send(str(['Get GIF Keywords Result', {'status': 'error', 'message': 'Invalid credentials'}]), room=sid)

    elif msg[0] == 'Update GIF Keywords':
        data = msg[1]
        username = data['username']
        password = data['password']
        giphy_id = data['giphy_id']
        keywords = data['keywords']

        if check_credentials(username, password):
            user_id = find_account_id_or_password_or_gender(username, 'id')
            if int(user_id) in [1, 2, 3, 4]: # Admin accounts
                try:
                    # 1. Get internal gif_id
                    existing = db_sql("SELECT id FROM whitelist_gifs WHERE giphy_id = ?;", 'gif_whitelist', params=[giphy_id], chat_room=False)
                    if not existing:
                        Server.send(str(['Update GIF Keywords Result', {'status': 'error', 'message': 'GIF not found in whitelist'}]), room=sid)
                        return
                    
                    gif_db_id = existing[0][0]

                    # 2. Clean new keywords
                    cleaned_keywords = []
                    for kw in keywords:
                        cleaned = clean_keyword(kw)
                        if cleaned and cleaned not in cleaned_keywords:
                            cleaned_keywords.append(cleaned)

                    if len(cleaned_keywords) < 1:
                        Server.send(str(['Update GIF Keywords Result', {'status': 'error', 'message': 'At least 1 keyword required'}]), room=sid)
                        return

                    # 3. Delete old tags
                    db_sql("DELETE FROM gif_tags WHERE gif_id = ?;", 'gif_whitelist', params=[gif_db_id], chat_room=False)

                    # 4. Insert new tags
                    for kw in cleaned_keywords:
                        db_sql("INSERT INTO gif_tags (gif_id, keyword) VALUES (?, ?);", 'gif_whitelist', params=[gif_db_id, kw], chat_room=False)

                    print(f"Update GIF: Updated keywords for giphy_id={giphy_id} (User: {username})")
                    Server.send(str(['Update GIF Keywords Result', {'status': 'success', 'giphy_id': giphy_id}]), room=sid)
                except Exception as e:
                    print(f"Update GIF Keywords Error: {e}")
                    Server.send(str(['Update GIF Keywords Result', {'status': 'error', 'message': 'Database error updating keywords'}]), room=sid)
            else:
                Server.send(str(['Update GIF Keywords Result', {'status': 'error', 'message': 'Unauthorized - Admin only'}]), room=sid)
        else:
            Server.send(str(['Update GIF Keywords Result', {'status': 'error', 'message': 'Invalid password'}]), room=sid)

@Server.on('disconnect')
def on_disconnect():
    process_room_leave(request.sid)

@Server.on('message')
def recv(message):
    Thread(target=Recv, args=(message, request.sid)).start()


if __name__ == "__main__":
    Server.run(app, host='localhost', port=80, debug=True)