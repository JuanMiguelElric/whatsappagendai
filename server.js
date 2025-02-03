const fs = require('fs');
const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const { Server } = require('socket.io');
const app = express();

// Armazena sessões ativas
const allsessionObject = {};

// Middleware para processar JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuração do servidor HTTPS com SSL
const server = require('https').createServer({
    key: fs.readFileSync('/etc/letsencrypt/live/agendai.tncsistemas.com/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/agendai.tncsistemas.com/fullchain.pem'),
}, app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

// Porta do servidor
const port = 6001;
server.listen(port, () => {
    console.log(`🚀 Servidor rodando na porta ${port}`);
});

// Rota principal para teste
app.get("/", (req, res) => res.send("🔥 Servidor está funcionando!"));

// Endpoint para receber dados do Laravel
app.post('/receive-data', (req, res) => {
    console.log("📩 Requisição recebida:", req.body);
    const { message, number, user_id } = req.body;

    if (!message || !number || !user_id) {
        return res.status(400).json({ error: '⚠️ Campos obrigatórios ausentes' });
    }

    getNumbers(number, message, user_id);
    res.status(200).json({ message: '✅ Dados recebidos com sucesso!' });
});

// Gerencia múltiplas sessões do WhatsApp
function getNumbers(numero, mensagem, user_id) {
    if (allsessionObject[user_id]) {
        console.log(`✔️ Sessão já ativa para o ID ${user_id}`);
        sendMessages(allsessionObject[user_id], numero, mensagem);
    } else {
        console.log(`➕ Criando nova sessão para ID ${user_id}`);
        iniciarSessao(user_id, mensagem, numero);
    }
}

// Função para inicializar sessões do WhatsApp
const iniciarSessao = async (id, message, numero) => {
    console.log(`🚀 Iniciando cliente para ID: ${id}`);
const client = new Client({
  
    puppeteer: {
          executablePath: '/usr/bin/google-chrome-stable', // Confirme o caminho correto com "which chromium-browser"
        headless: true,
        userDataDir: `/var/tmp/chromium_profiles/${id}`, // 🔹 Cada sessão terá seu próprio diretório!
        args: [
`--user-data-dir=/var/tmp/chromium_profiles/${id}`,
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--disable-extensions',
            '--disable-background-networking',
            '--disable-breakpad',
            '--disable-crash-reporter',
            '--disable-sync',
            '--disable-translate',
            '--force-color-profile=srgb',
            '--enable-automation',
            '--no-first-run',
            '--disable-default-apps',
            '--disable-infobars',
            '--disable-features=TranslateUI',
            '--disable-component-update',
            '--no-zygote',
            '--single-process',
            `--remote-debugging-port=${Math.floor(Math.random() * (50000 - 30000 + 1)) + 30000}` // 🔹 Porta aleatória para evitar conflitos!
        ],
    },
});



    client.on("qr", (qr) => {
        console.log(`📌 QR Code gerado para o ID ${id}`);
        io.emit("qr", { id, qr });
    });

    client.on("authenticated", () => {
        console.log(`✅ Sessão autenticada para ID: ${id}`);
    });

    client.on("ready", () => {
        console.log(`🎯 Sessão pronta para ID: ${id}`);
        allsessionObject[id] = client;
        io.emit("ready", { id, message: "Cliente está pronto!" });
        sendMessages(client, numero, message);
    });

    client.on("disconnected", (reason) => {
        console.log(`❌ Sessão do ID ${id} foi desconectada. Motivo: ${reason}`);
        delete allsessionObject[id];
        io.emit("disconnected", { id, message: "Cliente desconectado!" });
    });

    try {
        await client.initialize();
        console.log("✅ Cliente inicializado com sucesso!");
    } catch (error) {
        console.error(`⚠️ Erro ao inicializar cliente para o ID ${id}:`, error);
    }
};

// Função para enviar mensagens
const sendMessages = async (client, numero, message) => {
    try {
        await client.sendMessage(`${numero}@c.us`, message);
        console.log(`✅ Mensagem enviada para ${numero}`);
    } catch (error) {
        console.error(`⚠️ Erro ao enviar mensagem para ${numero}:`, error);
    }
};

// Configuração do WebSocket para múltiplas sessões
io.on("connection", (socket) => {
    console.log(`🔌 Nova conexão: ${socket.id}`);

    socket.on("disconnect", () => {
        console.log(`🔌 Cliente desconectado: ${socket.id}`);
    });

    socket.on("createSession", async (data) => {
        const { id } = data;

        if (allsessionObject[id]) {
            console.log(`⚠️ Sessão já existente para o ID: ${id}`);
            socket.emit("ready", { id, message: "Sessão já autenticada." });
            return;
        }

        console.log(`🛠 Criando nova sessão para ID: ${id}`);
const client = new Client({
  
    puppeteer: {
     executablePath: '/usr/bin/google-chrome-stable', // Confirme o caminho correto com "which chromium-browser"
        headless: true,
        userDataDir: `/var/tmp/chromium_profiles/${id}`, // 🔹 Cada sessão terá seu próprio diretório!
        args: [
		`--user-data-dir=/var/tmp/chromium_profiles/${id}`,
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--disable-extensions',
            '--disable-background-networking',
            '--disable-breakpad',
            '--disable-crash-reporter',
            '--disable-sync',
            '--disable-translate',
            '--force-color-profile=srgb',
            '--enable-automation',
            '--no-first-run',
            '--disable-default-apps',
            '--disable-infobars',
            '--disable-features=TranslateUI',
            '--disable-component-update',
            '--no-zygote',
            '--single-process',
            `--remote-debugging-port=${Math.floor(Math.random() * (50000 - 30000 + 1)) + 30000}` // 🔹 Porta aleatória para evitar conflitos!
        ],
    },
});




        client.on("qr", (qr) => {
            console.log(`📌 QR Code gerado para o ID ${id}`);
            socket.emit("qr", { id, qr });
        });

        client.on("authenticated", () => {
            console.log(`✅ Sessão autenticada para o ID: ${id}`);
        });

        client.on("ready", () => {
            console.log(`🎯 Sessão pronta para o ID: ${id}`);
            allsessionObject[id] = client;
            socket.emit("ready", { id, message: "Cliente está pronto!" });
        });

        client.on("disconnected", (reason) => {
            console.log(`❌ Sessão desconectada para o ID ${id}. Motivo: ${reason}`);
            delete allsessionObject[id];
            socket.emit("disconnected", { id, message: "Cliente desconectado!" });
        });

        try {
            await client.initialize();
            console.log("✅ Cliente inicializado com sucesso!");
        } catch (error) {
            console.error(`⚠️ Erro ao inicializar cliente para o ID ${id}:`, error);
        }
    });
});
