const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const express = require('express');

// سيرفر الويب لمنع توقف الاستضافة (Keep Alive)
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is Alive!'));
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
        printQRInTerminal: true, // سيظهر الـ QR في Console الخاص بـ Koyeb
        logger: pino({ level: 'silent' })
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log('--- امسح الرمز أدناه للربط ---');
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
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
