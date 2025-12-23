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
  },
  chat3: {
    // API URL: базовый URL сервера (библиотека chat3-client может добавлять /api автоматически)
    // Если библиотека не добавляет /api, укажите полный URL с /api в переменной окружения
    apiUrl: process.env.CHAT3_API_URL || 'http://localhost:3000/api',
    apiKey: process.env.CHAT3_API_KEY || '',
    tenantId: process.env.CHAT3_TENANT_ID || 'tnt_default',
  },
};

