import dotenv from 'dotenv';

dotenv.config();

export const config = {
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
    exchange: process.env.RABBITMQ_UPDATES_EXCHANGE || 'chat3_updates',
  },
  bot: {
    userId: process.env.BOT_USER_ID || 'bot_helper',
    name: process.env.BOT_NAME || 'Helper Bot',
    autoHandle: process.env.BOT_AUTO_HANDLE === 'true' || false,
    maxQuestions: parseInt(process.env.BOT_MAX_QUESTIONS || '5', 10),
  },
  chat3: {
    // API URL: базовый URL сервера (библиотека chat3-client может добавлять /api автоматически)
    // Если библиотека не добавляет /api, укажите полный URL с /api в переменной окружения
    apiUrl: process.env.CHAT3_API_URL || 'http://localhost:3000/api',
    apiKey: process.env.CHAT3_API_KEY || '',
    tenantId: process.env.CHAT3_TENANT_ID || 'tnt_default',
  },
  gigachat: {
    clientId: process.env.GIGACHAT_CLIENT_ID || '',
    clientSecret: process.env.GIGACHAT_CLIENT_SECRET || '',
    model: process.env.GIGACHAT_MODEL || 'GigaChat-2',
    // Низкая температура для более точной и детерминированной классификации
    temperature: parseFloat(process.env.GIGACHAT_TEMPERATURE || '0.1'),
    // Достаточно токенов для JSON ответа с данными
    maxTokens: parseInt(process.env.GIGACHAT_MAX_TOKENS || '1500', 10),
    // Top-p для более структурированных ответов (0.1 = более детерминированный)
    topP: parseFloat(process.env.GIGACHAT_TOP_P || '0.1'),
  },
};

