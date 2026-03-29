from shlex import join
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
    
    with lock:
        conn = sqlite3.connect(db_path)

        cursor = conn.cursor()
        
        cursor.execute(sql, params)

        result = None
        
        if remove_go_spaces(sql.lower()).startswith("select"):
            result = cursor.fetchall()
        else:
            conn.commit()
            result = True
            if chat_room or provide_id:
                result = cursor.lastrowid
            
        conn.close()
        return result

def check_room_access(room_name, username):
    user_id = find_account_id_or_password_or_gender(username, 'id')
    queryResults = db_sql("""SELECT room_type, owners, managers, curators, members FROM rooms WHERE room_name = ?;""", 'rooms', params=[room_name], chat_room=False)
    
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

def check_credentials(username, password):
    password = find_account_id_or_password_or_gender(username, 'password', RGS=True)
    return (password and password == password)


def fetch_room_messages(room_name, limit, offset):
    messages = []
    
    if offset == -1:
        query = db_sql("""SELECT id, user_id, message, timestamp, reply_id, upload FROM messages ORDER BY id DESC LIMIT ?""", room_name, params=[limit], chat_room=True)
    else:
        query = db_sql("""SELECT id, user_id, message, timestamp, reply_id, upload FROM messages WHERE id < ? ORDER BY id DESC LIMIT ?""", room_name, params=[offset, limit], chat_room=True)    

    for t in query:
        message = {}
        message['id'] = t[0]
        message['username'] = find_username_from_id(t[1])
        message['message'] = t[2]
        message['timestamp'] = t[3]
        message['reply_id'] = t[4]
        message['upload'] = t[5]
        messages.append(message)

    if offset == -1: messages.reverse()
    
    return messages


def fetch_dm_messages(dm_string, username, limit, offset):
    primary_user_id = find_account_id_or_password_or_gender(dm_string.split('.$@-@&.')[0], 'id')
    primaryGender = find_account_id_or_password_or_gender(dm_string.split('.$@-@&.')[0], 'gender')
    secondary_user_id = find_account_id_or_password_or_gender(dm_string.split('.$@-@&.')[1], 'id')

    id_to_username = {f"{primary_user_id}": dm_string.split('.$@-@&.')[0], f"{secondary_user_id}": dm_string.split('.$@-@&.')[1]}

    genderDict = {'male': 'boys_dm', 'female': 'girls_dm'}
    

    if offset != -1:
        raw_messages = db_sql(f"""SELECT id, sender_id, message, timestamp, reply_id, upload FROM {genderDict[primaryGender]} WHERE convo_hash = ? ORDER BY id DESC LIMIT ?""", genderDict[primaryGender], params=[f"{primary_user_id}-{secondary_user_id}", limit], chat_room=False)
    else:
        raw_messages = db_sql(f"""SELECT id, sender_id, message, timestamp, reply_id, upload FROM {genderDict[primaryGender]} WHERE convo_hash = ? AND id < ? ORDER BY id DESC LIMIT ?""", genderDict[primaryGender], params=[f"{primary_user_id}-{secondary_user_id}", offset, limit], chat_room=False)

    actual_user_dm_username = dm_string.split('.$@-@&.')[1] if dm_string.split('.$@-@&.')[0] == username else dm_string.split('.$@-@&.')[0]
    
    messages = []
    for message in raw_messages:
        messages.append({
            'id': message[0],
            'username': id_to_username[str(message[1])],
            'message': message[2],
            'timestamp': message[3],
            'reply_id': message[4],
            'upload': message[5]
        })

    return messages, actual_user_dm_username


accounts_dict = {}
id_to_accounts_dict = {}

def find_account_id_or_password_or_gender(user, id_or_password_or_gender='id', RGS=False, RU=False):
    if RGS:
        user = remove_go_spaces(user)

    try:
        if id_or_password_or_gender == 'id':
            return accounts_dict[user]['id']
            
        elif id_or_password_or_gender == 'password':
            return accounts_dict[user]['password']

        elif id_or_password_or_gender == 'gender':
            return accounts_dict[user]['gender']
        

    except KeyError:
        data = db_sql("""SELECT username, password, id, gender FROM accounts WHERE LOWER(username) = ?;""", 'accounts', params=[user.lower()], chat_room=False)[0]
        if data:
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


# Create application and Server

app = Flask(__name__)
app.secret_key = secrets.token_hex(64)
Server = SocketIO(app)


