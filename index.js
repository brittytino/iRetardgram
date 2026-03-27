require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const cron = require("node-cron");
const { franc } = require("franc");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const DEFAULT_OPENROUTER_MODELS = [
    "stepfun/step-3.5-flash:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "arcee-ai/trinity-large-preview:free",
    "z-ai/glm-4.5-air:free",
    "nvidia/nemotron-3-nano-30b-a3b:free",
    "arcee-ai/trinity-mini:free",
    "nvidia/nemotron-nano-12b-v2-vl:free",
    "qwen/qwen3-coder:free",
    "openai/gpt-oss-120b:free",
    "meta-llama/llama-3.3-70b-instruct:free"
];
const OPENROUTER_MODELS = (process.env.OPENROUTER_MODELS || "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
const ACTIVE_OPENROUTER_MODELS = OPENROUTER_MODELS.length > 0 ? OPENROUTER_MODELS : DEFAULT_OPENROUTER_MODELS;
const OPENROUTER_MODEL_TIMEOUT_MS = Number(process.env.OPENROUTER_MODEL_TIMEOUT_MS || 7000);
const OPENROUTER_MAX_TOKENS = Number(process.env.OPENROUTER_MAX_TOKENS || 280);

if (!TELEGRAM_TOKEN) {
    throw new Error("Missing TELEGRAM_TOKEN in .env");
}

if (!OPENROUTER_API_KEY) {
    throw new Error("Missing OPENROUTER_API_KEY in .env");
}

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

const DATA_DIR = path.join(__dirname, "data");
const PATIENTS_FILE = path.join(DATA_DIR, "patients.json");
const PROCESS_LOCK_FILE = path.join(DATA_DIR, "jeevancarebot.lock");

function isPidRunning(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (_) {
        return false;
    }
}

function releaseProcessLock() {
    try {
        if (fs.existsSync(PROCESS_LOCK_FILE)) {
            fs.unlinkSync(PROCESS_LOCK_FILE);
        }
    } catch (_) {
        // Ignore lock release errors.
    }
}

function stopExistingProcess(pid) {
    if (!pid || !Number.isFinite(pid) || pid === process.pid) {
        return;
    }

    try {
        process.kill(pid, "SIGTERM");
    } catch (_) {
        // ignore, process may already be stopped
    }

    if (isPidRunning(pid)) {
        try {
            process.kill(pid, "SIGKILL");
        } catch (_) {
            // ignore, may not be supported on all platforms
        }
    }

    if (isPidRunning(pid) && process.platform === "win32") {
        try {
            execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
        } catch (_) {
            // ignore taskkill errors; final check below handles failure
        }
    }

    if (isPidRunning(pid)) {
        throw new Error(`Failed to stop existing JeevanCareBot process (PID ${pid}). Please stop it manually.`);
    }
}

function acquireProcessLock() {
    ensurePatientStore();

    if (fs.existsSync(PROCESS_LOCK_FILE)) {
        try {
            const raw = fs.readFileSync(PROCESS_LOCK_FILE, "utf8");
            const existing = JSON.parse(raw || "{}");
            const existingPid = Number(existing.pid);

            if (existingPid && isPidRunning(existingPid)) {
                console.warn(`Detected existing JeevanCareBot process (PID ${existingPid}). Taking over...`);
                stopExistingProcess(existingPid);
            }
        } catch (error) {
            if (error && error.message && error.message.includes("Failed to stop existing JeevanCareBot process")) {
                throw error;
            }
            // If lock is invalid or stale, overwrite it.
        }
    }

    fs.writeFileSync(
        PROCESS_LOCK_FILE,
        JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }, null, 2),
        "utf8"
    );
//const lockAcquuiredAt = new Date().toISOString();
//console.log(`Process lock acquired at ${lockAcquuiredAt} with PID ${process.pid}`);

    process.on("SIGINT", () => {
        releaseProcessLock();
        process.exit(0);
    });

    process.on("SIGTERM", () => {
        releaseProcessLock();
        process.exit(0);
    });

    process.on("exit", () => {
        releaseProcessLock();
    });
}

// lockey is acquired at very beggining 
function ensurePatientStore() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(PATIENTS_FILE)) {
        fs.writeFileSync(PATIENTS_FILE, "{}", "utf8");
    }
}

function loadPatientStore() {
    ensurePatientStore();

    try {
        const raw = fs.readFileSync(PATIENTS_FILE, "utf8");
        return JSON.parse(raw || "{}");
    } catch (error) {
        console.error("Failed to read patients store. Recreating file:", error.message);
        fs.writeFileSync(PATIENTS_FILE, "{}", "utf8");
        return {};
    }
}

function savePatientStore() {
    fs.writeFileSync(PATIENTS_FILE, JSON.stringify(patientStore, null, 2), "utf8");
}

const patientStore = loadPatientStore();
const processedMessages = new Map();

const systemPrompt = `You are JeevanCareBot, a multilingual post-discharge billing companion for Indian patients.

Your main purpose:
1. Explain hospital bill items in simple words
2. Show total due and paid amount clearly
3. Guide payment using UPI or bank transfer steps
4. Confirm payment status politely
5. Answer billing and discharge cost questions calmly

Rules:
- Be simple, clear, and calm
- Use short sentences
- Avoid technical jargon
- Never make up final hospital accounting numbers if missing
- If exact data is missing, ask user to check /bills or hospital billing desk

Language behavior:
- Detect user's language automatically
- Support English, Tamil, Hindi
- Reply in user's language

Tone:
- Friendly, warm, and practical
- Sound like a companion helping a patient family
- Not robotic

Safety note:
- If user reports chest pain, breathing difficulty, heavy bleeding, fainting, or severe pain, advise immediate hospital contact first.

Response quality:
- Use patient's name naturally when available
- Start with one empathetic line
- Keep responses practical and concise
- Avoid repetitive wording across replies.`;

