// import_products.js — Makhazen only (مع تنظيف الهيدر)
import fs from "fs";
import yaml from "js-yaml";
import fetch from "node-fetch";

const config = yaml.load(fs.readFileSync("config.yml", "utf8"));
const makKey = String(config?.makhazen?.api_key || "").trim();

if (!makKey) {
  console.error("❌ مفقود مفتاح مخازن في config.yml (makhazen.api_key).");
  process.exit(1);
}

async function fetchAPI(url, headers = {}) {
  if (headers.Authorization) headers.Authorization = headers.Authorization.trim();
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  return await res.json();
}

function normalize(p, source = "makhazen") {
  const images = Array.isArray(p.images) && p.images.length ? p.images
               : p.main_image ? [p.main_image] : [];
  return {
    source,
    external_id: p.id || p.sku || p.product_id || "",
    category: String(p.category || "").toLowerCase(),
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
    const url =
      "https://api.makhazen.sa/v1/products/search?categories=men_tshirts,women_abaya,men_pants,men_shirts,shoes,glasses,watches,bags,beauty_serums,beauty_cleansers,moisturizers,hair_care,makeup_powder,makeup_lipstick,makeup_mascara&sort=orders_desc&min_rating=4.6&min_orders=50&limit=120&market=sa";

    const raw = await fetchAPI(url, {
      Authorization: `Bearer ${makKey}`,
      Accept: "application/json"
    });

    const allowed = new Set([
      "men_tshirts","men_pants","men_shirts","shoes","glasses","watches","bags",
      "women_abaya","women_tshirts","women_dresses",
      "beauty_serums","beauty_cleansers","moisturizers","hair_care",
      "makeup_powder","makeup_lipstick","makeup_mascara"
    ]);

    const filtered = (raw || []).filter(p => {
      const catOk = allowed.has(String(p.category || "").toLowerCase());
      const hasImg = (p.images && p.images.length) || p.main_image;
      return catOk && Number(p.rating || 0) >= 4.6 && Number(p.orders || 0) >= 50 && hasImg;
    });

    const normalized = filtered.map(p => normalize(p));
    fs.writeFileSync("products_raw.json", JSON.stringify(normalized, null, 2), "utf8");
    console.log("✅ تم إنشاء products_raw.json بعدد:", normalized.length);
  } catch (e) {
    console.error("❌ خطأ:", e.message);
    process.exit(1);
  }
}

main();
