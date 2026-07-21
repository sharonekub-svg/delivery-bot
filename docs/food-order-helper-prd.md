# Product Requirement Document (PRD) — Food Order Helper

## 1. Executive Summary & Problem Statement

- **Problem:** Busy professionals frequently neglect their lunches due to demanding
  work schedules and back-to-back meetings. By the time they realize they haven't
  eaten, they are already starving, leading to reduced productivity, irritability,
  and reliance on low-nutrition, convenient fast food.
- **Solution:** A WhatsApp-based conversational AI assistant that securely
  integrates with the user's corporate food application (e.g., Cibus, 10Bis). The
  assistant automatically monitors dietary goals, historical preferences, and
  budget constraints to proactively suggest and place lunch orders, ensuring the
  user never misses a healthy meal.

## 2. Target Persona & Assumptions

- **Target Audience:** Corporate employees and tech professionals who utilize
  company-subsidized food delivery apps.
- **Core Assumptions:**
  - Users have an active account with a supported corporate food application
    (e.g., 10Bis, Cibus).
  - Users comfortably use WhatsApp as a primary communication interface for
    automated services.
  - Users have a daily or monthly budget cap provided by their employer or
    managed individually.

## 3. Product Features & Detailed User Flow

### 3.1. Onboarding & First-Time User Experience (FTUX)

- **Channel:** Initiated via a WhatsApp welcome sequence.
- **Disclaimer & Legal Reliability:** The welcome message must include a link to a
  dedicated terms-of-service page stating that the tool acts solely as an
  intermediary order facilitator and holds no liability for preparation quality,
  delivery delays, or errors caused by the third-party food app or restaurant.
- **Account Core Identifiers:** The system maps the user account using their
  validated WhatsApp phone number as the primary unique ID.

### 3.2. Preference Setup Profile

The assistant collects the following configurations sequentially or via a webview
link to prevent chat fatigue:

| # | Preference Attribute | Default Value | Logic / Source |
|---|---------------------|---------------|----------------|
| 1 | Nutritional Target | Target based on health guidelines for user demographic. | Focus on weekly protein and macro levels. |
| 2 | Important Ingredients / Allergens | None (Optional). | Exclusions (e.g., no gluten, no nuts) or inclusions. |
| 3 | Include Beverage | No. | Boolean toggle. |
| 4 | Favorite Dishes Selection | Derived from history. | Parses the last 3 months of order history from the food app to find repeated meals. Re-prompt user every 3 months or allow manual overriding. |
| 5 | Daily Budget | Derived from app data. | Calculated as Total Monthly Budget / Average Israeli Working Days. User can manually override. |
| 6 | Active Days | Sunday through Thursday. | Specific days the helper should activate (e.g., hybrid office days). |
| 7 | Planning Horizon | Same-Day. | Options: "Daily suggestions" vs. "Weekly meal plan preview". |
| 8 | Daily Trigger Time | 09:00 AM. | Time the suggestion message is pushed. |
| 9 | Recommendation Variety | 2 Options. | Number of choices presented. Includes an "Autopilot Mode" ("I trust you to order without asking"). |
| 10 | Delivery Address | Sync from food app. | Pulls recent addresses from the last 3 months. User selects primary office/home location. |
| 11 | Food App Credentials | None (Required). | **Security Constraint:** Must be handled via a secure, encrypted token exchange gateway. Credentials must be validated synchronously before onboarding completes. |

### 3.3. Daily Engagement & Order Execution Flow

1. **The Prompt:** At the designated trigger time (e.g., 09:00 AM) on an active
   day, the user receives a tailored WhatsApp message presenting 2 distinct dish
   options with verbal descriptions and direct links to the item pages within the
   food app.
2. **The Response:** The user replies by typing `1` or `2` (or interacts via
   WhatsApp interactive buttons).
3. **Execution:** The system executes the API call to order through the connected
   food app backend.
4. **Confirmation:**
   - **Success:** The user receives a confirmation message containing a deep link
     to the live order tracker in the food app, the estimated delivery time, and
     a health-conscious closing remark.
   - **Failure:** If an issue occurs (e.g., restaurant closed, item out of stock,
     budget exceeded), an error notice is sent with an immediate alternative
     option or a prompt to manual override.

### 3.4. On-Demand Menu Commands

Whenever a user messages the bot outside the daily order window, it surfaces a
persistent menu providing:

- **Change Preferences:** Opens a secure configuration link or inline prompt to
  edit parameters.
- **See Last Order:** Provides a direct link to the food app's order history page.
- **Support / Problem with Order:** Triggers a reminder text clarifying the
  tool's role as an assistant and provides a direct escalation link to the food
  app's actual customer service.

## 4. Key Functional Enhancements for Product Success

To elevate this product from a simple script to a resilient, production-ready
product, the following critical areas are expanded:

### 4.1. The Recommendation Engine Logic

- **Scoring Heuristic:** Define how the 2 daily options are selected. The engine
  should calculate a score using variables like:

  ```
  Score = w1·(Budget Fit) + w2·(Protein/Macro Goal) + w3·(Historical Frequency) − w4·(Recent Fatigue)
  ```

- **Fatigue Filter:** Ensure the same dish isn't recommended two days in a row
  unless explicitly requested.

### 4.2. "Autopilot Mode" Edge Cases

When a user selects "I trust you to order for me without asking," strict fallback
rules are required:

- **Verification Check:** Define behavior when the preferred restaurant is closed
  that day.
- **Safety Mechanism:** Send an "Intent to Order" notification at 09:00 AM
  (e.g., "Ordering your usual salad at 10:30 AM unless you text 'Cancel'"). This
  prevents ordering food when a user is unexpectedly sick or out of the office.

### 4.3. Budget Dynamics

- **Over-Budget Handling:** If a user's favorite dish increases in price and
  exceeds their daily allocation, the bot should flag it: "Option 1 exceeds your
  daily budget by 5 NIS. Do you want to approve the extra charge or see a
  budget-friendly option?"

### 4.4. Security, Credentials, and Session Management

- **Credential Storage:** Storing raw passwords or session tokens for platforms
  like 10Bis/Cibus introduces high security risks. Requirements must explicitly
  state AES-256 encryption at rest and secure token management.
- **Session Expiry:** If the session token to the food app expires, the bot must
  gracefully handle it via WhatsApp: "Your login session expired. Please tap here
  to securely re-authenticate so I can place today's order."
