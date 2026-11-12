// =====================================================================
//  LỚP TÀI KHOẢN cho "Luyện truyền tin Morse & Semaphore"
//  - Đăng ký / đăng nhập bằng Firebase Authentication (Google)
//  - Hồ sơ, kích hoạt, hạn dùng: Cloud Firestore + Security Rules
//  - Quản trị: kích hoạt/ngừng, đặt hạn, gia hạn, sửa, thêm, xoá,
//    xem lịch sử làm bài đã đồng bộ của từng thành viên
//  - AI tạo bản tin: Firebase AI Logic (Gemini); hỏng thì dùng bộ
//    tạo dự phòng để buổi luyện không bị gián đoạn
//  Phần luyện tập (index.html) không bị sửa đổi gì.
// =====================================================================

import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, getDocs, addDoc, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { convertText, convertedLength, LEVEL_BANDS, THEMES } from "./converter.js";

const EMAIL_DOMAIN = "@truyentin.app";
const $ = (id) => document.getElementById(id);

// Gỡ màn che tải trang (veil) do index.html dựng sẵn — tới được đây
// nghĩa là lớp tài khoản đã nạp xong.
{ const veil = document.getElementById("tt-veil"); if (veil) veil.remove(); }

/* ---------------- Giao diện (CSS + khung) ---------------- */
const style = document.createElement("style");
style.textContent = `
#tt-overlay{position:fixed;inset:0;z-index:999990;background:linear-gradient(160deg,#0b5cad,#083d73);display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:24px 12px;font-family:system-ui,'Segoe UI',Roboto,sans-serif}
#tt-card{background:#fff;border-radius:16px;max-width:430px;width:100%;padding:22px 20px;box-shadow:0 12px 40px rgba(0,0,0,.35);margin:auto 0}
#tt-card h1{font-size:20px;margin:0 0 4px;color:#0b5cad;text-align:center}
#tt-card .tt-sub{text-align:center;color:#555;font-size:13px;margin-bottom:14px}
.tt-tabs{display:flex;gap:8px;margin-bottom:14px}
.tt-tabs button{flex:1;padding:9px;border-radius:9px;border:1.5px solid #0b5cad;background:#fff;color:#0b5cad;font-weight:600;cursor:pointer}
.tt-tabs button.on{background:#0b5cad;color:#fff}
.tt-field{margin-bottom:10px}
.tt-field label{display:block;font-size:13px;font-weight:600;margin-bottom:4px;color:#333}
.tt-field input{width:100%;padding:10px;border:1.5px solid #bbb;border-radius:9px;font-size:15px;box-sizing:border-box}
.tt-btn{width:100%;padding:11px;border:none;border-radius:9px;background:#0b5cad;color:#fff;font-size:15px;font-weight:700;cursor:pointer;margin-top:4px}
.tt-btn:disabled{opacity:.55;cursor:wait}
.tt-btn.alt{background:#e8f1fa;color:#0b5cad}
.tt-err{background:#fdecea;color:#a12622;border-radius:8px;padding:8px 10px;font-size:13.5px;margin-bottom:10px;display:none}
.tt-msg{background:#eef6ee;color:#205c20;border-radius:8px;padding:10px 12px;font-size:14px;margin-bottom:10px}
.tt-note{font-size:12.5px;color:#666;margin-top:10px;line-height:1.45}
.tt-center{text-align:center}
#tt-chip{position:fixed;right:10px;bottom:10px;z-index:999980;background:rgba(8,45,80,.92);color:#fff;border-radius:12px;padding:8px 10px;display:none;gap:6px;align-items:center;font-family:system-ui,sans-serif;font-size:13px;box-shadow:0 4px 16px rgba(0,0,0,.3);flex-wrap:wrap;max-width:92vw}
#tt-chip button{background:#fff;color:#0b4a80;border:none;border-radius:7px;padding:5px 9px;font-weight:600;cursor:pointer;font-size:12.5px}
#tt-panel{position:fixed;inset:0;z-index:999985;background:rgba(4,25,45,.55);display:none;align-items:flex-start;justify-content:center;overflow-y:auto;padding:18px 10px;font-family:system-ui,sans-serif}
#tt-panel .tt-box{background:#fff;border-radius:14px;max-width:760px;width:100%;padding:18px;margin:auto 0}
#tt-panel h2{margin:0 0 10px;font-size:18px;color:#0b5cad}
.tt-mrow{border:1px solid #dde5ee;border-radius:10px;padding:10px 12px;margin-bottom:8px}
.tt-mrow .tt-mhead{font-size:14.5px;margin-bottom:6px}
.tt-badge{display:inline-block;padding:1px 8px;border-radius:20px;font-size:12px;font-weight:700;margin-left:6px}
.tt-b-pending{background:#fff3cd;color:#7a5b00}.tt-b-active{background:#d9f2d9;color:#205c20}.tt-b-stopped{background:#f8d7da;color:#842029}
.tt-acts{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.tt-acts button{background:#e8f1fa;color:#0b4a80;border:1px solid #bcd4ee;border-radius:7px;padding:5px 9px;cursor:pointer;font-size:12.5px;font-weight:600}
.tt-acts button.danger{background:#fdecea;color:#a12622;border-color:#f0c4c0}
.tt-acts input[type=date]{padding:4px 6px;border:1px solid #bbb;border-radius:7px}
.tt-hist{font-size:13px;border-top:1px dashed #ccc;padding:6px 0;line-height:1.5}
.tt-aiout{background:#f4f8fc;border:1.5px dashed #0b5cad;border-radius:10px;padding:10px 12px;font-size:16px;margin:10px 0;min-height:24px}
.tt-aiout .tt-conv{font-size:12.5px;color:#666;margin-top:4px;letter-spacing:.5px}
select.tt-sel{width:100%;padding:9px;border:1.5px solid #bbb;border-radius:9px;font-size:14.5px;background:#fff}
`;
document.head.appendChild(style);

