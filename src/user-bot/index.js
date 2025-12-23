import { RabbitMQUpdatesClient } from './rabbitmq.js';
import { config } from './config.js';
import { Chat3UserBotClient } from './chat3Client.js';
import { UpdateHandlers } from './updateHandlers.js';
import { DialogMetaManager } from './dialogMetaManager.js';
import { AIClassifier } from './aiClassifier.js';
import { DialogStateManager } from './dialogStateManager.js';
import { MessageHandler } from './messageHandler.js';

const bot = new RabbitMQUpdatesClient();
const chat3Client = new Chat3UserBotClient();
const metaManager = new DialogMetaManager();
const aiClassifier = new AIClassifier();
const stateManager = new DialogStateManager();
const messageHandler = new MessageHandler();

// Обработка сигналов завершения
const shutdown = async (signal) => {
  console.log(`Получен сигнал ${signal}, завершение работы...`);
  try {
    await bot.close();
    console.log('Бот успешно остановлен');
    process.exit(0);
  } catch (error) {
    console.error('Ошибка при остановке бота:', error);
    process.exit(1);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Обработка необработанных ошибок
process.on('unhandledRejection', (reason, promise) => {
  console.error('Необработанное отклонение промиса:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Необработанное исключение:', error);
  shutdown('uncaughtException');
});

// Основная функция запуска бота
async function start() {
  try {
    const { userId, name } = config.bot;
    console.log(`Запуск user-bot ${name} (userId: ${userId})...`);

    // Инициализируем Chat3 API клиент
    if (config.chat3.apiUrl && config.chat3.apiKey && config.chat3.tenantId) {
      chat3Client.init(config.chat3.apiUrl, config.chat3.apiKey, config.chat3.tenantId);
      UpdateHandlers.setChat3Client(chat3Client);

      // Создаем или получаем пользователя-бота
      const userResult = await chat3Client.ensureUser(userId, name, 'bot');
      if (!userResult.success) {
        console.error('Не удалось создать/получить пользователя-бота:', userResult.error);
        process.exit(1);
      }
      
      if (userResult.created) {
        console.log(`Пользователь-бот ${userId} создан в системе`);
      } else {
        console.log(`Пользователь-бот ${userId} уже существует в системе`);
      }

      // Инициализируем DialogMetaManager
      metaManager.setChat3Client(chat3Client);
      console.log('DialogMetaManager инициализирован');

      // Инициализируем AIClassifier
      if (config.gigachat.clientId && config.gigachat.clientSecret) {
        aiClassifier.init(config.gigachat.clientId, config.gigachat.clientSecret, {
          model: config.gigachat.model,
          temperature: config.gigachat.temperature,
          maxTokens: config.gigachat.maxTokens,
          topP: config.gigachat.topP,
        });
        console.log('AIClassifier инициализирован');
      } else {
        console.warn('GigaChat Client ID или Client Secret не настроены, AI классификация будет недоступна');
      }

      // Инициализируем DialogStateManager
      stateManager.setChat3Client(chat3Client);
      stateManager.setMetaManager(metaManager);
      console.log('DialogStateManager инициализирован');

      // Инициализируем MessageHandler
      messageHandler.init(chat3Client, metaManager, aiClassifier, stateManager);
      UpdateHandlers.setMessageHandler(messageHandler);
      console.log('MessageHandler инициализирован');
    } else {
      console.warn('Chat3 API URL, API Key или Tenant ID не настроены');
      process.exit(1);
    }

    // Подключаемся к RabbitMQ
    await bot.connect();

    // Настраиваем очередь и подписываемся на updates
    await bot.setupQueue();

    console.log('User-bot успешно запущен и готов к работе');
    console.log(`Ожидание updates из очереди: bot_${userId}_updates`);

    // Периодическая проверка соединения
    setInterval(() => {
      if (!bot.isReady()) {
        console.warn('Соединение с RabbitMQ потеряно, попытка переподключения...');
        bot.connect()
          .then(() => bot.setupQueue())
          .catch((error) => console.error('Ошибка переподключения:', error));
      }
    }, 30000); // Проверка каждые 30 секунд

  } catch (error) {
    console.error('Критическая ошибка при запуске бота:', error);
    process.exit(1);
  }
}

// Запуск бота
start();

