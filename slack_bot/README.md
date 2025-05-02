# LeadBot for East Texas Hot Tub

A Slack bot that turns Slack into a CRM for East Texas Hot Tub (ETHT), integrating with the existing SharpSpring → Supabase lead-ingest logic.

## Features

1. **Lead intake listener** - Listens for messages in `#leads-inbox` with JSON-tagged `"lead_id"`, starts a thread, adds 🆕 reaction, and inserts/merges the lead in Supabase.
2. **`/claim` slash command** - Used in a thread to claim ownership of a lead, updates Supabase, reacts with 🤝, and posts confirmation.
3. **`/stage` command and emoji reactions** - Updates lead status with options: `Contacted ☎️`, `Qualified 🔍`, `Won ✅`, `Lost ❌`.
4. **Idle-lead reminder job** - Hourly check for leads with no activity in 48 hours, sends DMs to owners.
5. **`/escalate` command** - Creates a private `deal-{lastname}` channel, copies thread content, and invites sales managers.
6. **Webhook endpoint for SharpSpring** - Accepts SharpSpring data and posts to `#leads-inbox`.

## Setup

### Prerequisites

- Python 3.8+
- Slack workspace with admin access
- Supabase account with existing lead table

### Installation

1. Clone this repository
2. Create a `.env.slack_bot` file in the root directory with the following variables:

```
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_APP_TOKEN=xapp-...
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

3. Install dependencies:

```bash
pip install -r slack_bot/requirements.txt
```

### Slack App Configuration

1. Create a new Slack App at [api.slack.com/apps](https://api.slack.com/apps)
2. Enable Socket Mode under Settings → Socket Mode
3. Under Features → Event Subscriptions, enable events and subscribe to:
   - `message.channels` (to listen for messages in #leads-inbox)
   - `reaction_added` (for emoji-based stage updates)
4. Under Features → Slash Commands, create:
   - `/claim`
   - `/stage`
   - `/escalate`
5. Under Features → OAuth & Permissions, add the following scopes:
   - `channels:history` (read messages)
   - `channels:manage` (create escalation channels)
   - `chat:write` (post messages)
   - `commands` (create slash commands)
   - `reactions:write` (add reactions)
   - `usergroups:read` (read user groups for escalation)
   - `users:read` (get user info)
   - `app_mentions:read` (read mentions)

### Running Locally

```bash
python slack_bot/app.py
```

For testing the webhook endpoint:

```bash
uvicorn slack_bot.app:app --port 8000
```

Use ngrok to expose your local server for webhook testing:

```bash
ngrok http 8000
```

### Deployment

#### Render (Recommended)

1. Set up a new Background Worker service
2. Set root directory to `slack_bot`
3. Set start command to `python app.py`
4. Add all environment variables

## Development

### File Structure

- `app.py` - Main Bolt app
- `handlers/` - Contains handler modules for each feature
  - `new_lead.py` - Lead intake listener
  - `claim.py` - Claim command
  - `stage.py` - Stage command and emoji reactions
  - `reminders.py` - Idle-lead reminder job
  - `escalate.py` - Escalation handler
- `utils/` - Helper utilities
  - `supabase_client.py` - Supabase connection
  - `slack_helpers.py` - Slack helper functions

### TODOs and Future Improvements

- Add unit tests
- Add more robust error handling and retries
- Implement advanced analytics on lead conversion
- Add lead assignment rotation for equal distribution
- Integrate with calendar for scheduling follow-ups

## Support

For any issues, please contact the dev team at `support@etht.com`. 