const overlay = document.createElement("div");
overlay.id = "tt-overlay";
overlay.innerHTML = `
<div id="tt-card">
  <h1>🚩 Luyện truyền tin Morse &amp; Semaphore</h1>
  <div class="tt-sub">Bản có tài khoản — đăng nhập để luyện tập</div>
  <div id="tt-view"></div>
</div>`;
document.body.appendChild(overlay);
const view = $("tt-view");

function viewHTML(html) { view.innerHTML = html; }
function errText(code) {
  const map = {
    "auth/invalid-credential": "Sai tên đăng nhập hoặc mật khẩu.",
    "auth/user-not-found": "Không tìm thấy tài khoản này.",
    "auth/wrong-password": "Sai mật khẩu.",
    "auth/email-already-in-use": "Tên đăng nhập này đã có người đăng ký.",
    "auth/weak-password": "Mật khẩu phải có ít nhất 6 ký tự.",
    "auth/invalid-email": "Tên đăng nhập không hợp lệ.",
    "auth/network-request-failed": "Lỗi kết nối mạng. Kiểm tra mạng rồi thử lại.",
    "auth/unauthorized-domain": "Tên miền trang web chưa được thêm vào Firebase (Authorized domains) — xem hướng dẫn Phần E.",
    "permission-denied": "Máy chủ từ chối quyền truy cập. Kiểm tra lại Firestore Rules (hướng dẫn Phần C)."
  };
  return map[code] || ("Đã xảy ra lỗi (" + (code || "không rõ") + "). Thử lại sau.");
}

function showLoading(text) {
  viewHTML(`<div class="tt-center" style="padding:16px 0">
    <div style="font-size:30px">⏳</div><p>${text || "Đang kết nối máy chủ…"}</p></div>`);
}
function showError(text) {
  viewHTML(`<div class="tt-err" style="display:block">${text}</div>
    <button class="tt-btn" onclick="location.reload()">Tải lại trang</button>`);
}
function showGate(title, body) {
  viewHTML(`<div class="tt-msg">${body}</div>
    <button class="tt-btn alt" id="tt-logout2">Đăng xuất</button>`);
  $("tt-logout2").addEventListener("click", () => doLogout());
}

/* ---------------- Khởi tạo Firebase ---------------- */
const cfg = window.TT_FIREBASE_CONFIG;
const configured = cfg && typeof cfg.apiKey === "string" && cfg.apiKey && !cfg.apiKey.includes("DAN_");

let app = null, auth = null, db = null;
let currentUser = null, myProfile = null, myIsAdmin = false;

if (location.protocol === "file:") {
  viewHTML(`<div class="tt-err" style="display:block">Thầy đang mở file trực tiếp trên máy (file://) nên phần đăng nhập không chạy được.</div>
  <p class="tt-note">Hãy đưa cả thư mục này lên GitHub Pages hoặc Netlify (hướng dẫn Phần E), rồi mở ứng dụng bằng link https được cấp. Mở bằng link đó thì đăng nhập, quản trị và AI mới hoạt động.</p>`);
} else if (!configured) {
  viewHTML(`<div class="tt-err" style="display:block">Ứng dụng chưa được cấu hình máy chủ.</div>
  <p class="tt-note">Thầy mở file <b>app-config.js</b> và dán nội dung <b>firebaseConfig</b> của dự án Firebase vào đó (hướng dẫn Phần D), hoặc gửi nội dung đó cho em qua Muse để em dán giúp. Đây không phải mật khẩu bí mật — xem ghi chú trong file.</p>`);
} else {
  app = initializeApp(cfg);
  auth = getAuth(app);
  db = getFirestore(app);
  boot();
}

