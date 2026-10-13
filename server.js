const express = require('express');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const app = express();
const PORT = process.env.PORT || 3000;

// تابع استعلام اطلاعات کانال و چت‌روم از Kick
async function getKickChannelData(username) {
    try {
        const res = await fetch(`https://kick.com/api/v1/channels/${encodeURIComponent(username)}`, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "application/json"
            }
        });
        if (!res.ok) return { chatroomId: null, viewers: 0, is_live: false, category: "آفلاین" };
        const json = await res.json();
        return {
            chatroomId: json.chatroom?.id || null,
            channelId: json.id || json.chatroom?.id || null,
            viewers: json.livestream?.viewer_count || 0,
            is_live: json.is_live || false,
            category: json.livestream?.categories?.[0]?.name || "نامشخص"
        };
    } catch (e) {
        return { chatroomId: null, viewers: 0, is_live: false, category: "خطا" };
    }
}

// مسیر API برای دریافت تعداد بیننده
app.get('/api/viewers', async (req, res) => {
    const user = req.query.user;
    if (!user) return res.json({ viewers: 0, is_live: false });
    const data = await getKickChannelData(user);
    res.json(data);
});

// صفحه اصلی ورود
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>ورود به چت کیک</title>
        <style>
            body{background:#07090c;color:#fff;font-family:Tahoma;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;}
            .box{background:#12161c;padding:30px;border-radius:15px;border:1px solid #53fc18;text-align:center;width:350px;}
            input{width:100%;padding:12px;margin:15px 0;background:#05070a;border:1px solid #242c38;color:#fff;border-radius:8px;text-align:center;box-sizing:border-box;outline:none;}
            button{width:100%;padding:12px;background:#53fc18;border:none;color:#000;font-weight:bold;border-radius:8px;cursor:pointer;}
        </style>
    </head>
    <body>
        <div class="box">
            <h2>ورود به چت استریم</h2>
            <form onsubmit="event.preventDefault(); let u=document.getElementById('u').value.trim(); if(u) window.location.href='/'+u;">
                <input type="text" id="u" placeholder="نام کاربری (مثلاً ImErfi)" required autofocus>
                <button type="submit">اتصال به چت</button>
            </form>
        </div>
    </body>
    </html>`);
});

// صفحه چت اختصاصی برای هر استریمر
app.get('/:username', async (req, res) => {
    const username = req.params.username;
    const channelData = await getKickChannelData(username);

    res.send(`<!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>چت ${username}</title>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pusher/8.3.0/pusher.min.js"></script>
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { background: #090c10; color: #e6edf3; font-family: Tahoma; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
            header { background: #12161c; padding: 10px 16px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center; }
            .channel-name { font-weight: bold; color: #fff; }
            #chat-box { flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 8px; }
            .message { background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 8px; font-size: 0.95rem; line-height: 1.5; }
            .username { font-weight: bold; color: #53fc18; margin-left: 6px; }
        </style>
    </head>
    <body>
        <header>
            <span class="channel-name">${username}</span>
            <span id="viewer-status" style="font-size: 0.85rem; color: #ef4444;">${channelData.is_live ? channelData.viewers + ' بیننده' : 'آفلاین'}</span>
        </header>
        <div id="chat-box">
            <div class="message"><b>سیستم:</b> در حال اتصال به وب‌سوکت چت...</div>
        </div>

        <script>
            const chatroomId = ${channelData.chatroomId ? JSON.stringify(channelData.chatroomId) : "null"};
            const chatBox = document.getElementById('chat-box');

            if (!chatroomId) {
                chatBox.innerHTML = '<div class="message" style="color:#ef4444;">کانال پیدا نشد یا آفلاین است.</div>';
            } else {
                const pusher = new Pusher('32cbd69e4b950bf97679', { cluster: 'us2', forceTLS: true });
                const channel = pusher.subscribe('chatrooms.' + chatroomId + '.v2');

                channel.bind('App\\\\Events\\\\ChatMessageEvent', (data) => {
                    let d = typeof data === 'string' ? JSON.parse(data) : data;
                    let sender = d.sender?.username || 'کاربر';
                    let content = d.content || '';
                    
                    let div = document.createElement('div');
                    div.className = 'message';
                    div.innerHTML = '<span class="username">' + sender + ':</span> ' + content;
                    chatBox.appendChild(div);
                    chatBox.scrollTop = chatBox.scrollHeight;
                });
            }

            // بروزرسانی وضعیت بینندگان هر ۳۰ ثانیه
            setInterval(async () => {
                try {
                    let res = await fetch('/api/viewers?user=${username}');
                    let json = await res.json();
                    document.getElementById('viewer-status').innerText = json.is_live ? json.viewers + ' بیننده' : 'آفلاین';
                } catch(e) {}
            }, 30000);
        </script>
    </body>
    </html>`);
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
