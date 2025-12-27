# Promo Codes Documentation

## Overview

The promo code system allows users to apply discounts when registering for events. Promo codes can be either percentage-based or fixed-amount discounts, and can be configured to be event-specific or globally applicable. The system includes comprehensive validation, usage tracking, and rate limiting to prevent abuse.

## Table of Contents

1. [Data Model](#data-model)
2. [Validation Rules](#validation-rules)
3. [API Endpoints](#api-endpoints)
4. [Integration with Registrations](#integration-with-registrations)
5. [Price Calculation](#price-calculation)
6. [Usage Tracking](#usage-tracking)
7. [Rate Limiting](#rate-limiting)
8. [Examples](#examples)

---

## Data Model

### PromoCode Schema

The `PromoCode` model is defined in `src/models/PromoCode.ts` with the following structure:

```typescript
interface IPromoCode {
  _id: mongoose.Types.ObjectId;
  code: string; // Unique promo code (uppercase, max 50 chars)
  discountType: 'percentage' | 'amount';
  discountValue: number; // Discount value (percentage or fixed amount)
  usageLimit: number; // Maximum number of times code can be used
  usedCount: number; // Current usage count (default: 0)
  isActive: boolean; // Whether code is active (default: true)
  expirationDate?: Date; // Optional expiration date
  eventId?: mongoose.Types.ObjectId; // Optional event-specific code
  createdAt: Date;
  updatedAt: Date;
}
```

### Field Details

- **code**:
  - Must be unique across all promo codes
  - Automatically converted to uppercase
  - Trimmed of whitespace
  - Maximum length: 50 characters
  - Indexed for fast lookups

- **discountType**:
  - `'percentage'`: Discount is a percentage of the base price
  - `'amount'`: Discount is a fixed amount in the currency

- **discountValue**:
  - For percentage: value between 0-100 (e.g., 10 = 10% off)
  - For amount: fixed discount amount (e.g., 150 = 150 UAH off)
  - Must be greater than 0

- **usageLimit**:
  - Minimum value: 1
  - Defines how many times the code can be redeemed

- **usedCount**:
  - Tracks current usage
  - Automatically incremented when payment is completed
  - Cannot be negative

- **isActive**:
  - Controls whether the code can be used
  - Inactive codes are rejected during validation

- **expirationDate**:
  - Optional date when the code expires
  - Codes are automatically invalidated after this date

- **eventId**:
  - Optional reference to a specific event
  - If set, code can only be used for that event
  - If not set, code is valid for all events

### Database Indexes

The following indexes are created for performance:

- `{ code: 1 }` - Unique index for fast code lookups
- `{ isActive: 1 }` - Index for filtering active codes
- `{ eventId: 1 }` - Index for event-specific code queries

---

## Validation Rules

Promo codes are validated through the `PromoCodesService.validate()` method with the following checks (in order):

1. **Code Existence**: The code must exist in the database
2. **Active Status**: The code must have `isActive: true`
3. **Usage Limit**: `usedCount` must be less than `usageLimit`
4. **Expiration**: If `expirationDate` is set, it must be in the future
5. **Event Matching**: If both `promoCode.eventId` and `eventId` parameter are provided, they must match

### Validation Errors

All validation errors return a `ValidationError` with the following messages:

- `"Invalid or expired promo code"` - Code doesn't exist or is inactive
- `"Promo code usage limit reached"` - Code has been used maximum times
- `"Promo code has expired"` - Code's expiration date has passed
- `"Promo code is not valid for this event"` - Code is event-specific and doesn't match

### Code Normalization

Promo codes are automatically normalized during validation:

- Converted to uppercase
- Trimmed of leading/trailing whitespace

This ensures `"discount10"`, `"DISCOUNT10"`, and `"  discount10  "` are all treated as the same code.

---

## API Endpoints

### Base Path

All promo code endpoints are prefixed with `/api/promo-codes`

### Validate Promo Code

**Endpoint**: `POST /api/promo-codes/validate`

**Description**: Validates a promo code and returns discount information if valid.

**Rate Limiting**: 10 requests per minute per IP address

**Request Body**:

```json
{
  "code": "DISCOUNT10",
  "eventId": "optional-event-id"
}
```

**Request Validation**:

- `code`: Required, string, 1-50 characters (automatically uppercased and trimmed)
- `eventId`: Optional, must be valid MongoDB ObjectId or UUID format

**Success Response** (200):

```json
{
  "success": true,
  "data": {
    "code": "DISCOUNT10",
    "discountType": "percentage",
    "discountValue": 10,
    "isValid": true
  }
}
```

**Error Responses**:

- **400 Bad Request**: Validation error (invalid request format)
- **429 Too Many Requests**: Rate limit exceeded
- **422 Unprocessable Entity**: Validation error (invalid promo code)

**Example Error Response**:

```json
{
  "success": false,
  "error": {
    "message": "Validation error",
    "errors": {
      "promoCode": ["Promo code usage limit reached"]
    }
  }
}
```

---

## Integration with Registrations

### Registration Flow

Promo codes are integrated into the event registration process:

1. **During Registration**: Users can optionally provide a `promoCode` when registering
2. **Validation**: The code is validated against the event (if provided)
3. **Price Calculation**: The discount is applied to calculate `finalPrice`
4. **Storage**: Both `promoCode` (string) and `promoCodeId` (reference) are stored
5. **Usage Tracking**: Usage count is incremented only after successful payment

### Registration Model Fields

The `Registration` model includes:

```typescript
{
  promoCode?: string;           // The code string (uppercase)
  promoCodeId?: ObjectId;       // Reference to PromoCode document
  finalPrice?: number;          // Price after discount applied
}
```

### Registration Endpoints

Promo codes can be used in:

- **Public Registration**: `POST /api/registrations/public`
- **Authenticated Registration**: `POST /api/registrations` (for logged-in users)

**Request Example**:

```json
{
  "eventId": "event-id",
  "name": "John",
  "surname": "Doe",
  "email": "john@example.com",
  "city": "Kyiv",
  "promoCode": "DISCOUNT10"
}
```

### Payment Completion

When a payment is successfully completed:

1. The registration's `paymentStatus` is updated to `'completed'`
2. If `promoCodeId` exists, `promoCodesService.incrementUsage()` is called
3. The promo code's `usedCount` is incremented atomically within a database transaction
4. This ensures usage is only counted once per successful payment

**Important**: Usage is only incremented on successful payment, not during validation or registration creation.

---

## Price Calculation

Price calculation is handled by the `calculatePrice()` utility function in `src/utils/pricing.util.ts`.

### Function Signature

```typescript
calculatePrice(
  basePrice: number,
  promoCode?: IPromoCode | null
): PriceBreakdown
```

### Return Type

```typescript
interface PriceBreakdown {
  finalPrice: number; // Price after discount (never negative)
  discountAmount: number; // Amount of discount applied
}
```

### Calculation Logic

1. **No Promo Code**: Returns `{ finalPrice: basePrice, discountAmount: 0 }`

2. **Inactive Promo Code**: Treated as no promo code

3. **Percentage Discount**:

   ```
   discountAmount = (basePrice * discountValue) / 100
   finalPrice = basePrice - discountAmount
   ```

4. **Amount Discount**:

   ```
   discountAmount = discountValue
   finalPrice = basePrice - discountAmount
   ```

5. **Minimum Price**: `finalPrice` is always `Math.max(0, calculatedPrice)` to prevent negative prices

### Examples

- Base price: 1000 UAH, 10% discount → Final: 900 UAH, Discount: 100 UAH
- Base price: 1000 UAH, 150 UAH discount → Final: 850 UAH, Discount: 150 UAH
- Base price: 500 UAH, 600 UAH discount → Final: 0 UAH, Discount: 500 UAH (capped)

---

## Usage Tracking

### Incrementing Usage

Usage is tracked through the `PromoCodesService.incrementUsage()` method:

```typescript
async incrementUsage(
  promoCodeId: string,
  session?: mongoose.ClientSession
): Promise<void>
```

**Features**:

- Atomically increments `usedCount` using MongoDB's `$inc` operator
- Supports database transactions (via `session` parameter)
- Throws `NotFoundError` if promo code doesn't exist
- Only called after successful payment completion

### Usage Limit Enforcement

The validation service checks:

```typescript
if (promoCode.usedCount >= promoCode.usageLimit) {
  throw new ValidationError({ promoCode: ['Promo code usage limit reached'] });
}
```

This prevents codes from being used beyond their limit.

### Transaction Safety

Usage increment is performed within a database transaction when processing payments, ensuring:

- Atomicity: Either both payment completion and usage increment succeed, or both fail
- Consistency: Usage count always matches actual redemptions
- No double-counting: Even if multiple requests occur simultaneously

---

## Rate Limiting

The promo code validation endpoint is protected by rate limiting to prevent abuse.

### Configuration

**Rate Limiter**: `promoCodeLimiter` (defined in `src/middleware/rateLimiter.middleware.ts`)

- **Window**: 60 seconds (1 minute)
- **Max Requests**: 10 per IP address per window
- **Headers**: Standard rate limit headers included in responses

### Response Headers

When rate limited, the following headers are included:

- `RateLimit-Limit`: Maximum number of requests allowed
- `RateLimit-Remaining`: Number of requests remaining in current window
- `RateLimit-Reset`: Time when the rate limit resets (Unix timestamp)

### Error Response

**429 Too Many Requests**:

```json
{
  "success": false,
  "error": {
    "message": "Too many promo code requests, please try again in a minute"
  }
}
```

---

## Examples

### Example 1: Creating a Global Percentage Discount

```javascript
// Database document (created via admin interface or script)
{
  code: "SUMMER2024",
  discountType: "percentage",
  discountValue: 15,
  usageLimit: 100,
  usedCount: 0,
  isActive: true,
  // eventId: undefined (global code)
}
```

**Usage**:

- Base price: 1000 UAH
- Discount: 15% = 150 UAH
- Final price: 850 UAH

### Example 2: Event-Specific Fixed Amount Discount

```javascript
{
  code: "EARLYBIRD",
  discountType: "amount",
  discountValue: 200,
  usageLimit: 50,
  usedCount: 0,
  isActive: true,
  expirationDate: ISODate("2024-06-01T00:00:00Z"),
  eventId: ObjectId("507f1f77bcf86cd799439011")
}
```

**Usage**:

- Only valid for event `507f1f77bcf86cd799439011`
- Base price: 1000 UAH
- Discount: 200 UAH
- Final price: 800 UAH
- Expires on June 1, 2024

### Example 3: API Request Flow

**Step 1: Validate Promo Code**

```bash
POST /api/promo-codes/validate
Content-Type: application/json

{
  "code": "SUMMER2024",
  "eventId": "507f1f77bcf86cd799439011"
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "code": "SUMMER2024",
    "discountType": "percentage",
    "discountValue": 15,
    "isValid": true
  }
}
```

**Step 2: Register with Promo Code**

```bash
POST /api/registrations/public
Content-Type: application/json

{
  "eventId": "507f1f77bcf86cd799439011",
  "name": "John",
  "surname": "Doe",
  "email": "john@example.com",
  "city": "Kyiv",
  "promoCode": "SUMMER2024"
}
```

**Response** (excerpt):

```json
{
  "success": true,
  "data": {
    "id": "registration-id",
    "promoCode": "SUMMER2024",
    "finalPrice": 850,
    "paymentStatus": "pending"
  }
}
```

**Step 3: Payment Completion**

- After successful payment, `usedCount` is automatically incremented
- Code can now only be used 99 more times

### Example 4: Invalid Code Scenarios

**Expired Code**:

```json
{
  "success": false,
  "error": {
    "message": "Validation error",
    "errors": {
      "promoCode": ["Promo code has expired"]
    }
  }
}
```

**Usage Limit Reached**:

```json
{
  "success": false,
  "error": {
    "message": "Validation error",
    "errors": {
      "promoCode": ["Promo code usage limit reached"]
    }
  }
}
```

**Wrong Event**:

```json
{
  "success": false,
  "error": {
    "message": "Validation error",
    "errors": {
      "promoCode": ["Promo code is not valid for this event"]
    }
  }
}
```

---

## Implementation Files

### Core Files

- **Model**: `src/models/PromoCode.ts` - Database schema and interface
- **Service**: `src/services/promoCodes.service.ts` - Business logic
- **Controller**: `src/controllers/promoCodes.controller.ts` - Request handling
- **Routes**: `src/routes/promoCodes.routes.ts` - Route definitions
- **Validator**: `src/validators/promoCodes.validator.ts` - Input validation
- **Utility**: `src/utils/pricing.util.ts` - Price calculation logic

### Integration Points

- **Registrations**: `src/services/registrations.service.ts` - Uses promo codes during registration
- **Rate Limiting**: `src/middleware/rateLimiter.middleware.ts` - Protects validation endpoint
- **Swagger**: `src/config/swagger.ts` - API documentation

---

## Best Practices

1. **Code Formatting**: Always use uppercase, alphanumeric codes for better UX
2. **Expiration Dates**: Set expiration dates for time-limited promotions
3. **Usage Limits**: Set appropriate limits based on expected demand
4. **Event-Specific Codes**: Use `eventId` for codes that should only apply to specific events
5. **Testing**: Validate codes before creating registrations to provide immediate feedback
6. **Monitoring**: Track `usedCount` vs `usageLimit` to monitor code performance
7. **Deactivation**: Set `isActive: false` instead of deleting codes to maintain history

---

## Security Considerations

1. **Rate Limiting**: Prevents brute-force attempts to discover valid codes
2. **Code Normalization**: Prevents case-sensitivity issues and whitespace manipulation
3. **Transaction Safety**: Usage increment is atomic to prevent race conditions
4. **Validation**: Multiple validation layers ensure codes are used correctly
5. **Event Matching**: Event-specific codes prevent cross-event usage

---

## Future Enhancements

Potential improvements to consider:

- User-specific promo codes (one-time use per user)
- Minimum purchase amount requirements
- Stackable promo codes (multiple codes per registration)
- Promo code analytics and reporting
- Admin interface for creating/managing codes
- Promo code generation API
- Bulk code creation for campaigns
