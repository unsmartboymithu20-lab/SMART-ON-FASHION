require("dotenv").config();
const express = require("express");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const multer = require("multer");
const path = require("path");

const app = express();
const isProd = process.env.NODE_ENV === "production";
if (isProd && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
  throw new Error("SESSION_SECRET must be configured with at least 32 characters in production.");
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing. Configure a PostgreSQL connection in Render Environment.");
}
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false
});
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  store: new PgSession({ pool, tableName: "session" }),
  secret: process.env.SESSION_SECRET || "development-only-change-me",
  resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, secure: isProd, sameSite: "lax", maxAge: 7 * 86400000 }
}));
app.use(express.static(path.join(__dirname, "public")));

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY, full_name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
      phone TEXT DEFAULT '', password_hash TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, category TEXT DEFAULT 'Fashion',
      description TEXT DEFAULT '', price NUMERIC(12,2) NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0, image TEXT DEFAULT '',
      featured BOOLEAN DEFAULT FALSE, active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY, customer_name TEXT NOT NULL, phone TEXT NOT NULL,
      address TEXT NOT NULL, city TEXT DEFAULT 'Bangladesh',
      items JSONB NOT NULL, subtotal NUMERIC(12,2) NOT NULL,
      delivery_charge NUMERIC(12,2) NOT NULL DEFAULT 80,
      total NUMERIC(12,2) NOT NULL, payment_method TEXT DEFAULT 'Cash on Delivery',
      status TEXT DEFAULT 'Pending', created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY, value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS coupons (
      id SERIAL PRIMARY KEY, code TEXT UNIQUE NOT NULL, discount_type TEXT NOT NULL DEFAULT 'percent',
      discount_value NUMERIC(10,2) NOT NULL DEFAULT 0, min_order NUMERIC(12,2) NOT NULL DEFAULT 0,
      max_uses INTEGER, used_count INTEGER NOT NULL DEFAULT 0, active BOOLEAN NOT NULL DEFAULT TRUE,
      expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY, product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      customer_name TEXT NOT NULL, rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      comment TEXT DEFAULT '', approved BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, phone TEXT DEFAULT '', email TEXT DEFAULT '',
      subject TEXT DEFAULT '', message TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS subscribers (
      id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code TEXT DEFAULT '';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount NUMERIC(12,2) NOT NULL DEFAULT 0;
  `);
  const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || "");
  if (email && password) {
    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      `INSERT INTO admins(email,password_hash) VALUES($1,$2)
       ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash`,
      [email.toLowerCase(), hash]
    );
  } else {
    console.warn("ADMIN LOGIN NOT CONFIGURED: Set both ADMIN_EMAIL and ADMIN_PASSWORD in Render Environment.");
  }
  const count = await pool.query("SELECT COUNT(*)::int AS n FROM products");
  if (count.rows[0].n === 0) {
    const demo = [
      ["Classic Cotton T-Shirt","Men","Soft everyday cotton t-shirt.",650,30,"https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800",true],
      ["Everyday Casual Shirt","Men","Smart casual shirt for daily wear.",1250,20,"https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800",true],
      ["Elegant Summer Dress","Women","Lightweight summer dress.",1850,15,"https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800",true],
      ["Minimal Sneakers","Shoes","Comfortable everyday sneakers.",2200,12,"https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800",true],
      ["Classic Denim Jeans","Men","Versatile blue denim jeans.",1750,18,"https://images.unsplash.com/photo-1542272604-787c3835535d?w=800",false],
      ["Women's Casual Top","Women","Easy-to-style casual top.",950,22,"https://images.unsplash.com/photo-1551163943-3f6a855d1153?w=800",false],
      ["Premium Polo Shirt","Men","Smart polo shirt for everyday use.",1100,16,"https://images.unsplash.com/photo-1625910513413-5fc3b3f6f8d8?w=800",false],
      ["Lightweight Hoodie","Unisex","Comfortable hoodie for cool days.",1950,14,"https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800",true],
      ["Women's Handbag","Accessories","A stylish everyday handbag.",1650,10,"https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800",false],
      ["Classic Wrist Watch","Accessories","Minimal design wrist watch.",2450,8,"https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800",false],
      ["Kids Printed T-Shirt","Kids","Soft printed t-shirt for kids.",450,25,"https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=800",false],
      ["Kids Casual Sneakers","Kids","Lightweight kids sneakers.",1250,11,"https://images.unsplash.com/photo-1514989940723-e8e51635b782?w=800",false],
      ["Women's White Sneakers","Shoes","Clean everyday sneakers.",2100,9,"https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800",false],
      ["Formal Office Shirt","Men","A neat shirt for office and events.",1450,13,"https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=800",false],
      ["Women's Wide Leg Pants","Women","Relaxed fit wide-leg trousers.",1550,12,"https://images.unsplash.com/photo-1506629905607-d9c297d7a4f0?w=800",false],
      ["Canvas Backpack","Accessories","Everyday backpack with clean styling.",1350,17,"https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800",false],
      ["Summer Sunglasses","Accessories","Modern sunglasses for sunny days.",850,20,"https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800",false],
      ["Women's Knit Cardigan","Women","Soft knit layer for a relaxed look.",1850,7,"https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800",false],
      ["Men's Casual Shorts","Men","Comfortable casual shorts.",900,19,"https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=800",false],
      ["Classic Leather Belt","Accessories","Simple belt to complete your outfit.",700,21,"https://images.unsplash.com/photo-1624222247344-550fb8f7a2a4?w=800",false]
    ];
    for (const p of demo) await pool.query(
      "INSERT INTO products(name,category,description,price,stock,image,featured) VALUES($1,$2,$3,$4,$5,$6,$7)", p
    );
  }
  await pool.query(`INSERT INTO settings(key,value) VALUES
    ('store_name','SMART FASHION'),('delivery_charge','80'),('announcement','নতুন কালেকশন এসেছে!'),
    ('phone','01XXXXXXXXX'),('address','Bangladesh'),('hero_title','নিজের স্টাইল, নিজের গল্প।'),('hero_subtitle','প্রতিদিনের ফ্যাশনে নতুন আত্মবিশ্বাস।'),('hero_image',''),('promo_title','কমফোর্টের সাথে স্টাইলের ছোঁয়া।'),('promo_text','আপনার পছন্দের কালেকশন বেছে নিন।'),('whatsapp',''),('facebook',''),('instagram','')
    ON CONFLICT(key) DO NOTHING`);
}
const asyncRoute = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);
const customerOnly = (req,res,next) => req.session.customer ? next() : res.status(401).json({error:"অর্ডার করতে আগে Customer Account-এ Login করুন।"});
const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
    if (!allowed.has(file.mimetype)) return cb(new Error("শুধু JPG, PNG, WEBP বা GIF ছবি আপলোড করা যাবে।"));
    cb(null, true);
  }
});
const adminOnly = (req,res,next) => req.session.admin ? next() : res.status(401).json({error:"Admin login required"});

app.post("/api/customer/register",asyncRoute(async(req,res)=>{
  const name=String(req.body.name||"").trim(),email=String(req.body.email||"").trim().toLowerCase(),phone=String(req.body.phone||"").trim(),password=String(req.body.password||"");
  if(name.length<2||!/^\S+@\S+\.\S+$/.test(email)||password.length<8)return res.status(400).json({error:"নাম, সঠিক ইমেইল এবং কমপক্ষে ৮ অক্ষরের পাসওয়ার্ড দিন।"});
  const hash=await bcrypt.hash(password,12);let result;
  try{result=await pool.query("INSERT INTO customers(full_name,email,phone,password_hash) VALUES($1,$2,$3,$4) RETURNING id,full_name,email,phone",[name.slice(0,100),email,phone.slice(0,30),hash]);}catch(e){if(e.code==="23505")return res.status(409).json({error:"এই ইমেইল দিয়ে আগে Account খোলা হয়েছে। Login করুন।"});throw e;}
  req.session.regenerate(err=>{if(err)return res.status(500).json({error:"Session তৈরি হয়নি"});req.session.customer=result.rows[0];req.session.save(e=>e?res.status(500).json({error:"Session save হয়নি"}):res.json({success:true,customer:result.rows[0]}));});
}));
app.post("/api/customer/login",asyncRoute(async(req,res)=>{
  const email=String(req.body.email||"").trim().toLowerCase(),password=String(req.body.password||"");const {rows}=await pool.query("SELECT * FROM customers WHERE email=$1",[email]);
  if(!rows[0]||!(await bcrypt.compare(password,rows[0].password_hash)))return res.status(401).json({error:"ইমেইল অথবা পাসওয়ার্ড সঠিক নয়।"});
  const c={id:rows[0].id,full_name:rows[0].full_name,email:rows[0].email,phone:rows[0].phone};
  req.session.regenerate(err=>{if(err)return res.status(500).json({error:"Session তৈরি হয়নি"});req.session.customer=c;req.session.save(e=>e?res.status(500).json({error:"Session save হয়নি"}):res.json({success:true,customer:c}));});
}));
app.get("/api/customer/me",(req,res)=>res.json({customer:req.session.customer||null}));
app.post("/api/customer/logout",(req,res)=>{delete req.session.customer;req.session.save(()=>res.json({success:true}));});
app.get("/api/customer/orders",customerOnly,asyncRoute(async(req,res)=>{const {rows}=await pool.query("SELECT id,items,total,status,created_at FROM orders WHERE customer_id=$1 ORDER BY id DESC",[req.session.customer.id]);res.json(rows)}));

app.get("/api/health", asyncRoute(async (req,res) => {
  await pool.query("SELECT 1");
  res.json({ok:true,store:"SMART FASHION",database:"connected"});
}));
app.get("/api/products", asyncRoute(async (req,res) => {
  const { rows } = await pool.query("SELECT * FROM products WHERE active=true ORDER BY featured DESC, id DESC");
  res.json(rows);
}));
app.get("/api/settings", asyncRoute(async (req,res) => {
  const { rows } = await pool.query("SELECT key,value FROM settings");
  res.json(Object.fromEntries(rows.map(r=>[r.key,r.value])));
}));
app.post("/api/orders", customerOnly, asyncRoute(async (req,res) => {
  const { customer_name, phone, address, city, items, payment_method } = req.body;
  if(payment_method && !["Cash on Delivery","bKash (ম্যানুয়াল যোগাযোগ প্রয়োজন)","Nagad (ম্যানুয়াল যোগাযোগ প্রয়োজন)"].includes(payment_method))return res.status(400).json({error:"Payment method সঠিক নয়।"});
  if (!customer_name || !phone || !address || !Array.isArray(items) || !items.length || items.length>50)
    return res.status(400).json({error:"নাম, ফোন, ঠিকানা ও পণ্য দিন।"});
  const quantities=new Map();
  for(const item of items){const id=Number(item.id),qty=Number(item.qty);if(!Number.isInteger(id)||id<1||!Number.isInteger(qty)||qty<1||qty>20)return res.status(400).json({error:"পণ্যের পরিমাণ সঠিক নয়।"});quantities.set(id,(quantities.get(id)||0)+qty);}
  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const ids=[...quantities.keys()];
    const {rows:products}=await client.query("SELECT * FROM products WHERE id=ANY($1::int[]) AND active=true ORDER BY id FOR UPDATE",[ids]);
    if(products.length!==ids.length)throw Object.assign(new Error("একটি পণ্য পাওয়া যাচ্ছে না।"),{status:400});
    let normalized=[],subtotal=0;
    for(const p of products){const qty=quantities.get(p.id);if(Number(p.stock)<qty)throw Object.assign(new Error(`${p.name} স্টকে পর্যাপ্ত নেই।`),{status:400});normalized.push({id:p.id,name:p.name,price:Number(p.price),qty});subtotal+=Number(p.price)*qty;}
    const sr=await client.query("SELECT value FROM settings WHERE key='delivery_charge'");
    const delivery=Math.max(0,Number(sr.rows[0]?.value||80));
    const couponCode=String(req.body.coupon_code||"").trim().toUpperCase();let discount=0;
    if(couponCode){const cr=await client.query("SELECT * FROM coupons WHERE code=$1 AND active=true FOR UPDATE",[couponCode]);const c=cr.rows[0];if(!c||(c.expires_at&&new Date(c.expires_at)<new Date())||(c.max_uses!==null&&c.used_count>=c.max_uses)||subtotal<Number(c.min_order))throw Object.assign(new Error("কুপনটি ব্যবহার করা যাচ্ছে না।"),{status:400});discount=Math.min(subtotal,c.discount_type==="percent"?subtotal*Number(c.discount_value)/100:Number(c.discount_value));}
    const total=Math.max(0,subtotal+delivery-discount);
    const result=await client.query(`INSERT INTO orders(customer_id,customer_name,phone,address,city,items,subtotal,delivery_charge,total,payment_method,coupon_code,discount) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,[req.session.customer.id,String(customer_name).slice(0,100),String(phone).slice(0,30),String(address).slice(0,1000),String(city||"Bangladesh").slice(0,100),JSON.stringify(normalized),subtotal,delivery,total,String(payment_method||"Cash on Delivery").slice(0,50),couponCode,discount]);
    if(couponCode)await client.query("UPDATE coupons SET used_count=used_count+1 WHERE code=$1",[couponCode]);
    for(const item of normalized)await client.query("UPDATE products SET stock=stock-$1 WHERE id=$2",[item.qty,item.id]);
    await client.query("COMMIT");res.json({success:true,order_id:result.rows[0].id,total,discount});
  }catch(e){await client.query("ROLLBACK");if(e.status)return res.status(e.status).json({error:e.message});throw e;}finally{client.release();}
}));
app.get("/api/products/:id/reviews",asyncRoute(async(req,res)=>{
  const {rows}=await pool.query("SELECT id,customer_name,rating,comment,created_at FROM reviews WHERE product_id=$1 AND approved=true ORDER BY id DESC",[req.params.id]);res.json(rows);
}));
app.post("/api/reviews",asyncRoute(async(req,res)=>{
  const {product_id,customer_name,rating,comment}=req.body;
  if(!product_id||!customer_name||!Number.isInteger(Number(rating))||Number(rating)<1||Number(rating)>5) return res.status(400).json({error:"নাম ও ১-৫ এর মধ্যে রেটিং দিন।"});
  const p=await pool.query("SELECT id FROM products WHERE id=$1 AND active=true",[product_id]);if(!p.rows.length)return res.status(404).json({error:"পণ্য পাওয়া যায়নি"});
  await pool.query("INSERT INTO reviews(product_id,customer_name,rating,comment) VALUES($1,$2,$3,$4)",[product_id,String(customer_name).slice(0,100),Number(rating),String(comment||"").slice(0,1000)]);res.json({success:true,message:"রিভিউ জমা হয়েছে; অনুমোদনের পর দেখা যাবে।"});
}));
app.post("/api/coupons/validate",asyncRoute(async(req,res)=>{
 const code=String(req.body.code||"").trim().toUpperCase(),subtotal=Math.max(0,Number(req.body.subtotal)||0);
 const {rows}=await pool.query("SELECT * FROM coupons WHERE code=$1 AND active=true",[code]);const c=rows[0];
 if(!c|| (c.expires_at&&new Date(c.expires_at)<new Date()) || (c.max_uses!==null&&c.used_count>=c.max_uses))return res.status(400).json({error:"কুপনটি সঠিক নয় বা মেয়াদ শেষ।"});
 if(subtotal<Number(c.min_order))return res.status(400).json({error:`এই কুপনের জন্য কমপক্ষে ৳${c.min_order} অর্ডার করতে হবে।`});
 const discount=Math.min(subtotal,c.discount_type==="percent"?subtotal*Number(c.discount_value)/100:Number(c.discount_value));res.json({valid:true,code,discount:Number(discount.toFixed(2))});
}));
app.get("/api/orders/track",asyncRoute(async(req,res)=>{
 const id=Number(req.query.id),phone=String(req.query.phone||"").replace(/\D/g,"");if(!id||phone.length<8)return res.status(400).json({error:"Order ID ও সঠিক ফোন নম্বর দিন।"});
 const {rows}=await pool.query("SELECT id,customer_name,phone,items,total,status,created_at FROM orders WHERE id=$1",[id]);const o=rows[0];if(!o||o.phone.replace(/\D/g,"")!==phone)return res.status(404).json({error:"এই তথ্য দিয়ে অর্ডার পাওয়া যায়নি।"});res.json(o);
}));
app.post("/api/contact",asyncRoute(async(req,res)=>{const {name,phone,email,subject,message}=req.body;if(!name||!message)return res.status(400).json({error:"নাম ও মেসেজ লিখুন।"});await pool.query("INSERT INTO messages(name,phone,email,subject,message) VALUES($1,$2,$3,$4,$5)",[String(name).slice(0,100),String(phone||"").slice(0,30),String(email||"").slice(0,150),String(subject||"").slice(0,150),String(message).slice(0,3000)]);res.json({success:true,message:"আপনার মেসেজ পাঠানো হয়েছে।"});}));
app.post("/api/subscribe",asyncRoute(async(req,res)=>{const email=String(req.body.email||"").trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:"সঠিক ইমেইল দিন।"});await pool.query("INSERT INTO subscribers(email) VALUES($1) ON CONFLICT(email) DO NOTHING",[email]);res.json({success:true,message:"ধন্যবাদ! আপনি আপডেট পাবেন।"});}));
app.get("/api/admin/status", (req,res) => res.json({
  configured: Boolean(String(process.env.ADMIN_EMAIL || "").trim() && String(process.env.ADMIN_PASSWORD || ""))
}));
app.post("/api/admin/login", asyncRoute(async (req,res) => {
  const email=String(req.body.email||"").trim().toLowerCase(), password=String(req.body.password||"");
  if (!String(process.env.ADMIN_EMAIL || "").trim() || !String(process.env.ADMIN_PASSWORD || ""))
    return res.status(503).json({error:"Admin Login চালু হয়নি। Render → Environment-এ ADMIN_EMAIL ও ADMIN_PASSWORD সেট করে Redeploy করুন।"});
  const {rows}=await pool.query("SELECT * FROM admins WHERE email=$1",[email]);
  if(!rows[0] || !(await bcrypt.compare(password,rows[0].password_hash)))
    return res.status(401).json({error:"Email অথবা password সঠিক নয়"});
  req.session.regenerate(err=>{if(err)return res.status(500).json({error:"Session তৈরি করা যায়নি"});req.session.admin={id:rows[0].id,email:rows[0].email};req.session.save(e=>{if(e)return res.status(500).json({error:"Session save করা যায়নি"});res.json({success:true,email:rows[0].email});});});
}));
app.post("/api/admin/logout", (req,res)=>req.session.destroy(()=>{res.clearCookie("connect.sid");res.json({success:true});}));
app.get("/api/admin/me",(req,res)=>res.json({admin:req.session.admin||null}));
app.post("/api/admin/upload-image",adminOnly,(req,res,next)=>uploadImage.single("image")(req,res,err=>{if(err){if(err.code==="LIMIT_FILE_SIZE")return res.status(413).json({error:"ছবির সাইজ 5MB-এর বেশি। ছোট ছবি দিন।"});return res.status(400).json({error:err.message||"ছবি আপলোড করা যায়নি।"});}next();}),(req,res)=>{
  if(!req.file)return res.status(400).json({error:"Gallery থেকে JPG, PNG, WEBP বা GIF ছবি নির্বাচন করুন (সর্বোচ্চ 5MB)।"});
  const image=`data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;res.json({success:true,image});
});
app.get("/api/admin/products",adminOnly,asyncRoute(async(req,res)=>{
  const {rows}=await pool.query("SELECT * FROM products ORDER BY id DESC"); res.json(rows);
}));
app.post("/api/admin/products",adminOnly,asyncRoute(async(req,res)=>{
  const p=req.body;
  if(!p.name || Number(p.price)<0) return res.status(400).json({error:"পণ্যের নাম ও সঠিক দাম দিন"});
  const {rows}=await pool.query(
    `INSERT INTO products(name,category,description,price,stock,image,featured,active)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [p.name,p.category||"Fashion",p.description||"",Number(p.price),Number(p.stock)||0,p.image||"",!!p.featured,p.active!==false]);
  res.json(rows[0]);
}));
app.put("/api/admin/products/:id",adminOnly,asyncRoute(async(req,res)=>{
  const p=req.body;
  const {rows}=await pool.query(
    `UPDATE products SET name=$1,category=$2,description=$3,price=$4,stock=$5,image=$6,featured=$7,active=$8
     WHERE id=$9 RETURNING *`,
    [p.name,p.category||"Fashion",p.description||"",Number(p.price),Number(p.stock)||0,p.image||"",!!p.featured,p.active!==false,req.params.id]);
  if(!rows[0]) return res.status(404).json({error:"Product not found"}); res.json(rows[0]);
}));
app.delete("/api/admin/products/:id",adminOnly,asyncRoute(async(req,res)=>{
  await pool.query("DELETE FROM products WHERE id=$1",[req.params.id]); res.json({success:true});
}));
app.get("/api/admin/orders",adminOnly,asyncRoute(async(req,res)=>{
  const {rows}=await pool.query("SELECT * FROM orders ORDER BY id DESC"); res.json(rows);
}));
app.patch("/api/admin/orders/:id",adminOnly,asyncRoute(async(req,res)=>{
  const allowed=["Pending","Confirmed","Processing","Shipped","Delivered","Cancelled"];
  if(!allowed.includes(req.body.status)) return res.status(400).json({error:"Invalid status"});
  const client=await pool.connect();try{await client.query("BEGIN");const found=await client.query("SELECT * FROM orders WHERE id=$1 FOR UPDATE",[req.params.id]);if(!found.rows.length){await client.query("ROLLBACK");return res.status(404).json({error:"Order not found"});}const order=found.rows[0];if(order.status==="Cancelled"&&req.body.status!=="Cancelled"){await client.query("ROLLBACK");return res.status(400).json({error:"Cancelled order cannot be reopened. Create a new order instead."});}if(order.status!=="Cancelled"&&req.body.status==="Cancelled"){for(const item of order.items||[])await client.query("UPDATE products SET stock=stock+$1 WHERE id=$2",[item.qty,item.id]);}const {rows}=await client.query("UPDATE orders SET status=$1 WHERE id=$2 RETURNING *",[req.body.status,req.params.id]);await client.query("COMMIT");res.json(rows[0]);}catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
}));
app.get("/api/admin/overview",adminOnly,asyncRoute(async(req,res)=>{
  const [p,o,s]=await Promise.all([
    pool.query("SELECT COUNT(*)::int AS count FROM products"),
    pool.query("SELECT COUNT(*)::int AS count,COALESCE(SUM(total) FILTER (WHERE status <> 'Cancelled'),0)::numeric AS revenue FROM orders"),
    pool.query("SELECT COUNT(*)::int AS count FROM orders WHERE status='Pending'")
  ]);
  res.json({products:p.rows[0].count,orders:o.rows[0].count,revenue:Number(o.rows[0].revenue),pending:s.rows[0].count});
}));
app.put("/api/admin/settings",adminOnly,asyncRoute(async(req,res)=>{
  const allowed=["store_name","delivery_charge","announcement","phone","address","hero_title","hero_subtitle","hero_image","promo_title","promo_text","whatsapp","facebook","instagram"];
  for(const k of allowed) if(req.body[k]!==undefined)
    await pool.query("INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value",[k,String(req.body[k])]);
  res.json({success:true});
}));
app.get("/api/admin/coupons",adminOnly,asyncRoute(async(req,res)=>{const {rows}=await pool.query("SELECT * FROM coupons ORDER BY id DESC");res.json(rows)}));
app.post("/api/admin/coupons",adminOnly,asyncRoute(async(req,res)=>{const c=req.body,code=String(c.code||"").trim().toUpperCase();if(!code||Number(c.discount_value)<=0)return res.status(400).json({error:"কুপন কোড ও ডিসকাউন্ট দিন"});const {rows}=await pool.query("INSERT INTO coupons(code,discount_type,discount_value,min_order,max_uses,expires_at,active) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",[code,c.discount_type==="fixed"?"fixed":"percent",Number(c.discount_value),Number(c.min_order)||0,c.max_uses?Number(c.max_uses):null,c.expires_at||null,c.active!==false]);res.json(rows[0])}));
app.delete("/api/admin/coupons/:id",adminOnly,asyncRoute(async(req,res)=>{await pool.query("DELETE FROM coupons WHERE id=$1",[req.params.id]);res.json({success:true})}));
app.get("/api/admin/reviews",adminOnly,asyncRoute(async(req,res)=>{const {rows}=await pool.query("SELECT r.*,p.name AS product_name FROM reviews r LEFT JOIN products p ON p.id=r.product_id ORDER BY r.id DESC");res.json(rows)}));
app.patch("/api/admin/reviews/:id",adminOnly,asyncRoute(async(req,res)=>{const {rows}=await pool.query("UPDATE reviews SET approved=$1 WHERE id=$2 RETURNING *",[!!req.body.approved,req.params.id]);res.json(rows[0]||{})}));
app.delete("/api/admin/reviews/:id",adminOnly,asyncRoute(async(req,res)=>{await pool.query("DELETE FROM reviews WHERE id=$1",[req.params.id]);res.json({success:true})}));
app.get("/api/admin/messages",adminOnly,asyncRoute(async(req,res)=>{const {rows}=await pool.query("SELECT * FROM messages ORDER BY id DESC");res.json(rows)}));
app.get("/api/admin/subscribers",adminOnly,asyncRoute(async(req,res)=>{const {rows}=await pool.query("SELECT * FROM subscribers ORDER BY id DESC");res.json(rows)}));
app.get("/admin",(req,res)=>res.sendFile(path.join(__dirname,"public","admin.html"),{headers:{"Cache-Control":"no-store"}}));
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.use((err,req,res,next)=>{
  console.error("SMART FASHION API ERROR:", err);
  if (res.headersSent) return next(err);
  const status = Number(err.status || err.statusCode) || 500;
  res.status(status).json({error: status >= 500 ? "সার্ভারে সমস্যা হয়েছে। Render-এর Logs দেখুন।" : (err.message || "Request failed")});
});

const port=process.env.PORT||3000;
initDb().then(()=>app.listen(port,()=>console.log(`SMART FASHION running on ${port}`)))
.catch(err=>{console.error("Database initialization failed:",err);process.exit(1);});
