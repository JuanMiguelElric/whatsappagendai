const { Client, LocalAuth } = require('whatsapp-web.js');  
const express = require('express');  
const app = express();  
const port = 6001;  
const http = require('http');  
const server = http.createServer(app);  
const { Server } = require('socket.io');  

// Armazena todas as sessões do WhatsApp  
const allsessionObject = {};  

// Middlewares para análise de requisições  
app.use(express.json());  
app.use(express.urlencoded({ extended: true }));  

const io = new Server(server, {  
    cors: {  
        origin: "*",  
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
    console.log("Requisição recebida com os dados:", req.body);  // Log para ver os dados recebidos

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
        whatsappLogado(user_id, mensagem, numero); // Corrigido  
    }  
}  

// Função para criar uma nova sessão e enviar mensagens  
const whatsappLogado = (id, message, numero) => {  
    const client = new Client({  
        puppeteer: {  
            executablePath: '/usr/bin/chromium-browser', // ajuste de acordo com seu sistema  
            headless: true,  // certifique-se de que isso esteja definido como verdadeiro  
            args: [  
                '--no-sandbox',   
                '--disable-setuid-sandbox',  
                '--disable-gpu', // desabilita a GPU  
                '--disable-dev-shm-usage', // uso de memória compartilhada  
                '--remote-debugging-port=9222', // porta para depuração remota  
                // '--window-size=1920,1080', // opcional, ajuste do tamanho da janela  
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

    client.initialize();  
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

    socket.on("createSession", (data) => {  
        console.log("Criando sessão para:", data);  
        const { id } = data;  

        if (!allsessionObject[id]) {  
            const client = new Client({  
                puppeteer: {  
                    executablePath: '/usr/bin/chromium-browser', // ajuste de acordo com seu sistema  
                    headless: true,  // certifique-se de que isso esteja definido como verdadeiro  
                    args: [  
                        '--no-sandbox',   
                        '--disable-setuid-sandbox',  
                        '--disable-gpu', // desabilita a GPU  
                        '--disable-dev-shm-usage', // uso de memória compartilhada  
                        '--remote-debugging-port=9222', // porta para depuração remota  
                        // '--window-size=1920,1080', // opcional, ajuste do tamanho da janela  
                    ],  
                },  
                authStrategy: new LocalAuth({ clientId: id }),  
            });  

            client.on("qr", (qr) => {  
                console.log(`QR Code para o ID ${id}:`, qr);  
                socket.emit("qr", { qr });  
            });  

            client.on("authenticated", () => {  
                console.log(`Sessão autenticada para o ID: ${id}`);  
            });  

            client.on("ready", () => {  
                console.log(`Sessão pronta para o ID: ${id}`);  
                allsessionObject[id] = client; // Armazena a sessão criada  
                socket.emit('ready', { id, message: 'Cliente está pronto!' });  
            });  

            client.initialize();  
        } else {  
            console.log(`Sessão já existente para o ID: ${id}`);  
        }  
    });  
});