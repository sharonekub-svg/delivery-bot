# 10Bis API — reverse-engineered notes

Derived from a captured browser session. **No secrets, tokens, emails, or
personal data belong in this file or the repo.** Real credentials live only in
encrypted storage / env vars at runtime.

## Two hosts

| Purpose | Base |
|---|---|
| Catalog (read) | `https://api.10bis.co.il/api/v1` |
| Account / cart / order (stateful) | `https://www.10bis.co.il/NextApi` |

Common headers seen: `x-app-type: mobileWeb`, `language: he` / `en`.
NextApi calls are `POST` with JSON bodies that always include
`{ culture: "he-IL", uiCulture: "he", ... }`. Most also carry a
`shoppingCartGuid` that ties calls into one order session.

NextApi responses share an envelope:
`{ Success: bool, Errors: [...], Data: <payload>, ShoppingCartGuid: string }`.

## Authentication — SMS one-time code (two steps)

1. **Request code** — `POST /NextApi/GetUserAuthenticationDataAndSendAuthenticationCodeToUser_V2`
   - body: `{ culture, uiCulture, email }`
   - effect: 10Bis SMSes a numeric code to the account's phone
   - returns: `Data.codeXXX.authenticationToken` (+ `ShoppingCartGuid`)
2. **Verify code** — `POST /NextApi/GetUserV2`
   - body: `{ shoppingCartGuid, culture, uiCulture, email, authenticationCode, authenticationToken }`
   - returns: `Data` with `userId, firstName, lastName, email, userToken,
     sessionToken, cellphone, companyId, crossPlatformCustomerID, ...`

> Implication: login cannot be fully automated — it needs the SMS code each
> re-auth. Bot flow: trigger step 1 → user forwards the SMS code → bot does
> step 2 → persist session (encrypted). Session likely persists via an httpOnly
> cookie set on the step-2 response (stripped from the HAR) and/or
> `userToken`/`sessionToken`; confirm with a cookie jar when wiring live.

## Addresses

`POST /NextApi/GetUserAddresses` — body `{ culture, uiCulture }` →
`Data: [{ addressId, cityId, cityName, streetId, streetName, houseNumber,
apartmentNumber, entrance, floor, comments, longitude, latitude, phone01,
isCompanyAddress, locationType, ... }]`

## Catalog (read)

- `GET /api/v1/Restaurants/{restaurantId}?addressId=&longitude=&latitude=` → restaurant details (open/availability, delivery).
- `GET /api/v1/Restaurants/{restaurantId}/Menu?addressId=&dateTime=YYYY-MM-DDTHH:mm`
  → `categories: [{ id, name, description, dishes: [{ id, name, description,
  price, categoryId, imageUrl, popular, choices: [...], hasHighSugar,
  hasHighSodium, hasHighSaturatedFat, ... }] }]`
- `GET /api/v1/MarketingBanners`, `/api/v1/announcements`, `/api/v1/Orders/Banners` — not needed.

## Order build flow (POST /NextApi/...)

In observed order:
1. `SetAddressInOrder` — `{ shoppingCartGuid, addressId, ... }`
2. `SetDeliveryMethodInOrder` — `{ shoppingCartGuid, deliveryMethod, ... }`
3. `SetRestaurantInOrder` — `{ shoppingCartGuid, restaurantId, ... }`
4. `SetDishListInShoppingCart` — `{ shoppingCartGuid, dishList: [{ dishId,
   shoppingCartDishId, quantity, assignedUserId, choices: [], dishNotes,
   categoryId }] }`
5. `ChooseAndSetBestDiscountCouponValueInOrder` — `{ shoppingCartGuid, ... }`
6. `GetPayments` — `GET` → available payment methods (the 10Bis allowance)

## Session refresh (avoids re-OTP)

When a `NextApi` call returns **401**, the web app calls
`POST /api/v1/Authentication/RefreshToken` (empty body; relies on the
refresh cookie) and retries. This means a stored session can be kept alive for
a long time without a new SMS code — re-OTP only when refresh also fails.

## Order build flow (POST /NextApi/...) — COMPLETE

In observed order, all sharing one `shoppingCartGuid`:
1. `SetAddressInOrder` — `{ shoppingCartGuid, culture, uiCulture, locationType,
   addressKey ("cityId-streetId-houseNumber"), cityName, streetName,
   houseNumber, latitude, longitude, cityId, streetId, isBigCity }`
2. `SetDeliveryMethodInOrder` — `{ shoppingCartGuid, deliveryMethod: "delivery" }`
3. `SetRestaurantInOrder` — `{ shoppingCartGuid, isMobileDevice, restaurantId,
   deliveryRuleType: "Asap" }`
4. `SetDishListInShoppingCart` — `{ shoppingCartGuid, dishList: [{ dishId,
   shoppingCartDishId, quantity, assignedUserId, choices, dishNotes,
   categoryId }] }`
5. `ChooseAndSetBestDiscountCouponValueInOrder` — `{ shoppingCartGuid, includeUserCoupons:false }`
6. `SetPaymentsInOrder` — `{ shoppingCartGuid, payments: [{ paymentMethod:
   "Moneycard", cardId, userId, cardLastDigits, sum, assigned:true, ... }] }`
   (cardId = the 10Bis Moneycard / company allowance; from the user's payments)
7. `SubmitOrder` — `{ shoppingCartGuid, isMobileDevice, dontWantCutlery,
   orderRemarks }` → `Data.orderData.orderId` (+ `threeDsChallengeUrl` if 3DS,
   not used for Moneycard)

Other seen: `GetUser` (inits cart / returns ShoppingCartGuid), `SetUserInOrder`,
`SearchDishes`, `GetLastTransactionWithoutReview`, `GetPayments`.

> No cancel endpoint was captured (the order was submitted but not cancelled in
> the session). Cancellation, if needed, must be captured separately.

## Useful captured IDs (reference, not secret)

- Address `2629313` = דרך אילות 5, גני תקווה
- Restaurants seen: `46313`, `39005`
