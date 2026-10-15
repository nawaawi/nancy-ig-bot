const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'nancy_bot_verify_2026';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const PAGE_ACCESS_TOKEN_FB = process.env.PAGE_ACCESS_TOKEN_FB || process.env.PAGE_ACCESS_TOKEN;

let lastEvents = [];
let lastErrors = [];

app.get('/', (req, res) => {
  res.status(200).send('Nancy Bot is running! IG + FB ready! Webhook at /webhook - by Nawa');
});

// DEBUG ENDPOINT - buat cek token kepasang gak
app.get('/debug', (req, res) => {
  res.json({
    status: 'Nancy Bot Debug',
    verify_token_set: !!VERIFY_TOKEN,
    verify_token_value: VERIFY_TOKEN ? VERIFY_TOKEN.substring(0,6)+'...' : 'NOT SET',
    page_token_set: !!PAGE_ACCESS_TOKEN,
    page_token_preview: PAGE_ACCESS_TOKEN ? PAGE_ACCESS_TOKEN.substring(0,10)+'...' : 'NOT SET - INI PENYEBAB GAK BALES!',
    fb_token_set: !!PAGE_ACCESS_TOKEN_FB,
    last_events_count: lastEvents.length,
    last_events: lastEvents.slice(-3),
    last_errors: lastErrors.slice(-3),
    time: new Date().toISOString()
  });
});

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED:', req.query['hub.object'] || 'instagram/page');
      res.status(200).send(challenge);
    } else {
      console.log('VERIFY FAILED: token salah, expected', VERIFY_TOKEN, 'got', token);
      res.sendStatus(403);
    }
  } else {
    res.status(200).send('Webhook ready IG+FB - by Nawa');
  }
});

async function sendReply(senderId, text, token) {
  try {
    if (!token) {
      const err = 'TOKEN KOSONG! Set PAGE_ACCESS_TOKEN di Vercel!';
      console.error(err);
      lastErrors.push({time: new Date().toISOString(), error: err});
      return;
    }
    const r = await axios.post(
      `https://graph.facebook.com/v19.0/me/messages?access_token=${token}`,
      {
        recipient: { id: senderId },
        message: { text: text }
      }
    );
    console.log(`Sent to ${senderId}: ${text} - ID:`, r.data.message_id);
  } catch (e) {
    const errData = e.response?.data || e.message;
    console.error('Reply error:', JSON.stringify(errData));
    lastErrors.push({time: new Date().toISOString(), error: errData, senderId});
  }
}

app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    console.log('EVENT:', body.object, JSON.stringify(body).substring(0,1000));
    lastEvents.push({time: new Date().toISOString(), object: body.object, body: JSON.stringify(body).substring(0,500)});
    if (lastEvents.length > 20) lastEvents.shift();

    // === INSTAGRAM ===
    if (body.object === 'instagram') {
      for (const entry of body.entry || []) {
        for (const msg of entry.messaging || []) {
          const senderId = msg.sender?.id;
          const text = msg.message?.text;
          console.log('IG MSG from', senderId, ':', text);
          if (senderId && text && PAGE_ACCESS_TOKEN) {
            await sendReply(senderId, `Hai IG! Nancy Bot dapet: "${text}" 🤖`, PAGE_ACCESS_TOKEN);
          } else {
            console.log('IG skip - sender:', senderId, 'text:', text, 'token ada:', !!PAGE_ACCESS_TOKEN);
          }
        }
      }
    }

    // === FACEBOOK PAGE / MESSENGER ===
    if (body.object === 'page') {
      for (const entry of body.entry || []) {
        for (const msg of entry.messaging || []) {
          const senderId = msg.sender?.id;
          const text = msg.message?.text;
          if (senderId && text && msg.message?.is_echo !== true) {
            const tokenToUse = PAGE_ACCESS_TOKEN_FB || PAGE_ACCESS_TOKEN;
            console.log('FB MSG from', senderId, ':', text);
            await sendReply(senderId, `Hai FB! Nancy Bot dapet: "${text}" 💙`, tokenToUse);
          }
        }
      }
    }
    
    res.status(200).send('EVENT_RECEIVED');
  } catch (err) {
    console.error('Webhook error:', err);
    lastErrors.push({time: new Date().toISOString(), error: err.message});
    res.sendStatus(200);
  }
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Bot IG+FB running on port ${PORT}`));
}

module.exports = app;
