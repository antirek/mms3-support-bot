/**
 * Конфигурация намерений (intents) для классификации согласно action-spec
 * Структура соответствует спецификации PROMPT_SPEC.md
 */

export const INTENTS = [
  {
    intent: 'support_technical',
    description: 'Техническая поддержка - проблемы с работой системы, ошибки, неполадки',
    examples: [
      'не работает',
      'ошибка',
      'не могу войти',
      'система зависла',
      'не открывается',
      'баг',
      'сломалось'
    ],
    data: [
      {
        field: 'issue_type',
        description: 'Тип проблемы (авторизация, производительность, функциональность, другое)',
        required: true,
        examples: ['авторизация', 'производительность', 'функциональность', 'другое']
      },
      {
        field: 'device',
        description: 'Устройство или платформа (обязательно)',
        required: true,
        examples: ['мобильное приложение', 'веб-сайт', 'API']
      },
      {
        field: 'error_message',
        description: 'Текст ошибки, если есть (опционально)',
        required: false,
        examples: ['Ошибка 404', 'Connection timeout']
      }
    ]
  },
  {
    intent: 'support_billing',
    description: 'Вопросы по оплате, счетам, возвратам, подпискам',
    examples: [
      'оплата',
      'счет',
      'возврат',
      'подписка',
      'платеж',
      'деньги',
      'биллинг'
    ],
    data: [
      {
        field: 'order_id',
        description: 'Номер заказа или транзакции',
        required: true,
        examples: ['12345', 'ORD-2024-001']
      },
      {
        field: 'reason',
        description: 'Причина обращения (возврат, вопрос по счету, отмена подписки)',
        required: true,
        examples: ['возврат', 'вопрос по счету', 'отмена подписки', 'другое']
      },
      {
        field: 'amount',
        description: 'Сумма (опционально)',
        required: false,
        examples: ['1000', '5000 руб']
      }
    ]
  },
  {
    intent: 'support_account',
    description: 'Вопросы по аккаунту, настройкам профиля, доступу',
    examples: [
      'аккаунт',
      'профиль',
      'настройки',
      'пароль',
      'доступ',
      'регистрация'
    ],
    data: [
      {
        field: 'action_type',
        description: 'Тип действия (изменение пароля, восстановление доступа, изменение данных)',
        required: true,
        examples: ['изменение пароля', 'восстановление доступа', 'изменение данных', 'другое']
      },
      {
        field: 'user_id',
        description: 'ID пользователя (опционально)',
        required: false,
        examples: ['user123', 'user@example.com']
      }
    ]
  },
  {
    intent: 'support_general',
    description: 'Общие вопросы, информация о продукте, документация',
    examples: [
      'как использовать',
      'документация',
      'инструкция',
      'помощь',
      'вопрос',
      'информация'
    ],
    data: [
      {
        field: 'topic',
        description: 'Тема вопроса',
        required: false,
        examples: ['функциональность', 'интеграция', 'API', 'другое']
      }
    ]
  },
  {
    intent: 'default_intent',
    description: 'Намерение не определено или не соответствует ни одному из доступных намерений',
    examples: [],
    data: []
  }
];

/**
 * Получить намерение по идентификатору
 * @param {string} intentId - Идентификатор намерения
 * @returns {Object|null}
 */
export function getIntent(intentId) {
  return INTENTS.find(intent => intent.intent === intentId) || null;
}

/**
 * Получить все намерения
 * @returns {Array}
 */
export function getAllIntents() {
  return INTENTS;
}

/**
 * Получить дефолтное намерение
 * @returns {Object}
 */
export function getDefaultIntent() {
  return INTENTS.find(intent => intent.intent === 'default_intent') || INTENTS[INTENTS.length - 1];
}