function emailFor(username) {
  return username.trim().toLowerCase().replace(/\s+/g, "") + EMAIL_DOMAIN;
}
function usernameOk(u) { return /^[a-z0-9._-]{3,30}$/.test(u.trim().toLowerCase()); }
function todayStr() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function addDaysStr(base, days) {
  const d = base ? new Date(base + "T00:00:00") : new Date();
  d.setDate(d.getDate() + days);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function isExpired(p) { return p && p.expiry && p.expiry < todayStr(); }

let bootTimer = null;
function boot() {
  showLoading();
  bootTimer = setTimeout(() => {
    if (!currentUser && overlay.style.display !== "none") {
      showError("Kết nối máy chủ quá lâu. Có thể mạng đang chậm hoặc tên miền chưa được phép trong Firebase. Kiểm tra mạng rồi tải lại.");
    }
  }, 12000);
  onAuthStateChanged(auth, async (user) => {
    clearTimeout(bootTimer);
    try {
      if (!user) { currentUser = null; showAuthForms(); return; }
      currentUser = user;
      showLoading("Đang kiểm tra tài khoản…");
      await resolveAccess(user);
    } catch (e) {
      showError(errText(e && e.code) + "");
    }
  });
}

async function resolveAccess(user) {
  const adminSnap = await getDoc(doc(db, "admins", user.uid));
  myIsAdmin = adminSnap.exists();
  const pRef = doc(db, "profiles", user.uid);
  const pSnap = await getDoc(pRef);
  if (pSnap.exists()) {
    myProfile = pSnap.data();
  } else if (myIsAdmin) {
    myProfile = { username: (user.email || "").split("@")[0], name: "Quản trị viên", className: "", role: "admin", status: "active", expiry: null };
    await setDoc(pRef, { ...myProfile, createdAt: serverTimestamp() });
  } else {
    myProfile = { username: (user.email || "").split("@")[0], name: "", className: "", role: "member", status: "pending", expiry: null };
    await setDoc(pRef, { ...myProfile, createdAt: serverTimestamp() });
  }
  if (myIsAdmin) { grantAccess(); return; }
  if (myProfile.status === "pending") {
    showGate("Chờ kích hoạt", `Tài khoản <b>${myProfile.username}</b> đã đăng ký xong và đang <b>chờ thầy kích hoạt</b>. Khi được kích hoạt, em đăng nhập lại (hoặc tải lại trang) là vào luyện tập được.`);
    return;
  }
  if (myProfile.status === "stopped") {
    showGate("Tài khoản đã bị ngừng", `Tài khoản <b>${myProfile.username}</b> hiện đang bị <b>ngừng sử dụng</b>. Em liên hệ thầy để được mở lại.`);
    return;
  }
  if (isExpired(myProfile)) {
    showGate("Hết hạn sử dụng", `Tài khoản <b>${myProfile.username}</b> đã <b>hết hạn</b> vào ngày ${myProfile.expiry}. Em liên hệ thầy để được gia hạn.`);
    return;
  }
  grantAccess();
}

/* ---------------- Form đăng nhập / đăng ký ---------------- */
function showAuthForms() {
  viewHTML(`
  <div class="tt-tabs">
    <button id="tab-login" class="on">Đăng nhập</button>
    <button id="tab-reg">Đăng ký</button>
  </div>
  <div class="tt-err" id="tt-err"></div>
  <div id="tt-form-login">
    <div class="tt-field"><label>Tên đăng nhập</label><input id="li-user" autocomplete="username" placeholder="vd: an6a1"></div>
    <div class="tt-field"><label>Mật khẩu</label><input id="li-pass" type="password" autocomplete="current-password"></div>
    <button class="tt-btn" id="btn-login">Đăng nhập</button>
    <p class="tt-note">Tài khoản mới đăng ký phải chờ thầy kích hoạt mới đăng nhập vào luyện tập được.</p>
  </div>
  <div id="tt-form-reg" style="display:none">
    <div class="tt-field"><label>Họ và tên</label><input id="rg-name" placeholder="vd: Nguyễn Văn An"></div>
    <div class="tt-field"><label>Lớp</label><input id="rg-class" placeholder="vd: 6A1"></div>
    <div class="tt-field"><label>Tên đăng nhập (chữ thường không dấu, 3–30 ký tự)</label><input id="rg-user" autocomplete="username" placeholder="vd: an6a1"></div>
    <div class="tt-field"><label>Mật khẩu (ít nhất 6 ký tự)</label><input id="rg-pass" type="password" autocomplete="new-password"></div>
    <button class="tt-btn" id="btn-reg">Đăng ký</button>
    <p class="tt-note">Nhớ kỹ mật khẩu — không ai xem lại được mật khẩu cũ, kể cả thầy. Quên mật khẩu thì báo thầy để được cấp lại tài khoản.</p>
  </div>`);
  const err = $("tt-err");
  const showErr = (t) => { err.textContent = t; err.style.display = "block"; };
  $("tab-login").addEventListener("click", () => {
    $("tab-login").classList.add("on"); $("tab-reg").classList.remove("on");
    $("tt-form-login").style.display = ""; $("tt-form-reg").style.display = "none"; err.style.display = "none";
  });
  $("tab-reg").addEventListener("click", () => {
    $("tab-reg").classList.add("on"); $("tab-login").classList.remove("on");
    $("tt-form-reg").style.display = ""; $("tt-form-login").style.display = "none"; err.style.display = "none";
  });
  $("btn-login").addEventListener("click", async () => {
    const u = $("li-user").value, p = $("li-pass").value;
    if (!usernameOk(u)) { showErr("Tên đăng nhập không hợp lệ (chữ thường không dấu, số, dấu . _ -, 3–30 ký tự)."); return; }
    const btn = $("btn-login"); btn.disabled = true; btn.textContent = "Đang đăng nhập…";
    try { await signInWithEmailAndPassword(auth, emailFor(u), p); }
    catch (e) { showErr(errText(e.code)); btn.disabled = false; btn.textContent = "Đăng nhập"; }
  });
  $("btn-reg").addEventListener("click", async () => {
    const name = $("rg-name").value.trim(), cls = $("rg-class").value.trim();
    const u = $("rg-user").value, p = $("rg-pass").value;
    if (!name || !cls) { showErr("Em điền đủ Họ và tên và Lớp nhé."); return; }
    if (!usernameOk(u)) { showErr("Tên đăng nhập không hợp lệ (chữ thường không dấu, số, dấu . _ -, 3–30 ký tự)."); return; }
    if (p.length < 6) { showErr("Mật khẩu phải có ít nhất 6 ký tự."); return; }
    const btn = $("btn-reg"); btn.disabled = true; btn.textContent = "Đang đăng ký…";
    try {
      const cred = await createUserWithEmailAndPassword(auth, emailFor(u), p);
      await setDoc(doc(db, "profiles", cred.user.uid), {
        username: u.trim().toLowerCase(), name, className: cls,
        role: "member", status: "pending", expiry: null, createdAt: serverTimestamp()
      });
    } catch (e) { showErr(errText(e.code)); btn.disabled = false; btn.textContent = "Đăng ký"; }
  });
}

async function doLogout() {
  try { await signOut(auth); } catch (e) { /* bỏ qua */ }
  location.reload();
}

/* ---------------- Vào ứng dụng ---------------- */
function grantAccess() {
  overlay.style.display = "none";
  // Điền sẵn họ tên + lớp cho phần Kiểm tra
  const sn = $("stuName"), sc = $("stuClass");
  if (sn && myProfile.name) { sn.value = myProfile.name; sn.dispatchEvent(new Event("input", { bubbles: true })); }
  if (sc && myProfile.className) { sc.value = myProfile.className; sc.dispatchEvent(new Event("input", { bubbles: true })); }
  buildChip();
  syncHistory();
  setInterval(syncHistory, 20000);
}

function buildChip() {
  let chip = $("tt-chip");
  if (!chip) {
    chip = document.createElement("div");
    chip.id = "tt-chip";
    document.body.appendChild(chip);
  }
  chip.style.display = "flex";
  chip.innerHTML = "";
  const label = document.createElement("span");
  label.textContent = "👤 " + (myProfile.username || "");
  chip.appendChild(label);
  const bAI = document.createElement("button");
  bAI.textContent = "✨ Tạo bản tin AI";
  bAI.addEventListener("click", openAiPanel);
  chip.appendChild(bAI);
  if (myIsAdmin) {
    const bAd = document.createElement("button");
    bAd.textContent = "🛠 Quản trị";
    bAd.addEventListener("click", openAdminPanel);
    chip.appendChild(bAd);
  }
  const bOut = document.createElement("button");
  bOut.textContent = "Đăng xuất";
  bOut.addEventListener("click", doLogout);
  chip.appendChild(bOut);
}

/* ---------------- Đồng bộ lịch sử làm bài ---------------- */
function entryHash(e) {
  const s = JSON.stringify(e);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h * 31) + s.charCodeAt(i)) | 0;
  return "h" + h + "_" + s.length;
}
let syncing = false;
async function syncHistory() {
  if (syncing || !currentUser || !db) return;
  syncing = true;
  try {
    let arr = [];
    try { arr = JSON.parse(localStorage.getItem("ltmt_history") || "[]"); } catch (e) { arr = []; }
    if (!Array.isArray(arr) || !arr.length) return;
    const done = new Set(JSON.parse(localStorage.getItem("tt_synced") || "[]"));
    let added = 0;
    for (const entry of arr) {
      const key = entryHash(entry);
      if (done.has(key)) continue;
      if (added >= 10) break;
      await addDoc(collection(db, "history"), {
        uid: currentUser.uid, username: myProfile.username || "", entry, at: serverTimestamp()
      });
      done.add(key); added++;
    }
    if (added) localStorage.setItem("tt_synced", JSON.stringify([...done].slice(-400)));
  } catch (e) { /* đồng bộ hỏng không được làm gián đoạn luyện tập */ }
  syncing = false;
}

