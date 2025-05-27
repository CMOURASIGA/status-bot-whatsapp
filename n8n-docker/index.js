const express = require('express');
const axios = require('axios');
const qrcode = require('qrcode-terminal');

const baileys = require('@whiskeysockets/baileys');
const makeWASocket = baileys.default;
const { useMultiFileAuthState } = baileys;

const app = express();
app.use(express.json());

let sock;

async function startBot() {
const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
});

sock.ev.on('creds.update', saveCreds);

sock.ev.on('connection.update', ({ connection, qr, lastDisconnect }) => {
    if (qr) qrcode.generate(qr, { small: true });

    if (connection === 'open') {
    console.log('✅ Conectado ao WhatsApp');
    } else if (connection === 'close') {
    console.log('❌ Conexão encerrada. Tentando reconectar...');
      startBot(); // reconectar
    }
});
}

app.post('/send', async (req, res) => {
const { number, message, imageUrl, pdfUrl, audioUrl, location, buttons } = req.body;

if (!sock) {
    return res.status(500).json({ error: 'WhatsApp não conectado' });
}

if (!number) {
    return res.status(400).json({ error: 'Número é obrigatório' });
}

const jid = number.replace(/\D/g, '') + '@s.whatsapp.net';

try {
    if (message) {
    await sock.sendMessage(jid, { text: message });
    }

    if (imageUrl) {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    await sock.sendMessage(jid, {
        image: Buffer.from(response.data),
        caption: '📷 Imagem enviada via bot'
    });
    }

    if (pdfUrl) {
    const response = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
    await sock.sendMessage(jid, {
        document: Buffer.from(response.data),
        mimetype: 'application/pdf',
        fileName: 'relatorio.pdf'
    });
    }

    if (audioUrl) {
    const response = await axios.get(audioUrl, { responseType: 'arraybuffer' });
    await sock.sendMessage(jid, {
        audio: Buffer.from(response.data),
        mimetype: 'audio/mp4',
        ptt: true
    });
    }

    if (location && location.latitude && location.longitude) {
    await sock.sendMessage(jid, {
        location: {
        degreesLatitude: location.latitude,
        degreesLongitude: location.longitude
        }
    });
    }

    if (buttons && Array.isArray(buttons)) {
    await sock.sendMessage(jid, {
        text: 'Escolha uma opção:',
        buttons: buttons.map((b, i) => ({
        buttonId: 'btn' + i,
        buttonText: { displayText: b },
        type: 1
        })),
        headerType: 1
    });
    }

    res.json({ success: true, to: number });
} catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao enviar mensagem', details: err.message });
}
});

app.listen(3000, '0.0.0.0', () => {
console.log('📡 API de WhatsApp rodando em http://localhost:3000');
startBot();
});
