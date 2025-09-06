// import_products.js
// سكربت لجلب المنتجات من AutoDrop + مخازن مع فلترة أولية

import fs from "fs";
import yaml from "js-yaml";
import fetch from "node-fetch";

// قراءة إعدادات config.yml
const config = yaml.load(fs.readFileSync("config.yml", "utf8"));

const { autodrop, makhazen } = config;

// دالة مساعدة لاستدعاء API
async function fetchAPI(url, headers = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP error! ${res.status}`);
  return await res.json();
}

async function main() {
  try {
    // --- AutoDrop ---
    const autoDropUrl = `https://api.autodrop.ai/v1/aliexpress/search?categories=men_tshirts,women_abaya,men_pants,men_shirts,shoes,glasses,watches,bags,beauty_serums,beauty_cleansers,moisturizers,hair_care,makeup_powder,makeup_lipstick,makeup_mascara&sort=orders_desc&min_rating=4.6&min_orders=100&limit=50&market=sa`;

    const adProducts = await fetchAPI(autoDropUrl, {
      Authorization: `Bearer ${autodrop.api_key}`,
      Accept: "application/json",
    });

    // --- مخازن ---
    const makhazenUrl = `https://api.makhazen.sa/v1/products/search?categories=men_tshirts,women_abaya,men_pants,men_shirts,shoes,glasses,watches,bags,beauty_serums,beauty_cleansers,moisturizers,hair_care,makeup_powder,makeup_lipstick,makeup_mascara&sort=orders_desc&min_rating=4.6&min_orders=50&limit=50&market=sa`;

    const mkProducts = await fetchAPI(makhazenUrl, {
      Authorization: `Bearer ${makhazen.api_key}`,
      Accept: "application/json",
    });

    // --- دمج + فلترة ---
    const merged = [...(adProducts || []), ...(mkProducts || [])];

    const filtered = merged.filter((p) => {
      const rating = Number(p.rating || 0);
      const orders = Number(p.orders || 0);
      return rating >= 4.6 && orders >= 50;
    });

    console.log("✅ عدد المنتجات بعد الفلترة:", filtered.length);
    console.log(filtered.slice(0, 5)); // نعرض أول 5 منتجات للتأكد
  } catch (err) {
    console.error("❌ خطأ:", err.message);
  }
}

main();
