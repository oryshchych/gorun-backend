# Налаштування Google логіну (Google Cloud) для GoRun backend

Операційна інструкція: що зробити в Google Cloud Console і як узгодити URL з бекендом (`src/services/auth/auth.oauth.service.ts`, `src/config/env.ts`).

## Як це працює в цьому проєкті

1. Користувач на фронті переходить на **`GET /api/auth/google?redirect_uri=...`** (повний URL сторінки callback на фронті, URL-encoded).
2. Бекенд перевіряє `redirect_uri` проти whitelist (`FRONTEND_URL` / `FRONTEND_OAUTH_REDIRECT_ORIGINS`).
3. Браузер отримує **302** на `accounts.google.com` з `state` (CSRF).
4. Google після логіну редіректить на **бекенд** **`/api/auth/google/callback`** з `code` та `state`.
5. Бекенд обмінює `code` на токени Google (використовується `client_secret` лише на сервері), створює/знаходить користувача, видає **одноразовий `code`** і редіректить на **фронтовий** `redirect_uri?code=...`.
6. Фронт викликає **`POST /api/auth/oauth/exchange`** з `{ "code": "..." }` і отримує той самий JSON, що й після логіну: `user`, `accessToken`, `refreshToken`.

**Важливо:** у Google Cloud у **Authorized redirect URIs** вказується **тільки URL callback бекенду**, наприклад `https://api.example.com/api/auth/google/callback`. URL фронту в Google **не** реєструється — він передається як query `redirect_uri` і контролюється бекендом.

Запитувані OAuth scopes у коді: **`openid email profile`**.

---

## Чекліст Google Cloud Console

### 1. Проєкт і OAuth consent screen

- [ ] Увійти в [Google Cloud Console](https://console.cloud.google.com/).
- [ ] Створити або обрати **Project**.
- [ ] Меню **APIs & Services → OAuth consent screen**.
- [ ] Тип: **External** (публічний доступ) або **Internal** (лише Google Workspace організація).
- [ ] Заповнити обов’язкові поля: назва застосунку, support email, developer contact.
- [ ] Scopes: достатньо для входу з email та профілем (узгодити з `openid email profile`).
- [ ] Якщо статус **Testing**: додати **Test users** (email тих, хто може логінитись), інакше інші користувачі отримають помилку до публікації.
- [ ] Для продакшену: за потреби пройти **Google verification** (залежить від політик і scope).

### 2. OAuth 2.0 Client ID (Web application)

- [ ] **APIs & Services → Credentials → Create credentials → OAuth client ID**.
- [ ] Application type: **Web application**.
- [ ] **Authorized JavaScript origins** (за потреби UI): наприклад `http://localhost:5000` (бекенд у деві) або origin продакшен API.
- [ ] **Authorized redirect URIs** — строго один (або кілька для dev/prod) **бекенд callback**:
  - Локально: `http://localhost:5000/api/auth/google/callback` (порт як у `PORT` у `.env`).
  - Продакшен: `https://<your-api-host>/api/auth/google/callback`.
- [ ] Зберегти та скопіювати **Client ID** і **Client secret**.

### 3. APIs

- [ ] Для `openid` / `email` / `profile` зазвичай не потрібно окремо вмикати застарілі API. Якщо консоль або помилка OAuth вимагає увімкнути конкретний API — зробити за підказкою Google.

### 4. Змінні середовища бекенду

Скопіюйте значення в `.env` (див. `.env.example`):

| Змінна                      | Зміст                                                                                           |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`          | Client ID з Credentials                                                                         |
| `GOOGLE_CLIENT_SECRET`      | Client secret                                                                                   |
| `GOOGLE_OAUTH_REDIRECT_URI` | **Точна копія** URI з **Authorized redirect URIs** (протокол, хост, порт, шлях без зайвого `/`) |

Додатково:

| Змінна                            | Зміст                                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| `FRONTEND_URL`                    | Базовий URL фронту; його **origin** потрапляє в whitelist за замовчуванням                       |
| `FRONTEND_OAUTH_REDIRECT_ORIGINS` | Через кому **origins** додаткових фронтів (staging тощо), якщо callback не лише з `FRONTEND_URL` |

### 5. Ручна перевірка (smoke)

1. Запустіть бекенд і MongoDB.
2. Переконайтесь, що три змінні `GOOGLE_*` задані; інакше `GET /api/auth/google` поверне **503**.
3. Відкрийте в браузері (підставте свої URL):

   ```text
   http://localhost:5000/api/auth/google?redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fuk%2Fauth%2Fcallback
   ```

   `redirect_uri` має бути **повним URL** сторінки фронту після OAuth, дозволеним whitelist.

4. Після входу в Google очікується редірект на фронт з `?code=...` (одноразовий код).
5. Викличте:

   ```bash
   curl -s -X POST http://localhost:5000/api/auth/oauth/exchange \
     -H "Content-Type: application/json" \
     -d '{"code":"PASTE_CODE_FROM_URL"}'
   ```

   У відповіді мають бути `success`, `data.user`, `data.accessToken`, `data.refreshToken`.

### 6. Типові помилки

| Симптом                              | Що перевірити                                                                                        |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `redirect_uri_mismatch`              | URI в Google Console **ідентичний** `GOOGLE_OAUTH_REDIRECT_URI`; той самий http/https і порт         |
| Доступ заборонено для акаунта        | Режим Testing — додати користувача в Test users                                                      |
| `503` Google OAuth is not configured | Заповнити `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`                    |
| `400 redirect_uri is not allowed`    | Фронтовий `redirect_uri` не з whitelist — оновити `FRONTEND_URL` / `FRONTEND_OAUTH_REDIRECT_ORIGINS` |

---

## Короткий підсумок

У Google Cloud: **OAuth consent screen** + **OAuth 2.0 Web client** з **Authorized redirect URI лише на бекенд** (`…/api/auth/google/callback`). У `.env`: Client ID/Secret і той самий redirect URI. Фронтові return URL не реєструються в Google — їх дозволяє бекенд і передають як `redirect_uri` при старті логіну.