const translations = {
    en: {
        welcome: "Hello. I am JeevanCareBot, your post-discharge care companion. Please share your name.",
        help: "Commands:\n/start\n/bills\n/payupi <billId>\n/paybank <billId>\n/paystatus\n/startcare\n/stopcare\n/setcheckin <HH:MM>\n/setname <name>\n/setcondition <condition>\n/setday <number>\n/setmeds <Med1|HH:MM,HH:MM;Med2|HH:MM>\n/profile\n/record",
        startGuide: "Let us begin step-by-step:\n1) Set name: /setname <name>\n2) View bills: /bills\n3) Pay by UPI or bank: /payupi <billId> or /paybank <billId>\nUse /help anytime.",
        savedName: "Name saved.",
        setNameUsage: "Use: /setname <name> or just type your name now.",
        savedCondition: "Condition saved.",
        setConditionUsage: "Use: /setcondition <condition>",
        savedDay: "Day after discharge saved.",
        badDay: "Please send a valid day number. Example: /setday 3",
        medsSaved: "Medication reminders saved.",
        medsBadFormat: "Use this format: /setmeds Paracetamol|08:00,20:00;Metformin|09:00",
        setMedsUsage: "Use: /setmeds Paracetamol|08:00,20:00;Metformin|09:00",
        profileHeader: "Your current profile:",
        fallbackError: "Something went wrong. Please try again.",
        reminder: "Medicine reminder",
        askName: "Please share your name with /setname <name>.",
        askCondition: "You can set your condition with /setcondition <condition>.",
        recordHeader: "Patient record",
        onboarding: "To personalize care, set your name, condition, and day after discharge using /setname, /setcondition, and /setday.",
        billingIntro: "I can also help you with discharge bills and payment. Send /bills to view your current bill summary.",
        billsHeader: "Discharge bill summary",
        noBills: "No bills are available right now.",
        payUpiUsage: "Use: /payupi <billId>",
        payBankUsage: "Use: /paybank <billId>",
        payStatusEmpty: "Payment status: no payments yet.",
        billNotFound: "Bill not found. Please check /bills and try again.",
        billAlreadyPaid: "This bill is already marked as paid.",
        upiReady: "UPI payment details",
        bankReady: "Bank transfer details",
        paymentMarked: "Demo payment marked as successful.",
        paymentStatusHeader: "Payment status",
        billingAssist: "I am with you. I can explain your bill, total due, and payment steps.",
        careStarted: "7-day discharge care is started. You will get daily symptom check-ins.",
        careStopped: "7-day discharge care is stopped.",
        checkinSaved: "Daily check-in time saved.",
        checkinBadFormat: "Use this format: /setcheckin 09:00",
        dailyCheckin: "Daily check-in",
        dangerPrompt: "If you have chest pain, breathing difficulty, heavy bleeding, fainting, or severe pain, go to the nearest hospital immediately.",
        careCompleted: "You completed 7 days of follow-up. Please continue medicines and contact your doctor if symptoms worsen."
    },
    ta: {
        welcome: "வணக்கம். நான் JeevanCareBot, உங்கள் டிஸ்சார்ஜ் பிந்தைய பராமரிப்பு உதவியாளர். உங்கள் பெயரை சொல்லவும்.",
        help: "கட்டளைகள்:\n/start\n/bills\n/payupi <billId>\n/paybank <billId>\n/paystatus\n/startcare\n/stopcare\n/setcheckin <HH:MM>\n/setname <name>\n/setcondition <condition>\n/setday <number>\n/setmeds <Med1|HH:MM,HH:MM;Med2|HH:MM>\n/profile\n/record",
        startGuide: "படிப்படியாக தொடங்கலாம்:\n1) பெயர் சேமிக்க: /setname <name>\n2) பில் பார்க்க: /bills\n3) UPI/வங்கி கட்டணம்: /payupi <billId> அல்லது /paybank <billId>\nஉதவிக்கு /help.",
        savedName: "பெயர் சேமிக்கப்பட்டது.",
        setNameUsage: "இந்த வடிவில் அனுப்பவும்: /setname <name> அல்லது உங்கள் பெயரை நேராக அனுப்பவும்.",
        savedCondition: "நோய் நிலை சேமிக்கப்பட்டது.",
        setConditionUsage: "இந்த வடிவில் அனுப்பவும்: /setcondition <condition>",
        savedDay: "டிஸ்சார்ஜ் ஆன பிந்தைய நாள் சேமிக்கப்பட்டது.",
        badDay: "சரியான நாள் எண்ணை அனுப்பவும். உதாரணம்: /setday 3",
        medsSaved: "மருந்து நினைவூட்டல்கள் சேமிக்கப்பட்டது.",
        medsBadFormat: "இந்த வடிவில் அனுப்பவும்: /setmeds Paracetamol|08:00,20:00;Metformin|09:00",
        setMedsUsage: "இந்த வடிவில் அனுப்பவும்: /setmeds Paracetamol|08:00,20:00;Metformin|09:00",
        profileHeader: "உங்கள் தற்போதைய விபரம்:",
        fallbackError: "சில பிழை ஏற்பட்டது. மீண்டும் முயற்சிக்கவும்.",
        reminder: "மருந்து நினைவூட்டல்",
        askName: "உங்கள் பெயரை /setname <name> மூலம் பகிரவும்.",
        askCondition: "உங்கள் நிலையை /setcondition <condition> மூலம் சேமிக்கலாம்.",
        recordHeader: "நோயாளர் பதிவு",
        onboarding: "உங்கள் சேவையை தனிப்பயனாக்க, /setname, /setcondition, /setday கட்டளைகளை பயன்படுத்தவும்.",
        billingIntro: "டிஸ்சார்ஜ் பில் மற்றும் கட்டண உதவிக்கும் நான் இருக்கிறேன். /bills அனுப்பவும்.",
        billsHeader: "டிஸ்சார்ஜ் பில் சுருக்கம்",
        noBills: "இப்போது பில் இல்லை.",
        payUpiUsage: "இந்த வடிவில் அனுப்பவும்: /payupi <billId>",
        payBankUsage: "இந்த வடிவில் அனுப்பவும்: /paybank <billId>",
        payStatusEmpty: "கட்டண நிலை: இதுவரை கட்டணம் இல்லை.",
        billNotFound: "பில் கிடைக்கவில்லை. /bills பார்த்து மீண்டும் முயற்சி செய்யவும்.",
        billAlreadyPaid: "இந்த பில் ஏற்கனவே செலுத்தப்பட்டது.",
        upiReady: "UPI கட்டண விவரங்கள்",
        bankReady: "வங்கி பரிமாற்ற விவரங்கள்",
        paymentMarked: "டெமோ கட்டணம் வெற்றியாக பதிவு செய்யப்பட்டது.",
        paymentStatusHeader: "கட்டண நிலை",
        billingAssist: "நான் உங்களுடன் இருக்கிறேன். உங்கள் பில் மற்றும் கட்டணத்தை எளிதாக விளக்குகிறேன்.",
        careStarted: "7 நாள் டிஸ்சார்ஜ் பிந்தைய பராமரிப்பு தொடங்கியது. தினசரி அறிகுறி சரிபார்ப்பு வரும்.",
        careStopped: "7 நாள் டிஸ்சார்ஜ் பிந்தைய பராமரிப்பு நிறுத்தப்பட்டது.",
        checkinSaved: "தினசரி சரிபார்ப்பு நேரம் சேமிக்கப்பட்டது.",
        checkinBadFormat: "இந்த வடிவில் அனுப்பவும்: /setcheckin 09:00",
        dailyCheckin: "தினசரி சரிபார்ப்பு",
        dangerPrompt: "மார்பு வலி, சுவாச சிரமம், அதிக ரத்தப்போக்கு, மயக்கம், கடும் வலி இருந்தால் உடனே அருகிலுள்ள மருத்துவமனைக்கு செல்லவும்.",
        careCompleted: "7 நாள் பிந்தைய பராமரிப்பு முடிந்தது. மருந்துகளை தொடரவும். அறிகுறி அதிகரித்தால் மருத்துவரை தொடர்புகொள்ளவும்."
    },
    hi: {
        welcome: "नमस्ते। मैं JeevanCareBot, आपका डिस्चार्ज के बाद देखभाल सहायक हूँ। कृपया अपना नाम बताएं।",
        help: "कमांड्स:\n/start\n/bills\n/payupi <billId>\n/paybank <billId>\n/paystatus\n/startcare\n/stopcare\n/setcheckin <HH:MM>\n/setname <name>\n/setcondition <condition>\n/setday <number>\n/setmeds <Med1|HH:MM,HH:MM;Med2|HH:MM>\n/profile\n/record",
        startGuide: "चलें, स्टेप-बाय-स्टेप शुरू करें:\n1) नाम सेट करें: /setname <name>\n2) बिल देखें: /bills\n3) UPI/बैंक से भुगतान: /payupi <billId> या /paybank <billId>\nमदद के लिए /help भेजें।",
        savedName: "नाम सेव हो गया है।",
        setNameUsage: "यह फॉर्मेट इस्तेमाल करें: /setname <name> या अभी अपना नाम भेजें।",
        savedCondition: "स्थिति सेव हो गई है।",
        setConditionUsage: "यह फॉर्मेट इस्तेमाल करें: /setcondition <condition>",
        savedDay: "डिस्चार्ज के बाद का दिन सेव हो गया है।",
        badDay: "कृपया सही दिन संख्या भेजें। उदाहरण: /setday 3",
        medsSaved: "दवा रिमाइंडर सेव हो गए हैं।",
        medsBadFormat: "यह फॉर्मेट इस्तेमाल करें: /setmeds Paracetamol|08:00,20:00;Metformin|09:00",
        setMedsUsage: "यह फॉर्मेट इस्तेमाल करें: /setmeds Paracetamol|08:00,20:00;Metformin|09:00",
        profileHeader: "आपकी वर्तमान प्रोफाइल:",
        fallbackError: "कुछ गलती हुई। कृपया फिर से कोशिश करें।",
        reminder: "दवा रिमाइंडर",
        askName: "कृपया अपना नाम /setname <name> से सेट करें।",
        askCondition: "आप /setcondition <condition> से अपनी स्थिति सेट कर सकते हैं।",
        recordHeader: "रोगी रिकॉर्ड",
        onboarding: "देखभाल को निजी बनाने के लिए /setname, /setcondition और /setday का उपयोग करें।",
        billingIntro: "मैं डिस्चार्ज बिल और पेमेंट में भी मदद करता हूँ। /bills भेजें।",
        billsHeader: "डिस्चार्ज बिल सारांश",
        noBills: "अभी कोई बिल उपलब्ध नहीं है।",
        payUpiUsage: "यह फॉर्मेट इस्तेमाल करें: /payupi <billId>",
        payBankUsage: "यह फॉर्मेट इस्तेमाल करें: /paybank <billId>",
        payStatusEmpty: "भुगतान स्थिति: अभी तक कोई भुगतान नहीं।",
        billNotFound: "बिल नहीं मिला। /bills देखकर फिर कोशिश करें।",
        billAlreadyPaid: "यह बिल पहले ही भुगतान किया जा चुका है।",
        upiReady: "UPI भुगतान विवरण",
        bankReady: "बैंक ट्रांसफर विवरण",
        paymentMarked: "डेमो भुगतान सफल के रूप में मार्क कर दिया गया है।",
        paymentStatusHeader: "भुगतान स्थिति",
        billingAssist: "मैं आपके साथ हूँ। बिल, कुल बकाया और भुगतान के स्टेप्स बताता हूँ।",
        careStarted: "7 दिन की डिस्चार्ज देखभाल शुरू हो गई है। आपको रोज़ लक्षण चेक-इन मिलेगा।",
        careStopped: "7 दिन की डिस्चार्ज देखभाल बंद कर दी गई है।",
        checkinSaved: "रोज़ का चेक-इन समय सेव हो गया है।",
        checkinBadFormat: "यह फॉर्मेट इस्तेमाल करें: /setcheckin 09:00",
        dailyCheckin: "दैनिक चेक-इन",
        dangerPrompt: "अगर सीने में दर्द, सांस लेने में दिक्कत, ज्यादा खून बहना, बेहोशी, या तेज दर्द हो तो तुरंत नजदीकी अस्पताल जाएँ।",
        careCompleted: "7 दिन का फॉलो-अप पूरा हुआ। दवाएं जारी रखें और लक्षण बढ़ें तो डॉक्टर से संपर्क करें।"
    }
};

