const fs = require('fs');
const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const app = express();
const { Server } = require('socket.io');

// Objeto para armazenar sessões
const allsessionObject = {};

// Middleware para processar JSON e URL-encoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Porta do servidor
const port = 6001;

// Cria o servidor HTTPS com os certificados SSL
const server = require('https').createServer({
    key: fs.readFileSync('/etc/letsencrypt/live/agendai.tncsistemas.com/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/agendai.tncsistemas.com/fullchain.pem'),
}, app);

// Configura o Socket.IO
const io = new Server(server, {
    cors: {
        origin: "*", // Permitir todas as origens (ajuste conforme necessário)
        methods: ["GET", "POST"],
    },
});

// Inicia o servidor na porta 6001
server.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});

// Rota principal para teste
app.get("/", (req, res) => {
    res.send("Servidor está funcionando!");
});

// Endpoint para receber dados do Laravel
app.post('/receive-data', (req, res) => {
    console.log("Requisição recebida com os dados:", req.body);

    const message = req.body.message;
    const numero = req.body.number;
    const id = req.body.user_id;

    if (!message || !numero || !id) {
        return res.status(400).json({ error: 'Campos obrigatórios ausentes' });
    }

    getNumbers(numero, message, id);

    res.status(200).json({ message: 'Dados recebidos com sucesso!' });
});

// Função para processar números no JSON
function getNumbers(numero, mensagem, user_id) {
    if (allsessionObject[user_id]) {
        console.log("Sessão encontrada. Usando sessão existente.");
        sendMessages(allsessionObject[user_id], numero, mensagem);
    } else {
        console.log("Nenhuma sessão encontrada. Criando nova sessão.");
        whatsappLogado(user_id, mensagem, numero);
    }
}

// Função para criar uma nova sessão e enviar mensagens
const whatsappLogado = async (id, message, numero) => {
    const client = new Client({
        puppeteer: {
            executablePath: '/usr/bin/chromium-browser', // ajuste de acordo com seu sistema
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--remote-debugging-port=9222',
            ],
        },
        authStrategy: new LocalAuth({ clientId: id }),
    });

    client.on("authenticated", () => {
        console.log(`Sessão autenticada para o ID: ${id}`);
    });

    client.on('ready', () => {
        console.log(`Sessão pronta para o ID: ${id}`);
        allsessionObject[id] = client; // Armazena a sessão criada
        sendMessages(client, numero, message); // Dispara as mensagens
    });

    // Lógica de tentativa para inicializar o cliente
    const initializeClient = async (retries = 5) => {
        try {
            await client.initialize();
        } catch (error) {
            console.error(`Erro ao inicializar o cliente para o ID ${id}:`, error);
            if (retries > 0) {
                console.log(`Tentando novamente... (Restante: ${retries})`);
                await new Promise(res => setTimeout(res, 2000)); // Espera 2 segundos
                await initializeClient(retries - 1);
            }
        }
    };

    await initializeClient();
};

// Função para enviar mensagens
const sendMessages = async (client, numero, message) => {
    try {
        const res = await client.sendMessage(`${numero}@c.us`, message);
        console.log(`Mensagem enviada para ${numero}:`, res);
    } catch (error) {
        console.error(`Erro ao enviar mensagem para ${numero}:`, error);
    }
};

// Configuração do WebSocket
io.on("connection", (socket) => {
    console.log("Nova conexão:", socket.id);

    socket.on("disconnect", () => {
        console.log("Cliente desconectado:", socket.id);
    });

    socket.on("connected", (data) => {
        console.log("Cliente conectado ao servidor:", data);
        socket.emit('hello server');
    });

    // Criação de sessão pelo WebSocket
   socket.on("createSession", async (data) => {
    console.log("🔹 Criando sessão para:", data);
    const { id } = data;

    if (allsessionObject[id]) {
        console.log(`⚠️ Sessão já existente para o ID: ${id}`);
        socket.emit("ready", { id, message: "Sessão já autenticada." });
        return;
    }

    // Criar uma nova sessão no WhatsApp
    const client = new Client({
        puppeteer: {
            executablePath: '/usr/bin/chromium-browser', // Ajuste para seu sistema
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--disable-extensions',
                '--disable-background-networking',
                '--disable-sync',
                '--remote-debugging-port=9222',
            ],
        },
        authStrategy: new LocalAuth({ clientId: id }),
    });

    // 🔹 Evento de QR Code - Enviar QR Code ao cliente via WebSocket
    client.on("qr", (qr) => {
        console.log(`📌 QR Code gerado para o ID ${id}`);
        socket.emit("qr", { id, qr });
    });

    // 🔹 Evento de autenticação
    client.on("authenticated", () => {
        console.log(`✅ Sessão autenticada para o ID: ${id}`);
    });

    // 🔹 Evento quando a sessão estiver pronta
    client.on("ready", () => {
        console.log(`🎯 Sessão pronta para o ID: ${id}`);
        allsessionObject[id] = client; // Armazena a sessão ativa
        socket.emit("ready", { id, message: "Cliente está pronto!" });
    });

    // 🔹 Evento para capturar erros
    client.on("disconnected", (reason) => {
        console.log(`❌ Sessão desconectada para o ID: ${id}. Motivo:`, reason);
        delete allsessionObject[id];
        socket.emit("disconnected", { id, message: "Cliente desconectado!" });
    });

    // 🔹 Inicialização com tentativas de reconexão
    const initializeClient = async (retries = 5) => {
        try {
            console.log(`🚀 Inicializando o cliente para o ID: ${id}`);
            await client.initialize();
        } catch (error) {
            console.error(`⚠️ Erro ao inicializar o cliente para o ID ${id}:`, error);
            if (retries > 0) {
                console.log(`🔄 Tentando novamente... (Restante: ${retries})`);
                await new Promise(res => setTimeout(res, 2000)); // Espera 2 segundos
                await initializeClient(retries - 1);
            } else {
                console.log(`❌ Falha ao iniciar a sessão para o ID ${id} após múltiplas tentativas.`);
                socket.emit("error", { id, message: "Falha ao iniciar o cliente." });
            }
        }
    };

    await initializeClient();
});

});
