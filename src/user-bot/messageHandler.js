import { DialogMetaManager } from './dialogMetaManager.js';
import { AIClassifier } from './aiClassifier.js';
import { DialogStateManager } from './dialogStateManager.js';
import { Chat3UserBotClient } from './chat3Client.js';
import { getAllIntents } from './intentConfig.js';
import { config } from './config.js';

/**
 * Основной обработчик входящих сообщений
 */
export class MessageHandler {
  constructor() {
    this.chat3Client = null;
    this.metaManager = null;
    this.aiClassifier = null;
    this.stateManager = null;
  }

  /**
   * Инициализация компонентов
   * @param {Chat3UserBotClient} chat3Client - Клиент Chat3 API
   * @param {DialogMetaManager} metaManager - Менеджер мета тегов
   * @param {AIClassifier} aiClassifier - Классификатор AI
   * @param {DialogStateManager} stateManager - Менеджер состояния
   */
  init(chat3Client, metaManager, aiClassifier, stateManager) {
    this.chat3Client = chat3Client;
    this.metaManager = metaManager;
    this.aiClassifier = aiClassifier;
    this.stateManager = stateManager;
  }

  /**
   * Обработка входящего сообщения
   * @param {Object} update - Update из RabbitMQ
   * @returns {Promise<Object>}
   */
  async handleIncomingMessage(update) {
    try {
      const { data } = update;
      
      if (!data || !data.message) {
        console.warn('Update не содержит данных сообщения');
        return { success: false, error: 'Отсутствуют данные сообщения' };
      }

      const message = data.message;
      const dialog = data.dialog;
      const eventType = update.eventType;

      // Проверяем, что сообщение не от самого бота (только для создания/обновления)
      if ((eventType === 'message.create' || eventType === 'message.update') 
          && message.senderId === config.bot.userId) {
        console.debug('Сообщение от самого бота, пропускаем');
        return { success: true, handled: false };
      }

      // Обрабатываем только новые сообщения
      if (eventType !== 'message.create') {
        console.debug(`Событие ${eventType} не требует обработки`);
        return { success: true, handled: false };
      }

      const dialogId = message.dialogId;
      const userMessage = message.content || '';

      console.log(`Обработка сообщения в диалоге ${dialogId}:`, {
        messageId: message.messageId,
        senderId: message.senderId,
        content: userMessage.substring(0, 100),
      });

      // Получаем мета теги диалога
      const category = await this.metaManager.getCategory(dialogId);
      const botHandling = await this.metaManager.isBotHandling(dialogId);

      // Если категория есть, используем существующую
      if (category) {
        console.log(`Диалог ${dialogId} уже имеет категорию: ${category}`);
        // Можно добавить логику обработки сообщений в уже классифицированном диалоге
        return { success: true, handled: true, category };
      }

      // Если категории нет, определяем через AI
      let contextMessages = [];
      let conversationId = null;

      if (botHandling) {
        // Диалог на обслуживании бота - получаем сообщения диалога уточнения
        conversationId = await this.metaManager.getBotConversationId(dialogId);
        if (!conversationId) {
          // Создаем новый conversationId, если его нет
          conversationId = this.stateManager.createBotConversationId(dialogId);
          await this.metaManager.setBotConversationId(dialogId, conversationId);
        }

        // Помечаем текущее сообщение пользователя как ответ в диалоге с ботом
        await this.metaManager.markMessageAsBotResponse(message.messageId, conversationId);

        // Получаем все сообщения диалога уточнения
        contextMessages = await this.stateManager.getBotConversationMessages(dialogId, conversationId);
      } else {
        // Получаем последние сообщения диалога для контекста
        contextMessages = await this.stateManager.getDialogMessagesForContext(dialogId, 10);
      }

      // Классифицируем намерение через AI
      const intents = getAllIntents();
      const intentResult = await this.aiClassifier.classifyIntent(userMessage, contextMessages, intents);

      console.log('Результат классификации:', {
        status: intentResult.status,
        intent: intentResult.intent,
      });

      // Сохраняем категорию и намерение в мета теги только при успешной классификации
      // При insufficient_data категорию не устанавливаем, т.к. данных недостаточно
      if (intentResult.status === 'success' && intentResult.intent && intentResult.intent !== 'default_intent') {
        await this.metaManager.setCategory(dialogId, intentResult.intent);
        await this.metaManager.setLastIntent(dialogId, intentResult.intent);
        console.log(`Категория ${intentResult.intent} установлена для диалога ${dialogId}`);
      } else if (intentResult.intent && intentResult.intent !== 'default_intent') {
        // Сохраняем только lastIntent при insufficient_data, но не категорию
        await this.metaManager.setLastIntent(dialogId, intentResult.intent);
        console.log(`LastIntent ${intentResult.intent} установлен для диалога ${dialogId} (категория не установлена, т.к. недостаточно данных)`);
      }

      // Обрабатываем результат классификации
      if (intentResult.status === 'success') {
        // Категория определена, данных достаточно
        console.log(`Категория определена: ${intentResult.intent}`);
        
        // Завершаем диалог уточнения, если он был активен
        if (botHandling) {
          await this.metaManager.setBotHandling(dialogId, false);
        }

        // Отправляем ответ пользователю
        const responseText = this.buildSuccessResponse(intentResult);
        await this.sendResponse(dialogId, responseText);

        return { success: true, handled: true, intent: intentResult.intent, category: intentResult.intent };
      } else if (intentResult.status === 'insufficient_data') {
        // Нужно задать вопросы пользователю
        console.log('Статус insufficient_data, проверяем необходимость вопроса...');
        const shouldAsk = await this.stateManager.shouldAskQuestion(dialogId, intentResult);
        console.log(`shouldAsk: ${shouldAsk}, autoHandle: ${config.bot.autoHandle}`);
        
        if (shouldAsk && config.bot.autoHandle) {
          const question = this.stateManager.buildQuestion(intentResult);
          console.log(`Сформирован вопрос: ${question}`);
          
          if (question) {
            // Получаем или создаем conversationId
            if (!conversationId) {
              conversationId = this.stateManager.createBotConversationId(dialogId);
              await this.metaManager.setBotConversationId(dialogId, conversationId);
              console.log(`Создан conversationId: ${conversationId}`);
            }

            // Отправляем вопрос
            console.log(`Отправка вопроса в диалог ${dialogId}...`);
            const questionResult = await this.sendResponse(dialogId, question);
            console.log(`Результат отправки вопроса:`, questionResult);
            
            if (questionResult.success && questionResult.messageId) {
              // Помечаем сообщение как вопрос бота
              await this.metaManager.markMessageAsQuestion(
                questionResult.messageId,
                'missing_field',
                intentResult.intent,
                conversationId
              );
              console.log(`Сообщение ${questionResult.messageId} помечено как вопрос бота`);
            }

            // Устанавливаем флаг ведения ботом
            await this.metaManager.setBotHandling(dialogId, true);
            await this.metaManager.setBotConversationId(dialogId, conversationId);

            console.log(`Вопрос отправлен в диалог ${dialogId}`);
          } else {
            console.warn('Вопрос не сформирован (buildQuestion вернул null)');
          }
        } else {
          if (!shouldAsk) {
            console.log('Вопрос не задан: shouldAsk = false (возможно, достигнут лимит вопросов)');
          }
          if (!config.bot.autoHandle) {
            console.log('Вопрос не задан: autoHandle = false (установите BOT_AUTO_HANDLE=true)');
          }
        }

        return { success: true, handled: true, intent: intentResult.intent, needsMoreData: true };
      } else {
        // unknown_intent - используем дефолтную категорию
        console.log('Намерение не определено, используем дефолтную категорию');
        await this.metaManager.setCategory(dialogId, 'default_intent');
        
        const responseText = 'Извините, я не понял ваш запрос. Пожалуйста, уточните, чем я могу помочь.';
        await this.sendResponse(dialogId, responseText);

        return { success: true, handled: true, intent: 'default_intent' };
      }
    } catch (error) {
      console.error('Ошибка при обработке входящего сообщения:', error);
      return { success: false, error: error.message || String(error) };
    }
  }

