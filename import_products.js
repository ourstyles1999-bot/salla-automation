// import_products.js
// يجلب المنتجات من AutoDrop + مخازن ويكتبها في products_raw.json بصيغة موحّدة

import fs from "fs";
import yaml from "js-yaml";
import fetch from "node-fetch";

// قراءة إعدادات config.yml (محلي لديك)
const config = yaml.load(fs.readFileSync("config.yml", "utf8"));
const { autodrop, makhazen } = config;

async function fetchAPI(url, headers = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  return await res.json();
}

function normalize(p, source = "unknown") {
  // توحيد الحقول لما تحتاجه السكربتات اللاحقة
  const images =
    p.images && Array.isArray(p.images) && p.images.length
      ? p.images
      : p.main_image
      ? [p.main_image]
      : [];

  return {
    source,
    external_id: p.id || p.sku || p.product_id || "",
    category: (p.category || "").toString().toLowerCase(),
    brand: p.brand || "",
    title_raw: p.title || p.name || "",
    desc_raw: p.description || p.desc || "",
    rating: Number(p.rating || 0),
    orders: Number(p.orders || p.sales || 0),
    supplier_price: Number(p.price || p.supplier_price || 0),
    supplier_shipping: Number(p.shipping_cost || p.shipping || 0),
    images,
    options: p.options || [],
    product_url: p.url || p.link || ""
  };
}

async function main() {
  try {
    // --- AutoDrop ---
    const autoDropUrl =
      "https://api.autodrop.ai/v1/aliexpress/search?categories=men_tshirts,women_abaya,men_pants,men_shirts,shoes,glasses,watches,bags,beauty_serums,beauty_cleansers,moisturizers,hair_care,makeup_powder,makeup_lipstick,makeup_mascara&sort=orders_desc&min_rating=4.6&min_orders=100&limit=120&market=sa";

    const ad = await fetchAPI(autoDropUrl, {
      Authorization: `Bearer ${autodrop.api_key}`,
      Accept: "application/json"
    });

    // --- مخازن ---
    const makhazenUrl =
      "https://api.makhazen.sa/v1/products/search?categories=men_tshirts,women_abaya,men_pants,men_shirts,shoes,glasses,watches,bags,beauty_serums,beauty_cleansers,moisturizers,hair_care,makeup_powder,makeup_lipstick,makeup_mascara&sort=orders_desc&min_rating=4.6&min_orders=50&limit=120&market=sa";

    const mk = await fetchAPI(makhazenUrl, {
      Authorization: `Bearer ${makhazen.api_key}`,
      Accept: "application/json"
    });

    // --- دمج + فلترة ---
    const merged = [...(ad || []), ...(mk || [])];

    const allowedCats = new Set([
      "men_tshirts","men_pants","men_shirts","shoes","glasses","watches","bags",
      "women_abaya","women_tshirts","women_dresses",
      "beauty_serums","beauty_cleansers","moisturizers","hair_care",
      "makeup_powder","makeup_lipstick","makeup_mascara"
    ]);

    const filtered = merged.filter((p) => {
      const catOk = allowedCats.has((p.category || "").toLowerCase());
      const rating = Number(p.rating || 0);
      const orders = Number(p.orders || 0);
      const hasImg =
        (p.images && p.images.length) || p.main_image ? true : false;
      return catOk && rating >= 4.6 && orders >= 50 && hasImg;
    });

    // --- توحيد الصيغة + حفظ ---
    const normalized = filtered.map((p) =>
      normalize(p, p.source || (p.vendor === "makhazen" ? "makhazen" : "autodrop"))
    );

    fs.writeFileSync(
      "products_raw.json",
      JSON.stringify(normalized, null, 2),
      "utf8"
    );

    console.log("✅ تم إنشاء products_raw.json بعدد منتجات:", normalized.length);
  } catch (e) {
    console.error("❌ خطأ:", e.message);
    process.exit(1);
  }
}

main();
