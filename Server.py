# pyrefly: ignore [missing-import]
from flask import Flask, render_template, render_template_string, redirect, request, flash, session, send_file
from flask_socketio import SocketIO, join_room, leave_room
# pyrefly: ignore [missing-import]
from werkzeug.utils import secure_filename
# pyrefly: ignore [missing-import]
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
import json
# pyrefly: ignore [missing-import]
from PIL import Image, ImageOps 
import re
import requests

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
        elif db_string == "reports_alerts":
            lock = reports_alerts_lock
            db_path = 'reportsAndAlerts.db'
    
    # Alert hook with recursion guard
    if not hasattr(db_sql, '_in_alert_check'):
        db_sql._in_alert_check = False
    if not db_sql._in_alert_check:
        sql_upper = sql.upper()
        if "INSERT INTO ALERTS" in sql_upper:
            db_sql._in_alert_check = True
            try:
                add_unseen_admin_action('alerts')
            except Exception as e:
                print(f"Error in db_sql alert hook: {e}")
            finally:
                db_sql._in_alert_check = False

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
            
            if user1 is None or user2 is None:
                # If we can't find one of the users (e.g. name changed), just clean up and exit
                if sid in sid_to_room_state: del sid_to_room_state[sid]
                return

            ids = sorted([int(user1), int(user2)])
            target_id = f"{ids[0]}-{ids[1]}"
            
        if room != 'admin':
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
        
        elif id_or_password_or_gender == 'admin':
            if RU:
                return [user, accounts_dict[user]['admin']]
            return accounts_dict[user]['admin']

        elif id_or_password_or_gender == 'frozen':
            if RU:
                return [user, accounts_dict[user]['frozen']]
            return accounts_dict[user]['frozen']

    except KeyError:
        data_list = db_sql("""SELECT username, password, id, gender, admin, frozen FROM accounts WHERE LOWER(username) = ?;""", 'accounts', params=[user.lower()], chat_room=False)
        if data_list:
            data = data_list[0]
            accounts_dict[data[0]] = {'password': data[1], 'id': data[2], 'gender': data[3], 'admin': bool(data[4]), 'frozen': bool(data[5])}
            id_to_accounts_dict[data[2]] = data[0]
            if id_or_password_or_gender == 'password':
                returnable = data[1]
            elif id_or_password_or_gender == 'id':
                returnable = data[2]
            elif id_or_password_or_gender == 'gender':
                returnable = data[3]
            elif id_or_password_or_gender == 'admin':
                returnable = bool(data[4])
            elif id_or_password_or_gender == 'frozen':
                returnable = bool(data[5])
            else:
                returnable = None
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

def is_admin(username):
    if not username:
        return False
    val = find_account_id_or_password_or_gender(username, 'admin')
    return bool(val)

def broadcast_admin_requests():
    try:
        res = db_sql("SELECT id, requester, target_user, action_type, approvals, denials FROM admin_requests WHERE resolved = 0;", 'reports_alerts', chat_room=False)
        requests = []
        for row in res:
            requests.append({
                'id': row[0],
                'requester': row[1],
                'target_user': row[2],
                'action_type': row[3],
                'approvals': row[4],
                'denials': row[5]
            })
            
        for client_sid, state in list(sid_to_room_state.items()):
            user_id = state.get('user_id')
            if user_id:
                username = find_username_from_id(user_id)
                if username and is_admin(username):
                    Server.send(str(['Admin Requests Results', requests]), room=client_sid)
    except Exception as e:
        print(f"Broadcast Admin Requests Error: {e}")


def broadcast_unseen_actions_to_user(username):
    try:
        res = db_sql("SELECT sub_tabs FROM unseen_admin_actions WHERE LOWER(username) = LOWER(?);", 'accounts', params=[username], chat_room=False)
        sub_tabs = res[0][0] if res else ''
        tabs_list = sub_tabs.split('$$') if sub_tabs else []
        tabs_list = [t for t in tabs_list if t]
        
        user_id = find_account_id_or_password_or_gender(username, 'id')
        if user_id:
            for client_sid, state in list(sid_to_room_state.items()):
                if state.get('user_id') == user_id:
                    Server.send(str(['Unseen Admin Actions Updated', {'sub_tabs': tabs_list}]), room=client_sid)
    except Exception as e:
        print(f"Error broadcasting unseen actions: {e}")


def add_unseen_admin_action(tab, except_admin=None):
    try:
        admins = db_sql("SELECT username FROM accounts WHERE admin = 1;", 'accounts', chat_room=False)
        for row in admins:
            adm = row[0]
            if except_admin and adm.lower() == except_admin.lower():
                continue
            
            res = db_sql("SELECT sub_tabs FROM unseen_admin_actions WHERE LOWER(username) = LOWER(?);", 'accounts', params=[adm], chat_room=False)
            if res:
                sub_tabs = res[0][0]
                tabs_list = sub_tabs.split('$$') if sub_tabs else []
                tabs_list = [t for t in tabs_list if t]
                if tab not in tabs_list:
                    tabs_list.append(tab)
                new_sub_tabs = '$$'.join(tabs_list)
                db_sql("INSERT OR REPLACE INTO unseen_admin_actions (username, sub_tabs) VALUES (?, ?);", 'accounts', params=[adm, new_sub_tabs], chat_room=False)
            else:
                db_sql("INSERT OR REPLACE INTO unseen_admin_actions (username, sub_tabs) VALUES (?, ?);", 'accounts', params=[adm, tab], chat_room=False)
            
            broadcast_unseen_actions_to_user(adm)
    except Exception as e:
        print(f"Error in add_unseen_admin_action: {e}")


def clear_unseen_admin_action(username, tab):
    try:
        res = db_sql("SELECT sub_tabs FROM unseen_admin_actions WHERE LOWER(username) = LOWER(?);", 'accounts', params=[username], chat_room=False)
        if res:
            sub_tabs = res[0][0]
            tabs_list = sub_tabs.split('$$') if sub_tabs else []
            tabs_list = [t for t in tabs_list if t]
            if tab in tabs_list:
                tabs_list.remove(tab)
            new_sub_tabs = '$$'.join(tabs_list)
            db_sql("INSERT OR REPLACE INTO unseen_admin_actions (username, sub_tabs) VALUES (?, ?);", 'accounts', params=[username, new_sub_tabs], chat_room=False)
            
            broadcast_unseen_actions_to_user(username)
    except Exception as e:
        print(f"Error in clear_unseen_admin_action: {e}")





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
Server = SocketIO(app, max_http_buffer_size=50 * 1024 * 1024)

@app.context_processor
def inject_admin_status():
    username = session.get('username')
    is_admin_user = False
    has_unseen_actions = False
    pl_block_media = False
    if username:
        is_admin_user = is_admin(username)
        if is_admin_user:
            res = db_sql("SELECT sub_tabs FROM unseen_admin_actions WHERE LOWER(username) = LOWER(?);", 'accounts', params=[username], chat_room=False)
            if res and res[0][0]:
                has_unseen_actions = True
        # Check parental media block
        pl_res = db_sql("SELECT pl_block_media FROM accounts WHERE username = ?;", 'accounts', params=[username], chat_room=False)
        if pl_res and pl_res[0] and bool(pl_res[0][0]):
            pl_block_media = True
    return dict(is_admin_user=is_admin_user, has_unseen_actions=has_unseen_actions, pl_block_media=pl_block_media)



accounts_lock = Lock()
rooms_lock = Lock()
boys_dm_lock = Lock()
girls_dm_lock = Lock()
last_read_lock = Lock()
gif_whitelist_lock = Lock()
reports_alerts_lock = Lock()

theme_colors = {}
themes_dir = 'static/themes'
if os.path.exists(themes_dir):
    for t in os.listdir(themes_dir):
        colors_file = os.path.join(themes_dir, t, 'colors.txt')
        if os.path.exists(colors_file):
            try:
                with open(colors_file, 'r') as f:
                    theme_colors[t] = ast.literal_eval(f.read())
            except Exception as e:
                print(f"Error loading theme colors for {t}: {e}")