/* ---------------- Khung panel dùng chung ---------------- */
function openPanel(title) {
  let panel = $("tt-panel");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "tt-panel";
    panel.innerHTML = `<div class="tt-box"><h2></h2><div class="tt-pbody"></div>
      <button class="tt-btn alt" id="tt-pclose" style="margin-top:12px">Đóng</button></div>`;
    document.body.appendChild(panel);
    panel.querySelector("#tt-pclose").addEventListener("click", () => { panel.style.display = "none"; });
  }
  panel.querySelector("h2").textContent = title;
  panel.style.display = "flex";
  return panel.querySelector(".tt-pbody");
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------------- Quản trị ---------------- */
async function openAdminPanel() {
  const body = openPanel("🛠 Quản trị thành viên");
  body.innerHTML = `<p>Đang tải danh sách…</p>`;
  try {
    const snap = await getDocs(collection(db, "profiles"));
    const members = [];
    snap.forEach((d) => members.push({ uid: d.id, ...d.data() }));
    members.sort((a, b) => (a.username || "").localeCompare(b.username || ""));
    renderAdminList(body, members);
  } catch (e) {
    body.innerHTML = `<div class="tt-err" style="display:block">${esc(errText(e.code))}</div>`;
  }
}

function renderAdminList(body, members) {
  body.innerHTML = `
    <div class="tt-field"><input id="adm-search" placeholder="Tìm theo tên đăng nhập, họ tên, lớp…"></div>
    <div id="adm-add" style="margin-bottom:10px">
      <button class="tt-btn" id="adm-addbtn" style="width:auto;padding:8px 14px">➕ Thêm thành viên</button>
      <div id="adm-addform" style="display:none;margin-top:8px">
        <div class="tt-field"><input id="ad-name" placeholder="Họ và tên"></div>
        <div class="tt-field"><input id="ad-class" placeholder="Lớp"></div>
        <div class="tt-field"><input id="ad-user" placeholder="Tên đăng nhập (không dấu)"></div>
        <div class="tt-field"><input id="ad-pass" placeholder="Mật khẩu cấp cho học sinh (≥ 6 ký tự)"></div>
        <button class="tt-btn" id="ad-create" style="width:auto;padding:8px 14px">Tạo và kích hoạt ngay</button>
        <span id="ad-msg" style="margin-left:8px;font-size:13px"></span>
      </div>
    </div>
    <div id="adm-list"></div>`;
  const list = body.querySelector("#adm-list");
  const draw = (filter) => {
    list.innerHTML = "";
    const f = (filter || "").toLowerCase();
    members.filter((m) => !f || (m.username || "").includes(f) || (m.name || "").toLowerCase().includes(f) || (m.className || "").toLowerCase().includes(f))
      .forEach((m) => list.appendChild(memberRow(body, members, m)));
    if (!list.children.length) list.innerHTML = "<p>Không có thành viên nào khớp.</p>";
  };
  draw("");
  body.querySelector("#adm-search").addEventListener("input", (e) => draw(e.target.value));
  body.querySelector("#adm-addbtn").addEventListener("click", () => {
    const f = body.querySelector("#adm-addform");
    f.style.display = f.style.display === "none" ? "" : "none";
  });
  body.querySelector("#ad-create").addEventListener("click", async () => {
    const msg = body.querySelector("#ad-msg");
    const name = body.querySelector("#ad-name").value.trim();
    const cls = body.querySelector("#ad-class").value.trim();
    const u = body.querySelector("#ad-user").value;
    const p = body.querySelector("#ad-pass").value;
    if (!name || !cls || !usernameOk(u) || p.length < 6) { msg.textContent = "Kiểm tra lại: cần đủ họ tên, lớp, tên đăng nhập hợp lệ, mật khẩu ≥ 6 ký tự."; return; }
    msg.textContent = "Đang tạo…";
    let secondary = null;
    try {
      secondary = initializeApp(cfg, "tt-secondary");
      const sAuth = getAuth(secondary);
      const cred = await createUserWithEmailAndPassword(sAuth, emailFor(u), p);
      await setDoc(doc(db, "profiles", cred.user.uid), {
        username: u.trim().toLowerCase(), name, className: cls, role: "member",
        status: "pending", expiry: null, createdAt: serverTimestamp()
      });
      await updateDoc(doc(db, "profiles", cred.user.uid), { status: "active" });
      await signOut(sAuth);
      msg.textContent = "Đã tạo và kích hoạt: " + u.trim().toLowerCase();
      const nm = { uid: cred.user.uid, username: u.trim().toLowerCase(), name, className: cls, role: "member", status: "active", expiry: null };
      members.push(nm); members.sort((a, b) => (a.username || "").localeCompare(b.username || "")); draw(body.querySelector("#adm-search").value);
    } catch (e) {
      msg.textContent = errText(e.code);
    } finally {
      if (secondary) { try { await deleteApp(secondary); } catch (e) {} }
    }
  });
}

