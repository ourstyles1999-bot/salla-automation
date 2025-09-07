// optimize_with_openai.js
// يعالج ملف JSON للمنتجات (products_raw.json) ويُنشئ ملف products_optimized.json
// - يعيد صياغة العنوان/الوصف بالعربية بأسلوب تسويقي خليجي
// - يولد وسوم SEO بالعربية
// - يحسب السعر النهائي: (سعر المورد + الشحن) * (1 + هامش الربح) * (1 + VAT)

import fs from "fs";
import yaml from "js-yaml";

// ==== تحميل الإعدادات من config.yml (محلي، غير مرفوع) ====
const config = yaml.load(fs.readFileSync("config.yml", "utf8"));
const { openai, settings } = config;

// ==== مدخلات/مخرجات ====
const INPUT_PATH = process.env.INPUT_PATH || "products_raw.json";
const OUTPUT_PATH = process.env.OUTPUT_PATH || "products_optimized.json";

// ==== دوال مساعدة للتسعير ====
function pickMargin(margins, basePrice) {
  for (const r of margins) {
    if (basePrice >= r.min && basePrice <= r.max) return Number(r.margin || 0.5);
  }
  // fallback
  return 0.5;
}

function computePrice(p) {
  const supplier = Number(p.supplier_price || 0);
  const shipping = Number(p.supplier_shipping || 0);
  const base = supplier + shipping;
  const margin = pickMargin(settings.profit_margin, base);
  const withMargin = base * (1 + margin);
  const withVAT = withMargin * (1 + Number(settings.vat_rate || 0.15));
  // تقريب لأقرب 0.5 ريال
  return Math.round(withVAT * 2) / 2;
}

// ==== دالة OpenAI (استدعاء مباشر عبر fetch القياسي) ====
async function callOpenAI(system, user) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openai.api_key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: openai.model || "gpt-4o-mini",
      temperature: openai.temperature ?? 0.7,
      max_tokens: openai.max_tokens ?? 800,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    })
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${t}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

// ==== قالب برومبت مُحسّن بالعربية ====
const SYSTEM_PROMPT = `
أنت كاتب تسويق عربي محترف لمنتجات متجر إلكتروني خليجي (السوق السعودي).
اكتب عناوين موجزة وجذابة، وأوصاف مقنعة ومنسقة بنِقاط، ووسوم SEO عربية قوية.
تجنّب المبالغات المخالفة للسياسات الصحية أو ادعاءات علاجية. اللغة عربية فصحى بلمسة خليجية راقية.
أعد فقط JSON صالح بالشكل المحدد دون أي نص إضافي.
الشكل:
{
  "title_ar": "...",
  "description_ar": "...",
  "seo_tags_ar": ["...", "...", "..."]
}
`;

function buildUserPrompt(p) {
  const cat = p.category || "";
  const brand = p.brand || "";
  const title = p.title_raw || "";
  const desc = (p.desc_raw || "").slice(0, 1200); // حماية من نصوص طويلة جداً
  // كلمات مفتاحية مساعدة
  const kw = [
    "خليجي", "السعودية", "متانة", "جودة", "تصميم عصري", "موثوق",
    "مناسب للاستخدام اليومي", "هدية رائعة", "قيمة ممتازة"
  ].join(", ");

  return `
البيانات:
- التصنيف: ${cat}
- العلامة: ${brand}
- العنوان الأصلي: ${title}
- الوصف الأصلي: ${desc}

المطلوب:
1) عنوان عربي قصير (حد أقصى ~60-70 حرف) غني بالكلمات المفتاحية وبدون علامات ترقيم زائدة.
2) وصف تسويقي عربي منسق بفقرات قصيرة ونقاط ✅ يتناول: الخامة/المكونات، المزايا، الاستخدام، الملائمة للموسم/المناسبة، الضمان/الاسترجاع (بصياغة محايدة).
3) 10–15 وسم SEO عربية بصيغة كلمات وعبارات بحثية (بدون # وبدون أرقام موديلات عشوائية).

تذكر: أعد فقط JSON بالشكل المحدد.
كلمات مفتاحية مساعدة: ${kw}
`;
}

// ==== التنفيذ ====
const raw = JSON.parse(fs.readFileSync(INPUT_PATH, "utf8"));
if (!Array.isArray(raw)) {
  console.error("الملف products_raw.json يجب أن يحتوي Array من المنتجات.");
  process.exit(1);
}

const out = [];

console.log(`🔧 معالجة ${raw.length} منتج... (قد يستغرق قليلاً محلياً)`);

for (const p of raw) {
  try {
    const aiText = await callOpenAI(SYSTEM_PROMPT, buildUserPrompt(p));
    const aiData = JSON.parse(aiText);
    const price = computePrice(p);
    out.push({
      ...p,
      ...aiData,
      final_price: price
    });
  } catch (e) {
    console.error(`⚠️ فشل معالجة المنتج ${p.external_id || p.title_raw}:`, e.message);
  }
}

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(out, null, 2), "utf8");
console.log(`✅ تم إنشاء ${OUTPUT_PATH} بعدد: ${out.length}`);
