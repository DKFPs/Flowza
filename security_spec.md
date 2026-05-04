# Security Specification - Flowza

## 1. Data Invariants

1.  **Business Ownership**: Only the `owner_id` specified in the `businesses` document can manage its settings, professionals, services, and units.
2.  **Plan Limit Integrity**: 
    -   **Appointments**: Cannot exceed `limit_appointments` defined in the Business document.
    -   **Professionals**: Cannot exceed `limit_professionals` defined in the Business document.
    -   **Services**: Cannot exceed `limit_services` defined in the Business document.
    -   **Units**: Cannot exceed `limit_units` defined in the Business document.
3.  **Identity Spoofing**: Users cannot create or update documents with a `business_id` or `owner_id` that does not belong to them.
4.  **Immutability**: Once created, `created_at` and `business_id` fields must never change.
5.  **PII Isolation**: Client contact information (phone/email) is only accessible by the business owner.

## 2. The "Dirty Dozen" Payloads (Red Team Payloads)

### T1: Identity Hijack
**Action**: Create a service for another user's business.
**Payload**: `{ "name": "Hack", "business_id": "STOLEN_BIZ_ID", "price": 100 }`
**Result**: `PERMISSION_DENIED`

### T2: Plan Limit Bypass (Professionals)
**Action**: Create a 6th professional on a "Business" plan (limit: 5).
**Requirement**: Rules must check `get(/databases/$(database)/documents/businesses/$(bizId)).data.usage_professionals < limit`.
**Result**: `PERMISSION_DENIED`

### T3: Shadow Field Injection
**Action**: Update a business document to set `is_verified: true` or `plan_id: "premium"` without paying.
**Payload**: `{ "plan_id": "premium" }`
**Result**: `PERMISSION_DENIED` (via `affectedKeys().hasOnly()`)

### T4: Appointment Flooding
**Action**: Create an appointment when `usage_appointments >= limit_appointments`.
**Result**: `PERMISSION_DENIED`

### T5: PII Leak
**Action**: Read a client document from another business.
**Result**: `PERMISSION_DENIED`

### T6: System Field Modification
**Action**: Client trying to change their own loyalty points balance.
**Result**: `PERMISSION_DENIED` (Only manageable by Business Owner)

### T7: ID Poisoning
**Action**: Create service with 2KB string as Document ID.
**Result**: `PERMISSION_DENIED` (via `isValidId()`)

### T8: Timestamp Spoofing
**Action**: Set `created_at` to a date in the past.
**Result**: `PERMISSION_DENIED` (must be `request.time`)

### T9: Orphan Document
**Action**: Create an appointment for a service that doesn't exist.
**Result**: `PERMISSION_DENIED` (via `exists()`)

### T10: Role Escalation
**Action**: Update own profile to set `role: "admin"`.
**Result**: `PERMISSION_DENIED`

### T11: Negative Price
**Action**: Set service price to `-50`.
**Result**: `PERMISSION_DENIED` (via `price >= 0`)

### T12: Unauthorized List Query
**Action**: Fetch ALL appointments from the system.
**Result**: `PERMISSION_DENIED` (must filter by `business_id`)
