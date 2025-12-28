# Тест-кейси: Реєстрація, Оплата та Промокоди

## Зміст

1. [Реєстрація на публічні події](#1-реєстрація-на-публічні-події)
2. [Оплата](#2-оплата)
3. [Промокоди](#3-промокоди)
4. [Інтеграційні тест-кейси](#4-інтеграційні-тест-кейси)

---

## 1. Реєстрація на публічні події

### 1.1. Успішна реєстрація

#### TC-REG-001: Успішна реєстрація з усіма обов'язковими полями

**Preconditions:**

- Подія існує
- Подія має доступну місткість (`registeredCount < capacity`)
- Дата події в майбутньому
- Базова ціна події налаштована

**Test Data:**

```json
{
  "eventId": "507f1f77bcf86cd799439011",
  "name": "Іван",
  "surname": "Петренко",
  "email": "ivan@example.com",
  "city": "Київ"
}
```

**Steps:**

1. Надіслати POST запит на `/api/registrations` з валідними даними
2. Перевірити статус відповіді: `201 Created`
3. Перевірити, що реєстрація створена зі статусом `pending`
4. Перевірити, що `paymentStatus` = `pending`
5. Перевірити, що `paymentLink` присутній у відповіді
6. Перевірити, що `registeredCount` події збільшено на 1
7. Перевірити, що email з посиланням на оплату надіслано

**Expected Result:**

- Реєстрація успішно створена
- Payment link згенеровано
- Email надіслано
- Capacity події зменшено

---

#### TC-REG-002: Успішна реєстрація з опціональними полями

**Preconditions:**

- Подія існує та має місткість

**Test Data:**

```json
{
  "eventId": "507f1f77bcf86cd799439011",
  "name": "Марія",
  "surname": "Коваленко",
  "email": "maria@example.com",
  "city": "Львів",
  "runningClub": "Львівські бігуни",
  "phone": "+380501234567",
  "promoCode": "DISCOUNT10"
}
```

**Steps:**

1. Надіслати POST запит з усіма полями
2. Перевірити статус `201 Created`
3. Перевірити, що всі поля збережено коректно
4. Перевірити, що `runningClub` та `phone` збережено
5. Перевірити, що промокод застосовано (якщо валідний)

**Expected Result:**

- Реєстрація створена з усіма полями
- Опціональні поля збережено

---

#### TC-REG-003: Реєстрація з UUID eventId

**Preconditions:**

- Подія існує з UUID ідентифікатором

**Test Data:**

```json
{
  "eventId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Олег",
  "surname": "Сидоренко",
  "email": "oleg@example.com",
  "city": "Одеса"
}
```

**Steps:**

1. Надіслати POST запит з UUID як eventId
2. Перевірити, що система розпізнає UUID
3. Перевірити успішну реєстрацію

**Expected Result:**

- UUID прийнято та оброблено
- Реєстрація створена

---

### 1.2. Валідація вхідних даних

#### TC-REG-004: Відсутнє обов'язкове поле `name`

**Test Data:**

```json
{
  "eventId": "507f1f77bcf86cd799439011",
  "surname": "Петренко",
  "email": "test@example.com",
  "city": "Київ"
}
```

**Expected Result:**

- Статус: `400 Bad Request`
- Помилка: `"Name must be at least 2 characters"`

---

#### TC-REG-005: `name` занадто коротке (< 2 символів)

**Test Data:**

```json
{
  "eventId": "507f1f77bcf86cd799439011",
  "name": "А",
  "surname": "Петренко",
  "email": "test@example.com",
  "city": "Київ"
}
```

**Expected Result:**

- Статус: `400 Bad Request`
- Помилка: `"Name must be at least 2 characters"`

---

#### TC-REG-006: `name` занадто довге (> 50 символів)

**Test Data:**

```json
{
  "eventId": "507f1f77bcf86cd799439011",
  "name": "А".repeat(51),
  "surname": "Петренко",
  "email": "test@example.com",
  "city": "Київ"
}
```

**Expected Result:**

- Статус: `400 Bad Request`
- Помилка: `"Name must not exceed 50 characters"`

---

#### TC-REG-007: Відсутнє обов'язкове поле `surname`

**Test Data:**

```json
{
  "eventId": "507f1f77bcf86cd799439011",
  "name": "Іван",
  "email": "test@example.com",
  "city": "Київ"
}
```

**Expected Result:**

- Статус: `400 Bad Request`
- Помилка: `"Surname must be at least 2 characters"`

---

#### TC-REG-008: `surname` занадто коротке (< 2 символів)

**Test Data:**

```json
{
  "eventId": "507f1f77bcf86cd799439011",
  "name": "Іван",
  "surname": "П",
  "email": "test@example.com",
  "city": "Київ"
}
```

**Expected Result:**

- Статус: `400 Bad Request`
- Помилка: `"Surname must be at least 2 characters"`

---

#### TC-REG-009: `surname` занадто довге (> 50 символів)

**Test Data:**

```json
{
  "eventId": "507f1f77bcf86cd799439011",
  "name": "Іван",
  "surname": "А".repeat(51),
  "email": "test@example.com",
  "city": "Київ"
}
```

**Expected Result:**

- Статус: `400 Bad Request`
- Помилка: `"Surname must not exceed 50 characters"`

---

#### TC-REG-010: Відсутнє обов'язкове поле `email`

**Test Data:**

```json
{
  "eventId": "507f1f77bcf86cd799439011",
  "name": "Іван",
  "surname": "Петренко",
  "city": "Київ"
}
```

**Expected Result:**

- Статус: `400 Bad Request`
- Помилка: `"Please enter a valid email address"`

---

#### TC-REG-011: Невалідний формат email

**Test Data:**

```json
{
  "eventId": "507f1f77bcf86cd799439011",
  "name": "Іван",
  "surname": "Петренко",
  "email": "invalid-email",
  "city": "Київ"
}
```

**Expected Result:**

- Статус: `400 Bad Request`
- Помилка: `"Please enter a valid email address (e.g., user@example.com)"`

---

#### TC-REG-012: Email автоматично перетворюється на lowercase

**Test Data:**

```json
{
  "eventId": "507f1f77bcf86cd799439011",
  "name": "Іван",
  "surname": "Петренко",
  "email": "IVAN@EXAMPLE.COM",
  "city": "Київ"
}
```

**Expected Result:**

- Email збережено як `ivan@example.com` (lowercase)

---

#### TC-REG-013: Відсутнє обов'язкове поле `city`

**Test Data:**

```json
{
  "eventId": "507f1f77bcf86cd799439011",
  "name": "Іван",
  "surname": "Петренко",
  "email": "test@example.com"
}
```

**Expected Result:**

- Статус: `400 Bad Request`
- Помилка: `"City must be at least 2 characters"`

---

#### TC-REG-014: `city` занадто коротке (< 2 символів)

**Test Data:**

```json
{
  "eventId": "507f1f77bcf86cd799439011",
  "name": "Іван",
  "surname": "Петренко",
  "email": "test@example.com",
  "city": "К"
}
```

**Expected Result:**

- Статус: `400 Bad Request`
- Помилка: `"City must be at least 2 characters"`

---

#### TC-REG-015: `city` занадто довге (> 100 символів)

**Test Data:**

```json
{
  "eventId": "507f1f77bcf86cd799439011",
  "name": "Іван",
  "surname": "Петренко",
  "email": "test@example.com",
  "city": "А".repeat(101)
}
```

**Expected Result:**

- Статус: `400 Bad Request`
- Помилка: `"City must not exceed 100 characters"`

---

#### TC-REG-016: Невалідний формат `phone`

**Test Data:**

```json
{
  "eventId": "507f1f77bcf86cd799439011",
  "name": "Іван",
  "surname": "Петренко",
  "email": "test@example.com",
  "city": "Київ",
  "phone": "abc123"
}
```

**Expected Result:**

- Статус: `400 Bad Request`
- Помилка: `"Phone must contain only numbers, spaces, +, -, or parentheses"`

---

#### TC-REG-017: `phone` занадто довгий (> 20 символів)

**Test Data:**

```json
{
  "eventId": "507f1f77bcf86cd799439011",
  "name": "Іван",
  "surname": "Петренко",
  "email": "test@example.com",
  "city": "Київ",
  "phone": "+380501234567890123456"
}
```

**Expected Result:**

- Статус: `400 Bad Request`
- Помилка: `"Phone must not exceed 20 characters"`

---

#### TC-REG-018: Валідний формат `phone` з різними варіантами

**Test Data (різні варіанти):**

```json
// Варіант 1
{ "phone": "+380501234567" }
// Варіант 2
{ "phone": "380501234567" }
// Варіант 3
{ "phone": "(050) 123-45-67" }
// Варіант 4
{ "phone": "050 123 45 67" }
```

**Expected Result:**

- Всі варіанти прийнято як валідні

---

#### TC-REG-019: `runningClub` занадто довгий (> 100 символів)

**Test Data:**

```json
{
  "eventId": "507f1f77bcf86cd799439011",
  "name": "Іван",
  "surname": "Петренко",
  "email": "test@example.com",
  "city": "Київ",
  "runningClub": "А".repeat(101)
}
```

**Expected Result:**

- Статус: `400 Bad Request`
- Помилка: `"Running club must not exceed 100 characters"`

---

#### TC-REG-020: `promoCode` занадто довгий (> 50 символів)

**Test Data:**

```json
{
  "eventId": "507f1f77bcf86cd799439011",
  "name": "Іван",
  "surname": "Петренко",
  "email": "test@example.com",
  "city": "Київ",
  "promoCode": "A".repeat(51)
}
```

**Expected Result:**

- Статус: `400 Bad Request`
- Помилка: `"Promo code must not exceed 50 characters"`

---

#### TC-REG-021: Невалідний формат `eventId` (не ObjectId і не UUID)

**Test Data:**

```json
{
  "eventId": "invalid-id",
  "name": "Іван",
  "surname": "Петренко",
  "email": "test@example.com",
  "city": "Київ"
}
```

**Expected Result:**

- Статус: `400 Bad Request`
- Помилка: `"Invalid event ID format"`

---

### 1.3. Валідація події

#### TC-REG-022: Подія не існує

**Test Data:**

```json
{
  "eventId": "507f1f77bcf86cd799439999",
  "name": "Іван",
  "surname": "Петренко",
  "email": "test@example.com",
  "city": "Київ"
}
```

**Expected Result:**

- Статус: `404 Not Found`
- Помилка: `"Event not found"`

---

#### TC-REG-023: Подія досягла максимальної місткості

**Preconditions:**

- Подія існує
- `registeredCount >= capacity`

**Test Data:**

```json
{
  "eventId": "507f1f77bcf86cd799439011",
  "name": "Іван",
  "surname": "Петренко",
  "email": "test@example.com",
  "city": "Київ"
}
```

**Expected Result:**

- Статус: `409 Conflict`
- Помилка: `"Event is full"`

---

#### TC-REG-024: Подія без базової ціни

**Preconditions:**

- Подія існує
- `basePrice` не встановлено
- `eventConfig.basePrice` не налаштовано

**Expected Result:**

- Статус: `409 Conflict`
- Помилка: `"Event price is not configured"`

---

### 1.4. Дублікати реєстрацій

#### TC-REG-025: Реєстрація з email, який вже зареєстрований (confirmed)

**Preconditions:**

- Існує реєстрація з таким же email та eventId
- Статус реєстрації: `confirmed`
- Payment status: `completed`

**Test Data:**

```json
{
  "eventId": "507f1f77bcf86cd799439011",
  "name": "Іван",
  "surname": "Петренко",
  "email": "existing@example.com",
  "city": "Київ"
}
```

**Expected Result:**

- Статус: `409 Conflict`
- Помилка: `"This email is already registered for the event"`

---

#### TC-REG-026: Реєстрація з email, який вже зареєстрований (pending payment)

**Preconditions:**

- Існує реєстрація з таким же email та eventId
- Статус реєстрації: `pending`
- Payment status: `pending`

**Test Data:**

```json
{
  "eventId": "507f1f77bcf86cd799439011",
  "name": "Іван",
  "surname": "Петренко",
  "email": "pending@example.com",
  "city": "Київ"
}
```

**Expected Result:**

- Статус: `200 OK` (не 201!)
- Відповідь містить існуючу реєстрацію
- Відповідь містить `paymentLink`
- Email з payment link надіслано повторно

---

#### TC-REG-027: Реєстрація з email, який вже зареєстрований (failed payment)

**Preconditions:**

- Існує реєстрація з таким же email та eventId
- Статус реєстрації: `pending`
- Payment status: `failed`

**Test Data:**

```json
{
  "eventId": "507f1f77bcf86cd799439011",
  "name": "Іван",
  "surname": "Петренко",
  "email": "failed@example.com",
  "city": "Київ"
}
```

**Expected Result:**

- Статус: `201 Created`
- Створено нову реєстрацію
- Створено новий payment
- Стара реєстрація залишається в базі

---

#### TC-REG-028: Реєстрація з email у різному регістрі (case-insensitive)

**Preconditions:**

- Існує реєстрація з email `test@example.com`

**Test Data:**

```json
{
  "eventId": "507f1f77bcf86cd799439011",
  "name": "Іван",
  "surname": "Петренко",
  "email": "TEST@EXAMPLE.COM",
  "city": "Київ"
}
```

**Expected Result:**

- Статус: `409 Conflict` (якщо confirmed) або `200 OK` (якщо pending)
- Email нормалізується до lowercase перед перевіркою

---

### 1.5. Отримання payment link

#### TC-REG-029: Отримання payment link для pending реєстрації

**Preconditions:**

- Існує pending реєстрація з paymentLink

**Test Data:**

```
GET /api/registrations/payment-link?email=test@example.com&eventId=507f1f77bcf86cd799439011
```

**Expected Result:**

- Статус: `200 OK`
- Відповідь містить `paymentLink`

---

#### TC-REG-030: Отримання payment link для неіснуючої реєстрації

**Test Data:**

```
GET /api/registrations/payment-link?email=nonexistent@example.com&eventId=507f1f77bcf86cd799439011
```

**Expected Result:**

- Статус: `404 Not Found`
- Помилка: `"No pending registration found for this email and event."`

---

#### TC-REG-031: Отримання payment link для confirmed реєстрації

**Preconditions:**

- Існує confirmed реєстрація

**Expected Result:**

- Статус: `404 Not Found`
- Помилка: `"No pending registration found for this email and event."`

---

#### TC-REG-032: Отримання payment link з невалідним email

**Test Data:**

```
GET /api/registrations/payment-link?email=invalid-email&eventId=507f1f77bcf86cd799439011
```

**Expected Result:**

- Статус: `400 Bad Request`
- Помилка: `"Please enter a valid email address"`

---

#### TC-REG-033: Отримання payment link з невалідним eventId

**Test Data:**

```
GET /api/registrations/payment-link?email=test@example.com&eventId=invalid-id
```

**Expected Result:**

- Статус: `400 Bad Request`
- Помилка: `"Invalid event ID format"`

---

## 2. Оплата

### 2.1. Створення платежу

#### TC-PAY-001: Успішне створення платежу через Monobank

**Preconditions:**

- Monobank API key налаштовано
- Реєстрація створена
- Event має basePrice

**Steps:**

1. Створити реєстрацію
2. Перевірити, що payment створено зі статусом `pending`
3. Перевірити, що `plataMonoInvoiceId` присутній
4. Перевірити, що `paymentLink` присутній
5. Перевірити, що `amount` = `finalPrice` реєстрації

**Expected Result:**

- Payment створено
- Invoice створено в Monobank
- Payment link згенеровано

---

#### TC-PAY-002: Створення платежу без Monobank API key

**Preconditions:**

- `PLATA_MONO_API_KEY` не налаштовано

**Expected Result:**

- Статус: `500 Internal Server Error`
- Помилка: `"Monobank API key is not configured"`

---

#### TC-PAY-003: Monobank API повертає помилку

**Preconditions:**

- Monobank API повертає 4xx/5xx помилку

**Expected Result:**

- Статус: `502 Bad Gateway` або `503 Service Unavailable`
- Помилка з описом проблеми
- Payment створено, але без invoiceId та paymentLink

---

#### TC-PAY-004: Monobank API timeout

**Preconditions:**

- Monobank API не відповідає протягом 30 секунд

**Expected Result:**

- Статус: `504 Gateway Timeout`
- Помилка: `"Payment service timeout. Please try again."`

---

#### TC-PAY-005: Створення платежу з нульовою сумою (free event)

**Preconditions:**

- Event має `basePrice = 0` або промокод дає 100% знижку

**Expected Result:**

- Payment створено з `amount = 0`
- Payment link може бути відсутній (залежить від Monobank API)

---

### 2.2. Webhook обробка

#### TC-PAY-006: Успішна обробка webhook зі статусом `success`

**Preconditions:**

- Реєстрація з pending payment існує
- Webhook public key налаштовано

**Test Data:**

```json
{
  "invoiceId": "monobank-invoice-id",
  "status": "success",
  "amount": 90000,
  "ccy": 980,
  "finalAmount": 90000,
  "merchantData": {
    "registrationId": "507f1f77bcf86cd799439012"
  }
}
```

**Headers:**

```
X-Sign: <valid-ecdsa-signature>
```

**Steps:**

1. Надіслати POST запит на `/api/webhooks/plata-mono`
2. Перевірити валідацію підпису
3. Перевірити, що payment status оновлено на `completed`
4. Перевірити, що registration status оновлено на `confirmed`
5. Перевірити, що promo code usage збільшено (якщо був)
6. Перевірити, що email з підтвердженням надіслано

**Expected Result:**

- Webhook оброблено успішно
- Статуси оновлено
- Email надіслано

---

#### TC-PAY-007: Обробка webhook зі статусом `failure`

**Test Data:**

```json
{
  "invoiceId": "monobank-invoice-id",
  "status": "failure",
  "failureReason": "Insufficient funds",
  "merchantData": {
    "registrationId": "507f1f77bcf86cd799439012"
  }
}
```

**Expected Result:**

- Payment status = `failed`
- Registration status залишається `pending`
- Event capacity НЕ зменшено
- Email з повідомленням про невдачу надіслано

---

#### TC-PAY-008: Обробка webhook зі статусом `expired`

**Test Data:**

```json
{
  "invoiceId": "monobank-invoice-id",
  "status": "expired",
  "merchantData": {
    "registrationId": "507f1f77bcf86cd799439012"
  }
}
```

**Expected Result:**

- Payment status = `failed`
- Registration status залишається `pending`
- Event capacity НЕ зменшено

---

#### TC-PAY-009: Webhook з невалідним підписом

**Preconditions:**

- Webhook public key налаштовано

**Test Data:**

```json
{
  "invoiceId": "monobank-invoice-id",
  "status": "success"
}
```

**Headers:**

```
X-Sign: <invalid-signature>
```

**Expected Result:**

- Статус: `400 Bad Request`
- Помилка: `"Invalid webhook signature"`
- Дані не оновлено

---

#### TC-PAY-010: Webhook без підпису (якщо public key налаштовано)

**Preconditions:**

- Webhook public key налаштовано

**Test Data:**

```json
{
  "invoiceId": "monobank-invoice-id",
  "status": "success"
}
```

**Expected Result:**

- Статус: `400 Bad Request`
- Помилка: `"Invalid webhook signature"`

---

#### TC-PAY-011: Webhook без public key (development mode)

**Preconditions:**

- `PLATA_MONO_WEBHOOK_PUBLIC_KEY` не налаштовано

**Expected Result:**

- Webhook прийнято без перевірки підпису (для development)

---

#### TC-PAY-012: Webhook з неіснуючим invoiceId

**Test Data:**

```json
{
  "invoiceId": "nonexistent-invoice-id",
  "status": "success"
}
```

**Expected Result:**

- Статус: `404 Not Found`
- Помилка: `"Payment not found"`

---

#### TC-PAY-013: Webhook зі статусом `processing`

**Test Data:**

```json
{
  "invoiceId": "monobank-invoice-id",
  "status": "processing"
}
```

**Expected Result:**

- Payment status залишається `pending`
- Дані не змінюються

---

#### TC-PAY-014: Webhook зі статусом `hold`

**Test Data:**

```json
{
  "invoiceId": "monobank-invoice-id",
  "status": "hold"
}
```

**Expected Result:**

- Payment status залишається `pending`
- Дані не змінюються

---

#### TC-PAY-015: Webhook з дублюванням (idempotency)

**Preconditions:**

- Payment вже має статус `completed`

**Test Data:**

```json
{
  "invoiceId": "monobank-invoice-id",
  "status": "success"
}
```

**Expected Result:**

- Webhook оброблено без помилок
- Дані не змінюються (idempotent)

---

### 2.3. Перевірка статусу платежу

#### TC-PAY-016: Перевірка статусу платежу (authenticated)

**Preconditions:**

- Користувач автентифікований
- Payment існує

**Test Data:**

```
GET /api/payments/{paymentId}/status
Headers: Authorization: Bearer <token>
```

**Expected Result:**

- Статус: `200 OK`
- Відповідь містить статус з Monobank API

---

#### TC-PAY-017: Перевірка статусу без автентифікації

**Expected Result:**

- Статус: `401 Unauthorized`

---

#### TC-PAY-018: Перевірка статусу неіснуючого платежу

**Expected Result:**

- Статус: `404 Not Found`

---

### 2.4. Отримання receipt

#### TC-PAY-019: Отримання receipt для completed платежу

**Preconditions:**

- Payment має статус `completed`
- Monobank API повертає receipt

**Expected Result:**

- Статус: `200 OK`
- Відповідь містить receipt дані

---

#### TC-PAY-020: Отримання receipt для pending платежу

**Expected Result:**

- Статус: `404 Not Found` або `400 Bad Request`
- Помилка: receipt недоступний

---

### 2.5. Refund (повернення коштів)

#### TC-PAY-021: Успішний refund

**Preconditions:**

- Користувач автентифікований як адмін/організатор
- Registration має статус `confirmed`
- Payment має статус `completed`

**Test Data:**

```
POST /api/registrations/{registrationId}/refund
Body: { "amount": 900, "extRef": "refund-reason-123" }
```

**Steps:**

1. Надіслати запит на refund
2. Перевірити, що payment скасовано в Monobank
3. Перевірити, що registration status = `cancelled`
4. Перевірити, що event capacity збільшено на 1
5. Перевірити, що promo code usage зменшено (якщо був)

**Expected Result:**

- Refund виконано
- Статуси оновлено
- Capacity відновлено

---

#### TC-PAY-022: Refund без автентифікації

**Expected Result:**

- Статус: `401 Unauthorized`

---

#### TC-PAY-023: Refund для pending платежу

**Preconditions:**

- Payment має статус `pending`

**Expected Result:**

- Статус: `400 Bad Request`
- Помилка: refund можливий тільки для completed платежів

---

#### TC-PAY-024: Refund часткової суми

**Test Data:**

```json
{
  "amount": 450
}
```

**Expected Result:**

- Частковий refund виконано
- Payment оновлено

---

## 3. Промокоди

### 3.1. Валідація промокодів

#### TC-PROMO-001: Успішна валідація глобального промокоду

**Preconditions:**

- Промокод існує
- `isActive = true`
- `usedCount < usageLimit`
- `expirationDate` в майбутньому або відсутня
- `eventId` відсутній (глобальний код)

**Test Data:**

```json
{
  "eventId": "507f1f77bcf86cd799439011",
  "name": "Іван",
  "surname": "Петренко",
  "email": "test@example.com",
  "city": "Київ",
  "promoCode": "DISCOUNT10"
}
```

**Expected Result:**

- Промокод прийнято
- Знижка застосовано
- `finalPrice` розраховано з урахуванням знижки

---

#### TC-PROMO-002: Успішна валідація event-specific промокоду

**Preconditions:**

- Промокод існує з `eventId` = eventId реєстрації
- Інші умови виконано

**Expected Result:**

- Промокод прийнято
- Знижка застосовано

---

#### TC-PROMO-003: Промокод не існує

**Test Data:**

```json
{
  "promoCode": "NONEXISTENT"
}
```

**Expected Result:**

- Статус: `400 Bad Request`
- Помилка: `"Invalid or expired promo code"`

---

#### TC-PROMO-004: Промокод неактивний (`isActive = false`)

**Preconditions:**

- Промокод існує
- `isActive = false`

**Expected Result:**

- Статус: `400 Bad Request`
- Помилка: `"Invalid or expired promo code"`

---

#### TC-PROMO-005: Промокод досягнув ліміту використання

**Preconditions:**

- Промокод існує
- `usedCount >= usageLimit`

**Expected Result:**

- Статус: `400 Bad Request`
- Помилка: `"Promo code usage limit reached"`

---

#### TC-PROMO-006: Промокод прострочений

**Preconditions:**

- Промокод існує
- `expirationDate < currentDate`

**Expected Result:**

- Статус: `400 Bad Request`
- Помилка: `"Promo code has expired"`

---

#### TC-PROMO-007: Event-specific промокод для іншої події

**Preconditions:**

- Промокод існує з `eventId = eventA`
- Реєстрація на `eventB`

**Test Data:**

```json
{
  "eventId": "507f1f77bcf86cd799439011",
  "promoCode": "EVENT_A_CODE"
}
```

**Expected Result:**

- Статус: `400 Bad Request`
- Помилка: `"Promo code is not valid for this event"`

---

#### TC-PROMO-008: Нормалізація промокоду (uppercase, trim)

**Test Data:**

```json
{
  "promoCode": "  discount10  "
}
```

**Expected Result:**

- Промокод нормалізовано до `DISCOUNT10`
- Валідація виконана з нормалізованим кодом

---

#### TC-PROMO-009: Промокод з різним регістром

**Test Data:**

```json
{
  "promoCode": "discount10"
}
```

**Expected Result:**

- Промокод нормалізовано до `DISCOUNT10`
- Валідація виконана

---

### 3.2. Розрахунок ціни з промокодом

#### TC-PROMO-010: Percentage discount (10% знижка)

**Preconditions:**

- Event `basePrice = 1000`
- Промокод: `discountType = 'percentage'`, `discountValue = 10`

**Expected Result:**

- `discountAmount = 100`
- `finalPrice = 900`

---

#### TC-PROMO-011: Percentage discount (100% знижка)

**Preconditions:**

- Event `basePrice = 1000`
- Промокод: `discountType = 'percentage'`, `discountValue = 100`

**Expected Result:**

- `discountAmount = 1000`
- `finalPrice = 0` (мінімум 0)

---

#### TC-PROMO-012: Percentage discount (> 100% знижка)

**Preconditions:**

- Event `basePrice = 1000`
- Промокод: `discountType = 'percentage'`, `discountValue = 150`

**Expected Result:**

- `discountAmount = 1500`
- `finalPrice = 0` (мінімум 0, не може бути від'ємним)

---

#### TC-PROMO-013: Amount discount (фіксована сума)

**Preconditions:**

- Event `basePrice = 1000`
- Промокод: `discountType = 'amount'`, `discountValue = 200`

**Expected Result:**

- `discountAmount = 200`
- `finalPrice = 800`

---

#### TC-PROMO-014: Amount discount більше за basePrice

**Preconditions:**

- Event `basePrice = 1000`
- Промокод: `discountType = 'amount'`, `discountValue = 1500`

**Expected Result:**

- `discountAmount = 1500`
- `finalPrice = 0` (мінімум 0)

---

#### TC-PROMO-015: Розрахунок без промокоду

**Preconditions:**

- Event `basePrice = 1000`
- Промокод не надано

**Expected Result:**

- `discountAmount = 0`
- `finalPrice = 1000`

---

#### TC-PROMO-016: Розрахунок з невалідним промокодом

**Preconditions:**

- Event `basePrice = 1000`
- Промокод невалідний

**Expected Result:**

- Помилка валідації
- `finalPrice` не розраховано

---

### 3.3. Відстеження використання промокодів

#### TC-PROMO-017: Збільшення usedCount при успішній оплаті

**Preconditions:**

- Промокод використано при реєстрації
- Payment completed через webhook

**Steps:**

1. Створити реєстрацію з промокодом
2. Симулювати успішний webhook
3. Перевірити, що `usedCount` збільшено на 1

**Expected Result:**

- `usedCount` збільшено
- `usageLimit` не перевищено

---

#### TC-PROMO-018: Зменшення usedCount при refund

**Preconditions:**

- Промокод використано
- Payment completed
- Виконано refund

**Steps:**

1. Створити реєстрацію з промокодом
2. Завершити оплату
3. Виконати refund
4. Перевірити, що `usedCount` зменшено на 1

**Expected Result:**

- `usedCount` зменшено
- `usedCount` не може бути < 0

---

#### TC-PROMO-019: usedCount не збільшується при failed payment

**Preconditions:**

- Промокод використано при реєстрації
- Payment failed через webhook

**Expected Result:**

- `usedCount` не змінюється
- Промокод можна використати знову

---

#### TC-PROMO-020: usedCount не збільшується при pending payment

**Preconditions:**

- Промокод використано при реєстрації
- Payment залишається pending

**Expected Result:**

- `usedCount` не змінюється
- Промокод "зарезервовано" до завершення оплати

---

## 4. Інтеграційні тест-кейси

### 4.1. Повний flow реєстрації та оплати

#### TC-INT-001: Повний успішний flow з промокодом

**Steps:**

1. Створити подію з `basePrice = 1000`, `capacity = 10`
2. Створити промокод: `DISCOUNT20`, `discountType = 'percentage'`, `discountValue = 20`, `usageLimit = 5`
3. Створити реєстрацію з промокодом
4. Перевірити, що `finalPrice = 800`
5. Перевірити, що `registeredCount = 1`
6. Перевірити, що `usedCount = 0` (ще не збільшено)
7. Симулювати успішний webhook
8. Перевірити, що `paymentStatus = 'completed'`
9. Перевірити, що `registrationStatus = 'confirmed'`
10. Перевірити, що `usedCount = 1`
11. Перевірити, що email з підтвердженням надіслано

**Expected Result:**

- Весь flow виконано успішно
- Всі статуси оновлено
- Промокод використано

---

#### TC-INT-002: Flow з невдалою оплатою та повторною спробою

**Steps:**

1. Створити реєстрацію
2. Симулювати failed webhook
3. Перевірити, що `paymentStatus = 'failed'`
4. Перевірити, що `registeredCount` не зменшено
5. Створити нову реєстрацію з тим самим email
6. Перевірити, що створено новий payment
7. Симулювати успішний webhook
8. Перевірити, що все завершено успішно

**Expected Result:**

- Failed payment не впливає на capacity
- Можна спробувати знову
- Друга спроба успішна

---

#### TC-INT-003: Flow з pending payment та відновленням

**Steps:**

1. Створити реєстрацію
2. Перевірити, що paymentLink створено
3. Симулювати закриття payment page користувачем
4. Надіслати запит на отримання payment link
5. Перевірити, що payment link повернуто
6. Симулювати успішний webhook
7. Перевірити, що все завершено

**Expected Result:**

- Payment link можна отримати повторно
- Email надіслано повторно при повторній реєстрації

---

#### TC-INT-004: Flow з досягненням capacity під час реєстрації

**Steps:**

1. Створити подію з `capacity = 2`
2. Створити 2 реєстрації (заповнити capacity)
3. Спробувати створити 3-ю реєстрацію
4. Перевірити помилку `409 Conflict`

**Expected Result:**

- Capacity перевіряється перед створенням реєстрації
- Помилка повертається коректно

---

#### TC-INT-005: Flow з одночасними реєстраціями (race condition)

**Steps:**

1. Створити подію з `capacity = 1`
2. Одночасно надіслати 2 запити на реєстрацію
3. Перевірити, що тільки одна реєстрація успішна
4. Перевірити, що друга отримала помилку `409 Conflict`

**Expected Result:**

- Транзакції запобігають race condition
- Тільки одна реєстрація успішна

---

#### TC-INT-006: Flow з refund та відновленням capacity

**Steps:**

1. Створити реєстрацію та завершити оплату
2. Перевірити, що `registeredCount = 1`
3. Виконати refund
4. Перевірити, що `registeredCount = 0`
5. Перевірити, що можна створити нову реєстрацію

**Expected Result:**

- Capacity відновлено
- Можна зареєструватися знову

---

### 4.2. Edge cases

#### TC-EDGE-001: Реєстрація з порожнім промокодом

**Test Data:**

```json
{
  "promoCode": ""
}
```

**Expected Result:**

- Промокод ігнорується
- Ціна розраховується без знижки

---

#### TC-EDGE-002: Реєстрація з пробілами в промокоді

**Test Data:**

```json
{
  "promoCode": "   "
}
```

**Expected Result:**

- Промокод ігнорується або валідація повертає помилку

---

#### TC-EDGE-003: Реєстрація з email, що містить пробіли

**Test Data:**

```json
{
  "email": "  test@example.com  "
}
```

**Expected Result:**

- Email нормалізується (trim, lowercase)
- Реєстрація успішна

---

#### TC-EDGE-004: Реєстрація з спеціальними символами в імені

**Test Data:**

```json
{
  "name": "Іван-Марія",
  "surname": "О'Коннор"
}
```

**Expected Result:**

- Імена прийнято
- Реєстрація успішна

---

#### TC-EDGE-005: Реєстрація з дуже довгими опціональними полями (на межі ліміту)

**Test Data:**

```json
{
  "runningClub": "А".repeat(100),
  "phone": "+3805012345678901234" // 20 символів
}
```

**Expected Result:**

- Поля прийнято
- Реєстрація успішна

---

#### TC-EDGE-006: Webhook з неочікуваними полями

**Test Data:**

```json
{
  "invoiceId": "monobank-invoice-id",
  "status": "success",
  "unknownField": "value"
}
```

**Expected Result:**

- Webhook оброблено
- Неочікувані поля ігноровані

---

#### TC-EDGE-007: Реєстрація з промокодом, який стає невалідним між валідацією та оплатою

**Preconditions:**

- Промокод валідний при реєстрації
- Промокод стає невалідним (expired/limit reached) до оплати

**Expected Result:**

- Реєстрація створена з промокодом
- Оплата проходить (промокод вже застосовано)
- Промокод не можна використати для нових реєстрацій

---

#### TC-EDGE-008: Реєстрація з нульовою ціною після знижки

**Preconditions:**

- Event `basePrice = 100`
- Промокод дає 100% знижку

**Expected Result:**

- `finalPrice = 0`
- Payment створено з `amount = 0`
- Реєстрація може бути автоматично confirmed (залежить від логіки)

---

## 5. Тест-кейси для email notifications

### 5.1. Email з payment link

#### TC-EMAIL-001: Надсилання email після створення реєстрації

**Preconditions:**

- Resend API key налаштовано
- Реєстрація створена

**Expected Result:**

- Email надіслано з payment link
- Тема: `"Завершіть вашу реєстрацію - {eventTitle}"`
- Email містить український текст
- Email містить кнопку "Завершити оплату"
- Email містить текстове посилання

---

#### TC-EMAIL-002: Повторне надсилання email при повторній реєстрації

**Preconditions:**

- Існує pending реєстрація
- Користувач реєструється знову

**Expected Result:**

- Email надіслано повторно з тим самим payment link

---

#### TC-EMAIL-003: Email не надсилається, якщо Resend API key не налаштовано

**Preconditions:**

- `RESEND_API_KEY` не налаштовано

**Expected Result:**

- Email не надіслано
- Помилка не виникає (логовано warning)
- Реєстрація створена успішно

---

### 5.2. Email з підтвердженням

#### TC-EMAIL-004: Надсилання email при успішній оплаті

**Preconditions:**

- Webhook зі статусом `success` оброблено

**Expected Result:**

- Email надіслано з підтвердженням
- Тема: `"Реєстрацію підтверджено - {eventTitle}"`
- Email містить деталі події та оплати

---

#### TC-EMAIL-005: Надсилання email при невдалій оплаті

**Preconditions:**

- Webhook зі статусом `failure` оброблено

**Expected Result:**

- Email надіслано з повідомленням про невдачу
- Тема: `"Оплата не вдалася - {eventTitle}"`
- Email містить посилання для повторної спроби

---

## 6. Тест-кейси для performance та масштабованості

### 6.1. Навантаження

#### TC-PERF-001: Множинні одночасні реєстрації

**Steps:**

1. Створити подію з `capacity = 100`
2. Надіслати 100 одночасних запитів на реєстрацію
3. Перевірити, що всі реєстрації оброблено
4. Перевірити, що `registeredCount = 100`

**Expected Result:**

- Всі реєстрації оброблено
- Capacity не перевищено
- Транзакції працюють коректно

---

#### TC-PERF-002: Множинні webhook запити

**Steps:**

1. Створити 100 реєстрацій
2. Надіслати 100 одночасних webhook запитів
3. Перевірити, що всі оброблено

**Expected Result:**

- Всі webhook оброблено
- Дані оновлено коректно

---

## 7. Тест-кейси для безпеки

### 7.1. Автентифікація та авторизація

#### TC-SEC-001: Доступ до payment status без автентифікації

**Expected Result:**

- Статус: `401 Unauthorized`

---

#### TC-SEC-002: Доступ до refund без автентифікації

**Expected Result:**

- Статус: `401 Unauthorized`

---

#### TC-SEC-003: Спроба підробки webhook підпису

**Expected Result:**

- Webhook відхилено
- Дані не оновлено

---

### 7.2. Валідація даних

#### TC-SEC-004: SQL injection спроба в полях форми

**Test Data:**

```json
{
  "name": "'; DROP TABLE registrations; --"
}
```

**Expected Result:**

- Дані екрановано
- SQL injection не виконано
- Помилка валідації (якщо невалідні символи)

---

#### TC-SEC-005: XSS спроба в полях форми

**Test Data:**

```json
{
  "name": "<script>alert('XSS')</script>"
}
```

**Expected Result:**

- Дані екрановано
- XSS не виконано

---

## 8. Чек-лист для тестування

### Перед тестуванням

- [ ] Налаштовано тестову базу даних
- [ ] Налаштовано Monobank test API key
- [ ] Налаштовано Resend API key (або перевірено, що email не надсилаються)
- [ ] Створено тестову подію з валідними даними
- [ ] Створено тестові промокоди (глобальні та event-specific)

### Після тестування

- [ ] Перевірено, що всі транзакції виконано коректно
- [ ] Перевірено, що capacity не перевищено
- [ ] Перевірено, що промокоди використано коректно
- [ ] Перевірено, що email надіслано (якщо налаштовано)
- [ ] Перевірено логи на відсутність помилок

---

## Примітки

1. **Тестові дані**: Всі ObjectId та UUID в прикладах є прикладовими. Використовуйте реальні ID з вашої тестової бази.

2. **Monobank API**: Для тестування webhook можна використовувати тестовий endpoint або симулювати запити.

3. **Email**: Якщо Resend API key не налаштовано, email не надсилаються, але це не впливає на функціональність реєстрації.

4. **Транзакції**: Всі операції, що змінюють capacity або promo code usage, виконуються в транзакціях для забезпечення консистентності.

5. **Idempotency**: Webhook обробка є ідемпотентною - повторні запити з тими самими даними не змінюють результат.