const userData = {};

function detectLanguage(text) {
    if (!text || text.trim().length === 0) {
        return "en";
    }

    if (/[\u0B80-\u0BFF]/.test(text)) {
        return "ta";
    }

    if (/[\u0900-\u097F]/.test(text)) {
        return "hi";
    }

    const code = franc(text, { minLength: 3 });

    if (code === "tam") {
        return "ta";
    }

    if (code === "hin") {
        return "hi";
    }

    return "en";
}

function t(lang, key) {
    return (translations[lang] && translations[lang][key]) || translations.en[key];
}

function createDefaultBillingProfile() {
    return {
        upiId: "jeevancare.hospital@upi",
        bank: {
            accountName: "JeevanCare Hospital Pvt Ltd",
            accountNumber: "123456789012",
            ifsc: "JCBK0001234",
            bankName: "JeevanCare Bank"
        },
        bills: [
            { id: "INV-1001", title: "Room Charges", amount: 4200, status: "unpaid", date: "2026-03-26" },
            { id: "INV-1002", title: "Lab Tests", amount: 1850, status: "unpaid", date: "2026-03-26" },
            { id: "INV-1003", title: "Pharmacy", amount: 1325, status: "unpaid", date: "2026-03-27" }
        ],
        payments: []
    };
}

function formatInr(amount) {
    return `Rs ${Number(amount || 0).toFixed(2)}`;
}

