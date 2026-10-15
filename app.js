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

app.get('/privacy', (req, res) => {
  res.status(200).send(`
    <html><head><title>Privacy Policy - Nancy Bot</title></head><body>
    <h1>Privacy Policy - Nancy Bot</h1>
    <p>Last updated: 2026</p>
    <p>Nancy Bot only accesses Instagram/Facebook messages when you send a DM to the connected Page/Instagram account.</p>
    <p>We do not store messages permanently, we only auto-reply. No personal data is shared with third parties.</p>
    <p>Data: sender ID and message text for reply only.</p>
    <p>Contact: nawa.orchid - This bot is for personal testing.</p>
    </body></html>
  `);
});

app.get('/terms', (req, res) => {
  res.status(200).send(`
    <html><head><title>Terms - Nancy Bot</title></head><body>
    <h1>Terms of Service - Nancy Bot</h1>
    <p>Nancy Bot is an auto-reply bot for Instagram and Facebook Page. Use for legitimate customer service only.</p>
    </body></html>
  `);
});

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

    if (body.object === 'instagram') {
      for (const entry of body.entry || []) {
        for (const msg of entry.messaging || []) {
          const senderId = msg.sender?.id;
          const text = msg.message?.text;
          console.log('IG MSG [messaging] from', senderId, ':', text);
          if (senderId && text && PAGE_ACCESS_TOKEN) {
            await sendReply(senderId, `Hai IG! Nancy Bot dapet: "${text}" 🤖`, PAGE_ACCESS_TOKEN);
          }
        }
        for (const change of entry.changes || []) {
          if (change.field === 'messages') {
            const val = change.value || {};
            const senderId = val.sender?.id || val.from?.id;
            const text = val.message?.text || val.text;
            console.log('IG MSG [changes.messages] from', senderId, ':', text);
            if (senderId && text && PAGE_ACCESS_TOKEN && senderId !== '12334' && senderId !== '0') {
              await sendReply(senderId, `Hai IG! Nancy Bot dapet: "${text}" 🤖`, PAGE_ACCESS_TOKEN);
            }
          }
        }
      }
    }

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
