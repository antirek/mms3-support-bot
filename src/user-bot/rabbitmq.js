import amqp from 'amqplib';
import { config } from './config.js';
import { UpdateHandlers } from './updateHandlers.js';

export class RabbitMQUpdatesClient {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.isConnected = false;
  }

  /**
   * Подключение к RabbitMQ
   */
  async connect() {
    try {
      console.log(`Подключение к RabbitMQ: ${config.rabbitmq.url}`);
      
      this.connection = await amqp.connect(config.rabbitmq.url);
      this.channel = await this.connection.createChannel();
      this.isConnected = true;

      // Обработка закрытия соединения
      this.connection.on('close', () => {
        console.warn('Соединение с RabbitMQ закрыто');
        this.isConnected = false;
      });

      this.connection.on('error', (err) => {
        console.error('Ошибка соединения с RabbitMQ:', err);
        this.isConnected = false;
      });

      console.log('Успешно подключено к RabbitMQ');
      return true;
    } catch (error) {
      console.error('Ошибка при подключении к RabbitMQ:', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Настройка очереди и подписка на updates для бота
   */
  async setupQueue() {
    try {
      if (!this.channel) {
        throw new Error('Канал не создан. Сначала выполните connect()');
      }

      const { exchange } = config.rabbitmq;
      const { userId } = config.bot;

      // Имя очереди для бота
      const queue = `bot_${userId}_updates`;
      
      // Routing key для подписки на updates бота
      // Формат: update.dialog.bot.bot_helper.*
      const routingKey = `update.dialog.bot.${userId}.*`;

      // Убеждаемся, что очередь существует
      await this.channel.assertQueue(queue, {
        durable: true,
        arguments: {
          'x-message-ttl': 3600000, // TTL 1 час
        },
      });

      console.log(`Очередь '${queue}' настроена`);

      // Настраиваем exchange для updates chat3
      if (exchange) {
        await this.channel.assertExchange(exchange, 'topic', {
          durable: true,
        });

        // Привязываем очередь к exchange с routing key для updates бота
        await this.channel.bindQueue(queue, exchange, routingKey);
        console.log(`Exchange '${exchange}' настроен, очередь привязана к '${routingKey}'`);
      }

      // Подписываемся на сообщения из очереди
      await this.channel.consume(
        queue,
        async (msg) => {
          if (msg !== null) {
            try {
              const content = JSON.parse(msg.content.toString());
              console.debug('Получен update из очереди:', {
                eventType: content.eventType,
                entityId: content.entityId,
                userId: content.userId,
              });

              // Обрабатываем update
              const result = await UpdateHandlers.handleUpdate(content);

              if (result.success) {
                // Подтверждаем обработку сообщения
                this.channel.ack(msg);
                console.debug('Update успешно обработан');
              } else {
                // В случае ошибки можно отправить в очередь ошибок или повторить
                console.error('Ошибка обработки update:', result.error);
                // Отклоняем сообщение и отправляем обратно в очередь
                this.channel.nack(msg, false, true);
              }
            } catch (error) {
              console.error('Ошибка при парсинге update:', error);
              // Отклоняем некорректное сообщение без повторной отправки
              this.channel.nack(msg, false, false);
            }
          }
        },
        {
          noAck: false, // Требуем подтверждения обработки
        }
      );

      console.log(`Подписка на очередь '${queue}' установлена (routing key: ${routingKey})`);
    } catch (error) {
      console.error('Ошибка при настройке очереди:', error);
      throw error;
    }
  }

  /**
   * Закрытие соединения
   */
  async close() {
    try {
      if (this.channel) {
        await this.channel.close();
        console.log('Канал закрыт');
      }

      if (this.connection) {
        await this.connection.close();
        console.log('Соединение с RabbitMQ закрыто');
      }

      this.isConnected = false;
    } catch (error) {
      console.error('Ошибка при закрытии соединения:', error);
      throw error;
    }
  }

  /**
   * Проверка состояния соединения
   */
  isReady() {
    return this.isConnected && this.channel !== null;
  }
}