function memberRow(body, members, m) {
  const row = document.createElement("div");
  row.className = "tt-mrow";
  const expired = isExpired(m);
  const statusLabel = m.status === "pending" ? "Chờ kích hoạt" : m.status === "stopped" ? "Đã ngừng" : expired ? "Hết hạn" : "Đang dùng";
  const badgeCls = m.status === "pending" ? "tt-b-pending" : m.status === "stopped" ? "tt-b-stopped" : expired ? "tt-b-stopped" : "tt-b-active";
  row.innerHTML = `
    <div class="tt-mhead"><b>${esc(m.username)}</b> — ${esc(m.name || "")} · Lớp ${esc(m.className || "")}
      <span class="tt-badge ${badgeCls}">${statusLabel}</span></div>
    <div style="font-size:13px;color:#555;margin-bottom:6px">Hạn dùng: ${m.expiry ? "đến hết ngày " + esc(m.expiry) : "không giới hạn"}</div>
    <div class="tt-acts">
      <button data-a="toggle">${m.status === "active" ? "Ngừng" : "Kích hoạt"}</button>
      <button data-a="forever">Vĩnh viễn</button>
      <button data-a="d30">+30 ngày</button>
      <button data-a="d90">+90 ngày</button>
      <input type="date" data-a="date" value="${m.expiry || ""}">
      <button data-a="setdate">Đặt hạn</button>
      <button data-a="edit">Sửa tên/lớp</button>
      <button data-a="hist">Lịch sử</button>
      <button data-a="del" class="danger">Xoá hồ sơ</button>
    </div>
    <div class="tt-histbox"></div>`;
  const ref = doc(db, "profiles", m.uid);
  const reload = () => openAdminPanel();
  const upd = async (data) => { try { await updateDoc(ref, data); Object.assign(m, data); reload(); } catch (e) { alert(errText(e.code)); } };
  row.querySelector('[data-a="toggle"]').addEventListener("click", () => upd({ status: m.status === "active" ? "stopped" : "active" }));
  row.querySelector('[data-a="forever"]').addEventListener("click", () => upd({ expiry: null, status: m.status === "pending" ? "pending" : "active" }));
  row.querySelector('[data-a="d30"]').addEventListener("click", () => { const base = m.expiry && m.expiry > todayStr() ? m.expiry : todayStr(); upd({ expiry: addDaysStr(base, 30) }); });
  row.querySelector('[data-a="d90"]').addEventListener("click", () => { const base = m.expiry && m.expiry > todayStr() ? m.expiry : todayStr(); upd({ expiry: addDaysStr(base, 90) }); });
  row.querySelector('[data-a="setdate"]').addEventListener("click", () => {
    const v = row.querySelector('[data-a="date"]').value;
    if (v) upd({ expiry: v }); else alert("Thầy chọn ngày trước đã ạ.");
  });
  row.querySelector('[data-a="edit"]').addEventListener("click", async () => {
    const name = prompt("Họ và tên:", m.name || ""); if (name === null) return;
    const cls = prompt("Lớp:", m.className || ""); if (cls === null) return;
    upd({ name: name.trim(), className: cls.trim() });
  });
  row.querySelector('[data-a="del"]').addEventListener("click", async () => {
    if (!confirm("Xoá HỒ SƠ của " + m.username + "? (Tài khoản đăng nhập vẫn còn trên Firebase; muốn xoá hẳn/đặt lại mật khẩu thì xoá tài khoản trong Firebase Console — xem hướng dẫn Phần J.)")) return;
    try { await deleteDoc(ref); reload(); } catch (e) { alert(errText(e.code)); }
  });
  row.querySelector('[data-a="hist"]').addEventListener("click", async () => {
    const box = row.querySelector(".tt-histbox");
    box.innerHTML = "Đang tải lịch sử…";
    try {
      const snap = await getDocs(query(collection(db, "history"), where("uid", "==", m.uid)));
      const items = [];
      snap.forEach((d) => items.push(d.data()));
      items.sort((a, b) => ((b.at && b.at.seconds) || 0) - ((a.at && a.at.seconds) || 0));
      if (!items.length) { box.innerHTML = "<div class='tt-hist'>Chưa có bài làm nào được đồng bộ từ máy của học sinh này.</div>"; return; }
      box.innerHTML = items.slice(0, 50).map((it) => {
        const e = it.entry || {};
        return `<div class="tt-hist">🗓 ${esc(e.date || "")} · ${esc(e.kind || "")} · <b>${esc(e.score ?? "")}/10</b> · đúng ${esc(e.correct ?? "")}/${esc(e.total ?? "")} · “${esc(e.msg || "")}”</div>`;
      }).join("");
    } catch (e) { box.innerHTML = esc(errText(e.code)); }
  });
  return row;
}

