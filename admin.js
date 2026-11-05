const $=id=>document.getElementById(id);let adminProducts=[];
async function api(url,opts={}){
  const r=await fetch(url,{credentials:"same-origin",...opts,headers:{"Content-Type":"application/json",...(opts.headers||{})}});
  const raw=await r.text(); let j={};
  if(raw){try{j=JSON.parse(raw)}catch{throw Error(`Server থেকে সঠিক response আসেনি (${r.status}). Render Logs দেখুন।`)}}
  if(!r.ok)throw Error(j.error||`Request failed (${r.status})`);
  return j;
}
async function readServerResponse(r){const raw=await r.text();let data={};if(raw){try{data=JSON.parse(raw)}catch{throw Error(`Image upload response invalid (${r.status}). Render Logs দেখুন।`)}}if(!r.ok)throw Error(data.error||`Image upload failed (${r.status})`);return data;}
async function checkLogin(){
  try {
    const status=await api("/api/admin/status");
    if(!status.configured){
      $("loginError").textContent="Admin Login সেটআপ করা হয়নি। Render → Environment-এ ADMIN_EMAIL ও ADMIN_PASSWORD যোগ করে Redeploy করুন।";
      $("loginError").classList.add("setup-error");
    }
    const j=await api("/api/admin/me");
    if(j.admin)showDashboard();
  } catch(err) {
    $("loginError").textContent="সার্ভারের সাথে সংযোগ হচ্ছে না। Render-এর Deploy ও Logs পরীক্ষা করুন।";
  }
}
function showDashboard(){
  $("loginView").classList.add("hidden");
  $("dashboard").classList.remove("hidden");
  loadOverview();
}
$("loginForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const form=e.target,button=form.querySelector('button[type="submit"],button:not([type])');
  const d=Object.fromEntries(new FormData(form));
  d.email=String(d.email||"").trim().toLowerCase();
  $("loginError").textContent="";
  if(button){button.disabled=true;button.textContent="PLEASE WAIT...";}
  try{
    await api("/api/admin/login",{method:"POST",body:JSON.stringify(d)});
    $("loginError").textContent="";
    showDashboard();
  }catch(err){
    $("loginError").textContent=err.message;
  }finally{
    if(button){button.disabled=false;button.textContent="LOGIN TO DASHBOARD";}
  }
});
$("logout").onclick=async()=>{
  const button=$("logout");button.disabled=true;
  try{await api("/api/admin/logout",{method:"POST"});location.href="/admin";}
  catch(e){alert("Logout করা যায়নি: "+e.message);button.disabled=false;}
};
document.querySelectorAll(".side[data-tab]").forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
function switchTab(tab){document.querySelectorAll(".side[data-tab]").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));document.querySelectorAll(".tab").forEach(x=>x.classList.add("hidden"));$("tab-"+tab).classList.remove("hidden");$("pageTitle").textContent=({overview:"Overview",products:"Products",orders:"Orders",coupons:"Coupons",reviews:"Reviews",messages:"Messages",subscribers:"Subscribers",settings:"Store Settings"})[tab];if(tab==="products")loadProducts().catch(e=>showTableError("productRows",5,e));if(tab==="orders")loadOrders().catch(e=>showTableError("orderRows",6,e));if(tab==="settings")loadSettings().catch(e=>showPanelError("settingsForm",e))}
async function loadOverview(){try{let d=await api("/api/admin/overview");$("statProducts").textContent=d.products;$("statOrders").textContent=d.orders;$("statRevenue").textContent="৳"+Number(d.revenue).toLocaleString("en-BD");$("statPending").textContent=d.pending}catch(e){$("tab-overview").insertAdjacentHTML("beforeend",`<p class="admin-load-error">${esc(e.message)}</p>`)}}
async function loadProducts(){adminProducts=await api("/api/admin/products");$("productRows").innerHTML=adminProducts.map(p=>`<tr><td>${esc(p.name)}</td><td>৳${p.price}</td><td>${p.stock}</td><td>${esc(p.category)}</td><td><button class="table-action" onclick="editProduct(${p.id})">Edit</button><button class="table-action" onclick="deleteProduct(${p.id})">Delete</button></td></tr>`).join("")}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function showTableError(id,cols,error){const el=$(id);if(el)el.innerHTML=`<tr><td colspan="${cols}" class="admin-load-error">${esc(error.message)}</td></tr>`}
function showPanelError(id,error){const el=$(id);if(el)el.insertAdjacentHTML("beforeend",`<p class="admin-load-error">${esc(error.message)}</p>`)}
function newProduct(){ $("productError").textContent="";let f=$("productForm");f.reset();f.elements.id.value="";f.elements.active.checked=true;showProductPreview("");$("productModalTitle").textContent="Add Product";$("productModal").classList.add("show")}
function editProduct(id){let p=adminProducts.find(x=>x.id===id),f=$("productForm");$("productError").textContent="";for(let k of ["id","name","category","description","price","stock","image"])f.elements[k].value=p[k]??"";f.elements.imageFile.value="";showProductPreview(p.image);f.elements.featured.checked=p.featured;f.elements.active.checked=p.active;$("productModalTitle").textContent="Edit Product";$("productModal").classList.add("show")}
function closeProduct(){$("productModal").classList.remove("show")}
function showProductPreview(src){const img=$("productImagePreview");if(src){img.src=src;img.style.display="block"}else{img.removeAttribute("src");img.style.display="none"}}
$("productImageFile").addEventListener("change",e=>{const file=e.target.files[0];if(file){if(file.size>5*1024*1024){alert("ছবি 5MB-এর কম হতে হবে");e.target.value="";return}showProductPreview(URL.createObjectURL(file))}});
$("productForm").addEventListener("submit",async e=>{e.preventDefault();let f=e.target,d=Object.fromEntries(new FormData(f));d.featured=f.elements.featured.checked;d.active=f.elements.active.checked;let id=d.id;delete d.id;delete d.imageFile;try{const file=f.elements.imageFile.files[0];if(file){const fd=new FormData();fd.append("image",file);const up=await fetch("/api/admin/upload-image",{method:"POST",body:fd,credentials:"same-origin"});const uj=await readServerResponse(up);if(!uj.image)throw Error("ছবি সার্ভারে সংরক্ষণ হয়নি। আবার চেষ্টা করুন।");d.image=uj.image;}await api(id?"/api/admin/products/"+id:"/api/admin/products",{method:id?"PUT":"POST",body:JSON.stringify(d)});closeProduct();await loadProducts();alert("Product সফলভাবে Save হয়েছে।")}catch(err){$("productError").textContent=err.message}});
async function deleteProduct(id){if(!confirm("এই পণ্যটি Delete করবেন?"))return;try{await api("/api/admin/products/"+id,{method:"DELETE"});loadProducts()}catch(e){alert(e.message)}}
async function loadOrders(){let rows=await api("/api/admin/orders");$("orderRows").innerHTML=rows.map(o=>`<tr><td>#${o.id}<br>${new Date(o.created_at).toLocaleDateString()}</td><td>${esc(o.customer_name)}<br>${esc(o.phone)}<br>${esc(o.address)}</td><td>${(o.items||[]).map(i=>esc(i.name)+" × "+i.qty).join("<br>")}</td><td>৳${o.total}<br><small>${esc(o.payment_method)}</small></td><td>${esc(o.status)}</td><td><select class="status-select" onchange="updateOrder(${o.id},this.value)">${["Pending","Confirmed","Processing","Shipped","Delivered","Cancelled"].map(s=>`<option ${s===o.status?"selected":""}>${s}</option>`).join("")}</select></td></tr>`).join("")||"<tr><td colspan='6'>No orders yet</td></tr>"}
async function updateOrder(id,status){try{await api("/api/admin/orders/"+id,{method:"PATCH",body:JSON.stringify({status})});loadOverview()}catch(e){alert(e.message)}}
async function loadSettings(){let d=await api("/api/settings"),f=$("settingsForm");for(let k of ["store_name","delivery_charge","announcement","phone","address","hero_title","hero_subtitle","hero_image","promo_title","promo_text","whatsapp","facebook","instagram"])f.elements[k].value=d[k]||""}
$("settingsForm").addEventListener("submit",async e=>{e.preventDefault();try{await api("/api/admin/settings",{method:"PUT",body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});alert("Settings saved")}catch(err){alert(err.message)}});
checkLogin().catch(()=>{});// Additional store operations
const oldSwitchTab=switchTab;
switchTab=function(tab){
  oldSwitchTab(tab);
  const tasks={coupons:()=>loadCoupons().catch(e=>showTableError("couponRows",4,e)),reviews:()=>loadReviews().catch(e=>showTableError("reviewRows",4,e)),messages:()=>loadMessages().catch(e=>showTableError("messageRows",4,e)),subscribers:()=>loadSubscribers().catch(e=>showTableError("subscriberRows",2,e))};
  if(tasks[tab])tasks[tab]();
};
async function loadCoupons(){const rows=await api("/api/admin/coupons");$("couponRows").innerHTML=rows.map(c=>`<tr><td><b>${esc(c.code)}</b></td><td>${c.discount_type==="percent"?c.discount_value+"%":"৳"+c.discount_value}</td><td>${c.used_count}${c.max_uses?" / "+c.max_uses:""}</td><td><button class="table-action" onclick="deleteCoupon(${c.id})">Delete</button></td></tr>`).join("")||"<tr><td colspan='4'>No coupons yet</td></tr>"}
$("couponForm").addEventListener("submit",async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));if(!d.max_uses)delete d.max_uses;if(!d.expires_at)delete d.expires_at;try{await api("/api/admin/coupons",{method:"POST",body:JSON.stringify(d)});e.target.reset();loadCoupons()}catch(err){alert(err.message)}});
async function deleteCoupon(id){if(!confirm("Delete this coupon?"))return;await api("/api/admin/coupons/"+id,{method:"DELETE"});loadCoupons()}
async function loadReviews(){const rows=await api("/api/admin/reviews");$("reviewRows").innerHTML=rows.map(r=>`<tr><td>${esc(r.product_name||"Deleted product")}<br>${esc(r.customer_name)}</td><td>${"★".repeat(r.rating)}</td><td>${esc(r.comment)}</td><td><button class="table-action" onclick="moderateReview(${r.id},${!r.approved})">${r.approved?"Hide":"Approve"}</button><button class="table-action" onclick="removeReview(${r.id})">Delete</button></td></tr>`).join("")||"<tr><td colspan='4'>No reviews yet</td></tr>"}
async function moderateReview(id,approved){await api("/api/admin/reviews/"+id,{method:"PATCH",body:JSON.stringify({approved})});loadReviews()}
async function removeReview(id){if(!confirm("Delete review?"))return;await api("/api/admin/reviews/"+id,{method:"DELETE"});loadReviews()}
async function loadMessages(){const rows=await api("/api/admin/messages");$("messageRows").innerHTML=rows.map(m=>`<tr><td>${esc(m.name)}</td><td>${esc(m.phone)}<br>${esc(m.email)}</td><td><b>${esc(m.subject)}</b><br>${esc(m.message)}</td><td>${new Date(m.created_at).toLocaleDateString()}</td></tr>`).join("")||"<tr><td colspan='4'>No messages yet</td></tr>"}

async function loadSubscribers(){const rows=await api("/api/admin/subscribers");$("subscriberRows").innerHTML=rows.map(x=>`<tr><td>${esc(x.email)}</td><td>${new Date(x.created_at).toLocaleDateString()}</td></tr>`).join("")||"<tr><td colspan='2'>No subscribers yet</td></tr>"}
