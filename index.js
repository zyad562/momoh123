const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const express = require('express');

const app = express();
const port = process.env.PORT || 8000;
let lastQR = null; // لتخزين الرمز وإظهاره في المتصفح

// سيرفر الويب المطور
app.get('/', (req, res) => {
    if (lastQR) {
        // إذا لم يظهر في التيرمنال، سيظهر لك هنا عند فتح الرابط
        res.send(`
            <html>
                <body style="text-align:center; background:#f0f0f0; font-family:sans-serif;">
                    <h2>سيرفر ماجه - امسح الرمز للربط</h2>
                    <p>إذا لم يظهر الرمز في Koyeb، امسحه من هنا:</p>
                    <img src="https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(lastQR)}&size=300x300" />
                    <br><br>
                    <p>الحالة: البوت ينتظر المسح...</p>
                </body>
            </html>
        `);
    } else {
        res.send('البوت يعمل بنجاح! الحالة: متصل أو يتم توليد الرمز...');
    }
});

app.listen(port, () => console.log(`Server is running on port ${port}`));

const prayers = [
    "اللهم إنك عفو كريم تحب العفو فاعفُ عنا.",
    "ربنا آتنا في الدنيا حسنة وفي الآخرة حسنة وقنا عذاب النار.",
    "اللهم اشرح لي صدري ويسر لي أمري.",
    "اللهم إني أسألك علماً نافعاً ورزقاً طيباً وعملاً متقبلاً.",
    "يا حي يا قيوم برحمتك أستغيث، أصلح لي شأني كله ولا تكلني إلى نفسي طرفة عين."
];

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }),
        browser: ['Majeh System', 'Chrome', '1.0.0'] // تعريف البوت للسيرفر
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            lastQR = qr; // حفظ الرمز لإظهاره في المتصفح
            console.log('--- امسح الرمز أدناه للربط ---');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            lastQR = null;
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            lastQR = null; // حذف الرمز بعد النجاح
            console.log('--- البوت متصل وشغال بنجاح! ---');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const remoteJid = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        if (text.trim() === '!دعاء') {
            const randomPrayer = prayers[Math.floor(Math.random() * prayers.length)];
            await sock.sendMessage(remoteJid, { text: `🌙 *دعاء:* \n\n${randomPrayer}` });
        }
    });
}

startBot();