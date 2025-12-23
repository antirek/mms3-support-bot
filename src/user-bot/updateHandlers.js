import { config } from './config.js';
import { MessageHandler } from './messageHandler.js';

/**
 * Обработчик updates из RabbitMQ
 * Обрабатывает updates для бота bot_helper
 */
export class UpdateHandlers {
  static chat3Client = null;
  static messageHandler = null;

  /**
   * Установка клиента Chat3 API
   * @param {Chat3UserBotClient} client - Экземпляр клиента
   */
  static setChat3Client(client) {
    this.chat3Client = client;
  }

  /**
   * Установка обработчика сообщений
   * @param {MessageHandler} handler - Экземпляр обработчика
   */
  static setMessageHandler(handler) {
    this.messageHandler = handler;
  }

  /**
   * Обработка MessageUpdate - новое сообщение в диалоге
   * @param {Object} update - Update из RabbitMQ
   * @returns {Promise<Object>}
   */
  static async handleMessageUpdate(update) {
    try {
      const { data } = update;
      
      if (!data || !data.message) {
        console.warn('Update не содержит данных сообщения');
        return { success: false, error: 'Отсутствуют данные сообщения' };
      }

      const message = data.message;
      const dialog = data.dialog;
      const eventType = update.eventType;
      
      console.log('Получено обновление сообщения в диалоге:', {
        messageId: message.messageId,
        dialogId: message.dialogId,
        senderId: message.senderId,
        content: message.content,
        type: message.type,
        eventType: eventType,
      });

      // Проверяем, что сообщение не от самого бота (только для создания/обновления)
      if ((eventType === 'message.create' || eventType === 'message.update') 
          && message.senderId === config.bot.userId) {
        console.debug('Сообщение от самого бота, пропускаем');
        return { success: true, handled: false };
      }

      // Обработка различных типов событий сообщений
      if (eventType === 'message.create') {
        // Используем MessageHandler для обработки входящих сообщений
        if (this.messageHandler) {
          const result = await this.messageHandler.handleIncomingMessage(update);
          if (result.success) {
            console.log(`Сообщение обработано в диалоге ${message.dialogId}`, {
              handled: result.handled,
              intent: result.intent,
              category: result.category,
            });
          } else {
            console.error(`Ошибка обработки сообщения:`, result.error);
          }
        } else {
          console.warn('MessageHandler не установлен, невозможно обработать сообщение');
        }
      } else if (eventType === 'message.update') {
        console.log(`Сообщение обновлено: ${message.messageId}`);
        // Здесь можно добавить логику при обновлении сообщения
      } else if (eventType === 'message.status.update') {
        const statusUpdate = message.statusUpdate;
        console.log(`Статус сообщения обновлен: ${message.messageId}`, {
          userId: statusUpdate?.userId,
          status: statusUpdate?.status,
        });
        // Здесь можно добавить логику при обновлении статуса
      } else if (eventType === 'message.reaction.update') {
        const reactionUpdate = message.reactionUpdate;
        console.log(`Реакция на сообщение обновлена: ${message.messageId}`, {
          userId: reactionUpdate?.userId,
          reaction: reactionUpdate?.reaction,
        });
        // Здесь можно добавить логику при обновлении реакции
      }

      return { success: true, handled: true };
    } catch (error) {
      console.error('Ошибка при обработке MessageUpdate:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Обработка DialogUpdate - обновление диалога
   * @param {Object} update - Update из RabbitMQ
   * @returns {Promise<Object>}
   */
  static async handleDialogUpdate(update) {
    try {
      const { data } = update;
      
      if (!data || !data.dialog) {
        console.warn('Update не содержит данных диалога');
        return { success: false, error: 'Отсутствуют данные диалога' };
      }

      const dialog = data.dialog;
      const eventType = update.eventType;
      
      console.log('Обновление диалога:', {
        dialogId: dialog.dialogId,
        name: dialog.name,
        eventType: eventType,
      });

      // Обработка различных типов событий диалога
      if (eventType === 'dialog.create') {
        console.log(`Создан новый диалог: ${dialog.dialogId}`);
        // Здесь можно добавить логику при создании диалога
      } else if (eventType === 'dialog.update') {
        console.log(`Диалог обновлен: ${dialog.dialogId}`);
        // Здесь можно добавить логику при обновлении диалога
      } else if (eventType === 'dialog.delete') {
        console.log(`Диалог удален: ${dialog.dialogId}`);
        // Здесь можно добавить логику при удалении диалога
      } else if (eventType === 'dialog.member.add') {
        const member = data.member;
        console.log(`Участник добавлен в диалог ${dialog.dialogId}: ${member?.userId}`);
        // Здесь можно добавить логику при добавлении участника
      } else if (eventType === 'dialog.member.remove') {
        const member = data.member;
        console.log(`Участник удален из диалога ${dialog.dialogId}: ${member?.userId}`);
        // Здесь можно добавить логику при удалении участника
      }
      
      return { success: true, handled: true };
    } catch (error) {
      console.error('Ошибка при обработке DialogUpdate:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Обработка DialogMemberUpdate - обновление участника диалога
   * @param {Object} update - Update из RabbitMQ
   * @returns {Promise<Object>}
   */
  static async handleDialogMemberUpdate(update) {
    try {
      const { data } = update;
      
      if (!data || !data.dialog || !data.member) {
        console.warn('Update не содержит данных участника диалога');
        return { success: false, error: 'Отсутствуют данные участника диалога' };
      }

      const dialog = data.dialog;
      const member = data.member;
      
      console.log('Обновление участника диалога:', {
        dialogId: dialog.dialogId,
        userId: member.userId,
        unreadCount: member.state?.unreadCount,
        eventType: update.eventType,
      });

      // Здесь можно добавить логику обработки обновления участника
      
      return { success: true, handled: true };
    } catch (error) {
      console.error('Ошибка при обработке DialogMemberUpdate:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Обработка TypingUpdate - индикатор печати
   * @param {Object} update - Update из RabbitMQ
   * @returns {Promise<Object>}
   */
  static async handleTypingUpdate(update) {
    try {
      const { data } = update;
      
      if (!data || !data.dialog || !data.typing) {
        console.warn('Update не содержит данных typing');
        return { success: false, error: 'Отсутствуют данные typing' };
      }

      const dialog = data.dialog;
      const typing = data.typing;
      
      console.log('Индикатор печати:', {
        dialogId: dialog.dialogId,
        userId: typing.userId,
        expiresInMs: typing.expiresInMs,
      });

      // Здесь можно добавить логику обработки индикатора печати
      
      return { success: true, handled: true };
    } catch (error) {
      console.error('Ошибка при обработке TypingUpdate:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Обработка UserUpdate - обновление пользователя
   * @param {Object} update - Update из RabbitMQ
   * @returns {Promise<Object>}
   */
  static async handleUserUpdate(update) {
    try {
      const { data } = update;
      
      if (!data || !data.user) {
        console.warn('Update не содержит данных пользователя');
        return { success: false, error: 'Отсутствуют данные пользователя' };
      }

      const user = data.user;
      const eventType = update.eventType;
      
      console.log('Обновление пользователя:', {
        userId: user.userId,
        type: user.type,
        eventType: eventType,
      });

      // Обработка различных типов событий пользователя
      if (eventType === 'user.add') {
        console.log(`Пользователь добавлен: ${user.userId}`);
      } else if (eventType === 'user.update') {
        console.log(`Пользователь обновлен: ${user.userId}`);
      } else if (eventType === 'user.remove') {
        console.log(`Пользователь удален: ${user.userId}`);
      }
      
      return { success: true, handled: true };
    } catch (error) {
      console.error('Ошибка при обработке UserUpdate:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Обработка UserStatsUpdate - обновление статистики пользователя
   * @param {Object} update - Update из RabbitMQ
   * @returns {Promise<Object>}
   */
  static async handleUserStatsUpdate(update) {
    try {
      const { data } = update;
      
      if (!data || !data.user || !data.user.stats) {
        console.warn('Update не содержит данных статистики пользователя');
        return { success: false, error: 'Отсутствуют данные статистики пользователя' };
      }

      const user = data.user;
      const stats = user.stats;
      
      console.log('Обновление статистики пользователя:', {
        userId: user.userId,
        dialogCount: stats.dialogCount,
        unreadDialogsCount: stats.unreadDialogsCount,
      });

      // Здесь можно добавить логику обработки статистики
      
      return { success: true, handled: true };
    } catch (error) {
      console.error('Ошибка при обработке UserStatsUpdate:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Универсальный обработчик updates
   * @param {Object} update - Update из RabbitMQ
   * @returns {Promise<Object>}
   */
  static async handleUpdate(update) {
    try {
      const eventType = update.eventType || 'unknown';
      console.debug(`Обработка update типа: ${eventType}`);

      // Определяем тип update по eventType согласно документации UPDATES.md
      // Message Updates
      if (eventType === 'message.create' 
          || eventType === 'message.update' 
          || eventType === 'message.status.update' 
          || eventType === 'message.reaction.update') {
        return await this.handleMessageUpdate(update);
      }
      
      // Dialog Updates
      if (eventType === 'dialog.create' 
          || eventType === 'dialog.update' 
          || eventType === 'dialog.delete'
          || eventType === 'dialog.member.add' 
          || eventType === 'dialog.member.remove') {
        return await this.handleDialogUpdate(update);
      }
      
      // Dialog Member Updates
      if (eventType === 'dialog.member.update') {
        return await this.handleDialogMemberUpdate(update);
      }
      
      // Typing Updates
      if (eventType === 'dialog.typing') {
        return await this.handleTypingUpdate(update);
      }
      
      // User Updates
      if (eventType === 'user.add' 
          || eventType === 'user.update' 
          || eventType === 'user.remove') {
        return await this.handleUserUpdate(update);
      }
      
      // User Stats Updates
      if (eventType === 'user.stats.update') {
        return await this.handleUserStatsUpdate(update);
      }

      // Игнорируем неизвестные типы updates
      console.debug(`Update типа '${eventType}' проигнорирован (неизвестный тип)`);
      return { success: true, handled: false };
    } catch (error) {
      console.error('Ошибка при обработке update:', error);
      return { success: false, error: error.message };
    }
  }
}