/* ---------------- AI tạo bản tin ---------------- */
const FALLBACK_PARTS = {
  subjects: ["ĐỘI EM", "LỚP EM", "TỔ EM", "CHÚNG EM", "ĐỘI VIÊN", "HỌC SINH", "BẠN NHỎ", "CẢ LỚP"],
  middles: [
    "HỌC TẬP TỐT", "THI ĐUA HỌC GIỎI", "RÈN LUYỆN THÂN THỂ", "GIỮ GÌN TRẬT TỰ",
    "ĐOÀN KẾT GIÚP BẠN", "CHĂM NGOAN HỌC GIỎI", "LÀM THEO LỜI BÁC", "YÊU QUÊ HƯƠNG",
    "ĐI HỌC ĐÚNG GIỜ", "VƯỢT KHÓ HỌC TẬP", "GIỮ TRƯỜNG XANH SẠCH", "TUÂN THỦ LUẬT GIAO THÔNG"
  ],
  endings: ["", "", "", "MỖI NGÀY", "HÔM NAY", "THẬT TỐT", "VÌ TƯƠNG LAI", "ĐẠT KẾT QUẢ CAO"]
};
function fallbackSentence() {
  const r = (a) => a[Math.floor(Math.random() * a.length)];
  const e = r(FALLBACK_PARTS.endings);
  return (r(FALLBACK_PARTS.subjects) + " " + r(FALLBACK_PARTS.middles) + (e ? " " + e : "")).trim();
}