accounts_lock = Lock()
rooms_lock = Lock()
boys_dm_lock = Lock()
girls_dm_lock = Lock()

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
            upload TEXT NOT NULL
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
            emoji TEXT NOT NULL
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
            upload TEXT NOT NULL
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
            upload TEXT NOT NULL
        );
    ''')
    girls_dm_db.close()

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
                actual_user_dm_username = room.split('.$@-@&.')[1] if room.split('.$@-@&.')[0] == username else room.split('.$@-@&.')[0]

                room_emoji = f"/static/profile-pictures/{actual_user_dm_username}.png"
                room_type = 'dm'
            else:
                room_emoji, room_type = db_sql("SELECT emoji, room_type FROM rooms WHERE room_name = ?;", 'rooms', params=[room], chat_room=False)[0]


            return render_template(
                'home.html',
                theme=theme,
                color_dark=colors['color_dark'],
                color_medium=colors['color_medium'],
                color_light=colors['color_light'],
                room=room,
                room_emoji=room_emoji,
                room_type=room_type
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



def Recv(message, sid):
    msg = ast.literal_eval(message)
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

                    message_id = db_sql("""INSERT INTO messages (user_id, message, timestamp, reply_id, upload) VALUES (?, ?, ?, ?, ?);""", room, params=[user_id, user_message, gmt_timestamp, reply_index, upload], chat_room=True)
                    Server.send(str(['Message', {'id': message_id, 'username': username, 'message': user_message, 'timestamp': gmt_timestamp, 'reply_id': int(reply_index)}]), room=room)
            
            elif setting == 'dm':
                actual_user_dm_username = room.split('.$@-@&.')[1] if room.split('.$@-@&.')[0] == username else room.split('.$@-@&.')[0]

                username_id = find_account_id_or_password_or_gender(username, 'id')

                important_id = find_account_id_or_password_or_gender(room.split('.$@-@&.')[0], 'id')
                important_gender = find_account_id_or_password_or_gender(room.split('.$@-@&.')[0], 'gender')
                un_important_id = find_account_id_or_password_or_gender(room.split('.$@-@&.')[1], 'id')

                fm_to_gb = {'female': 'girl', 'male': 'boy'}

                gmt_timestamp = convert_to_gmt(timestamp)

                message_id = db_sql(f"""INSERT INTO {fm_to_gb[important_gender]}s_dm (convo_hash, sender_id, message, timestamp, reply_id, upload) VALUES (?, ?, ?, ?, ?, ?);""", f"{fm_to_gb[important_gender]}s_dm", params=[f"{important_id}-{un_important_id}", username_id, user_message, gmt_timestamp, reply_index, upload], chat_room=False, provide_id=True)
                Server.send(str(['Message', {'id': message_id, 'username': username, 'message': user_message, 'timestamp': gmt_timestamp, 'reply_id': int(reply_index)}]), room=room)
                

    elif msg[0] == 'Fetch Room Messages':
        username = msg[1]['username']
        password = msg[1]['password']
        data = msg[1]
        room = data['room']
        limit = data['limit']
        offset = data['offset']
        
        if check_credentials(username, password) and check_room_access(room, username):
            messages = fetch_room_messages(room, limit, offset)
            Server.send(str(['Fetch Room Messages', {'messages': messages, 'room': room, 'emoji': db_sql("""SELECT emoji FROM rooms WHERE room_name = ?;""", 'rooms', params=[room], chat_room=False)[0][0], 'overhead': (offset != -1)}]), room=sid)

    elif msg[0] == 'Fetch DM Messages':
        username = msg[1]['username']
        password = msg[1]['password']
        limit = msg[1]['limit']
        offset = msg[1]['offset']
        new_dm = db_sql("""SELECT room FROM accounts WHERE username = ?;""", 'accounts', params=[username], chat_room=False)[0][0]
        
        messages, actual_user_dm_username = fetch_dm_messages(new_dm, username, limit, offset)

        db_sql("""UPDATE accounts SET room = ? WHERE username = ?;""", 'accounts', params=[new_dm, username], chat_room=False)
        
        Server.send(str(['Fetch DM Messages', {'messages': messages, 'room': new_dm, 'profile_picture': f'/static/profile-pictures/{actual_user_dm_username}.png', 'overhead': (offset != -1)}]), room=sid)
    

    elif msg[0] == 'Join Room':
        data = msg[1]
        room = data['room']
        username = data['username']
        password = data['password']
        
        if check_credentials(username, password):
            if check_room_access(room, username):
                Server.server.enter_room(sid, room)
            else:
                return # User not allowed in room
        else:
            return 

    elif msg[0] == 'Switch Room':
        data = msg[1]
        old_group = data['old-group']
        new_room = data['room']
        username = data['username']
        password = data['password']
        
        if check_credentials(username, password):
            if check_room_access(new_room, username):
                Server.server.leave_room(sid, old_group)
                Server.server.enter_room(sid, new_room)

                db_sql("""UPDATE accounts SET room = ? WHERE username = ?;""", 'accounts', params=[new_room, username], chat_room=False)

                Server.send(str(['Fetch Room Messages', {'messages': fetch_room_messages(new_room, 50, -1), 'room': new_room, 'emoji': db_sql("""SELECT emoji FROM rooms WHERE room_name = ?;""", 'rooms', params=[new_room], chat_room=False)[0][0], 'clear': False}]), room=sid)
            else:
                return # User not allowed in room
        else:
            return 

    elif msg[0] == 'Switch DM':
        data = msg[1]
        old_group = data['old-group']
        new_dm = data['new-dm']
        username = data['username']
        password = data['password']
        
        if check_credentials(username, password):
            Server.server.leave_room(sid, old_group)
            Server.server.enter_room(sid, new_dm)
            
            messages, actual_user_dm_username = fetch_dm_messages(new_dm, username, 50, -1)

            db_sql("""UPDATE accounts SET room = ? WHERE username = ?;""", 'accounts', params=[new_dm, username], chat_room=False)
            
            Server.send(str(['Fetch DM Messages', {'messages': messages, 'room': new_dm, 'profile_picture': f'/static/profile-pictures/{actual_user_dm_username}.png', 'clear': False}]), room=sid)
            
        else:
            return 

    elif msg[0] == 'Leave Room':
        data = msg[1]
        room = data['room']
        Server.server.leave_room(sid, room)


    elif msg[0] == 'Get Rooms':
        data = msg[1]
        username = data['username']
        password = data['password']
        roomtype = data['roomtype']
        
        if check_credentials(username, password):
                all_rooms = db_sql("""SELECT room_name, room_type, description, owners, managers, curators, members, emoji FROM rooms;""", 'rooms', chat_room=False)
                user_rooms = []

                user_id = find_account_id_or_password_or_gender(username, 'id')
                
                for room in all_rooms:

                    if room[1] == 'public' and roomtype == 'public':
                        user_rooms.append({'name': room[0], 'description': room[2], 'emoji': room[7]})
                    
                    
                    elif room[1] == 'private' and roomtype == 'private':
                        owners = split(room[3])
                        managers = split(room[4])
                        curators = split(room[5])
                        members = split(room[6])

                        all_members = owners+managers+curators+members
                        
                        if str(user_id) in all_members:
                            user_rooms.append({'name': room[0], 'description': room[2], 'emoji': room[7]})

                Server.send(str(['Get Rooms', user_rooms]), room=sid)


    elif msg[0] == 'Get Dms':
        data = msg[1]
        username = data['username']
        password = data['password']
        
        if check_credentials(username, password):
            dms = {'unread': [], 'read': []}
            dms_ids = split(db_sql("""SELECT dms FROM accounts WHERE username = ?;""", 'accounts', params=[username], chat_room=False)[0][0])
            
            if dms_ids:
                for dm in dms_ids:
                    if dm[0] == 'u':
                        dmli = list(dm)
                        dmli.pop(0)
                        dm = ''.join(dmli)
                        dm_info = db_sql("""SELECT username, first_name, last_name FROM accounts WHERE id = ?;""", 'accounts', params=[str(dm)], chat_room=False)[0]
                        dms['unread'].append({'username': dm_info[0], 'first_name': dm_info[1], 'last_name': dm_info[2]})
                    else:
                        dm_info = db_sql("""SELECT username, first_name, last_name FROM accounts WHERE id = ?;""", 'accounts', params=[str(dm)], chat_room=False)[0]
                        dms['read'].append({'username': dm_info[0], 'first_name': dm_info[1], 'last_name': dm_info[2]})
                
            
            Server.send(str(['Get Dms', dms]), room=sid)
            

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
            query = db_sql("""SELECT * FROM rooms WHERE room_name = ?;""", 'rooms', params=[roomname], chat_room=False)
            if query:
                Server.send(str(['Create Room Results', 'Room Already Exists']), room=sid)
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
                        upload TEXT NOT NULL
                    );
                ''')
                
                new_room_connection.close()

                room_dict[roomname] = {'filepath': f'rooms/{roomname}.db', 'lock': Lock()}

                db_sql("""INSERT INTO rooms (room_name, description, room_type, owners, managers, curators, members, emoji) VALUES (?, ?, ?, ?, ?, ?, ?, ?);""", 'rooms', params=[roomname, description, roomtype, str(find_account_id_or_password_or_gender(username, 'id')), '', '', '', emoji], chat_room=False)
                
                Server.send(str(['Create Room Results', 'Room Created']), room=sid)

@Server.on('message')
def recv(message):
    Thread(target=Recv, args=(message, request.sid)).start()


if __name__ == "__main__":
    Server.run(app, host='localhost', port=80, debug=True)