function buildBillsSummaryText(lang, profile) {
    const bills = Array.isArray(profile.billing?.bills) ? profile.billing.bills : [];
    if (bills.length === 0) {
        return t(lang, "noBills");
    }

    const lines = bills.map((b) => `- ${b.id}: ${b.title} | ${formatInr(b.amount)} | ${b.status}`);
    const total = bills.reduce((sum, b) => sum + Number(b.amount || 0), 0);
    const due = bills.filter((b) => b.status !== "paid").reduce((sum, b) => sum + Number(b.amount || 0), 0);
    const paid = total - due;

    return `${t(lang, "billsHeader")}:\n${lines.join("\n")}\n\nTotal: ${formatInr(total)}\nPaid: ${formatInr(paid)}\nDue: ${formatInr(due)}`;
}

function findBill(profile, billId) {
    const target = String(billId || "").trim().toUpperCase();
    const bills = Array.isArray(profile.billing?.bills) ? profile.billing.bills : [];
    return bills.find((b) => String(b.id || "").toUpperCase() === target);
}

function markBillPaid(profile, bill, method) {
    bill.status = "paid";
    profile.billing.payments.push({
        billId: bill.id,
        method,
        amount: bill.amount,
        paidAt: new Date().toISOString(),
        txnId: `DEMO-${Date.now()}`
    });
}

