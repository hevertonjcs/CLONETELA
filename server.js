const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve arquivos estáticos da pasta "site"
app.use(express.static(path.join(__dirname, 'site')));

// Redireciona / para o index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'site', 'index.html'));
});

// Inicia o servidor na porta do Railway ou 3000 localmente
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
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

// ===================== ADMIN USERS =====================
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

// ===================== CHECKOUT (salvar dados) =====================
app.post("/checkout", (req, res) => {
  const { nome, email, valor } = req.body;

  // Data formatada legível
  const dataAtual = new Date();
  const dataFormatada = dataAtual.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const linha = `${dataFormatada} - Nome: ${nome} | Email: ${email} | Valor: ${valor}\n`;

  fs.appendFile(path.join(__dirname, "checkout.txt"), linha, (err) => {
    if (err) {
      return res.status(500).send("Erro ao salvar checkout");
    }
    res.send("Checkout registrado com sucesso ✅");
  });
});

// ===================== ADMIN CHECKOUTS =====================
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
