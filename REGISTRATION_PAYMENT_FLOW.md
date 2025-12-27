# Registration, Payment, and Promo Code Flow Documentation

## Overview

This document describes the complete flow of event registration, payment processing, and promo code integration in the application. It covers data models, validation rules, state transitions, and the interaction between all three systems.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Data Models](#data-models)
3. [Registration Flow](#registration-flow)
4. [Payment Flow](#payment-flow)
5. [Promo Code Integration](#promo-code-integration)
6. [Complete End-to-End Flow](#complete-end-to-end-flow)
7. [Validation Rules](#validation-rules)
8. [State Transitions](#state-transitions)
9. [Transaction Safety](#transaction-safety)
10. [Error Handling](#error-handling)
11. [API Endpoints](#api-endpoints)

---

## System Architecture

The system consists of three main components that work together:

```
┌─────────────┐
│ Registration│
└──────┬──────┘
       │
       ├───► Promo Code (optional)
       │
       └───► Payment
             │
             └───► Monobank (Payment Gateway)
```

### Component Relationships

- **Registration**: Core entity that tracks participant information and status
- **Payment**: Linked to registration, tracks payment status and gateway integration
- **Promo Code**: Optional discount applied during registration, usage tracked after payment

---

## Data Models

### Registration Model

**File**: `src/models/Registration.ts`

```typescript
interface IRegistration {
  _id: ObjectId;
  eventId: ObjectId; // Required: Event reference
  userId?: ObjectId; // Optional: For authenticated users
  name?: string; // Required for public registration
  surname?: string; // Required for public registration
  email?: string; // Required for public registration
  city?: string; // Required for public registration
  runningClub?: string; // Optional
  phone?: string; // Optional
  promoCode?: string; // Optional: Code string (uppercase)
  promoCodeId?: ObjectId; // Optional: Reference to PromoCode
  status: 'pending' | 'confirmed' | 'cancelled';
  registeredAt: Date;
  paymentStatus: 'pending' | 'completed' | 'failed';
  paymentId?: string; // Reference to Payment._id
  finalPrice?: number; // Price after promo code discount
  createdAt: Date;
  updatedAt: Date;
}
```

**Key Constraints**:

- Unique constraint: `(eventId, userId)` for authenticated users
- Unique constraint: `(eventId, email)` for public registrations
- `finalPrice` must be >= 0

**Indexes**:

- `{ eventId: 1, userId: 1 }` (unique, partial)
- `{ eventId: 1, email: 1 }` (unique, partial)
- `{ eventId: 1 }`
- `{ userId: 1 }`
- `{ status: 1 }`
- `{ paymentStatus: 1 }`
- `{ promoCodeId: 1 }`

### Payment Model

**File**: `src/models/Payment.ts`

```typescript
interface IPayment {
  _id: ObjectId;
  registrationId: ObjectId; // Required: Reference to Registration
  amount: number; // Required: Payment amount (>= 0)
  currency: string; // Default: 'UAH'
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  plataMonoInvoiceId?: string; // Monobank invoice ID
  plataMonoPaymentId?: string; // Monobank payment ID
  paymentLink?: string; // URL for user to complete payment
  webhookData?: Record<string, unknown>; // Raw webhook payload
  createdAt: Date;
  updatedAt: Date;
}
```

**Key Constraints**:

- `amount` must be >= 0
- `currency` defaults to 'UAH'

**Indexes**:

- `{ registrationId: 1 }`
- `{ plataMonoInvoiceId: 1 }`
- `{ status: 1 }`

### Promo Code Model

**File**: `src/models/PromoCode.ts`

```typescript
interface IPromoCode {
  _id: ObjectId;
  code: string; // Required: Unique, uppercase, max 50 chars
  discountType: 'percentage' | 'amount';
  discountValue: number; // Required: > 0
  usageLimit: number; // Required: >= 1
  usedCount: number; // Default: 0, >= 0
  isActive: boolean; // Default: true
  expirationDate?: Date; // Optional expiration
  eventId?: ObjectId; // Optional: Event-specific code
  createdAt: Date;
  updatedAt: Date;
}
```

**Key Constraints**:

- `code` must be unique
- `discountValue` must be > 0
- `usageLimit` must be >= 1
- `usedCount` must be >= 0

**Indexes**:

- `{ code: 1 }` (unique)
- `{ isActive: 1 }`
- `{ eventId: 1 }`

---

## Registration Flow

### Public Registration (No Authentication)

**Endpoint**: `POST /api/registrations`

**Flow Steps**:

1. **Input Validation**
   - Validate required fields: `eventId`, `name`, `surname`, `email`, `city`
   - Validate optional fields: `runningClub`, `phone`, `promoCode`
   - Email format validation
   - Phone format validation (if provided)

2. **Event Validation**
   - Resolve event ID (supports UUID or ObjectId, falls back to configured single event)
   - Verify event exists
   - Check event has available capacity (`registeredCount < capacity`)
   - Event date must be in the future (enforced at event creation)

3. **Duplicate Prevention**
   - Check if email already registered for this event
   - If duplicate found, throw `ConflictError`

4. **Promo Code Processing** (if provided)
   - Normalize code (uppercase, trim)
   - Validate promo code (see [Promo Code Validation](#promo-code-validation))
   - Calculate final price using `calculatePrice()` utility

5. **Price Calculation**
   - Get base price from event (`event.basePrice`) or config (`eventConfig.basePrice`)
   - If no base price configured, throw `ConflictError`
   - Apply promo code discount if valid
   - Store `finalPrice` in registration

6. **Create Registration** (within transaction)
   - Create registration with status `'pending'`
   - Set `paymentStatus` to `'pending'`
   - Store promo code string and reference (if applicable)

7. **Create Payment** (within same transaction)
   - Create payment record with status `'pending'`
   - Call Monobank API to create invoice
   - Store `plataMonoInvoiceId` and `paymentLink`
   - Link payment to registration via `paymentId`

8. **Transaction Commit**
   - All database operations succeed or fail together
   - Return registration and payment link

**Response**:

```json
{
  "success": true,
  "data": {
    "registration": {
      "id": "...",
      "eventId": "...",
      "name": "John",
      "surname": "Doe",
      "email": "john@example.com",
      "city": "Kyiv",
      "promoCode": "DISCOUNT10",
      "finalPrice": 900,
      "status": "pending",
      "paymentStatus": "pending"
    },
    "paymentLink": "https://pay.monobank.ua/..."
  }
}
```

### Authenticated Registration

**Endpoint**: `POST /api/registrations` (with authentication)

**Differences from Public Registration**:

- Uses `userId` from authenticated user
- No need for `name`, `surname`, `email`, `city` (can be retrieved from user profile)
- Still supports promo codes
- Registration status starts as `'confirmed'` (immediate confirmation)
- Payment status starts as `'completed'` (assumed paid)
- Event `registeredCount` is incremented immediately

---

## Payment Flow

### Payment Creation

**Triggered During**: Registration creation

**Process**:

1. **Payment Record Creation**
   - Amount: `finalPrice` from registration
   - Currency: From config (default: 'UAH')
   - Status: `'pending'`
   - Linked to registration via `registrationId`

2. **Monobank Invoice Creation**
   - API Endpoint: `https://api.monobank.ua/api/merchant/invoice/create`
   - Method: `POST`
   - Headers: `X-Token: {plataApiKey}`
   - Documentation: [Monobank API Docs](https://monobank.ua/api-docs/acquiring/methods/ia/post--api--merchant--invoice--create)
   - Body:
     ```json
     {
       "amount": 90000, // in kopiykas (finalPrice * 100)
       "ccy": 980, // ISO 4217 code for UAH
       "merchantPaymInfo": {}, // Required for PPRO integration
       "redirectUrl": "{frontendConfig.successUrl}?registrationId={id}",
       "successUrl": "{frontendConfig.successUrl}?registrationId={id}",
       "failUrl": "{frontendConfig.failureUrl}?registrationId={id}",
       "webHookUrl": "{webhookUrl}",
       "merchantData": {
         "registrationId": "{id}"
       }
     }
     ```

3. **Store Payment Link**
   - Save `plataMonoInvoiceId` from response
   - Save `paymentLink` (pageUrl/invoiceUrl) from response
   - Return payment link to user

### Payment Status Updates

**Webhook Endpoint**: `POST /api/webhooks/plata-mono`

**Webhook Validation**:

1. Verify ECDSA signature using public key (if `plataWebhookPublicKey` configured)
   - Header: `X-Sign` (base64-encoded ECDSA signature)
   - Algorithm: ECDSA with SHA256
   - Public key: Base64-encoded, obtained from `/api/merchant/pubkey` or configured in env
   - Documentation: [Monobank Webhook Verification](https://monobank.ua/api-docs/acquiring/dev/webhooks/verify)
2. Validate payload structure using Zod schema
3. Extract `invoiceId` from payload

**Webhook Payload Schema**:

```typescript
{
  invoiceId: string;              // Required
  status?: 'created' | 'processing' | 'success' | 'failure' | 'expired' | 'hold';
  failureReason?: string;
  amount?: number;
  ccy?: number;
  finalAmount?: number;
  createdDate?: string;
  modifiedDate?: string;
  reference?: string;
  paymentId?: string;
  merchantData?: {
    registrationId?: string;
    customerName?: string;
    eventTitle?: string;
  };
  cancelList?: unknown[];
}
```

**Note**: Only `status === 'success'` triggers payment completion. Other statuses (`created`, `processing`, `hold`) are intermediate states.

**Payment Success Flow**:

1. **Find Payment**
   - Lookup payment by `plataMonoInvoiceId`
   - If not found, return 404

2. **Update Payment Status** (within transaction)
   - Set payment `status` to `'completed'`
   - Store `plataMonoPaymentId` if provided
   - Store `webhookData` for audit

3. **Update Registration** (within same transaction)
   - Set registration `status` to `'confirmed'`
   - Set registration `paymentStatus` to `'completed'`

4. **Update Event** (within same transaction)
   - Increment `event.registeredCount` by 1
   - Uses `$inc` operator for atomic increment

5. **Increment Promo Code Usage** (within same transaction)
   - If `registration.promoCodeId` exists
   - Atomically increment `promoCode.usedCount` by 1
   - Uses `$inc` operator

6. **Send Confirmation Email** (async, non-blocking)
   - Send registration confirmation email
   - Include event details and payment amount

7. **Transaction Commit**
   - All updates succeed or fail together

**Payment Failure Flow**:

1. **Update Payment Status** (within transaction)
   - Set payment `status` to `'failed'`
   - Store `webhookData`

2. **Update Registration** (within same transaction)
   - Set registration `status` to `'pending'` (allows retry)
   - Set registration `paymentStatus` to `'failed'`

3. **Send Failure Email** (async, non-blocking)
   - Send payment failure notification
   - Include retry link

4. **Transaction Commit**

**Important**: Event capacity is NOT incremented on payment failure, allowing user to retry payment.

---

## Promo Code Integration

### Promo Code Validation

**Service**: `PromoCodesService.validate()`

**Validation Steps** (in order):

1. **Code Normalization**
   - Convert to uppercase
   - Trim whitespace

2. **Code Existence**
   - Lookup code in database
   - If not found → `ValidationError: "Invalid or expired promo code"`

3. **Active Status**
   - Check `isActive === true`
   - If inactive → `ValidationError: "Invalid or expired promo code"`

4. **Usage Limit**
   - Check `usedCount < usageLimit`
   - If limit reached → `ValidationError: "Promo code usage limit reached"`

5. **Expiration Date**
   - If `expirationDate` exists, check it's in the future
   - If expired → `ValidationError: "Promo code has expired"`

6. **Event Matching**
   - If both `promoCode.eventId` and `eventId` parameter provided:
     - Both must be valid ObjectIds
     - They must match exactly
   - If `promoCode.eventId` exists but doesn't match → `ValidationError: "Promo code is not valid for this event"`
   - If `promoCode.eventId` is null, code is global (valid for all events)

**Return**: Validated `IPromoCode` object

### Price Calculation

**Utility**: `src/utils/pricing.util.ts`

**Function**: `calculatePrice(basePrice: number, promoCode?: IPromoCode | null)`

**Logic**:

1. **No Promo Code or Inactive**

   ```typescript
   return { finalPrice: basePrice, discountAmount: 0 };
   ```

2. **Percentage Discount**

   ```typescript
   discountAmount = (basePrice * discountValue) / 100;
   finalPrice = basePrice - discountAmount;
   ```

3. **Amount Discount**

   ```typescript
   discountAmount = discountValue;
   finalPrice = basePrice - discountAmount;
   ```

4. **Minimum Price Protection**
   ```typescript
   finalPrice = Math.max(0, finalPrice); // Never negative
   ```

**Return**: `{ finalPrice: number, discountAmount: number }`

### Promo Code Usage Tracking

**When Usage is Incremented**:

- Only after successful payment completion
- Within the same database transaction as payment confirmation
- Atomic operation using MongoDB `$inc` operator

**Service Method**: `PromoCodesService.incrementUsage()`

```typescript
await PromoCode.updateOne({ _id: promoCodeId }, { $inc: { usedCount: 1 } }, { session });
```

**Important**: Usage is NOT incremented during:

- Code validation
- Registration creation
- Payment creation
- Payment failure

---

## Complete End-to-End Flow

### Scenario: User Registers with Promo Code

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User Submits Registration                                │
│    POST /api/registrations                                  │
│    { eventId, name, surname, email, city, promoCode }      │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Validate Input                                          │
│    - Required fields present                                │
│    - Email format valid                                     │
│    - Phone format valid (if provided)                      │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Validate Event                                           │
│    - Event exists                                           │
│    - Event has capacity                                     │
│    - No duplicate registration (by email)                  │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Validate Promo Code (if provided)                        │
│    - Code exists and is active                              │
│    - Usage limit not reached                                │
│    - Not expired                                            │
│    - Valid for this event (if event-specific)               │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Calculate Price                                          │
│    - Get basePrice from event or config                     │
│    - Apply promo code discount                              │
│    - Calculate finalPrice                                   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Create Registration & Payment (Transaction)             │
│    - Create registration (status: pending)                  │
│    - Create payment (status: pending)                        │
│    - Call Monobank API to create invoice                    │
│    - Link payment to registration                           │
│    - Commit transaction                                     │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Return Response                                         │
│    - Registration details                                   │
│    - Payment link                                           │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. User Completes Payment                                  │
│    - Redirected to Monobank payment page                   │
│    - Completes payment                                      │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 9. Monobank Sends Webhook                                  │
│    POST /api/webhooks/plata-mono                           │
│    { invoiceId, status: 'success', paymentId }             │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 10. Process Webhook (Transaction)                          │
│     - Verify webhook signature                             │
│     - Find payment by invoiceId                             │
│     - Update payment status: completed                      │
│     - Update registration status: confirmed                │
│     - Update registration paymentStatus: completed         │
│     - Increment event.registeredCount                       │
│     - Increment promoCode.usedCount (if applicable)         │
│     - Commit transaction                                    │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 11. Send Confirmation Email (Async)                        │
│     - Registration confirmed                                │
│     - Event details                                         │
│     - Payment amount                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Validation Rules

### Registration Validation

**Public Registration Required Fields**:

- `eventId`: Must be valid ObjectId or UUID
- `name`: 2-50 characters
- `surname`: 2-50 characters
- `email`: Valid email format, lowercase, unique per event
- `city`: 2-100 characters

**Public Registration Optional Fields**:

- `runningClub`: Max 100 characters
- `phone`: Max 20 characters, format: `+?[\d\s-()]+`
- `promoCode`: Max 50 characters (normalized to uppercase)

**Business Rules**:

- Event must exist
- Event must have available capacity
- Email must be unique per event
- Event date must be in the future (enforced at event creation)

### Payment Validation

**Payment Creation**:

- `amount` must be >= 0
- `currency` defaults to 'UAH'
- `registrationId` must reference valid registration

**Webhook Validation**:

- ECDSA signature verification using public key (if `plataWebhookPublicKey` configured)
- Header `X-Sign` contains base64-encoded ECDSA signature
- Public key can be obtained from `GET /api/merchant/pubkey` or configured in env
- `invoiceId` must be present
- `status` can be: 'created', 'processing', 'success', 'failure', 'expired', 'hold'

### Promo Code Validation

See [Promo Code Validation](#promo-code-validation) section above.

**Additional Rules**:

- Code is case-insensitive (normalized to uppercase)
- Code is trimmed of whitespace
- Event-specific codes must match event exactly
- Global codes (no eventId) work for all events

---

## State Transitions

### Registration Status

```
pending ──[payment completed]──► confirmed
  │
  └──[user cancels]──► cancelled
```

**States**:

- `pending`: Initial state, waiting for payment
- `confirmed`: Payment completed, registration active
- `cancelled`: User cancelled registration

**Transitions**:

- `pending → confirmed`: Payment webhook with status 'success'
- `pending → cancelled`: User-initiated cancellation (authenticated only)

### Payment Status

```
pending ──[webhook: success]──► completed
  │
  └──[webhook: failure]──► failed
```

**States**:

- `pending`: Payment created, awaiting completion
- `completed`: Payment successfully processed
- `failed`: Payment failed or declined
- `refunded`: Payment refunded (future state)

**Transitions**:

- `pending → completed`: Webhook with status 'success'
- `pending → failed`: Webhook with status 'failure'

### Promo Code Usage

```
unused ──[payment completed]──► used (usedCount++)
```

**Tracking**:

- `usedCount` starts at 0
- Incremented atomically when payment completes
- Cannot exceed `usageLimit`

---

## Transaction Safety

### Critical Operations in Transactions

All operations that modify multiple documents are wrapped in MongoDB transactions:

1. **Registration Creation**
   - Registration creation
   - Payment creation
   - Plata invoice creation (external, but payment record created in transaction)

2. **Payment Completion**
   - Payment status update
   - Registration status update
   - Event capacity increment
   - Promo code usage increment

3. **Payment Failure**
   - Payment status update
   - Registration status update

### Transaction Guarantees

- **Atomicity**: All operations succeed or all fail
- **Consistency**: Database state remains consistent
- **Isolation**: Concurrent transactions don't interfere
- **Durability**: Committed changes are permanent

### Race Condition Prevention

1. **Event Capacity**
   - Uses MongoDB `$inc` operator (atomic)
   - Checked before registration creation
   - Incremented only on successful payment

2. **Promo Code Usage**
   - Uses MongoDB `$inc` operator (atomic)
   - Validated before registration
   - Incremented only on successful payment

3. **Duplicate Registration**
   - Unique indexes prevent duplicates
   - Checked within transaction

---

## Error Handling

### Error Types

**ValidationError**:

- Invalid input data
- Business rule violations
- Promo code validation failures

**NotFoundError**:

- Event not found
- Registration not found
- Payment not found
- Promo code not found

**ConflictError**:

- Event at capacity
- Duplicate registration
- Event price not configured
- Cannot register for past events

**ForbiddenError**:

- Unauthorized access
- Not event organizer

**AppError**:

- External API failures (Monobank)
- Configuration errors

### Error Response Format

```json
{
  "success": false,
  "error": {
    "message": "Error message",
    "errors": {
      "field": ["Field-specific error message"]
    }
  }
}
```

### Webhook Error Handling

- Invalid signature → 400 Bad Request
- Payment not found → 404 Not Found
- Processing failure → 500 Internal Server Error
- Always returns 200 on webhook receipt (to prevent retries)

---

## API Endpoints

### Registration Endpoints

**Public Registration**

- `POST /api/registrations`
- No authentication required
- Creates pending registration with payment link

**Authenticated Registration**

- `POST /api/registrations` (with auth token)
- Creates confirmed registration immediately

**Get My Registrations**

- `GET /api/registrations/my`
- Requires authentication
- Returns user's registrations

**Cancel Registration**

- `DELETE /api/registrations/:id`
- Requires authentication
- Only for authenticated registrations

### Payment Endpoints

**Webhook Handler**

- `POST /api/webhooks/plata-mono`
- Receives payment status updates from Monobank
- Validates signature and processes payment

### Promo Code Endpoints

**Validate Promo Code**

- `POST /api/promo-codes/validate`
- Rate limited: 10 requests/minute
- Returns promo code details if valid

---

## Key Implementation Files

### Models

- `src/models/Registration.ts` - Registration schema
- `src/models/Payment.ts` - Payment schema
- `src/models/PromoCode.ts` - Promo code schema

### Services

- `src/services/registrations.service.ts` - Registration business logic
- `src/services/payments.service.ts` - Payment processing
- `src/services/promoCodes.service.ts` - Promo code validation

### Controllers

- `src/controllers/registrations.controller.ts` - Registration endpoints
- `src/controllers/webhooks.controller.ts` - Payment webhook handler
- `src/controllers/promoCodes.controller.ts` - Promo code endpoints

### Utilities

- `src/utils/pricing.util.ts` - Price calculation logic

### Validators

- `src/validators/registrations.validator.ts` - Registration input validation
- `src/validators/webhooks.validator.ts` - Webhook payload validation
- `src/validators/promoCodes.validator.ts` - Promo code input validation

---

## Best Practices

1. **Always use transactions** for multi-document operations
2. **Validate promo codes** before creating registration
3. **Increment usage only** after successful payment
4. **Handle webhook failures** gracefully (log, don't crash)
5. **Use atomic operations** (`$inc`) for counters
6. **Check capacity** before allowing registration
7. **Prevent duplicates** using unique indexes
8. **Store both code string and ID** for promo codes
9. **Send emails asynchronously** to avoid blocking
10. **Validate webhook signatures** for security

---

## Security Considerations

1. **Webhook Signature Verification**: ECDSA signature validation using public key from Monobank
2. **Rate Limiting**: Promo code validation endpoint rate limited
3. **Input Validation**: All inputs validated using Zod schemas
4. **Transaction Safety**: Critical operations use database transactions
5. **Unique Constraints**: Prevent duplicate registrations
6. **Email Uniqueness**: One registration per email per event

---

## Future Enhancements

Potential improvements:

- Payment retry mechanism
- Refund processing
- Partial payments
- Payment method selection
- Multiple promo codes per registration
- User-specific promo codes
- Promo code analytics
- Payment status polling (fallback for webhooks)
- Admin dashboard for managing registrations and payments