function buildUpiText(lang, profile, bill) {
    const upiId = profile.billing.upiId;
    const upiLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent("JeevanCare Hospital")}&am=${bill.amount}&tn=${encodeURIComponent(bill.id)}`;
    return `${t(lang, "upiReady")}:\nBill: ${bill.id}\nAmount: ${formatInr(bill.amount)}\nUPI ID: ${upiId}\nUPI Link: ${upiLink}`;
}

function buildBankText(lang, profile, bill) {
    const bank = profile.billing.bank;
    return `${t(lang, "bankReady")}:\nBill: ${bill.id}\nAmount: ${formatInr(bill.amount)}\nAccount Name: ${bank.accountName}\nAccount Number: ${bank.accountNumber}\nIFSC: ${bank.ifsc}\nBank: ${bank.bankName}`;
}

function buildPaymentStatusText(lang, profile) {
    const payments = Array.isArray(profile.billing?.payments) ? profile.billing.payments : [];
    if (payments.length === 0) {
        return t(lang, "payStatusEmpty");
    }

    const lines = payments.slice(-5).reverse().map((p) => `- ${p.billId} | ${p.method.toUpperCase()} | ${formatInr(p.amount)} | ${p.txnId}`);
    return `${t(lang, "paymentStatusHeader")}:\n${lines.join("\n")}`;
}

function isBillingIntent(text) {
    const q = String(text || "").toLowerCase();
    return /(bill|billing|invoice|amount|due|total|payment|pay|upi|bank|charges|receipt|balance|பில்|கட்டணம்|பணம்|ரசீது|बिल|भुगतान|बाकी|राशि)/i.test(q);
}

function buildBillingIntentReply(lang, profile) {
    const due = (profile.billing?.bills || []).filter((b) => b.status !== "paid").reduce((sum, b) => sum + Number(b.amount || 0), 0);
    if (lang === "ta") {
        return `${profile.name}, ${t(lang, "billingAssist")}\nதற்போதைய நிலுவை: ${formatInr(due)}\nமுழு விவரங்களுக்கு /bills அனுப்பவும்.\nகட்டணத்திற்கு /payupi <billId> அல்லது /paybank <billId> பயன்படுத்தவும்.`;
    }

    if (lang === "hi") {
        return `${profile.name}, ${t(lang, "billingAssist")}\nवर्तमान बकाया: ${formatInr(due)}\nपूरी जानकारी के लिए /bills भेजें।\nभुगतान के लिए /payupi <billId> या /paybank <billId> इस्तेमाल करें।`;
    }

    return `${profile.name}, ${t(lang, "billingAssist")}\nCurrent due: ${formatInr(due)}\nUse /bills to view all items.\nUse /payupi <billId> or /paybank <billId> for demo payment.`;
}

function shouldProcessMessage(msg, source = "default") {
    const chatId = msg?.chat?.id;
    const messageId = msg?.message_id;

    if (!chatId || !messageId) {
        return true;
    }

    const key = `${chatId}:${messageId}:${source}`;
    if (processedMessages.has(key)) {
        return false;
    }

    processedMessages.set(key, Date.now());

    // Keep memory bounded in long-running process.
    if (processedMessages.size > 2000) {
        const cutoff = Date.now() - 30 * 60 * 1000;
        for (const [k, ts] of processedMessages.entries()) {
            if (ts < cutoff) {
                processedMessages.delete(k);
            }
        }
    }

    return true;
}

function syncPatientRecord(chatId, profile, msg) {
    const from = msg?.from || {};
    const key = String(chatId);
    const existing = patientStore[key] || {};

    patientStore[key] = {
        ...existing,
        chatId,
        telegram: {
            username: from.username || existing?.telegram?.username || null,
            firstName: from.first_name || existing?.telegram?.firstName || null,
            lastName: from.last_name || existing?.telegram?.lastName || null
        },
        patient: {
            name: profile.name,
            condition: profile.condition,
            dayAfterDischarge: profile.day,
            meds: profile.meds,
            language: profile.language,
            carePlan: profile.carePlan,
            billing: profile.billing
        },
        updatedAt: new Date().toISOString(),
        createdAt: existing.createdAt || new Date().toISOString()
    };

    savePatientStore();
}

function ensureUser(chatId, msg) {
    if (!userData[chatId]) {
        const existing = patientStore[String(chatId)]?.patient || {};
        const firstName = msg?.from?.first_name && String(msg.from.first_name).trim().length > 0
            ? String(msg.from.first_name).trim()
            : "Patient";

        userData[chatId] = {
            name: existing.name || firstName,
            condition: existing.condition || "General recovery",
            day: existing.dayAfterDischarge || 1,
            meds: Array.isArray(existing.meds) ? existing.meds : [],
            language: existing.language || "en",
            pendingInput: null,
            billing: existing.billing || createDefaultBillingProfile(),
            carePlan: existing.carePlan || {
                active: false,
                startDate: null,
                totalDays: 7,
                checkinTime: "09:00"
            },
            medReminderJobs: [],
            careReminderJob: null
        };

        if (!userData[chatId].carePlan.totalDays) {
            userData[chatId].carePlan.totalDays = 7;
        }
        if (!userData[chatId].carePlan.checkinTime) {
            userData[chatId].carePlan.checkinTime = "09:00";
        }
    }

    syncPatientRecord(chatId, userData[chatId], msg);
    return userData[chatId];
}

function clearMedicationReminderJobs(profile) {
    for (const job of profile.medReminderJobs) {
        job.stop();
    }
    profile.medReminderJobs = [];
}

function clearCareReminderJob(profile) {
    if (profile.careReminderJob) {
        profile.careReminderJob.stop();
        profile.careReminderJob = null;
    }
}

function parseMeds(input) {
    // Expected: Med1|08:00,20:00;Med2|09:00
    const entries = input
        .split(";")
        .map((part) => part.trim())
        .filter(Boolean);

    const meds = [];

    for (const entry of entries) {
        const [namePart, timesPart] = entry.split("|").map((x) => x && x.trim());
        if (!namePart || !timesPart) {
            return null;
        }

        const times = timesPart
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean);

        if (times.length === 0) {
            return null;
        }

        for (const time of times) {
            if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(time)) {
                return null;
            }
        }

        meds.push({
            name: namePart,
            times
        });
    }

    return meds.length > 0 ? meds : null;
}

function scheduleMedicationReminders(chatId, lang, profile) {
    clearMedicationReminderJobs(profile);

    for (const med of profile.meds) {
        for (const time of med.times) {
            const [hour, minute] = time.split(":").map(Number);
            const expression = `${minute} ${hour} * * *`;
            const task = cron.schedule(
                expression,
                async () => {
                    const text = `${t(lang, "reminder")}: ${med.name} (${time})`;
                    await bot.sendMessage(chatId, text);
                },
                { timezone: "Asia/Kolkata" }
            );
            profile.medReminderJobs.push(task);
        }
    }
}

function parseTime(value) {
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(value)) {
        return null;
    }

    const [hour, minute] = value.split(":").map(Number);
    return { hour, minute };
}

function getCareDayNumber(startDateIso) {
    if (!startDateIso) {
        return 1;
    }

    const start = new Date(startDateIso).getTime();
    const now = Date.now();
    const day = Math.floor((now - start) / (24 * 60 * 60 * 1000)) + 1;
    return day < 1 ? 1 : day;
}

function buildCheckinMessage(lang, profile, dayNumber) {
    if (lang === "ta") {
        return `${t(lang, "dailyCheckin")} - நாள் ${dayNumber}/7\n${profile.name}, இன்று எப்படி உணர்கிறீர்கள்? வலி, காய்ச்சல், சுவாச சிரமம், அல்லது புதிய அறிகுறிகள் உள்ளதா?\n${t(lang, "dangerPrompt")}`;
    }

    if (lang === "hi") {
        return `${t(lang, "dailyCheckin")} - दिन ${dayNumber}/7\n${profile.name}, आज आप कैसा महसूस कर रहे हैं? क्या दर्द, बुखार, सांस की तकलीफ, या नया लक्षण है?\n${t(lang, "dangerPrompt")}`;
    }

    return `${t(lang, "dailyCheckin")} - Day ${dayNumber}/7\n${profile.name}, how are you feeling today? Any pain, fever, breathing difficulty, or new symptoms?\n${t(lang, "dangerPrompt")}`;
}

function scheduleCareCheckin(chatId, profile) {
    clearCareReminderJob(profile);

    if (!profile.carePlan.active) {
        return;
    }

    const parsed = parseTime(profile.carePlan.checkinTime || "09:00");
    if (!parsed) {
        return;
    }

    const expression = `${parsed.minute} ${parsed.hour} * * *`;
    profile.careReminderJob = cron.schedule(
        expression,
        async () => {
            const dayNumber = getCareDayNumber(profile.carePlan.startDate);
            const lang = profile.language || "en";

            if (dayNumber > (profile.carePlan.totalDays || 7)) {
                profile.carePlan.active = false;
                clearCareReminderJob(profile);
                syncPatientRecord(chatId, profile);
                await bot.sendMessage(chatId, t(lang, "careCompleted"));
                return;
            }

            const msg = buildCheckinMessage(lang, profile, dayNumber);
            await bot.sendMessage(chatId, msg);
        },
        { timezone: "Asia/Kolkata" }
    );
}

function buildProfileText(lang, profile) {
    const medsText = profile.meds.length
        ? profile.meds.map((m) => `${m.name}: ${m.times.join(", ")}`).join("\n")
        : "Not set";

    return `${t(lang, "profileHeader")}\nName: ${profile.name}\nCondition: ${profile.condition}\nDay After Discharge: ${profile.day}\nMeds:\n${medsText}`;
}

function buildRecordText(lang, chatId) {
    const record = patientStore[String(chatId)];
    if (!record) {
        return `${t(lang, "recordHeader")}: Not found`;
    }

    const meds = Array.isArray(record.patient?.meds) && record.patient.meds.length > 0
        ? record.patient.meds.map((m) => `${m.name}: ${(m.times || []).join(", ")}`).join("\n")
        : "Not set";

    return `${t(lang, "recordHeader")}:\nName: ${record.patient?.name || "Patient"}\nCondition: ${record.patient?.condition || "General recovery"}\nDay After Discharge: ${record.patient?.dayAfterDischarge || 1}\nTelegram: @${record.telegram?.username || "unknown"}\nLast Updated: ${record.updatedAt || "unknown"}\nMeds:\n${meds}`;
}

function buildLocalFallbackResponse(lang, profile, userText) {
    const text = String(userText || "").toLowerCase();
    const hasCriticalSymptom =
        text.includes("chest pain") ||
        text.includes("breathing") ||
        text.includes("heavy bleeding") ||
        text.includes("faint") ||
        text.includes("severe pain");

    if (hasCriticalSymptom) {
        if (lang === "ta") {
            return "இது மோசமான அறிகுறியாக இருக்கலாம். உடனே உங்கள் மருத்துவரை தொடர்புகொள்ளவும் அல்லது அருகிலுள்ள மருத்துவமனைக்கு செல்லவும். நீங்கள் இப்போது தனியாக உள்ளீர்களா?";
        }

        if (lang === "hi") {
            return "यह गंभीर हो सकता है। कृपया तुरंत अपने डॉक्टर से संपर्क करें या नजदीकी अस्पताल जाएँ। क्या आप अभी अकेले हैं?";
        }

        return "This may be serious. Please contact your doctor or go to the nearest hospital immediately. Are you alone right now?";
    }

    if (lang === "ta") {
        return `நான் உதவ தயாராக இருக்கிறேன். இப்போது உங்கள் நிலை: ${profile.condition}, டிஸ்சார்ஜ் ஆன பிந்தைய நாள் ${profile.day}. சிறிய வலி அல்லது அவதி இருந்தால் ஓய்வு எடுக்கவும், தண்ணீர் குடிக்கவும், உங்கள் மருந்தை நேரத்தில் எடுத்துக்கொள்ளவும். அறிகுறி அதிகரித்தால் உடனே மருத்துவரை தொடர்புகொள்ளவும்.`;
    }

    if (lang === "hi") {
        return `मैं आपकी मदद के लिए यहां हूं। आपकी स्थिति: ${profile.condition}, डिस्चार्ज के बाद दिन ${profile.day}. हल्का दर्द या असहजता हो तो आराम करें, पानी पिएं और दवा समय पर लें। लक्षण बढ़ें तो तुरंत अपने डॉक्टर से संपर्क करें।`;
    }

    return `I am here to help. Current profile: ${profile.condition}, day ${profile.day} after discharge. For mild discomfort, rest, hydrate, and take medicines on time. If symptoms worsen, contact your treating doctor immediately.`;
}

async function queryOpenRouter(userContext) {
    const endpoint = "https://openrouter.ai/api/v1/chat/completions";
    const headers = {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://telegram.org",
        "X-Title": "jeevancarebot"
    };
    const modelErrors = [];

    // One-by-one fallback in the exact model order.
    for (const model of ACTIVE_OPENROUTER_MODELS) {
        try {
            const response = await axios.post(
                endpoint,
                {
                    model,
                    max_tokens: OPENROUTER_MAX_TOKENS,
                    temperature: 0.6,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userContext }
                    ]
                },
                {
                    headers,
                    timeout: OPENROUTER_MODEL_TIMEOUT_MS
                }
            );

            const content = response.data.choices?.[0]?.message?.content;
            if (content && String(content).trim().length > 0) {
                return content;
            }

            modelErrors.push(`${model}: empty response`);
        } catch (error) {
            const status = error?.response?.status;
            const message =
                error?.response?.data?.error?.message ||
                error?.response?.data?.message ||
                error.message ||
                "unknown error";
            modelErrors.push(`${model}: ${status || "no-status"} ${message}`);
        }
    }

    throw new Error(`All OpenRouter fallback models failed: ${modelErrors.join(" | ")}`);
}

bot.onText(/^\/start$/, async (msg) => {
    if (!shouldProcessMessage(msg, "command")) {
        return;
    }

    const chatId = msg.chat.id;
    const lang = detectLanguage(msg.text || "");
    const profile = ensureUser(chatId, msg);
    profile.language = lang;
    await bot.sendMessage(chatId, t(lang, "welcome"));
    await bot.sendMessage(chatId, t(lang, "startGuide"));
    await bot.sendMessage(chatId, t(lang, "billingIntro"));
});

bot.onText(/^\/help$/, async (msg) => {
    if (!shouldProcessMessage(msg, "command")) {
        return;
    }

    const chatId = msg.chat.id;
    const lang = detectLanguage(msg.text || "");
    await bot.sendMessage(chatId, t(lang, "help"));
});

bot.onText(/^\/bills$/i, async (msg) => {
    if (!shouldProcessMessage(msg, "command")) {
        return;
    }

    const chatId = msg.chat.id;
    const lang = detectLanguage(msg.text || "");
    const profile = ensureUser(chatId, msg);
    profile.language = lang;
    syncPatientRecord(chatId, profile, msg);
    await bot.sendMessage(chatId, buildBillsSummaryText(lang, profile));
});

bot.onText(/^\/payupi\s+(.+)$/i, async (msg, match) => {
    if (!shouldProcessMessage(msg, "command")) {
        return;
    }

    const chatId = msg.chat.id;
    const lang = detectLanguage(msg.text || "");
    const profile = ensureUser(chatId, msg);
    profile.language = lang;

    const bill = findBill(profile, match[1]);
    if (!bill) {
        await bot.sendMessage(chatId, t(lang, "billNotFound"));
        return;
    }

    if (bill.status === "paid") {
        await bot.sendMessage(chatId, t(lang, "billAlreadyPaid"));
        return;
    }

    await bot.sendMessage(chatId, buildUpiText(lang, profile, bill));
    markBillPaid(profile, bill, "upi");
    syncPatientRecord(chatId, profile, msg);
    await bot.sendMessage(chatId, t(lang, "paymentMarked"));
});

bot.onText(/^\/payupi$/i, async (msg) => {
    if (!shouldProcessMessage(msg, "command")) {
        return;
    }

    const chatId = msg.chat.id;
    const lang = detectLanguage(msg.text || "");
    await bot.sendMessage(chatId, t(lang, "payUpiUsage"));
});

bot.onText(/^\/paybank\s+(.+)$/i, async (msg, match) => {
    if (!shouldProcessMessage(msg, "command")) {
        return;
    }

    const chatId = msg.chat.id;
    const lang = detectLanguage(msg.text || "");
    const profile = ensureUser(chatId, msg);
    profile.language = lang;

    const bill = findBill(profile, match[1]);
    if (!bill) {
        await bot.sendMessage(chatId, t(lang, "billNotFound"));
        return;
    }

    if (bill.status === "paid") {
        await bot.sendMessage(chatId, t(lang, "billAlreadyPaid"));
        return;
    }

    await bot.sendMessage(chatId, buildBankText(lang, profile, bill));
    markBillPaid(profile, bill, "bank");
    syncPatientRecord(chatId, profile, msg);
    await bot.sendMessage(chatId, t(lang, "paymentMarked"));
});

bot.onText(/^\/paybank$/i, async (msg) => {
    if (!shouldProcessMessage(msg, "command")) {
        return;
    }

    const chatId = msg.chat.id;
    const lang = detectLanguage(msg.text || "");
    await bot.sendMessage(chatId, t(lang, "payBankUsage"));
});

bot.onText(/^\/paystatus$/i, async (msg) => {
    if (!shouldProcessMessage(msg, "command")) {
        return;
    }

    const chatId = msg.chat.id;
    const lang = detectLanguage(msg.text || "");
    const profile = ensureUser(chatId, msg);
    profile.language = lang;
    await bot.sendMessage(chatId, buildPaymentStatusText(lang, profile));
});

bot.onText(/^\/setname\s+(.+)$/i, async (msg, match) => {
    if (!shouldProcessMessage(msg, "command")) {
        return;
    }

    const chatId = msg.chat.id;
    const profile = ensureUser(chatId, msg);
    const lang = detectLanguage(msg.text || "");
    profile.language = lang;
    profile.name = match[1].trim();
    syncPatientRecord(chatId, profile, msg);
    await bot.sendMessage(chatId, t(lang, "savedName"));
});

bot.onText(/^\/setname$/i, async (msg) => {
    if (!shouldProcessMessage(msg, "command")) {
        return;
    }

    const chatId = msg.chat.id;
    const lang = detectLanguage(msg.text || "");
    const profile = ensureUser(chatId, msg);
    profile.pendingInput = "name";
    syncPatientRecord(chatId, profile, msg);
    await bot.sendMessage(chatId, t(lang, "setNameUsage"));
});

bot.onText(/^\/setcondition\s+(.+)$/i, async (msg, match) => {
    if (!shouldProcessMessage(msg, "command")) {
        return;
    }

    const chatId = msg.chat.id;
    const profile = ensureUser(chatId, msg);
    const lang = detectLanguage(msg.text || "");
    profile.language = lang;
    profile.condition = match[1].trim();
    syncPatientRecord(chatId, profile, msg);
    await bot.sendMessage(chatId, t(lang, "savedCondition"));
});

bot.onText(/^\/setcondition$/i, async (msg) => {
    if (!shouldProcessMessage(msg, "command")) {
        return;
    }

    const chatId = msg.chat.id;
    const lang = detectLanguage(msg.text || "");
    await bot.sendMessage(chatId, t(lang, "setConditionUsage"));
});

bot.onText(/^\/setday\s+(\d+)$/i, async (msg, match) => {
    if (!shouldProcessMessage(msg, "command")) {
        return;
    }

    const chatId = msg.chat.id;
    const profile = ensureUser(chatId, msg);
    const lang = detectLanguage(msg.text || "");
    profile.language = lang;
    profile.day = Number(match[1]);
    syncPatientRecord(chatId, profile, msg);
    await bot.sendMessage(chatId, t(lang, "savedDay"));
});

bot.onText(/^\/setday$/i, async (msg) => {
    if (!shouldProcessMessage(msg, "command")) {
        return;
    }

    const chatId = msg.chat.id;
    const lang = detectLanguage(msg.text || "");
    await bot.sendMessage(chatId, t(lang, "badDay"));
});

bot.onText(/^\/setmeds\s+(.+)$/i, async (msg, match) => {
    if (!shouldProcessMessage(msg, "command")) {
        return;
    }

    const chatId = msg.chat.id;
    const profile = ensureUser(chatId, msg);
    const lang = detectLanguage(msg.text || "");
    profile.language = lang;
    const meds = parseMeds(match[1]);

    if (!meds) {
        await bot.sendMessage(chatId, t(lang, "medsBadFormat"));
        return;
    }

    profile.meds = meds;
    scheduleMedicationReminders(chatId, lang, profile);
    syncPatientRecord(chatId, profile, msg);
    await bot.sendMessage(chatId, t(lang, "medsSaved"));
});

bot.onText(/^\/setmeds$/i, async (msg) => {
    if (!shouldProcessMessage(msg, "command")) {
        return;
    }

    const chatId = msg.chat.id;
    const lang = detectLanguage(msg.text || "");
    await bot.sendMessage(chatId, t(lang, "setMedsUsage"));
});

bot.onText(/^\/setcheckin\s+(.+)$/i, async (msg, match) => {
    if (!shouldProcessMessage(msg, "command")) {
        return;
    }

    const chatId = msg.chat.id;
    const profile = ensureUser(chatId, msg);
    const lang = detectLanguage(msg.text || "");
    profile.language = lang;

    const value = String(match[1]).trim();
    if (!parseTime(value)) {
        await bot.sendMessage(chatId, t(lang, "checkinBadFormat"));
        return;
    }

    profile.carePlan.checkinTime = value;
    scheduleCareCheckin(chatId, profile);
    syncPatientRecord(chatId, profile, msg);
    await bot.sendMessage(chatId, t(lang, "checkinSaved"));
});

bot.onText(/^\/setcheckin$/i, async (msg) => {
    if (!shouldProcessMessage(msg, "command")) {
        return;
    }

    const chatId = msg.chat.id;
    const lang = detectLanguage(msg.text || "");
    await bot.sendMessage(chatId, t(lang, "checkinBadFormat"));
});

bot.onText(/^\/startcare$/i, async (msg) => {
    if (!shouldProcessMessage(msg, "command")) {
        return;
    }

    const chatId = msg.chat.id;
    const profile = ensureUser(chatId, msg);
    const lang = detectLanguage(msg.text || "");
    profile.language = lang;
    profile.carePlan.active = true;
    profile.carePlan.startDate = new Date().toISOString();
    profile.carePlan.totalDays = 7;

    scheduleCareCheckin(chatId, profile);
    syncPatientRecord(chatId, profile, msg);
    await bot.sendMessage(chatId, t(lang, "careStarted"));
    await bot.sendMessage(chatId, buildCheckinMessage(lang, profile, 1));
});

bot.onText(/^\/stopcare$/i, async (msg) => {
    if (!shouldProcessMessage(msg, "command")) {
        return;
    }

    const chatId = msg.chat.id;
    const profile = ensureUser(chatId, msg);
    const lang = detectLanguage(msg.text || "");
    profile.language = lang;
    profile.carePlan.active = false;
    clearCareReminderJob(profile);
    syncPatientRecord(chatId, profile, msg);
    await bot.sendMessage(chatId, t(lang, "careStopped"));
});

bot.onText(/^\/profile$/, async (msg) => {
    if (!shouldProcessMessage(msg, "command")) {
        return;
    }

    const chatId = msg.chat.id;
    const lang = detectLanguage(msg.text || "");
    const profile = ensureUser(chatId, msg);
    profile.language = lang;
    await bot.sendMessage(chatId, buildProfileText(lang, profile));
});

bot.onText(/^\/record$/, async (msg) => {
    if (!shouldProcessMessage(msg, "command")) {
        return;
    }

    const chatId = msg.chat.id;
    const lang = detectLanguage(msg.text || "");
    const profile = ensureUser(chatId, msg);
    profile.language = lang;
    syncPatientRecord(chatId, profile, msg);
    await bot.sendMessage(chatId, buildRecordText(lang, chatId));
});

bot.on("message", async (msg) => {
    if (!shouldProcessMessage(msg, "message")) {
        return;
    }

    if (!msg.text || msg.text.startsWith("/")) {
        return;
    }

    const chatId = msg.chat.id;
    const text = msg.text;
    const profile = ensureUser(chatId, msg);
    const lang = detectLanguage(text);
    profile.language = lang;

    if (profile.pendingInput === "name") {
        const clean = String(text).trim();
        if (clean.length >= 2 && clean.length <= 50) {
            profile.name = clean;
            profile.pendingInput = null;
            syncPatientRecord(chatId, profile, msg);
            await bot.sendMessage(chatId, `${t(lang, "savedName")} ${profile.name}.`);
            return;
        }

        await bot.sendMessage(chatId, t(lang, "setNameUsage"));
        return;
    }

    if (isBillingIntent(text)) {
        await bot.sendMessage(chatId, buildBillingIntentReply(lang, profile));
        return;
    }

    const medsSummary = profile.meds.length
        ? profile.meds.map((m) => `${m.name}: ${m.times.join(",")}`).join("; ")
        : "Not set";

    const userContext = `Patient Info:\nName: ${profile.name}\nCondition: ${profile.condition}\nDay After Discharge: ${profile.day}\nPreferred Language: ${lang}\nMedication Schedule: ${medsSummary}\n\nUser Message:\n${text}`;

    try {
        await bot.sendChatAction(chatId, "typing");
        const reply = await queryOpenRouter(userContext);

        if (!reply) {
            await bot.sendMessage(chatId, t(lang, "fallbackError"));
            return;
        }

        await bot.sendMessage(chatId, reply);
        syncPatientRecord(chatId, profile, msg);
    } catch (error) {
        console.error("OpenRouter error:", error?.response?.data || error.message);
        const localReply = buildLocalFallbackResponse(lang, profile, text);
        await bot.sendMessage(chatId, localReply);
        if (profile.name === "Patient") {
            await bot.sendMessage(chatId, t(lang, "askName"));
        }
        if (profile.condition === "General recovery") {
            await bot.sendMessage(chatId, t(lang, "askCondition"));
        }
    }
});

let pollingRestartTimeout = null;
let isStartingPolling = false;
let lastConflictLogAt = 0;

async function startPolling() {
    if (isStartingPolling) {
        return;
    }

    isStartingPolling = true;

    try {
        // Ensure no stale webhook blocks polling mode.
        await bot.deleteWebHook({ drop_pending_updates: true });
        await bot.startPolling({
            restart: false,
            interval: 300,
            params: {
                timeout: 10
            }
        });
        console.log("JeevanCareBot is running...");
    } catch (error) {
        console.error("Polling startup failed:", error?.message || error);
        setTimeout(startPolling, 4000);
    } finally {
        isStartingPolling = false;
    }
}

bot.on("polling_error", (error) => {
    const message = error?.message || "unknown polling error";

    if (message.includes("409 Conflict")) {
        const now = Date.now();
        if (now - lastConflictLogAt > 8000) {
            console.warn("Another bot instance is already polling. Retrying in 8 seconds...");
            lastConflictLogAt = now;
        }

        if (pollingRestartTimeout) {
            return;
        }

        pollingRestartTimeout = setTimeout(async () => {
            pollingRestartTimeout = null;
            try {
                await bot.stopPolling();
            } catch (stopErr) {
                // ignore stop errors and retry polling startup
            }
            await startPolling();
        }, 8000);
        return;
    }

    console.error("Polling error:", message);
});

function restoreSchedulesFromStore() {
    for (const [chatIdString] of Object.entries(patientStore)) {
        const chatId = Number(chatIdString);
        if (!Number.isFinite(chatId)) {
            continue;
        }

        const profile = ensureUser(chatId);
        scheduleMedicationReminders(chatId, profile.language || "en", profile);
        scheduleCareCheckin(chatId, profile);
    }
}

try {
    acquireProcessLock();
    restoreSchedulesFromStore();
    startPolling();
} catch (error) {
    console.error(error?.message || "Failed to start JeevanCareBot.");
    process.exit(1);
}
