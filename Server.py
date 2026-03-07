from flask import Flask, render_template, render_template_string, redirect, request, flash, session 
from flask_socketio import SocketIO
from werkzeug.utils import secure_filename
import werkzeug
import sqlite3
import datetime
import os
import shutil
import secrets
from threading import Thread, Lock
import ast

def db_sql(sql, db_string, params=[], chat_room=False):
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
    
    with lock:
        conn = sqlite3.connect(db_path)

        cursor = conn.cursor()
        
        cursor.execute(sql, params)
        
        if remove_go_spaces(sql.lower()).startswith("select"):
            result = cursor.fetchall()
        else:
            conn.commit()
            result = True
            
        conn.close()
        return result



def remove_go_spaces(string):
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


# Create application and Server

app = Flask(__name__)
app.secret_key = secrets.token_hex(64)
Server = SocketIO(app)


accounts_lock = Lock()
rooms_lock = Lock()

if not os.path.exists("rooms/mainroom.db"):
    room_db = sqlite3.connect("rooms/mainroom.db")
    room_cursor = room_db.cursor()
    room_cursor.execute('''
        CREATE TABLE messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
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
            theme TEXT NOT NULL
        );
    ''')
    accounts_db.close()

if not os.path.exists("rooms.db"):
    rooms_db = sqlite3.connect("rooms.db")
    rooms_cursor = rooms_db.cursor()
    rooms_cursor.execute('''
        CREATE TABLE rooms (
            roomid INTEGER PRIMARY KEY AUTOINCREMENT,
            roomname TEXT NOT NULL,
            roomtype TEXT NOT NULL,
            invites TEXT NOT NULL
        );
    ''')
    rooms_cursor.execute(''' INSERT INTO rooms (roomname, roomtype, invites) VALUES (?, ?, ?);''', ('Mainroom', 'public', ''))
    rooms_db.close()