if not os.path.exists("reportsAndAlerts.db"):
    ra_db = sqlite3.connect("reportsAndAlerts.db")
    ra_cursor = ra_db.cursor()
    ra_cursor.execute('''
        CREATE TABLE alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text TEXT NOT NULL,
            resolved BOOLEAN NOT NULL DEFAULT 0,
            seen BOOLEAN NOT NULL DEFAULT 0
        );
    ''')
    ra_db.commit()
    ra_db.close()

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
            dms TEXT NOT NULL,
            admin BOOLEAN NOT NULL DEFAULT 0,
            frozen BOOLEAN NOT NULL DEFAULT 0,
            pl_read_dms BOOLEAN NOT NULL DEFAULT 0,
            pl_block_media BOOLEAN NOT NULL DEFAULT 0,
            pl_dm_lock BOOLEAN NOT NULL DEFAULT 0,
            pl_restricted_users TEXT NOT NULL DEFAULT '',
            pl_curfew BOOLEAN NOT NULL DEFAULT 0,
            pl_curfew_offline TEXT NOT NULL DEFAULT '4:30 AM',
            pl_curfew_online TEXT NOT NULL DEFAULT '4:30 AM',
            pl_block_games BOOLEAN NOT NULL DEFAULT 0,
            pl_age_segregation BOOLEAN NOT NULL DEFAULT 1
        );
    ''')
    accounts_db.close()

# Migration: Add location fields if they don't exist
try:
    with accounts_lock:
        conn = sqlite3.connect('accounts.db')
        cursor = conn.cursor()
        columns = [info[1] for info in cursor.execute("PRAGMA table_info(accounts);").fetchall()]
        new_cols = {
            'location': 'TEXT DEFAULT ""',
            'show_location': 'BOOLEAN DEFAULT 1',
            'latitude': 'REAL DEFAULT 0.0',
            'longitude': 'REAL DEFAULT 0.0',
            'city': 'TEXT DEFAULT ""',
            'state': 'TEXT DEFAULT ""',
            'admin': 'BOOLEAN DEFAULT 0',
            'frozen': 'BOOLEAN DEFAULT 0',
            'pl_read_dms': 'BOOLEAN DEFAULT 0',
            'pl_block_media': 'BOOLEAN DEFAULT 0',
            'pl_dm_lock': 'BOOLEAN DEFAULT 0',
            'pl_restricted_users': "TEXT DEFAULT ''",
            'pl_curfew': 'BOOLEAN DEFAULT 0',
            'pl_curfew_offline': "TEXT DEFAULT '10:00 PM'",
            'pl_curfew_online': "TEXT DEFAULT '6:00 AM'",
            'pl_block_games': 'BOOLEAN DEFAULT 0',
            'pl_age_segregation': 'BOOLEAN DEFAULT 1',
            'friends': "TEXT DEFAULT ''",
            'country': "TEXT DEFAULT 'United States'",
            'last_seen': "TEXT DEFAULT 'Never'"
        }
        for col, definition in new_cols.items():
            if col not in columns:
                cursor.execute(f"ALTER TABLE accounts ADD COLUMN {col} {definition};")
        conn.commit()
        conn.close()
except Exception as e:
    print(f"Migration error: {e}")


# Migration: Add unseen_admin_actions table to accounts.db if it doesn't exist
try:
    with accounts_lock:
        conn = sqlite3.connect('accounts.db')
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS unseen_admin_actions (
                username TEXT PRIMARY KEY,
                sub_tabs TEXT NOT NULL DEFAULT ''
            );
        ''')
        conn.commit()
        conn.close()
except Exception as e:
    print(f"Unseen admin actions table creation error: {e}")