function seenSet() {
  try { return new Set(JSON.parse(localStorage.getItem("tt_ai_seen") || "[]")); } catch (e) { return new Set(); }
}
function rememberSeen(conv) {
  const s = seenSet(); s.add(conv);
  try { localStorage.setItem("tt_ai_seen", JSON.stringify([...s].slice(-300))); } catch (e) {}
}

async function aiCandidates(theme, level) {
  const mod = await import("https://www.gstatic.com/firebasejs/12.4.0/firebase-ai.js");
  const ai = mod.getAI(app, { backend: new mod.GoogleAIBackend() });
  const words = level === "de" ? "3 đến 5 từ" : level === "tb" ? "5 đến 7 từ" : "7 đến 10 từ";
  const prompt = `Bạn là giáo viên tiểu học Việt Nam. Viết 4 câu tiếng Việt, mỗi câu đúng một dòng, không đánh số, không dấu ngoặc kép, không dấu chấm cuối câu, viết hoa chữ cái đầu câu. Nội dung tích cực, phù hợp học sinh tiểu học, chủ đề: ${theme}. Mỗi câu khoảng ${words}. Bốn câu phải khác nhau hoàn toàn về nội dung. Chỉ in ra 4 câu, không giải thích.`;
  const models = ["gemini-2.0-flash", "gemini-2.5-flash"];
  let lastErr = null;
  for (const name of models) {
    try {
      const model = mod.getGenerativeModel(ai, { model: name });
      const res = await model.generateContent(prompt);
      const text = res.response.text();
      return text.split(/\n+/).map((x) => x.replace(/^[\d\-.)\s"“”]+/, "").replace(/["“”.]+\s*$/, "").trim()).filter((x) => x.length > 2);
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("AI unavailable");
}

async function generateMessageSmart(theme, level) {
  const band = LEVEL_BANDS[level];
  const seen = seenSet();
  const pickValid = (cands) => {
    for (const c of cands) {
      const conv = convertText(c);
      const len = convertedLength(c);
      if (len >= band.min && len <= band.max && !seen.has(conv)) return c;
    }
    return null;
  };
  let usedAi = false;
  try {
    const cands = await aiCandidates(theme, level);
    const v = pickValid(cands);
    if (v) { usedAi = true; rememberSeen(convertText(v)); return { text: v.toUpperCase(), ai: true }; }
  } catch (e) { /* rơi xuống bộ tạo dự phòng */ }
  for (let i = 0; i < 80; i++) {
    const c = fallbackSentence();
    const conv = convertText(c);
    const len = convertedLength(c);
    if (len >= band.min && len <= band.max && !seen.has(conv)) {
      rememberSeen(conv);
      return { text: c, ai: usedAi };
    }
  }
  const c = fallbackSentence();
  rememberSeen(convertText(c));
  return { text: c, ai: usedAi };
}

function openAiPanel() {
  const body = openPanel("✨ Tạo bản tin bằng AI");
  body.innerHTML = `
    <div class="tt-field"><label>Chủ đề</label>
      <select class="tt-sel" id="ai-theme">${THEMES.map((t) => `<option>${esc(t)}</option>`).join("")}</select></div>
    <div class="tt-field"><label>Mức độ</label>
      <select class="tt-sel" id="ai-level">
        <option value="de">Dễ (10–15 ký tự sau chuyển đổi)</option>
        <option value="tb" selected>Trung bình (16–22 ký tự)</option>
        <option value="kho">Khó (25–30 ký tự)</option>
      </select></div>
    <button class="tt-btn" id="ai-go">Tạo bản tin</button>
    <div class="tt-aiout" id="ai-out">Câu được tạo sẽ hiện ở đây.</div>
    <div class="tt-acts">
      <button id="ai-fill">⬇ Đưa vào ô nhập bản tin</button>
      <button id="ai-copy">Sao chép</button>
    </div>
    <p class="tt-note">Câu do AI (Gemini của Google) soạn mới theo chủ đề, đã kiểm độ dài sau chuyển đổi theo quy ước của lớp và tránh trùng các câu đã tạo trước. Nếu AI chưa được bật trong Firebase Console hoặc mất mạng, hệ thống tự dùng bộ tạo dự phòng (câu ghép đa dạng) để không gián đoạn buổi luyện.</p>`;
  let current = "";
  body.querySelector("#ai-go").addEventListener("click", async () => {
    const out = body.querySelector("#ai-out");
    const btn = body.querySelector("#ai-go");
    btn.disabled = true; btn.textContent = "Đang tạo…";
    out.textContent = "Đang soạn câu mới…";
    try {
      const r = await generateMessageSmart(body.querySelector("#ai-theme").value, body.querySelector("#ai-level").value);
      current = r.text;
      out.innerHTML = `${esc(r.text)}<div class="tt-conv">${esc(convertText(r.text))} · ${convertedLength(r.text)} ký tự ${r.ai ? "· do AI soạn" : "· bộ tạo dự phòng"}</div>`;
    } catch (e) {
      out.textContent = "Chưa tạo được câu. Kiểm tra mạng rồi thử lại.";
    }
    btn.disabled = false; btn.textContent = "Tạo bản tin";
  });
  body.querySelector("#ai-fill").addEventListener("click", () => {
    if (!current) { alert("Tạo một câu trước đã ạ."); return; }
    const radio = document.querySelector('input[name="src"][value="custom"]');
    if (radio && !radio.checked) { radio.checked = true; radio.dispatchEvent(new Event("change", { bubbles: true })); }
    const ta = $("customText");
    if (ta) {
      ta.value = current;
      ta.dispatchEvent(new Event("input", { bubbles: true }));
      $("tt-panel").style.display = "none";
      ta.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      alert("Không tìm thấy ô nhập bản tin. Câu của thầy: " + current);
    }
  });
  body.querySelector("#ai-copy").addEventListener("click", async () => {
    if (!current) { alert("Tạo một câu trước đã ạ."); return; }
    try { await navigator.clipboard.writeText(current); alert("Đã sao chép: " + current); }
    catch (e) { alert("Câu của thầy: " + current); }
  });
}
