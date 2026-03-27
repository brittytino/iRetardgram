# Post-Discharge Companion Telegram Bot

A multilingual post-discharge medical assistant for Indian patients (English, Tamil, Hindi), powered by Telegram + OpenRouter.

## Features

- Safe, calm post-discharge guidance
- Multilingual responses (English/Tamil/Hindi)
- Structured patient context passed to model
- Simple patient memory in bot runtime
- Medication reminder scheduling with cron
- Useful commands for demo and real use

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables in `.env`:

```env
TELEGRAM_TOKEN=your_telegram_bot_token_here
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODELS=stepfun/step-3.5-flash:free,nvidia/nemotron-3-super-120b-a12b:free,arcee-ai/trinity-large-preview:free,z-ai/glm-4.5-air:free,nvidia/nemotron-3-nano-30b-a3b:free,arcee-ai/trinity-mini:free,nvidia/nemotron-nano-12b-v2-vl:free,qwen/qwen3-coder:free,openai/gpt-oss-120b:free,meta-llama/llama-3.3-70b-instruct:free
OPENROUTER_MODEL_TIMEOUT_MS=7000
OPENROUTER_MAX_TOKENS=280
```

3. Start bot:

```bash
npm start
```

## Telegram Commands

- `/start` - Welcome + command help
- `/bills` - Show dummy discharge bills and total due
- `/payupi <billId>` - Demo UPI payment for a bill
- `/paybank <billId>` - Demo bank transfer payment for a bill
- `/paystatus` - Show recent payment status
- `/startcare` - Start 7-day discharge follow-up with daily check-ins
- `/stopcare` - Stop the 7-day discharge follow-up
- `/setcheckin <HH:MM>` - Set daily check-in time in IST
- `/help` - Show command help
- `/setname <name>` - Store patient name
- `/setcondition <condition>` - Store medical condition
- `/setday <number>` - Store day after discharge
- `/setmeds <Med1|HH:MM,HH:MM;Med2|HH:MM>` - Save meds and start reminders
- `/profile` - Show stored profile and meds
- `/record` - Show persistent patient record saved on disk

Notes:
- `/start` does not auto-show bills; it gives a clean guided flow.
- Use `/bills` when you want to see bill details.
- If command arguments are missing (for example `/payupi`), bot shows usage help.

## User Prompt Format Sent to OpenRouter

The bot sends each user message in this structure:

```text
Patient Info:
Name: {name}
Condition: {condition}
Day After Discharge: {day}
Preferred Language: {detected_lang}
Medication Schedule: {meds}

User Message:
{user_message}
```

## Reminder Notes

- Reminders use `node-cron`.
- Time format is 24-hour (`HH:MM`).
- Timezone used: `Asia/Kolkata`.
- Medication reminders and 7-day symptom check-ins run independently.
- OpenRouter speed tuning: lower timeout values and lower max tokens reduce latency.

## Patient Record (Persistent)

- Patient records are saved in `data/patients.json`.
- This includes name, condition, day, meds, Telegram metadata, and last update time.
- Use `/record` in Telegram to show the current saved record.

## Demo Script

1. Patient runs `/start`
2. Set profile with `/setname Ravi`, `/setcondition Post-op recovery`, `/setday 2`
3. Set medicines with `/setmeds Paracetamol|08:00,20:00`
4. Ask a symptom question in English/Tamil/Hindi
5. Bot replies in same language with safe, step-by-step advice

## BotFather Setup Text

Use these in Telegram BotFather.

### Short Description

```text
7-day multilingual discharge companion with reminders and safety escalation.
```

### Description

```text
JeevanCareBot is a post-discharge companion for patients.
After discharge, it supports patients in their language (Tamil, Hindi, English) for 7 days with:
- daily symptom check-ins
- medication reminders
- simple answers to recovery questions
- danger-sign escalation guidance
No app install needed. Works directly in Telegram.
```

### Commands (for /setcommands)

```text
start - Start bot and view guidance
help - Show all commands
startcare - Start 7-day discharge follow-up
stopcare - Stop 7-day follow-up
setcheckin - Set daily check-in time (HH:MM)
setname - Save patient name
setcondition - Save patient condition
setday - Save day after discharge
setmeds - Save medication schedule
profile - Show current profile
record - Show saved patient record
```
