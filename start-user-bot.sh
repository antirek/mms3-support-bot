#!/bin/bash

# Скрипт запуска user-bot chat3 с установкой переменных окружения

# Установка переменных окружения для RabbitMQ
export RABBITMQ_URL="amqp://rmuser:rmpassword@192.168.95.8:5672"
export RABBITMQ_UPDATES_EXCHANGE="chat3_updates"

# Установка переменных окружения для бота
export BOT_USER_ID="bot_helper"
export BOT_NAME="Helper Bot"

# Установка переменных окружения для Chat3 API
export CHAT3_API_URL="https://tubo-mms3-tenant-api.services.mobilon.ru/api"
export CHAT3_API_KEY="chat3_de2b79b6159abaf8cb1145ec95b8136146483d1d34770236014932e13a327fc1"
export CHAT3_TENANT_ID="tnt_default"

# Вывод текущих настроек
echo "Запуск user-bot chat3 с настройками:"
echo "  RABBITMQ_URL: $RABBITMQ_URL"
echo "  RABBITMQ_UPDATES_EXCHANGE: $RABBITMQ_UPDATES_EXCHANGE"
echo "  BOT_USER_ID: $BOT_USER_ID"
echo "  BOT_NAME: $BOT_NAME"
echo "  CHAT3_API_URL: $CHAT3_API_URL"
echo "  CHAT3_TENANT_ID: $CHAT3_TENANT_ID"
echo "  CHAT3_API_KEY: ${CHAT3_API_KEY:+***установлен***}"
echo ""

# Проверка наличия node_modules
if [ ! -d "node_modules" ]; then
  echo "Установка зависимостей..."
  npm install
fi

# Запуск приложения
echo "Запуск user-bot..."
npm run start:user-bot

