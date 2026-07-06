from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit, join_room
import os
import time
import json
import sqlite3
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

app = Flask(__name__)
app.config["SECRET_KEY"] = os.urandom(24).hex()
socketio = SocketIO(app, cors_allowed_origins="*")

DB_PATH = os.path.join(os.path.dirname(__file__), "chat.db")

config_path = os.path.join(os.path.dirname(__file__), "config.json")
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
if not GOOGLE_CLIENT_ID and os.path.exists(config_path):
    with open(config_path) as f:
        cfg = json.load(f)
    GOOGLE_CLIENT_ID = cfg.get("GOOGLE_CLIENT_ID", "")

DEFAULT_AVATARS = ["😎","🦸","🧙","🚀","🎮","🦊","🐉","👑","💻","🎸","🌈","🔥","⭐","🦋","🍕","🌙"]

rooms = {}
online_users = {}
user_sockets = {}

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            email TEXT DEFAULT '',
            bio TEXT DEFAULT '',
            avatar TEXT DEFAULT '😎',
            google_pic TEXT DEFAULT '',
            google_id TEXT UNIQUE DEFAULT NULL,
            created_at REAL DEFAULT (strftime('%s','now'))
        );
        CREATE TABLE IF NOT EXISTS follows (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            follower TEXT NOT NULL,
            followed TEXT NOT NULL,
            created_at REAL DEFAULT (strftime('%s','now')),
            UNIQUE(follower, followed)
        );
        CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower);
        CREATE INDEX IF NOT EXISTS idx_follows_followed ON follows(followed);
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room TEXT NOT NULL,
            username TEXT NOT NULL,
            text TEXT NOT NULL,
            msg_type TEXT DEFAULT 'user',
            time REAL DEFAULT (strftime('%s','now'))
        );
        CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room);
    """)
    conn.commit()
    conn.close()

init_db()

def get_profile(username):
    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    conn.close()
    if not row:
        return None
    return dict(row)

def get_or_create_profile(username, google_pic=""):
    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    if not row:
        avatar = DEFAULT_AVATARS[abs(hash(username)) % len(DEFAULT_AVATARS)]
        conn.execute(
            "INSERT INTO users (username, bio, avatar, google_pic) VALUES (?, ?, ?, ?)",
            (username, f"Hi, I'm {username}!", avatar, google_pic)
        )
        conn.commit()
        row = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    elif google_pic and not row["google_pic"]:
        conn.execute("UPDATE users SET google_pic = ? WHERE username = ?", (google_pic, username))
        conn.commit()
        row = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    conn.close()
    return dict(row)

def get_user_pic(username):
    conn = get_db()
    row = conn.execute("SELECT avatar, google_pic FROM users WHERE username = ?", (username,)).fetchone()
    conn.close()
    if row:
        return row["avatar"], row["google_pic"]
    return "😎", ""

def get_follow_counts(username):
    conn = get_db()
    followers = conn.execute("SELECT COUNT(*) FROM follows WHERE followed = ?", (username,)).fetchone()[0]
    following = conn.execute("SELECT COUNT(*) FROM follows WHERE follower = ?", (username,)).fetchone()[0]
    conn.close()
    return followers, following

def is_following(follower, followed):
    conn = get_db()
    row = conn.execute("SELECT 1 FROM follows WHERE follower = ? AND followed = ?", (follower, followed)).fetchone()
    conn.close()
    return row is not None

def save_message(room, username, text, msg_type="user"):
    conn = get_db()
    cur = conn.execute(
        "INSERT INTO messages (room, username, text, msg_type, time) VALUES (?, ?, ?, ?, ?)",
        (room, username, text, msg_type, time.time())
    )
    msg_id = cur.lastrowid
    conn.commit()
    conn.close()
    return msg_id

@app.route("/google_login", methods=["POST"])
def google_login():
    if not GOOGLE_CLIENT_ID:
        return jsonify({"error": "Google Client ID not configured. Check config.json"}), 400
    token = request.json.get("credential")
    if not token:
        return jsonify({"error": "No token provided"}), 400
    try:
        info = id_token.verify_oauth2_token(token, google_requests.Request(), GOOGLE_CLIENT_ID)
        google_id = info["sub"]
        name = info.get("name", "User")
        email = info.get("email", "")
        picture = info.get("picture", "")
        conn = get_db()
        row = conn.execute("SELECT username FROM users WHERE google_id = ?", (google_id,)).fetchone()
        if row:
            username = row["username"]
            conn.execute("UPDATE users SET email = ?, google_pic = ? WHERE username = ?", (email, picture, username))
        else:
            username = name.replace(" ", "_")[:20]
            existing = conn.execute("SELECT 1 FROM users WHERE username = ?", (username,)).fetchone()
            if existing:
                base = username
                i = 1
                while conn.execute("SELECT 1 FROM users WHERE username = ?", (f"{base}{i}",)).fetchone():
                    i += 1
                username = f"{base}{i}"
            avatar = DEFAULT_AVATARS[abs(hash(username)) % len(DEFAULT_AVATARS)]
            conn.execute(
                "INSERT INTO users (username, email, bio, avatar, google_pic, google_id) VALUES (?, ?, ?, ?, ?, ?)",
                (username, email, f"Hi, I'm {name}!", avatar, picture, google_id)
            )
        conn.commit()
        conn.close()
        return jsonify({"username": username, "email": email, "picture": picture, "name": name})
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

@app.route("/")
def index():
    return render_template("index.html", google_client_id=GOOGLE_CLIENT_ID)

@socketio.on("join")
def handle_join(data):
    username = data["username"]
    room = data.get("room", "general")
    google_pic = data.get("google_pic", "")
    join_room(room)
    online_users[request.sid] = {"username": username, "room": room}
    user_sockets[username] = request.sid
    profile = get_or_create_profile(username, google_pic)
    if room not in rooms:
        rooms[room] = []
    if username not in rooms[room]:
        rooms[room].append(username)
    conn = get_db()
    history = conn.execute(
        "SELECT id, username, text, msg_type, time FROM messages WHERE room = ? ORDER BY id DESC LIMIT 50",
        (room,)
    ).fetchall()
    conn.close()
    history_list = []
    for h in reversed(history):
        hd = dict(h)
        avatar, google_pic = get_user_pic(hd["username"])
        hd["avatar"] = avatar
        hd["google_pic"] = google_pic
        if hd["msg_type"] == "audio" and hd["text"].startswith("data:"):
            hd["voice"] = True
        history_list.append(hd)
    emit("history", {"messages": history_list})
    save_message(room, "System", f"{username} joined #{room}", "system")
    emit("message", {"user": "System", "text": f"{username} joined #{room}", "time": time.time()}, room=room)
    emit("users", {"users": rooms[room]}, room=room)

@socketio.on("join_dm")
def handle_join_dm(data):
    username = data["username"]
    target = data["target"]
    if username == target:
        return
    room = "dm__" + "_".join(sorted([username.lower(), target.lower()]))
    join_room(room)
    online_users[request.sid] = {"username": username, "room": room}
    user_sockets[username] = request.sid
    if room not in rooms:
        rooms[room] = []
    for u in [username, target]:
        if u not in rooms[room]:
            rooms[room].append(u)
    conn = get_db()
    history = conn.execute(
        "SELECT id, username, text, msg_type, time FROM messages WHERE room = ? ORDER BY id DESC LIMIT 50",
        (room,)
    ).fetchall()
    conn.close()
    history_list = []
    for h in reversed(history):
        hd = dict(h)
        avatar, google_pic = get_user_pic(hd["username"])
        hd["avatar"] = avatar
        hd["google_pic"] = google_pic
        if hd["msg_type"] == "audio" and hd["text"].startswith("data:"):
            hd["voice"] = True
        history_list.append(hd)
    emit("history", {"messages": history_list})
    emit("dm_joined", {"room": room, "target": target})

@socketio.on("message")
def handle_message(data):
    user_info = online_users.get(request.sid)
    if user_info:
        text = data.get("text", "").strip()
        if text:
            ts = time.time()
            msg_id = save_message(user_info["room"], user_info["username"], text, "user")
            avatar, google_pic = get_user_pic(user_info["username"])
            emit("message", {"id": msg_id, "user": user_info["username"], "text": text, "time": ts, "avatar": avatar, "google_pic": google_pic}, room=user_info["room"])

@socketio.on("delete_message")
def handle_delete_message(data):
    user_info = online_users.get(request.sid)
    if not user_info:
        return
    msg_id = data.get("id")
    username = user_info["username"]
    room = user_info["room"]
    conn = get_db()
    msg = conn.execute("SELECT username, room FROM messages WHERE id = ?", (msg_id,)).fetchone()
    if msg and msg["username"] == username:
        conn.execute("UPDATE messages SET text = '<deleted>', msg_type = 'deleted' WHERE id = ?", (msg_id,))
        conn.commit()
        emit("message_deleted", {"id": msg_id}, room=room)
    conn.close()

@socketio.on("share_audio")
def handle_share_audio(data):
    user_info = online_users.get(request.sid)
    if not user_info:
        return
    audio_data = data.get("audio", "").strip()
    if not audio_data or len(audio_data) > 1000000:
        return
    is_voice = data.get("voice", False)
    ts = time.time()
    msg_id = save_message(user_info["room"], user_info["username"], audio_data, "audio")
    avatar, google_pic = get_user_pic(user_info["username"])
    emit("message", {"id": msg_id, "user": user_info["username"], "text": audio_data, "time": ts, "avatar": avatar, "google_pic": google_pic, "msg_type": "audio", "voice": is_voice}, room=user_info["room"])

@socketio.on("share_image")
def handle_share_image(data):
    user_info = online_users.get(request.sid)
    if not user_info:
        return
    img_data = data.get("image", "").strip()
    if not img_data or len(img_data) > 500000:
        return
    ts = time.time()
    msg_id = save_message(user_info["room"], user_info["username"], img_data, "image")
    avatar, google_pic = get_user_pic(user_info["username"])
    emit("message", {"id": msg_id, "user": user_info["username"], "text": img_data, "time": ts, "avatar": avatar, "google_pic": google_pic, "msg_type": "image"}, room=user_info["room"])

@socketio.on("typing")
def handle_typing(data):
    user_info = online_users.get(request.sid)
    if user_info:
        room = user_info["room"]
        emit("typing", {"user": user_info["username"], "typing": data.get("typing", False)}, room=room)

def get_target_sid(target):
    for sid, info in online_users.items():
        if info["username"] == target:
            return sid
    return None

@socketio.on("call_user")
def handle_call_user(data):
    user_info = online_users.get(request.sid)
    if not user_info:
        return
    caller = user_info["username"]
    target = data.get("target", "")
    audio_only = data.get("audioOnly", False)
    target_sid = get_target_sid(target)
    if target_sid:
        emit("incoming_call", {"from": caller, "audioOnly": audio_only}, room=target_sid)
    else:
        emit("user_offline", {"target": target})

@socketio.on("call_accept")
def handle_call_accept(data):
    user_info = online_users.get(request.sid)
    if not user_info:
        return
    accepter = user_info["username"]
    target = data.get("target", "")
    target_sid = get_target_sid(target)
    if target_sid:
        emit("call_accepted", {"from": accepter}, room=target_sid)

@socketio.on("call_reject")
def handle_call_reject(data):
    user_info = online_users.get(request.sid)
    if not user_info:
        return
    rejecter = user_info["username"]
    target = data.get("target", "")
    target_sid = get_target_sid(target)
    if target_sid:
        emit("call_rejected", {"from": rejecter}, room=target_sid)

@socketio.on("call_offer")
def handle_call_offer(data):
    user_info = online_users.get(request.sid)
    if not user_info:
        return
    target_sid = get_target_sid(data.get("target", ""))
    if target_sid:
        emit("call_offer", {"from": user_info["username"], "sdp": data["sdp"]}, room=target_sid)

@socketio.on("call_answer")
def handle_call_answer(data):
    user_info = online_users.get(request.sid)
    if not user_info:
        return
    target_sid = get_target_sid(data.get("target", ""))
    if target_sid:
        emit("call_answer", {"from": user_info["username"], "sdp": data["sdp"]}, room=target_sid)

@socketio.on("call_ice_candidate")
def handle_call_ice(data):
    user_info = online_users.get(request.sid)
    if not user_info:
        return
    target_sid = get_target_sid(data.get("target", ""))
    if target_sid:
        emit("call_ice_candidate", {"from": user_info["username"], "candidate": data["candidate"]}, room=target_sid)

@socketio.on("call_end")
def handle_call_end(data):
    user_info = online_users.get(request.sid)
    if not user_info:
        return
    ender = user_info["username"]
    target = data.get("target", "")
    target_sid = get_target_sid(target)
    if target_sid:
        emit("call_ended", {"from": ender}, room=target_sid)

@socketio.on("get_profile")
def handle_get_profile(data):
    target = data.get("username", "")
    profile = get_profile(target)
    if not profile:
        return emit("profile_data", {"error": "User not found"})
    user_info = online_users.get(request.sid)
    curr_user = user_info["username"] if user_info else None
    followers, following = get_follow_counts(target)
    online = any(u["username"] == target for u in online_users.values())
    emit("profile_data", {
        "username": target,
        "bio": profile["bio"],
        "avatar": profile["avatar"],
        "google_pic": profile.get("google_pic", ""),
        "followers": followers,
        "following": following,
        "is_following": is_following(curr_user, target) if curr_user else False,
        "is_self": curr_user == target,
        "online": online,
    })

@socketio.on("update_profile")
def handle_update_profile(data):
    user_info = online_users.get(request.sid)
    if not user_info:
        return
    username = user_info["username"]
    conn = get_db()
    if "bio" in data:
        conn.execute("UPDATE users SET bio = ? WHERE username = ?", (data["bio"][:150], username))
    if "avatar" in data and data["avatar"] in DEFAULT_AVATARS:
        conn.execute("UPDATE users SET avatar = ? WHERE username = ?", (data["avatar"], username))
    conn.commit()
    row = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    conn.close()
    if row:
        emit("profile_updated", {"username": username, "bio": row["bio"], "avatar": row["avatar"]})

@socketio.on("upload_profile_pic")
def handle_upload_profile_pic(data):
    user_info = online_users.get(request.sid)
    if not user_info:
        return
    username = user_info["username"]
    img_data = data.get("image", "")
    if not img_data or not img_data.startswith("data:image/"):
        return
    conn = get_db()
    conn.execute("UPDATE users SET google_pic = ? WHERE username = ?", (img_data[:500000], username))
    conn.commit()
    conn.close()
    emit("profile_pic_updated", {"username": username, "google_pic": img_data}, broadcast=True)

@socketio.on("follow")
def handle_follow(data):
    user_info = online_users.get(request.sid)
    if not user_info:
        return
    curr = user_info["username"]
    target = data.get("username", "")
    if curr == target:
        return
    profile = get_profile(target)
    if not profile:
        return
    conn = get_db()
    try:
        conn.execute("INSERT INTO follows (follower, followed) VALUES (?, ?)", (curr, target))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        return
    conn.close()
    followers, following = get_follow_counts(target)
    room = user_info["room"]
    emit("profile_data", {
        "username": target,
        "avatar": profile["avatar"],
        "google_pic": profile.get("google_pic", ""),
        "followers": followers,
        "following": following,
        "is_following": True,
    })
    save_message(room, "System", f"{curr} started following {target}", "system")

@socketio.on("unfollow")
def handle_unfollow(data):
    user_info = online_users.get(request.sid)
    if not user_info:
        return
    curr = user_info["username"]
    target = data.get("username", "")
    profile = get_profile(target)
    if not profile:
        return
    conn = get_db()
    conn.execute("DELETE FROM follows WHERE follower = ? AND followed = ?", (curr, target))
    conn.commit()
    conn.close()
    followers, following = get_follow_counts(target)
    emit("profile_data", {
        "username": target,
        "avatar": profile["avatar"],
        "google_pic": profile.get("google_pic", ""),
        "followers": followers,
        "following": following,
        "is_following": False,
    })

@socketio.on("clear_chat")
def handle_clear_chat(data):
    user_info = online_users.get(request.sid)
    if not user_info:
        return
    room = user_info["room"]
    conn = get_db()
    conn.execute("DELETE FROM messages WHERE room = ?", (room,))
    conn.commit()
    conn.close()
    save_message(room, "System", f"{user_info['username']} cleared the chat", "system")
    emit("chat_cleared", {"room": room}, room=room)

@socketio.on("disconnect")
def handle_disconnect():
    user_info = online_users.pop(request.sid, None)
    if user_info:
        username = user_info["username"]
        user_sockets.pop(username, None)
        room = user_info["room"]
        if room in rooms and username in rooms[room]:
            rooms[room].remove(username)
            if not rooms[room]:
                del rooms[room]
        ts = time.time()
        save_message(room, "System", f"{username} left", "system")
        emit("users", {"users": rooms.get(room, [])}, room=room)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_ENV") == "development"
    socketio.run(app, host="0.0.0.0", port=port, debug=debug, allow_unsafe_werkzeug=debug)
