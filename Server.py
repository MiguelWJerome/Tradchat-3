from flask import Flask, render_template, render_template_string, redirect, request, flash, session 
from flask_socketio import SocketIO
from werkzeug.utils import secure_filename
import werkzeug
import sqlite3
import os
import shutil
import secrets
from threading import Thread, Lock

def db_sql(sql, db_string, params=[],chat_room=False):
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

room_dict = {}

#make room databases dict
for file in os.listdir("rooms"):
    if file.endswith(".db"):
        file_path = os.path.join("rooms", file)
        file_lock = Lock() 

        room_dict[file] = {
            'file_path': file_path,
            'queue': file_lock
        }


def remove_go_spaces(text):
    """Remove all spaces from text"""
    return text.replace(" ", "")


# Create application and Server

app = Flask(__name__)
app.secret_key = secrets.token_hex(64)
Server = SocketIO(app)



accounts_db_exists = os.path.exists("accounts.db")
rooms_db_exists = os.path.exists("rooms.db")

accounts_lock = Lock()
rooms_lock = Lock()


# Create tables if databases didn't exist
if not accounts_db_exists:
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

if not rooms_db_exists:
    rooms_db = sqlite3.connect("rooms.db")
    rooms_cursor = rooms_db.cursor()
    rooms_cursor.execute('''
        CREATE TABLE rooms (
            roomid INTEGER PRIMARY KEY AUTOINCREMENT,
            roomname TEXT NOT NULL,
            roomtype TEXT NOT NULL,
            invites TEXT
        );
    ''')
    rooms_db.close()


@app.route('/')
def index():
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



@app.route('/home/')
def home():
    try:
        username = session['username']
        password = session['password']

        account_password = db_sql("SELECT password FROM accounts WHERE username = ?;", 'accounts', params=[username], chat_room=False)

        if account_password:
            if remove_go_spaces(account_password[0][0].lower()) == remove_go_spaces(password.lower()):

                return render_template('home.html')

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



def Recv(message):
    msg = eval(message)
    print(msg)
    if msg[0] == 'Log In':
        data = msg[1]
        username = data['username']
        password = data['password']

        queryResult = db_sql("""SELECT password FROM accounts WHERE username = ?;""", 'accounts', params=[username], chat_room=False)

        if queryResult:
            if remove_go_spaces(queryResult[0][0].lower()) == remove_go_spaces(password.lower()):
                Server.send(str(['Log In Results', username, 'Success', password]))

            else:
                Server.send(str(['Log In Results', username, 'Wrong Password']))
    
        else:
            Server.send(str(['Log In Results', username, 'Wrong Username']))


    elif msg[0] == 'Create Account':
        data = msg[1]
        
        username = data['username']

        # Check if username already exists (case-insensitive and no spaces)
        clean_username = remove_go_spaces(username.lower())
        queryResult = db_sql("SELECT username FROM accounts;", 'accounts', chat_room=False)
        existing_usernames = [remove_go_spaces(row[0].lower()) for row in queryResult]

        if clean_username in existing_usernames:
            Server.send(str(['Create Account Results', data['username'], 'Username Exists']))
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
        
        Server.send(str(['Create Account Results', data['username'], 'Success']))

@Server.on('message')
def recv(message):
    Thread(target=Recv, args=(message,)).start()


if __name__ == "__main__":
    Server.run(app, host='localhost', port=80, debug=True)