def convert_to_gmt(timestamp):
    # Parse timestamp and convert to GMT military time
    # Input format: "Sat Mar 07 2026 15:15:11 GMT-0500 (Eastern Standard Time)"
    try:
        # Extract the timezone offset (e.g., "GMT-0500")
        tz_match = timestamp.split('GMT-')[1].split(' (')[0]
        tz_offset = int(tz_match)
        
        # Extract the datetime part (e.g., "Sat Mar 07 2026 15:15:11")
        datetime_part = remove_go_spaces(timestamp.split('GMT')[0])
        
        # Parse the datetime and add timezone offset to get GMT
        dt = datetime.datetime.strptime(datetime_part, "%a %b %d %Y %H:%M:%S")
        gmt_dt = dt + datetime.timedelta(hours=-tz_offset//100)
        
        # Format as date and GMT military time
        gmt_timestamp = gmt_dt.strftime("%Y-%m-%d %H:%M:%S")
    except:
        # Fallback to original timestamp if parsing fails
        gmt_timestamp = timestamp
    return gmt_timestamp


room_dict = {}

#make room databases dict
for file in os.listdir("rooms"):
    if file.endswith(".db"):
        file_path = os.path.join("rooms", file)
        file_lock = Lock() 

        room_dict[file] = {
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

        account_password = db_sql("SELECT password FROM accounts WHERE username = ?;", 'accounts', params=[username], chat_room=False)

        if account_password:
            if remove_go_spaces(account_password[0][0].lower()) == remove_go_spaces(password.lower()):
                session['username'] = username
                session['password'] = password

                return redirect('/home/')

            else:
                raise werkzeug.exceptions.BadRequestKeyError('Lets get him directed back to the welcome page')

        else:
            raise werkzeug.exceptions.BadRequestKeyError('Lets get him directed back to the welcome page')

    except werkzeug.exceptions.BadRequestKeyError:
        return render_template('welcome.html')

@app.route('/computer-log-into-server/', methods=['POST'])
def computer_log_into_server():
    try:
        username = request.form['username']
        password = request.form['password']

        account_password = db_sql("SELECT password FROM accounts WHERE username = ?;", 'accounts', params=[username], chat_room=False)

        if account_password:
            if remove_go_spaces(account_password[0][0].lower()) == remove_go_spaces(password.lower()):
                session['username'] = username
                session['password'] = password

                return redirect('/home/')

            else:
                raise werkzeug.exceptions.BadRequestKeyError('Lets get him directed back to the welcome page')

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

        account_password = db_sql("SELECT password FROM accounts WHERE username = ?;", 'accounts', params=[username], chat_room=False)

        if account_password:
            if remove_go_spaces(account_password[0][0].lower()) == remove_go_spaces(password.lower()):

                theme = db_sql("SELECT theme FROM accounts WHERE username = ?;", 'accounts', params=[username], chat_room=False)
                if theme:
                    theme = theme[0][0]
                else:
                    theme = 'classic'

                colorsFile = open(f'static/themes/{theme}/colors.txt', 'r')
                colors = ast.literal_eval(colorsFile.read())
                colorsFile.close()

                return render_template('home.html', theme=theme, color_dark=colors['color_dark'], color_medium=colors['color_medium'], color_light=colors['color_light'])

            else:
                raise KeyError('Why do people try to hack accounts?')

        else:
            raise KeyError('Why do people try to hack accounts?')

    except KeyError:
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
            timestamp = data['timestamp']
            user_message = data['message']
        
        except KeyError:
            return # Dont bother to return a response to someone who is trying to alter the code

        queryResult = db_sql("""SELECT password FROM accounts WHERE username = ?;""", 'accounts', params=[username], chat_room=False)
        if queryResult:
            if remove_go_spaces(queryResult[0][0].lower()) == remove_go_spaces(password.lower()):
                if setting == 'public room':
                    # Send message to public room
                    
                    user_id = db_sql("""SELECT id FROM accounts WHERE username = ?;""", 'accounts', params=[username], chat_room=False)[0][0]
                    gmt_timestamp = convert_to_gmt(timestamp)

                    db_sql("""INSERT INTO messages (user_id, message, timestamp, reply_id, upload) VALUES (?, ?, ?, ?, ?);""", room, params=[user_id, user_message, gmt_timestamp, -1, ''], chat_room=True)
                    Server.send(str(['Message', {'username': username, 'message': user_message, 'timestamp': gmt_timestamp}]), room=room)

                elif setting == 'private room':
                    # Send message to private room
                    pass
                elif setting == 'direct message':
                    # Send message to direct message
                    pass
                else:
                    return # Invalid setting
            else:
                return # Invalid password
        else:
            return # User not found

    
    elif msg[0] == 'Log In':
        data = msg[1]
        username = data['username']
        password = data['password']

        queryResult = db_sql("""SELECT password FROM accounts WHERE username = ?;""", 'accounts', params=[username], chat_room=False)

        if queryResult:
            if remove_go_spaces(queryResult[0][0].lower()) == remove_go_spaces(password.lower()):
                Server.send(str(['Log In Results', username, 'Success', password]), room=sid)

            else:
                Server.send(str(['Log In Results', username, 'Wrong Password']), room=sid)
    
        else:
            Server.send(str(['Log In Results', username, 'Wrong Username']), room=sid)
            
    elif msg[0] == 'Secret Log In':
        data = msg[1]
        username = data['username']
        password = data['password']

        queryResult = db_sql("""SELECT password FROM accounts WHERE username = ?;""", 'accounts', params=[username], chat_room=False)

        if queryResult:
            if remove_go_spaces(queryResult[0][0].lower()) == remove_go_spaces(password.lower()):
                Server.send(str(['Log In Results', username, 'Success', password]), room=sid)

            else:
                return
    
        else:
            return

    elif msg[0] == 'Create Account':
        data = msg[1]
        
        username = data['username']

        # Check if username already exists (case-insensitive and no spaces)
        clean_username = remove_go_spaces(username.lower())
        queryResult = db_sql("SELECT username FROM accounts;", 'accounts', chat_room=False)
        existing_usernames = [remove_go_spaces(row[0].lower()) for row in queryResult]

        if clean_username in existing_usernames:
            Server.send(str(['Create Account Results', data['username'], 'Username Exists']), room=sid)
            return

        password = data['password']
        first_name = data['first_name']
        last_name = data['last_name']
        email = data['email']
        dob = data['dob']
        gender = data['gender']

        # Username available - create account
        db_sql("""INSERT INTO accounts (username, password, first_name, last_name, email, dob, gender, theme) VALUES (?, ?, ?, ?, ?, ?, ?, ?);""", 'accounts', params=[username, password, first_name, last_name, email, dob, gender, 'classic'], chat_room=False)

        shutil.copyfile(f'static/graphics/default{gender.capitalize()}.png', f'static/profile-pictures/{username}.png')
        
        Server.send(str(['Create Account Results', data['username'], 'Success']), room=sid)

@Server.on('message')
def recv(message):
    Thread(target=Recv, args=(message, request.sid)).start()



if __name__ == "__main__":
    Server.run(app, host='localhost', port=80, debug=True)