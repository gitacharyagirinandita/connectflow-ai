# ConnectFlow AI – Phase 1 🚀

Your lead management and growth assistant for **Health Coaching** and **Ratnagiri Gurukula**.

---

## ▶️ How to open the app (no installation needed)

1. Open the folder `Documents\ConnectFlow-AI`.
2. Double-click **`ConnectFlow-AI.html`**. It opens in Chrome or Edge.
3. Tap **"Create account & join"**, enter your email and a password. You go straight in. No email confirmation needed.
4. The first person to sign up becomes the **owner**. Everyone who signs up after that joins both workspaces as a **member** and can see all leads.

📱 **Mobile link:** https://gitacharyagirinandita.github.io/connectflow-ai/

---

## ✅ What works now (Phase 1)

| Section | What you can do |
|---|---|
| Business cards | Choose Health Coaching or Ratnagiri Gurukula. Switch any time from the sidebar |
| Dashboard | Real counts from your database, last 7 days chart, follow-ups due, recent activity |
| All Leads Collected | Add, edit, search, filter, delete leads. Colour dots: 🟢 sent · ⚪ not sent · 🔵 reply · 🟠 follow-up |
| Lead profile | Lead status, notes, call history, lists, WhatsApp permission history |
| Bulk actions | Select leads, "Select all eligible" (opted-in only), add many leads to a list |
| My Lists | Create, rename, delete lists. Add or remove leads. Search inside a list. Deleting a list never deletes leads |
| Call History | Add as many call records as you like. Old records can never be changed. A follow-up date creates a reminder automatically |
| Search Leads | Live web search (Brave, India) through your n8n. Filters for location, category, age group, requirement, source, enquiry type and date. Save any result as a lead |

## ⏳ Coming next

| Phase | Feature |
|---|---|
| 2 | Business Settings (programs, verified fees, FAQs) + AI Message Studio |
| 3 | WhatsApp Business Cloud API: sending, delivery ticks, replies, opt-out, Messaged Leads |
| 4 | 7-Day Growth Planner |
| 5 | More lead sources + integration setup page |

---

## 🔒 Safety built in

- Every record is tagged with its business. The database itself blocks mixing the two businesses.
- Row Level Security: only your account can see your data.
- Call records can't be edited or deleted. You can only add new ones.
- The app can't mark a message as "delivered" by itself. Only the real WhatsApp server can do that (Phase 3).
- Only contacts marked **Opted in** can be messaged. Opted-out contacts are always excluded.
- Only the public "publishable" key is in the app. Secret keys will stay on the server.

---

## 🛠️ For developers

- Database: Supabase project `yqtuduxhbqkagzactrny` (all tables start with `cf_`). Migrations are in `supabase/migrations`.
- App: React + Vite + Tailwind, in the `app` folder.
  - `npm install` then `npm run dev` to develop.
  - `npm run build` creates `app/dist/index.html`. Copy it as `ConnectFlow-AI.html`.
- To give another person access later, run this in Supabase SQL editor (replace the email):
  ```sql
  insert into cf_business_members (business_id, user_id, role)
  select b.id, u.id, 'member' from cf_businesses b, auth.users u where u.email = 'FILL IN';
  ```