  /**
   * Построить ответ при успешной классификации
   * @param {Object} intentResult - Результат классификации
   * @returns {string}
   */
  buildSuccessResponse(intentResult) {
    const intent = intentResult.intent;
    const data = intentResult.data || {};

    // Базовые ответы для разных намерений
    const responses = {
      'support_technical': 'Понял, проблема с технической поддержкой. Сейчас разберусь.',
      'support_billing': 'Понял, вопрос по оплате. Обрабатываю ваш запрос.',
      'support_account': 'Понял, вопрос по аккаунту. Помогу вам.',
      'support_general': 'Понял ваш вопрос. Сейчас помогу.',
      'default_intent': 'Понял ваш запрос. Обрабатываю.',
    };

    let response = responses[intent] || responses['default_intent'];

    // Можно добавить более детальные ответы на основе данных
    if (intent === 'support_billing' && data.order_id) {
      response = `Оформляю возврат по заказу ${data.order_id}.`;
    }

    return response;
  }

  /**
   * Отправить ответ пользователю
   * @param {string} dialogId - ID диалога
   * @param {string} content - Содержимое ответа
   * @returns {Promise<Object>}
   */
  async sendResponse(dialogId, content) {
    try {
      if (!this.chat3Client) {
        throw new Error('Chat3Client не установлен');
      }

      const result = await this.chat3Client.sendMessage(dialogId, content);
      return result;
    } catch (error) {
      console.error(`Ошибка при отправке ответа в диалог ${dialogId}:`, error);
      return { success: false, error: error.message || String(error) };
    }
  }
}