# Migration: Add admin_requests table to reportsAndAlerts.db if it doesn't exist
try:
    with reports_alerts_lock:
        conn = sqlite3.connect('reportsAndAlerts.db')
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS admin_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                requester TEXT NOT NULL,
                target_user TEXT NOT NULL,
                action_type TEXT NOT NULL,
                approvals TEXT NOT NULL,
                denials TEXT NOT NULL,
                resolved BOOLEAN NOT NULL DEFAULT 0
            );
        ''')
        conn.commit()
        conn.close()
except Exception as e:
    print(f"Admin requests migration error: {e}")


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

def get_location_data(ip):
    try:
        # Use ipapi.co (JSON endpoint)
        # Note: For local development, ip might be '127.0.0.1', ipapi will return info for the server's public IP
        # If IP is local, ipapi will use the request's origin IP.
        url = f"https://ipapi.co/{ip}/json/" if ip != '127.0.0.1' else "https://ipapi.co/json/"
        response = requests.get(url, timeout=5, headers={'User-Agent': 'Tradchat-App'})
        if response.status_code == 200:
            data = response.json()
            return {
                'city': data.get('city', ''),
                'state': data.get('region', ''),
                'latitude': data.get('latitude', 0.0),
                'longitude': data.get('longitude', 0.0),
                'country': data.get('country_name', '')
            }
    except Exception as e:
        print(f"Error fetching location: {e}")
    return {'city': '', 'state': '', 'latitude': 0.0, 'longitude': 0.0, 'country': ''}

def post_server_message(room, text):
    """Fakes a message from the Server account to a specific room."""
    fake_data = {
        'setting': 'room',
        'room': room,
        'username': 'Server',
        'password': find_account_id_or_password_or_gender('Server', 'password'),
        'time-stamp': datetime.datetime.now().strftime("%a %b %d %Y %H:%M:%S GMT-0000 (UTC)"),
        'message': text,
        'reply-index': -1,
        'upload': ''
    }
    fake_msg = json.dumps(['Message', fake_data])
    # Use a dummy sid for the server message
    Thread(target=Recv, args=(fake_msg, 'SERVER_SYSTEM_SID')).start()

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


def is_in_curfew(username):
    try:
        locks = db_sql("SELECT pl_curfew, pl_curfew_offline, pl_curfew_online FROM accounts WHERE username = ?;", 'accounts', params=[username], chat_room=False)
        if not locks or not locks[0]:
            return False
        
        pl_curfew = bool(locks[0][0])
        if not pl_curfew:
            return False
            
        offline_str = locks[0][1]
        online_str = locks[0][2]
        
        def time_to_minutes(time_str):
            if not time_str:
                return 0
            match = re.match(r"^(\d+):(\d+)\s*(AM|PM)$", time_str.strip(), re.IGNORECASE)
            if not match:
                return 0
            hours = int(match.group(1))
            minutes = int(match.group(2))
            ampm = match.group(3).upper()
            
            if ampm == 'PM' and hours != 12:
                hours += 12
            elif ampm == 'AM' and hours == 12:
                hours = 0
            return hours * 60 + minutes
            
        offline_mins = time_to_minutes(offline_str)
        online_mins = time_to_minutes(online_str)
        
        now = datetime.datetime.now()
        current_mins = now.hour * 60 + now.minute
        
        if offline_mins > online_mins:
            return current_mins >= offline_mins or current_mins < online_mins
        elif offline_mins < online_mins:
            return current_mins >= offline_mins and current_mins < online_mins
        return False
    except Exception as e:
        print(f"Error checking curfew for {username}: {e}")
        return False

def get_restricted_users(username):
    """Returns a list of usernames that this user is restricted from DMing.
    Returns empty list if DM lock is disabled or no restrictions set."""
    try:
        row = db_sql("SELECT pl_dm_lock, pl_restricted_users FROM accounts WHERE username = ?;", 'accounts', params=[username], chat_room=False)
        if not row or not row[0]:
            return []
        pl_dm_lock = bool(row[0][0])
        if not pl_dm_lock:
            return []
        restricted_str = row[0][1]
        if not restricted_str or restricted_str.strip() == '':
            return []
        return [u.strip().lower() for u in restricted_str.split(',') if u.strip()]
    except Exception as e:
        print(f"Error getting restricted users for {username}: {e}")
        return []

def get_user_age_from_dob(dob_str):
    if not dob_str:
        return 18
    for fmt in ('%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y'):
        try:
            birth_date = datetime.datetime.strptime(dob_str, fmt)
            today = datetime.datetime.today()
            return today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
        except ValueError:
            continue
    try:
        parts = re.split(r'[-/]', dob_str.strip())
        if len(parts) == 3:
            year = None
            for p in parts:
                if len(p) == 4 and p.isdigit():
                    year = int(p)
                    break
            if year:
                today = datetime.datetime.today()
                return today.year - year
    except:
        pass
    return 18

def is_dm_restricted(user_a, user_b):
    """Check if a DM between user_a and user_b is blocked by either side's parental locks.
    Returns True if either user has the other in their restricted list, or if age segregation is violated."""
    if not user_a or not user_b:
        return False
    
    # 1. Custom restricted list check
    if user_b.lower() in get_restricted_users(user_a) or user_a.lower() in get_restricted_users(user_b):
        return True
        
    # 2. Age segregation check
    try:
        info_a = db_sql("SELECT dob, pl_age_segregation FROM accounts WHERE LOWER(username) = LOWER(?);", 'accounts', params=[user_a], chat_room=False)
        info_b = db_sql("SELECT dob, pl_age_segregation FROM accounts WHERE LOWER(username) = LOWER(?);", 'accounts', params=[user_b], chat_room=False)
        
        if info_a and info_b:
            age_a = get_user_age_from_dob(info_a[0][0])
            seg_a = bool(info_a[0][1])
            
            age_b = get_user_age_from_dob(info_b[0][0])
            seg_b = bool(info_b[0][1])
            
            if (seg_a or seg_b) and ((age_a < 13 and age_b >= 13) or (age_a >= 13 and age_b < 13)):
                return True
    except Exception as e:
        print(f"Error in is_dm_restricted age check: {e}")
        
    return False

@app.before_request
def check_curfew_redirect():
    username = session.get('username')
    if username:
        req_path = request.path
        if req_path.startswith('/static/') or req_path.startswith('/socket.io/') or req_path in ['/go_to_bed/', '/logout/']:
            return
            
        if is_in_curfew(username):
            return redirect('/go_to_bed/')

@app.route('/go_to_bed/')
def go_to_bed():
    username = session.get('username')
    if not username:
        return redirect('/')
    locks = db_sql("SELECT pl_curfew_offline, pl_curfew_online FROM accounts WHERE username = ?;", 'accounts', params=[username], chat_room=False)
    curfew_start = locks[0][0]
    curfew_end = locks[0][1]
    return render_template('go_to_bed.html', curfew_start=curfew_start, curfew_end=curfew_end)


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
            # Update location data in the background
            ip = request.environ.get('HTTP_X_FORWARDED_FOR', request.remote_addr)
            if ',' in str(ip): ip = ip.split(',')[0].strip() # Handle proxy lists
            
            def update_loc(u, ip_addr):
                loc = get_location_data(ip_addr)
                now_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                if loc['city'] or loc['state']: # Only update if we got valid data
                    db_sql("UPDATE accounts SET location = ?, latitude = ?, longitude = ?, city = ?, state = ?, country = ?, last_seen = ? WHERE username = ?;", 'accounts', params=[f"{loc['city']}, {loc['state']}", loc['latitude'], loc['longitude'], loc['city'], loc['state'], loc['country'], now_str, u], chat_room=False)
                else:
                    db_sql("UPDATE accounts SET last_seen = ? WHERE username = ?;", 'accounts', params=[now_str, u], chat_room=False)
            
            Thread(target=update_loc, args=(username, ip)).start()

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

            frozen_status = bool(find_account_id_or_password_or_gender(username, 'frozen'))

            return render_template(
                'home.html',
                theme=theme,
                color_dark=colors['color_dark'],
                color_medium=colors['color_medium'],
                color_light=colors['color_light'],
                room=room,
                room_type=room_type,
                room_emoji=room_emoji,
                active_page='home',
                frozen=frozen_status
            )

        else:
            raise KeyError('Why do people try to hack accounts?')

    except (KeyError, SyntaxError, ValueError):
        return redirect('/')

@app.route('/settings/')
def settings():
    if not request.args.get('tab'):
        return redirect('/settings/?tab=profile')
    try:
        username = session['username']
        password = session['password']

        if check_credentials(username, password):
            now_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            db_sql("UPDATE accounts SET last_seen = ? WHERE username = ?;", 'accounts', params=[now_str, username], chat_room=False)
            theme = db_sql("SELECT theme FROM accounts WHERE username = ?;", 'accounts', params=[username], chat_room=False)[0][0]

            colorsFile = open(f'static/themes/{theme}/colors.txt', 'r')
            colors = ast.literal_eval(colorsFile.read())
            colorsFile.close()
            
            account_info = db_sql("SELECT first_name, last_name, location, show_location, city, state, email, dob FROM accounts WHERE username = ?;", 'accounts', params=[username], chat_room=False)
            first_name = account_info[0][0] if account_info else ''
            last_name = account_info[0][1] if account_info else ''
            location = account_info[0][2] if account_info else ''
            show_location = account_info[0][3] if account_info else 1
            city = account_info[0][4] if account_info else ''
            state = account_info[0][5] if account_info else ''
            email = account_info[0][6] if account_info else ''
            dob = account_info[0][7] if account_info else ''

            return render_template(
                'settings.html',
                theme=theme,
                color_dark=colors['color_dark'],
                color_medium=colors['color_medium'],
                color_light=colors['color_light'],
                username=username,
                password=password,
                first_name=first_name,
                last_name=last_name,
                location=location,
                show_location=show_location,
                city=city,
                state=state,
                email=email,
                dob=dob,
                active_page='settings'
            )
        else:
            raise KeyError('Why do people try to hack accounts?')

    except (KeyError, SyntaxError, ValueError):
        return redirect('/')

@app.route('/members/')
def members():
    try:
        username = session['username']
        password = session['password']

        if check_credentials(username, password):
            theme = db_sql("SELECT theme FROM accounts WHERE username = ?;", 'accounts', params=[username], chat_room=False)[0][0]

            colorsFile = open(f'static/themes/{theme}/colors.txt', 'r')
            colors = ast.literal_eval(colorsFile.read())
            colorsFile.close()

            # Record presence
            now_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            db_sql("UPDATE accounts SET last_seen = ? WHERE username = ?;", 'accounts', params=[now_str, username], chat_room=False)

            return render_template(
                'members.html',
                theme=theme,
                color_dark=colors['color_dark'],
                color_medium=colors['color_medium'],
                color_light=colors['color_light'],
                username=username,
                password=password,
                active_page='members'
            )
        else:
            raise KeyError('Authentication failed')

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
    


@app.route('/admin/')
def admin():
    try:
        username = session['username']
        password = session['password']
        if check_credentials(username, password):
            if not is_admin(username):
                return "Unauthorized: Admin Only", 403
                
            theme = db_sql("SELECT theme FROM accounts WHERE username = ?;", 'accounts', params=[username], chat_room=False)[0][0]
            colorsFile = open(f'static/themes/{theme}/colors.txt', 'r')
            colors = ast.literal_eval(colorsFile.read())
            colorsFile.close()
            
            # Check if there are any unseen & unresolved alerts
            unseen = db_sql("SELECT COUNT(*) FROM alerts WHERE seen = 0 AND resolved = 0;", 'reports_alerts')
            has_unseen_alerts = (unseen[0][0] > 0) if unseen else False

            # Fetch active unseen sub-tabs
            res = db_sql("SELECT sub_tabs FROM unseen_admin_actions WHERE LOWER(username) = LOWER(?);", 'accounts', params=[username], chat_room=False)
            sub_tabs = res[0][0] if res else ''
            unseen_sub_tabs_list = sub_tabs.split('$$') if sub_tabs else []
            unseen_sub_tabs_list = [t for t in unseen_sub_tabs_list if t]
            
            return render_template(
                'admin.html',
                theme=theme,
                color_dark=colors['color_dark'],
                color_medium=colors['color_medium'],
                color_light=colors['color_light'],
                active_page='admin',
                has_unseen_alerts=has_unseen_alerts,
                unseen_sub_tabs=unseen_sub_tabs_list
            )
        return redirect('/')
    except Exception as e:
        print(f"Error loading admin page: {e}")
        return redirect('/')

@app.route('/admin/alerts/', methods=['GET'])
def get_admin_alerts():
    try:
        username = session.get('username')
        password = session.get('password')
        if not username or not check_credentials(username, password):
            return {"status": "error", "message": "Unauthorized"}, 401
            
        if not is_admin(username):
            return {"status": "error", "message": "Unauthorized"}, 403
            
        # Get all unresolved alerts ordered by seen ASC, id DESC
        rows = db_sql("SELECT id, text, resolved, seen FROM alerts WHERE resolved = 0 ORDER BY seen ASC, id DESC;", 'reports_alerts')
        alerts_list = []
        for r in rows:
            alerts_list.append({
                "id": r[0],
                "text": r[1],
                "resolved": r[2],
                "seen": r[3]
            })
            
        # Also get current unseen count for header/sidebar updates
        unseen = db_sql("SELECT COUNT(*) FROM alerts WHERE seen = 0 AND resolved = 0;", 'reports_alerts')
        unseen_count = unseen[0][0] if unseen else 0
        
        return {"status": "success", "alerts": alerts_list, "unseen_count": unseen_count}
    except Exception as e:
        return {"status": "error", "message": str(e)}, 500

@app.route('/admin/alerts/seen/<int:alert_id>/', methods=['POST'])
def mark_alert_seen(alert_id):
    try:
        username = session.get('username')
        password = session.get('password')
        if not username or not check_credentials(username, password):
            return {"status": "error", "message": "Unauthorized"}, 401
            
        if not is_admin(username):
            return {"status": "error", "message": "Unauthorized"}, 403
            
        # Toggle seen status
        current = db_sql("SELECT seen FROM alerts WHERE id = ?;", 'reports_alerts', params=[alert_id])
        new_seen = 0 if (current and current[0][0] == 1) else 1
        db_sql("UPDATE alerts SET seen = ? WHERE id = ?;", 'reports_alerts', params=[new_seen, alert_id])
        
        unseen = db_sql("SELECT COUNT(*) FROM alerts WHERE seen = 0 AND resolved = 0;", 'reports_alerts')
        unseen_count = unseen[0][0] if unseen else 0
        
        return {"status": "success", "unseen_count": unseen_count}
    except Exception as e:
        return {"status": "error", "message": str(e)}, 500

@app.route('/admin/alerts/resolve/<int:alert_id>/', methods=['POST'])
def mark_alert_resolved(alert_id):
    try:
        username = session.get('username')
        password = session.get('password')
        if not username or not check_credentials(username, password):
            return {"status": "error", "message": "Unauthorized"}, 401
            
        if not is_admin(username):
            return {"status": "error", "message": "Unauthorized"}, 403
            
        db_sql("UPDATE alerts SET resolved = 1 WHERE id = ?;", 'reports_alerts', params=[alert_id])
        
        unseen = db_sql("SELECT COUNT(*) FROM alerts WHERE seen = 0 AND resolved = 0;", 'reports_alerts')
        unseen_count = unseen[0][0] if unseen else 0
        
        return {"status": "success", "unseen_count": unseen_count}
    except Exception as e:
        return {"status": "error", "message": str(e)}, 500


@app.route('/db/')
def db_modifier_page():
    return render_template('db_modifier.html')

@app.route('/db/load/', methods=['POST'])
def db_modifier_load():
    try:
        if 'db_file' not in request.files:
            return {"status": "error", "message": "No file uploaded"}, 400
        file = request.files['db_file']
        if file.filename == '':
            return {"status": "error", "message": "No file selected"}, 400
        
        temp_path = "temp_modifier.db"
        file.save(temp_path)
        session['loaded_db_path'] = temp_path
        session['original_db_name'] = file.filename
        
        conn = sqlite3.connect(temp_path)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
        tables = [row[0] for row in cursor.fetchall()]
        conn.close()
        return {"status": "success", "tables": tables}
    except Exception as e:
        return {"status": "error", "message": str(e)}, 500

def parse_modifier_value(val, col_type):
    if val is None:
        return None
    col_type = col_type.upper()
    if 'INT' in col_type:
        if val == '':
            return None
        try:
            return int(val)
        except ValueError:
            return val
    elif 'REAL' in col_type or 'FLOAT' in col_type or 'DOUBLE' in col_type or 'NUM' in col_type:
        if val == '':
            return None
        try:
            return float(val)
        except ValueError:
            return val
    elif 'BOOL' in col_type:
        if val == '':
            return 0
        if str(val).lower() in ['true', '1', 'on', 'checked']:
            return 1
        return 0
    return str(val)

@app.route('/db/table/', methods=['GET'])
def db_modifier_table():
    try:
        temp_path = session.get('loaded_db_path')
        if not temp_path or not os.path.exists(temp_path):
            return {"status": "error", "message": "No database loaded"}, 400
        table_name = request.args.get('name')
        if not table_name:
            return {"status": "error", "message": "Table name required"}, 400
            
        conn = sqlite3.connect(temp_path)
        cursor = conn.cursor()
        cursor.execute(f"PRAGMA table_info({table_name});")
        pragma_info = cursor.fetchall()
        columns = [col[1] for col in pragma_info]
        types = {col[1]: col[2].upper() for col in pragma_info}
        
        cursor.execute(f"SELECT * FROM {table_name};")
        rows = cursor.fetchall()
        conn.close()
        return {"status": "success", "columns": columns, "types": types, "rows": rows}
    except Exception as e:
        return {"status": "error", "message": str(e)}, 500

@app.route('/db/update/', methods=['POST'])
def db_modifier_update():
    try:
        temp_path = session.get('loaded_db_path')
        if not temp_path or not os.path.exists(temp_path):
            return {"status": "error", "message": "No database loaded"}, 400
        data = request.json
        table_name = data.get('table')
        updates = data.get('updates')
        
        if not table_name or updates is None:
            return {"status": "error", "message": "Table name and updates required"}, 400
            
        conn = sqlite3.connect(temp_path)
        cursor = conn.cursor()
        cursor.execute(f"PRAGMA table_info({table_name});")
        pragma_info = cursor.fetchall()
        columns = [col[1] for col in pragma_info]
        types = {col[1]: col[2].upper() for col in pragma_info}
        
        cursor.execute(f"DELETE FROM {table_name};")
        
        placeholders = ", ".join(["?"] * len(columns))
        cols_str = ", ".join(columns)
        insert_sql = f"INSERT INTO {table_name} ({cols_str}) VALUES ({placeholders});"
        
        for row in updates:
            vals = []
            for col in columns:
                raw_val = row.get(col)
                col_type = types.get(col, 'TEXT')
                parsed_val = parse_modifier_value(raw_val, col_type)
                vals.append(parsed_val)
            cursor.execute(insert_sql, vals)
            
        conn.commit()
        conn.close()

        # Copy the updated temp_path back to the original database file location if it exists on the server
        original_name = session.get('original_db_name')
        if original_name:
            # Let's locate the live database file
            target_path = None
            if os.path.exists(original_name):
                target_path = original_name
            elif os.path.exists(os.path.join("rooms", original_name)):
                target_path = os.path.join("rooms", original_name)
            elif os.path.exists(os.path.join("dms", original_name)):
                target_path = os.path.join("dms", original_name)

            if target_path:
                print(f"Syncing temp_modifier.db back to live database: {target_path}")
                shutil.copyfile(temp_path, target_path)

        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}, 500

@app.route('/db/download/', methods=['GET'])
def db_modifier_download():
    try:
        temp_path = session.get('loaded_db_path')
        if not temp_path or not os.path.exists(temp_path):
            return "No database loaded", 400
        filename = request.args.get('filename', 'database.db')
        return send_file(temp_path, as_attachment=True, download_name=filename)
    except Exception as e:
        return str(e), 500





def Recv(message, sid): 
    try:
        msg = json.loads(message)
    except (json.JSONDecodeError, TypeError):
        msg = ast.literal_eval(message)

    if msg[0] in ['Image Upload', 'Update Profile Picture']:
        print([msg[0], {k: (v if k != 'image' else f'<{len(v)} bytes of image data>') for k, v in msg[1].items()}])
    else:
        print(message)
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
            if find_account_id_or_password_or_gender(username, 'frozen'):
                is_admin_dm = False
                if setting == 'dm' and '.$@-@&.' in room:
                    dm_parts = room.split('.$@-@&.')
                    if len(dm_parts) == 2 and (dm_parts[0].lower() == 'admin' or dm_parts[1].lower() == 'admin'):
                        if not upload:
                            is_admin_dm = True
                if not is_admin_dm:
                    print(f"[SECURITY WARNING] Frozen user {username} blocked from sending message to {room}")
                    return

            # Parental lock: block media uploads if pl_block_media is enabled
            if upload and upload.strip():
                pl_block = db_sql("SELECT pl_block_media FROM accounts WHERE username = ?;", 'accounts', params=[username], chat_room=False)
                if pl_block and pl_block[0] and bool(pl_block[0][0]):
                    upload = ''  # Silently strip the upload

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

                    # Parental lock: block DMs between restricted users (bidirectional)
                    if is_dm_restricted(username, actual_user_dm_username):
                        print(f"[PARENTAL LOCK] DM blocked between {username} and {actual_user_dm_username}")
                        return

                    if actual_user_dm_username.lower() == 'admin' and username.lower() != 'admin':
                        alert_text = f"ADMIN MESSAGE: {username} sent ({user_message})"
                        db_sql("INSERT INTO alerts (text, resolved, seen) VALUES (?, 0, 0);", 'reports_alerts', params=[alert_text], chat_room=False)

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
            if find_account_id_or_password_or_gender(username, 'frozen'):
                print(f"[SECURITY WARNING] Frozen user {username} blocked from uploading image.")
                return
            # Parental lock: block image uploads if pl_block_media is enabled
            pl_block = db_sql("SELECT pl_block_media FROM accounts WHERE username = ?;", 'accounts', params=[username], chat_room=False)
            if pl_block and pl_block[0] and bool(pl_block[0][0]):
                print(f"[PARENTAL LOCK] Image upload blocked for {username}")
                return
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
                        dm_username = dm_info[0]
                        if is_dm_restricted(username, dm_username):
                            continue
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
            # Parental lock: block DM creation between restricted users
            if is_dm_restricted(username, user):
                print(f"[PARENTAL LOCK] DM creation blocked between {username} and {user}")
                return
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

        # Get IP and Fetch Location Data
        ip = Server.server.environ[sid].get('REMOTE_ADDR', '127.0.0.1')
        loc = get_location_data(ip)
        
        # Username available - create account
        now_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        db_sql("""INSERT INTO accounts (username, password, first_name, last_name, email, dob, gender, theme, room, dms, location, show_location, latitude, longitude, city, state, country, friends, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);""", 'accounts', params=[username, password, first_name, last_name, email, dob, gender, 'classic', 'mainroom', '1-2', f"{loc['city']}, {loc['state']}", 1, loc['latitude'], loc['longitude'], loc['city'], loc['state'], loc['country'], '', now_str], chat_room=False)

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

    elif msg[0] == 'Update Profile':
        data = msg[1]
        old_username = data['username'].replace('&#39;', "'").replace('&#47;', "/").replace('&#34;', '"')
        old_password = data['password'].replace('&#39;', "'").replace('&#47;', "/").replace('&#34;', '"')
        new_username = data['new_username'].replace('&#39;', "'").replace('&#47;', "/").replace('&#34;', '"')
        new_password = data['new_password'].replace('&#39;', "'").replace('&#47;', "/").replace('&#34;', '"')
        new_first_name = data['new_first_name'].replace('&#39;', "'").replace('&#47;', "/").replace('&#34;', '"')
        new_last_name = data['new_last_name'].replace('&#39;', "'").replace('&#47;', "/").replace('&#34;', '"')
        new_location = data.get('new_location', '').replace('&#39;', "'").replace('&#47;', "/").replace('&#34;', '"')
        new_email = data.get('new_email', '').replace('&#39;', "'").replace('&#47;', "/").replace('&#34;', '"')
        new_show_location = data.get('new_show_location', 1)

        if check_credentials(old_username, old_password):
            user_id = find_account_id_or_password_or_gender(old_username, 'id')
            
            # Check for invalid filename characters
            invalid_chars = r'\/:*?"<>|'
            found_invalid = [c for c in new_username if c in invalid_chars]
            if found_invalid:
                Server.send(str(['Update Profile Result', {'status': 'error', 'message': f'Sorry but {" ".join(list(set(found_invalid)))} symbols are not allowed'}]), room=sid)
                return

            # Check if new username is taken
            if new_username.lower() != old_username.lower():
                existing = db_sql("SELECT id FROM accounts WHERE LOWER(username) = ?;", 'accounts', params=[new_username.lower()], chat_room=False)
                if existing:
                    Server.send(str(['Update Profile Result', {'status': 'error', 'message': 'Username already exists'}]), room=sid)
                    return
            
            # Update database
            db_sql("""UPDATE accounts SET username = ?, password = ?, first_name = ?, last_name = ?, location = ?, show_location = ?, email = ? WHERE id = ?;""", 'accounts', params=[new_username, new_password, new_first_name, new_last_name, new_location, new_show_location, new_email, user_id], chat_room=False)
            
            username_changed = (new_username != old_username)
            if username_changed:
                # Reset room to mainroom to avoid stale DM room names crashing the server
                db_sql("UPDATE accounts SET room = 'mainroom' WHERE id = ?;", 'accounts', params=[user_id], chat_room=False)
                
                # Rename profile picture if it exists
                old_pic = f'static/profile-pictures/{old_username}.png'
                new_pic = f'static/profile-pictures/{new_username}.png'
                if os.path.exists(old_pic):
                    try:
                        os.rename(old_pic, new_pic)
                    except Exception as e:
                        print(f"Error renaming profile picture: {e}")

                # Remove from caches as requested
                if old_username in accounts_dict:
                    del accounts_dict[old_username]
                if user_id in id_to_accounts_dict:
                    del id_to_accounts_dict[user_id]
                
                # Signal client to log out
                Server.send(str(['Update Profile Result', {'status': 'success', 'username_changed': True}]), room=sid)
            else:
                # Update password in cache if username didn't change
                if old_username in accounts_dict:
                    accounts_dict[old_username]['password'] = new_password
                
                Server.send(str(['Update Profile Result', {'status': 'success', 'username_changed': False}]), room=sid)
        else:
            Server.send(str(['Update Profile Result', {'status': 'error', 'message': 'Invalid credentials'}]), room=sid)

    elif msg[0] == 'Get Themes':
        themes_dir = 'static/themes'
        themes_list = []
        if os.path.exists(themes_dir):
            for theme_name in os.listdir(themes_dir):
                theme_path = os.path.join(themes_dir, theme_name)
                if os.path.isdir(theme_path):
                    colors_file = os.path.join(theme_path, 'colors.txt')
                    if os.path.exists(colors_file):
                        try:
                            with open(colors_file, 'r') as f:
                                colors = ast.literal_eval(f.read())
                                themes_list.append({
                                    'name': theme_name,
                                    'colors': colors
                                })
                        except Exception as e:
                            print(f"Error reading theme {theme_name}: {e}")
        # Sort alphabetically by name
        themes_list.sort(key=lambda x: x['name'].lower())
        Server.send(str(['Themes List', themes_list]), room=sid)

    elif msg[0] == 'Update Theme':
        data = msg[1]
        username = data.get('username')
        password = data.get('password')
        theme = data.get('theme')

        if check_credentials(username, password):
            user_id = find_account_id_or_password_or_gender(username, 'id')
            db_sql("UPDATE accounts SET theme = ? WHERE id = ?;", 'accounts', params=[theme, user_id], chat_room=False)

    elif msg[0] == 'Update Profile Picture':
        data = msg[1]
        username = data.get('username')
        password = data.get('password')
        image_data = data.get('image')

        if check_credentials(username, password):
            try:
                # Strip the data URL prefix if present
                if ',' in image_data:
                    image_data = image_data.split(',')[1]
                
                # Decode base64 string to bytes
                image_bytes = base64.b64decode(image_data)
                
                # Open with Pillow
                image = Image.open(io.BytesIO(image_bytes))
                
                # Ensure it's exactly 800x800, using ImageOps.fit to crop the center if needed
                image = ImageOps.fit(image, (800, 800), method=Image.Resampling.LANCZOS)
                
                # Save as PNG
                save_path = f'static/profile-pictures/{username}.png'
                image.save(save_path, 'PNG')
                
                Server.send(str(['Update Profile Picture Result', {'status': 'success', 'message': 'Profile picture updated successfully!'}]), room=sid)
            except Exception as e:
                print(f"Error processing profile picture: {e}")
                Server.send(str(['Update Profile Picture Result', {'status': 'error', 'message': 'Failed to process image.'}]), room=sid)

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
                    if action == 'remove':
                        post_server_message(room, f"{target_username}({target_id}) has been deleted")

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
                    post_server_message(room, f"{new_username}({new_id}) has been added")

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
            if find_account_id_or_password_or_gender(username, 'frozen'):
                print(f"[SECURITY WARNING] Frozen user {username} blocked from adding GIF.")
                return
            if is_admin(username):
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
            if find_account_id_or_password_or_gender(username, 'frozen'):
                print(f"[SECURITY WARNING] Frozen user {username} blocked from searching GIFs.")
                return
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
            if is_admin(username):
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
            if is_admin(username):
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

    elif msg[0] == 'Search Usernames':
        data = msg[1]
        username = data['username']
        password = data['password']
        query = data.get('query', '')

        if check_credentials(username, password):
            try:
                is_curr_admin = is_admin(username)
                clean_query = remove_go_spaces(query.lower())
                
                limit_val = 50 if is_curr_admin else 200
                if clean_query:
                    results = db_sql(
                        f"SELECT username, first_name, last_name, dob, pl_age_segregation FROM accounts WHERE LOWER(username) LIKE ? OR LOWER(first_name) LIKE ? OR LOWER(last_name) LIKE ? LIMIT {limit_val};",
                        'accounts', params=[f'%{clean_query}%', f'%{clean_query}%', f'%{clean_query}%'], chat_room=False
                    )
                else:
                    results = db_sql(
                        f"SELECT username, first_name, last_name, dob, pl_age_segregation FROM accounts LIMIT {limit_val};",
                        'accounts', chat_room=False
                    )

                if is_curr_admin:
                    user_list = [{
                        'username': row[0],
                        'first_name': row[1],
                        'last_name': row[2],
                        'profile_picture': f'/static/profile-pictures/{row[0]}.png'
                    } for row in results]
                else:
                    curr_info = db_sql("SELECT dob, pl_age_segregation FROM accounts WHERE username = ?;", 'accounts', params=[username], chat_room=False)
                    curr_age = 18
                    curr_segregation = False
                    if curr_info:
                        curr_age = get_user_age_from_dob(curr_info[0][0])
                        curr_segregation = bool(curr_info[0][1])

                    user_list = []
                    for row in results:
                        other_username = row[0]
                        if other_username.lower() == username.lower():
                            continue
                        
                        other_age = get_user_age_from_dob(row[3])
                        other_segregation = bool(row[4])

                        if (curr_segregation or other_segregation) and ((curr_age < 13 and other_age >= 13) or (curr_age >= 13 and other_age < 13)):
                            continue

                        user_list.append({
                            'username': other_username,
                            'first_name': row[1],
                            'last_name': row[2],
                            'profile_picture': f'/static/profile-pictures/{other_username}.png'
                        })
                    user_list = user_list[:50]

                Server.send(str(['Search Usernames Results', {'status': 'success', 'results': user_list}]), room=sid)
            except Exception as e:
                print(f"Search Usernames Error: {e}")
                Server.send(str(['Search Usernames Results', {'status': 'error', 'message': 'Internal search error'}]), room=sid)

    elif msg[0] == 'Get Members':
        data = msg[1]
        username = data['username']
        password = data['password']
        tab = data.get('tab', 'all')
        search_query = data.get('search_query', '')
        filters = data.get('filters', {})

        if check_credentials(username, password):
            try:
                # Fetch current user info
                curr_info = db_sql("SELECT id, dob, pl_age_segregation, friends FROM accounts WHERE username = ?;", 'accounts', params=[username], chat_room=False)
                if not curr_info:
                    Server.send(str(['Get Members Results', {'status': 'error', 'message': 'User not found'}]), room=sid)
                    return
                curr_id = curr_info[0][0]
                curr_dob = curr_info[0][1]
                curr_segregation = bool(curr_info[0][2])
                curr_friends = split(curr_info[0][3])
                curr_age = get_user_age_from_dob(curr_dob)

                # Fetch members
                results = db_sql("SELECT id, username, first_name, last_name, dob, location, show_location, city, state, country, gender, last_seen, theme FROM accounts WHERE id != ? AND username != 'Server';", 'accounts', params=[curr_id], chat_room=False)

                member_list = []
                for row in results:
                    m_id, m_username, m_first_name, m_last_name, m_dob, m_location, m_show_location, m_city, m_state, m_country, m_gender, m_last_seen, m_theme = row
                    
                    # Friend check
                    is_friend = str(m_id) in curr_friends
                    
                    # Filter by tab == 'friends'
                    if tab == 'friends' and not is_friend:
                        continue
                        
                    # Age segregation filter (only if curr_segregation is active for viewing user)
                    m_age = get_user_age_from_dob(m_dob)
                    if curr_segregation:
                        if (curr_age < 13 and m_age >= 13) or (curr_age >= 13 and m_age < 13):
                            continue
                            
                    # Filter by search_query
                    if search_query:
                        sq_clean = remove_go_spaces(search_query.lower())
                        if (sq_clean not in remove_go_spaces(m_username.lower()) and 
                            sq_clean not in remove_go_spaces(m_first_name.lower()) and 
                            sq_clean not in remove_go_spaces(m_last_name.lower())):
                            continue
                            
                    # Filter by filters dict
                    if filters:
                        # Age filter
                        f_min_age = filters.get('min_age')
                        f_max_age = filters.get('max_age')
                        if f_min_age is not None and f_min_age != '':
                            try:
                                if m_age < int(f_min_age):
                                    continue
                            except ValueError:
                                pass
                        if f_max_age is not None and f_max_age != '':
                            try:
                                if m_age > int(f_max_age):
                                    continue
                            except ValueError:
                                pass
                                
                        # Gender filter
                        f_gender = filters.get('gender')
                        if f_gender:
                            if isinstance(f_gender, list):
                                if m_gender not in f_gender:
                                    continue
                            elif isinstance(f_gender, str) and f_gender != '':
                                if m_gender != f_gender:
                                    continue
                                    
                        # Location filter
                        f_loc = filters.get('location')
                        if f_loc:
                            f_loc_clean = remove_go_spaces(f_loc.lower())
                            if not m_show_location:
                                continue
                            if (f_loc_clean not in remove_go_spaces(m_location.lower()) and 
                                f_loc_clean not in remove_go_spaces(m_city.lower()) and 
                                f_loc_clean not in remove_go_spaces(m_state.lower()) and 
                                f_loc_clean not in remove_go_spaces(m_country.lower())):
                                continue

                    # Resolve user's theme color (their theme color main)
                    m_theme_config = theme_colors.get(m_theme, {})
                    color_main = m_theme_config.get('color_medium', '#C47A6B')

                    member_list.append({
                        'id': m_id,
                        'username': m_username,
                        'first_name': m_first_name,
                        'last_name': m_last_name,
                        'age': m_age,
                        'location': m_location if m_show_location else '',
                        'show_location': bool(m_show_location),
                        'city': m_city if m_show_location else '',
                        'state': m_state if m_show_location else '',
                        'country': m_country if m_show_location else '',
                        'gender': m_gender,
                        'last_seen': m_last_seen if m_last_seen else 'Never',
                        'is_friend': is_friend,
                        'color_main': color_main
                    })
                
                # Sort results based on user selection
                sort_by = data.get('sort_by', 'last_name')
                if sort_by == 'first_name':
                    member_list.sort(key=lambda x: x['first_name'].lower())
                elif sort_by == 'username':
                    member_list.sort(key=lambda x: x['username'].lower())
                else:  # Default / last_name
                    member_list.sort(key=lambda x: x['last_name'].lower())

                # Limit results
                member_list = member_list[:200]
                Server.send(str(['Get Members Results', {'status': 'success', 'results': member_list}]), room=sid)
            except Exception as e:
                print(f"Get Members Error: {e}")
                Server.send(str(['Get Members Results', {'status': 'error', 'message': 'Internal search error'}]), room=sid)

    elif msg[0] == 'Add Friend':
        data = msg[1]
        username = data['username']
        password = data['password']
        friend_username = data.get('friend_username')
        friend_id = data.get('friend_id')

        if check_credentials(username, password):
            try:
                if friend_id is None and friend_username:
                    friend_id = find_account_id_or_password_or_gender(friend_username, 'id')
                
                if friend_id:
                    curr_info = db_sql("SELECT id, friends FROM accounts WHERE username = ?;", 'accounts', params=[username], chat_room=False)
                    if curr_info:
                        curr_id = curr_info[0][0]
                        friends_list = split(curr_info[0][1])
                        
                        if str(friend_id) not in friends_list:
                            friends_list.append(str(friend_id))
                            db_sql("UPDATE accounts SET friends = ? WHERE id = ?;", 'accounts', params=[join(friends_list), curr_id], chat_room=False)
                        
                        Server.send(str(['Add Friend Result', {'status': 'success', 'friend_id': friend_id, 'friend_username': friend_username}]), room=sid)
            except Exception as e:
                print(f"Add Friend Error: {e}")
                Server.send(str(['Add Friend Result', {'status': 'error', 'message': str(e)}]), room=sid)

    elif msg[0] == 'Remove Friend':
        data = msg[1]
        username = data['username']
        password = data['password']
        friend_username = data.get('friend_username')
        friend_id = data.get('friend_id')

        if check_credentials(username, password):
            try:
                if friend_id is None and friend_username:
                    friend_id = find_account_id_or_password_or_gender(friend_username, 'id')
                
                if friend_id:
                    curr_info = db_sql("SELECT id, friends FROM accounts WHERE username = ?;", 'accounts', params=[username], chat_room=False)
                    if curr_info:
                        curr_id = curr_info[0][0]
                        friends_list = split(curr_info[0][1])
                        
                        if str(friend_id) in friends_list:
                            friends_list.remove(str(friend_id))
                            db_sql("UPDATE accounts SET friends = ? WHERE id = ?;", 'accounts', params=[join(friends_list), curr_id], chat_room=False)
                        
                        Server.send(str(['Remove Friend Result', {'status': 'success', 'friend_id': friend_id, 'friend_username': friend_username}]), room=sid)
            except Exception as e:
                print(f"Remove Friend Error: {e}")
                Server.send(str(['Remove Friend Result', {'status': 'error', 'message': str(e)}]), room=sid)

    elif msg[0] == 'Admin Get User Conversations':
        data = msg[1]
        username = data['username']
        password = data['password']
        target_user = data['target_user']

        if check_credentials(username, password) and is_admin(username):
            try:
                # 1. Fetch DMs
                dms = []
                dms_res = db_sql("SELECT dms FROM accounts WHERE username = ?;", 'accounts', params=[target_user], chat_room=False)
                target_id = find_account_id_or_password_or_gender(target_user, 'id')
                if dms_res and dms_res[0][0]:
                    dms_ids = split(dms_res[0][0])
                    for dm in dms_ids:
                        actual_dm_id = str(dm)
                        if actual_dm_id.startswith('u'):
                            actual_dm_id = actual_dm_id[1:]
                        dm_info_row = db_sql("SELECT username, first_name, last_name FROM accounts WHERE id = ?;", 'accounts', params=[actual_dm_id], chat_room=False)
                        if dm_info_row:
                            dm_info = dm_info_row[0]
                            dm_username = dm_info[0]
                            dms.append({
                                'username': dm_username,
                                'display_name': f"with {dm_username} ({dm_info[1]} {dm_info[2]})",
                                'room_id': f"{target_user}.$@-@&.{dm_username}"
                            })

                # 2. Fetch Rooms (Private rooms target is in, and all Public rooms)
                private_rooms = []
                public_rooms = []
                all_rooms = db_sql("SELECT room_name, owners, managers, curators, members, emoji, room_type FROM rooms WHERE deleted = 0;", 'rooms', chat_room=False)
                for room in all_rooms:
                    room_name = room[0]
                    owners = split(room[1])
                    managers = split(room[2])
                    curators = split(room[3])
                    members = split(room[4])
                    emoji = room[5]
                    room_type = room[6]

                    if room_type == 'public':
                        public_rooms.append({
                            'name': room_name,
                            'emoji': emoji
                        })
                    else: # private
                        all_members = owners + managers + curators + members
                        if str(target_id) in all_members:
                            private_rooms.append({
                                'name': room_name,
                                'emoji': emoji
                            })

                Server.send(str(['Admin Get User Conversations Result', {
                    'status': 'success',
                    'target_user': target_user,
                    'dms': dms,
                    'private_rooms': private_rooms,
                    'public_rooms': public_rooms
                }]), room=sid)
            except Exception as e:
                print(f"Admin Get User Conversations Error: {e}")
                Server.send(str(['Admin Get User Conversations Result', {'status': 'error', 'message': str(e)}]), room=sid)

    elif msg[0] == 'Admin Get Conversation Messages':
        data = msg[1]
        username = data['username']
        password = data['password']
        target_user = data['target_user']
        convo_type = data['convo_type']
        target_id = data['target_id']
        before_id = data.get('before_id')
        filter_query = data.get('filter_query', '')

        if check_credentials(username, password) and is_admin(username):
            try:
                messages = []
                if convo_type == 'dm':
                    user1_id = find_account_id_or_password_or_gender(target_user, 'id')
                    user2_id = find_account_id_or_password_or_gender(target_id, 'id')
                    convo_hash = f"{user1_id}-{user2_id}"
                    anti_convo_hash = f"{user2_id}-{user1_id}"

                    params = []
                    query_parts = ["(convo_hash = ? OR convo_hash = ?)"]
                    params.extend([convo_hash, anti_convo_hash])

                    if before_id is not None:
                        query_parts.append("id < ?")
                        params.append(before_id)

                    if filter_query:
                        query_parts.append("LOWER(message) LIKE ?")
                        params.append(f"%{filter_query.lower()}%")

                    where_clause = " AND ".join(query_parts)

                    sql = f"SELECT id, sender_id, message, timestamp, reply_id, upload, reactions, deleted FROM boys_dm WHERE {where_clause} ORDER BY id DESC LIMIT 100;"
                    raw_messages = db_sql(sql, 'boys_dm', params=params, chat_room=False)
                    if not raw_messages:
                        sql = f"SELECT id, sender_id, message, timestamp, reply_id, upload, reactions, deleted FROM girls_dm WHERE {where_clause} ORDER BY id DESC LIMIT 100;"
                        raw_messages = db_sql(sql, 'girls_dm', params=params, chat_room=False)

                    if raw_messages:
                        raw_messages.reverse()
                    else:
                        raw_messages = []

                    for msg_row in raw_messages:
                        sender_username = find_username_from_id(msg_row[1])
                        if sender_username:
                            pfp = f'/static/profile-pictures/{sender_username}.png'
                            sender_info = db_sql("SELECT theme FROM accounts WHERE username = ?;", 'accounts', params=[sender_username], chat_room=False)
                            sender_theme = sender_info[0][0] if sender_info else 'classic'
                        else:
                            sender_username = 'Unknown'
                            pfp = '/static/graphics/defaultMale.png'
                            sender_theme = 'classic'

                        try:
                            with open(f'static/themes/{sender_theme}/colors.txt', 'r') as theme_file:
                                color_dict = eval(theme_file.read())
                            color_light = color_dict.get('color_light', '#ffc67b')
                            color_dark = color_dict.get('color_dark', '#7e0808')
                        except:
                            color_light = '#ffc67b'
                            color_dark = '#7e0808'

                        msg_text = msg_row[2]
                        if msg_row[7]:
                            msg_text = "(message has been deleted)"
                        messages.append({
                            'id': msg_row[0],
                            'username': sender_username,
                            'message': msg_text,
                            'timestamp': msg_row[3],
                            'upload': msg_row[5] if not msg_row[7] else "",
                            'reactions': get_reactions_with_usernames(msg_row[6]),
                            'deleted': msg_row[7],
                            'avatar': pfp,
                            'color_light': color_light,
                            'color_dark': color_dark
                        })

                elif convo_type == 'room':
                    params = []
                    query_parts = []

                    if before_id is not None:
                        query_parts.append("id < ?")
                        params.append(before_id)

                    if filter_query:
                        query_parts.append("LOWER(message) LIKE ?")
                        params.append(f"%{filter_query.lower()}%")

                    if query_parts:
                        where_clause = "WHERE " + " AND ".join(query_parts)
                    else:
                        where_clause = ""

                    sql = f"SELECT id, user_id, message, timestamp, reply_id, upload, reactions, deleted FROM messages {where_clause} ORDER BY id DESC LIMIT 100;"
                    raw_messages = db_sql(sql, target_id, params=params, chat_room=True)
                    if raw_messages:
                        raw_messages.reverse()
                    else:
                        raw_messages = []

                    for msg_row in raw_messages:
                        sender_username = find_username_from_id(msg_row[1])
                        if sender_username:
                            pfp = f'/static/profile-pictures/{sender_username}.png'
                            sender_info = db_sql("SELECT theme FROM accounts WHERE username = ?;", 'accounts', params=[sender_username], chat_room=False)
                            sender_theme = sender_info[0][0] if sender_info else 'classic'
                        else:
                            sender_username = 'Unknown'
                            pfp = '/static/graphics/defaultMale.png'
                            sender_theme = 'classic'

                        try:
                            with open(f'static/themes/{sender_theme}/colors.txt', 'r') as theme_file:
                                color_dict = eval(theme_file.read())
                            color_light = color_dict.get('color_light', '#ffc67b')
                            color_dark = color_dict.get('color_dark', '#7e0808')
                        except:
                            color_light = '#ffc67b'
                            color_dark = '#7e0808'

                        msg_text = msg_row[2]
                        if msg_row[7]:
                            msg_text = "(message has been deleted)"
                        messages.append({
                            'id': msg_row[0],
                            'username': sender_username,
                            'message': msg_text,
                            'timestamp': msg_row[3],
                            'upload': msg_row[5] if not msg_row[7] else "",
                            'reactions': get_reactions_with_usernames(msg_row[6]),
                            'deleted': msg_row[7],
                            'avatar': pfp,
                            'color_light': color_light,
                            'color_dark': color_dark
                        })

                Server.send(str(['Admin Get Conversation Messages Result', {
                    'status': 'success',
                    'target_user': target_user,
                    'convo_type': convo_type,
                    'target_id': target_id,
                    'before_id': before_id,
                    'filter_query': filter_query,
                    'messages': messages
                }]), room=sid)
            except Exception as e:
                print(f"Admin Get Conversation Messages Error: {e}")
                Server.send(str(['Admin Get Conversation Messages Result', {'status': 'error', 'message': str(e)}]), room=sid)

    elif msg[0] == 'Get Target Admin Data':
        data = msg[1]
        username = data['username']
        password = data['password']
        target_user = data['target_user']

        if check_credentials(username, password) and is_admin(username):
            try:
                res = db_sql("SELECT frozen, pl_read_dms, pl_block_media, pl_dm_lock, pl_restricted_users, pl_curfew, pl_curfew_offline, pl_curfew_online, pl_block_games, pl_age_segregation, username FROM accounts WHERE LOWER(username) = LOWER(?);", 'accounts', params=[target_user], chat_room=False)
                if res:
                    row = res[0]
                    target_data = {
                        'status': 'success',
                        'target_user': row[10],
                        'frozen': bool(row[0]),
                        'pl_read_dms': bool(row[1]),
                        'pl_block_media': bool(row[2]),
                        'pl_dm_lock': bool(row[3]),
                        'pl_restricted_users': row[4],
                        'pl_curfew': bool(row[5]),
                        'pl_curfew_offline': row[6],
                        'pl_curfew_online': row[7],
                        'pl_block_games': bool(row[8]),
                        'pl_age_segregation': bool(row[9])
                    }
                    Server.send(str(['Get Target Admin Data Result', target_data]), room=sid)
                else:
                    Server.send(str(['Get Target Admin Data Result', {'status': 'error', 'message': 'User not found'}]), room=sid)
            except Exception as e:
                print(f"Get Target Admin Data Error: {e}")
                Server.send(str(['Get Target Admin Data Result', {'status': 'error', 'message': str(e)}]), room=sid)

    elif msg[0] == 'Update Freeze Status':
        data = msg[1]
        username = data['username']
        password = data['password']
        target_user = data['target_user']
        frozen = int(data['frozen'])

        if check_credentials(username, password) and is_admin(username):
            try:
                user_res = db_sql("SELECT username FROM accounts WHERE LOWER(username) = LOWER(?);", 'accounts', params=[target_user], chat_room=False)
                if user_res:
                    canonical_username = user_res[0][0]
                    
                    if is_admin(canonical_username):
                        Server.send(str(['Update Freeze Status Result', {'status': 'error', 'message': 'Admins are not allowed to freeze other admins.'}]), room=sid)
                        return
                        
                    db_sql("UPDATE accounts SET frozen = ? WHERE username = ?;", 'accounts', params=[frozen, canonical_username], chat_room=False)
                    
                    # Clear from memory cache
                    if canonical_username in accounts_dict:
                        del accounts_dict[canonical_username]
                    for k in list(accounts_dict.keys()):
                        if k.lower() == canonical_username.lower():
                            del accounts_dict[k]
                            
                    # Live notify target user
                    target_id = find_account_id_or_password_or_gender(canonical_username, 'id')
                    for client_sid, state in list(sid_to_room_state.items()):
                        if state.get('user_id') == target_id:
                            Server.send(str(['Account Freeze Status Changed', {'frozen': bool(frozen)}]), room=client_sid)
                            
                    Server.send(str(['Update Freeze Status Result', {'status': 'success', 'target_user': canonical_username, 'frozen': frozen}]), room=sid)
                else:
                    Server.send(str(['Update Freeze Status Result', {'status': 'error', 'message': 'User not found'}]), room=sid)
            except Exception as e:
                print(f"Update Freeze Status Error: {e}")
                Server.send(str(['Update Freeze Status Result', {'status': 'error', 'message': str(e)}]), room=sid)

    elif msg[0] == 'Update Parental Locks':
        data = msg[1]
        username = data['username']
        password = data['password']
        target_user = data['target_user']
        locks = data['locks']

        if check_credentials(username, password) and is_admin(username):
            try:
                user_res = db_sql("SELECT username FROM accounts WHERE LOWER(username) = LOWER(?);", 'accounts', params=[target_user], chat_room=False)
                if user_res:
                    canonical_username = user_res[0][0]
                    db_sql("""UPDATE accounts SET 
                        pl_read_dms = ?, 
                        pl_block_media = ?, 
                        pl_dm_lock = ?, 
                        pl_restricted_users = ?, 
                        pl_curfew = ?, 
                        pl_curfew_offline = ?, 
                        pl_curfew_online = ?, 
                        pl_block_games = ?, 
                        pl_age_segregation = ? 
                        WHERE username = ?;""", 'accounts', params=[
                            int(locks['readDms']),
                            int(locks['blockMedia']),
                            int(locks['dmLock']),
                            locks['restrictedUsers'],
                            int(locks['curfew']),
                            locks['curfewOffline'],
                            locks['curfewOnline'],
                            int(locks['blockGames']),
                            int(locks['ageSegregation']),
                            canonical_username
                        ], chat_room=False)
                    
                    # Clear from memory cache
                    if canonical_username in accounts_dict:
                        del accounts_dict[canonical_username]
                    for k in list(accounts_dict.keys()):
                        if k.lower() == canonical_username.lower():
                            del accounts_dict[k]
                            
                    Server.send(str(['Update Parental Locks Result', {'status': 'success', 'target_user': canonical_username}]), room=sid)
                else:
                    Server.send(str(['Update Parental Locks Result', {'status': 'error', 'message': 'User not found'}]), room=sid)
            except Exception as e:
                print(f"Update Parental Locks Error: {e}")
                Server.send(str(['Update Parental Locks Result', {'status': 'error', 'message': str(e)}]), room=sid)

    elif msg[0] == 'Clear Unseen Action':
        data = msg[1]
        username = data.get('username')
        password = data.get('password')
        tab = data.get('tab')
        if check_credentials(username, password) and is_admin(username):
            clear_unseen_admin_action(username, tab)

    elif msg[0] == 'Get Admin Requests':
        data = msg[1]
        username = data['username']
        password = data['password']
        
        if check_credentials(username, password) and is_admin(username):
            try:
                user_id = find_account_id_or_password_or_gender(username, 'id')
                sid_to_room_state[sid] = {'user_id': user_id, 'room': 'admin', 'is_dm': False}
                res = db_sql("SELECT id, requester, target_user, action_type, approvals, denials FROM admin_requests WHERE resolved = 0;", 'reports_alerts', chat_room=False)
                requests = []
                for row in res:
                    requests.append({
                        'id': row[0],
                        'requester': row[1],
                        'target_user': row[2],
                        'action_type': row[3],
                        'approvals': row[4],
                        'denials': row[5]
                    })
                Server.send(str(['Admin Requests Results', requests]), room=sid)
            except Exception as e:
                print(f"Get Admin Requests Error: {e}")

    elif msg[0] == 'Create Admin Request':
        data = msg[1]
        username = data['username']
        password = data['password']
        target_user = data['target_user']
        action_type = data['action_type']
        
        if check_credentials(username, password) and is_admin(username):
            try:
                if is_admin(target_user):
                    Server.send(str(['Admin Request Vote Result', {'status': 'error', 'message': 'Admins are not allowed to modify other admins.'}]), room=sid)
                    return
                
                user_res = db_sql("SELECT username FROM accounts WHERE LOWER(username) = LOWER(?);", 'accounts', params=[target_user], chat_room=False)
                if not user_res:
                    Server.send(str(['Admin Request Vote Result', {'status': 'error', 'message': 'User not found.'}]), room=sid)
                    return
                canonical_username = user_res[0][0]
                
                existing = db_sql("SELECT id FROM admin_requests WHERE target_user = ? AND action_type = ? AND resolved = 0;", 'reports_alerts', params=[canonical_username, action_type], chat_room=False)
                if existing:
                    Server.send(str(['Admin Request Vote Result', {'status': 'error', 'message': f'A request to {action_type} this user is already pending.'}]), room=sid)
                    return
                
                db_sql("INSERT INTO admin_requests (requester, target_user, action_type, approvals, denials, resolved) VALUES (?, ?, ?, ?, '', 0);", 
                       'reports_alerts', params=[username, canonical_username, action_type, username], chat_room=False)
                
                try:
                    add_unseen_admin_action('action-zone', except_admin=username)
                except Exception as e:
                    print(f"Error alerting action-zone: {e}")

                broadcast_admin_requests()
                Server.send(str(['Admin Request Vote Result', {'status': 'success', 'message': f'Proposed {action_type} request for {canonical_username} successfully.'}]), room=sid)
            except Exception as e:
                print(f"Create Admin Request Error: {e}")
                Server.send(str(['Admin Request Vote Result', {'status': 'error', 'message': str(e)}]), room=sid)

    elif msg[0] == 'Vote Admin Request':
        data = msg[1]
        username = data['username']
        password = data['password']
        request_id = int(data['request_id'])
        vote = data['vote']
        
        if check_credentials(username, password) and is_admin(username):
            try:
                req_res = db_sql("SELECT id, requester, target_user, action_type, approvals, denials FROM admin_requests WHERE id = ? AND resolved = 0;", 'reports_alerts', params=[request_id], chat_room=False)
                if not req_res:
                    Server.send(str(['Admin Request Vote Result', {'status': 'error', 'message': 'Request not found or already resolved.'}]), room=sid)
                    return
                
                row = req_res[0]
                req_id, requester, target_user, action_type, approvals_str, denials_str = row
                
                approvals = approvals_str.split(',') if approvals_str else []
                approvals = [x for x in approvals if x]
                denials = denials_str.split(',') if denials_str else []
                denials = [x for x in denials if x]
                
                if username in approvals or username in denials:
                    Server.send(str(['Admin Request Vote Result', {'status': 'error', 'message': 'You have already voted on this request.'}]), room=sid)
                    return
                
                if vote == 'approve':
                    approvals.append(username)
                else:
                    denials.append(username)
                
                new_approvals_str = ','.join(approvals)
                new_denials_str = ','.join(denials)
                
                db_sql("UPDATE admin_requests SET approvals = ?, denials = ? WHERE id = ?;", 'reports_alerts', params=[new_approvals_str, new_denials_str, request_id], chat_room=False)
                
                threshold = 3 if action_type == 'delete' else 2
                executed_message = None
                
                if vote == 'deny':
                    db_sql("UPDATE admin_requests SET resolved = 1 WHERE id = ?;", 'reports_alerts', params=[request_id], chat_room=False)
                    executed_message = f"Request to {action_type} {target_user} was denied and cancelled by {username}."
                
                elif len(approvals) >= threshold:
                    db_sql("UPDATE admin_requests SET resolved = 1 WHERE id = ?;", 'reports_alerts', params=[request_id], chat_room=False)
                    
                    if action_type == 'freeze':
                        db_sql("UPDATE accounts SET frozen = 1 WHERE LOWER(username) = LOWER(?);", 'accounts', params=[target_user], chat_room=False)
                        
                        if target_user in accounts_dict:
                            del accounts_dict[target_user]
                        for k in list(accounts_dict.keys()):
                            if k.lower() == target_user.lower():
                                del accounts_dict[k]
                        
                        target_id = find_account_id_or_password_or_gender(target_user, 'id')
                        for client_sid, state in list(sid_to_room_state.items()):
                            if state.get('user_id') == target_id:
                                Server.send(str(['Account Freeze Status Changed', {'frozen': True}]), room=client_sid)
                        
                        executed_message = f"Threshold met. Account {target_user} has been frozen."
                        
                    elif action_type == 'unfreeze':
                        db_sql("UPDATE accounts SET frozen = 0 WHERE LOWER(username) = LOWER(?);", 'accounts', params=[target_user], chat_room=False)
                        
                        if target_user in accounts_dict:
                            del accounts_dict[target_user]
                        for k in list(accounts_dict.keys()):
                            if k.lower() == target_user.lower():
                                del accounts_dict[k]
                        
                        target_id = find_account_id_or_password_or_gender(target_user, 'id')
                        for client_sid, state in list(sid_to_room_state.items()):
                            if state.get('user_id') == target_id:
                                Server.send(str(['Account Freeze Status Changed', {'frozen': False}]), room=client_sid)
                                
                        executed_message = f"Threshold met. Account {target_user} has been unfrozen."
                        
                    elif action_type == 'delete':
                        db_sql("DELETE FROM accounts WHERE LOWER(username) = LOWER(?);", 'accounts', params=[target_user], chat_room=False)
                        
                        if target_user in accounts_dict:
                            del accounts_dict[target_user]
                        for k in list(accounts_dict.keys()):
                            if k.lower() == target_user.lower():
                                del accounts_dict[k]
                                
                        target_id = find_account_id_or_password_or_gender(target_user, 'id')
                        for client_sid, state in list(sid_to_room_state.items()):
                            if state.get('user_id') == target_id:
                                Server.send(str(['Account Deleted Notification', {}]), room=client_sid)
                                
                        executed_message = f"Threshold met. Account {target_user} has been permanently deleted."
                
                broadcast_admin_requests()
                Server.send(str(['Admin Request Vote Result', {'status': 'success', 'message': executed_message}]), room=sid)
            except Exception as e:
                print(f"Vote Admin Request Error: {e}")
                Server.send(str(['Admin Request Vote Result', {'status': 'error', 'message': str(e)}]), room=sid)


@Server.on('disconnect')
def on_disconnect():
    process_room_leave(request.sid)

@Server.on('message')
def recv(message):
    Thread(target=Recv, args=(message, request.sid)).start()


if __name__ == "__main__":
    Server.run(app, host='localhost', port=80, debug=True)