# שליחת פניות מהטופס לדוא"ל

מצב היום: פנייה שנשלחת מטופס "צרו קשר" **נשמרת בטבלת `roey_leads` ב-Supabase**.
דף סטטי לא יכול לשלוח דוא"ל בעצמו, ולכן כדי שכל פנייה תגיע גם לתיבה
`Roy@kubovsky.co.il` צריך רכיב שרת קטן. הקובץ `notify-lead.ts` שבתיקייה הזו הוא
בדיוק זה — Supabase Edge Function שמעבירה את הפנייה בדוא"ל.

עד שהפונקציה נפרסת, אין אובדן מידע: הפניות נשמרות במסד הנתונים, ואם השמירה
נכשלת נפתחת אצל הפונה תוכנת הדוא"ל עם הפרטים ממולאים לכתובת שב-`fallbackEmail`.

## הפעלה — שלושה שלבים

1. **חשבון לשליחת דוא"ל.** נרשמים ל-[Resend](https://resend.com), מאמתים את
   הדומיין `kubovsky.co.il` ומייצרים מפתח API.

2. **פורסים את הפונקציה** (מתוך תיקיית הפרויקט ב-Supabase):

   ```bash
   mkdir -p supabase/functions/notify-lead
   cp site/backend/notify-lead.ts supabase/functions/notify-lead/index.ts

   supabase secrets set \
     RESEND_API_KEY=re_xxxxxxxx \
     LEAD_TO=Roy@kubovsky.co.il \
     LEAD_FROM=site@kubovsky.co.il

   supabase functions deploy notify-lead --no-verify-jwt
   ```

   `--no-verify-jwt` נדרש כי הקריאה מגיעה מדפדפן של גולש אנונימי.

3. **מחברים את האתר.** בקובץ `site/index.html`, בתוך `window.SITE_CONFIG`,
   ממלאים את כתובת הפונקציה:

   ```js
   formEndpoint: "https://<project-ref>.supabase.co/functions/v1/notify-lead",
   ```

מרגע זה כל פנייה נשמרת במסד הנתונים **וגם** נשלחת בדוא"ל. כפתור "השב" במייל
פונה ישירות לכתובת שהשאיר הפונה.

## בדיקה

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/notify-lead" \
  -H "Content-Type: application/json" \
  -d '{"lead":{"full_name":"בדיקה","email":"test@example.com","message":"בדיקת מערכת"}}'
```

תשובה תקינה: `{"ok":true}`, ומייל אמור להגיע לתיבה שהוגדרה ב-`LEAD_TO`.

## חלופה פשוטה יותר

אם לא רוצים לתחזק פונקציה, אפשר לוותר על Supabase ולהשתמש בשירות העברת טפסים
(כמו Formspree). זה מהיר יותר להקמה, אבל פרטי הפונים עוברים דרך צד שלישי — שיקול
שכדאי לשקול לגבי פניות למשרד עורכי דין.
