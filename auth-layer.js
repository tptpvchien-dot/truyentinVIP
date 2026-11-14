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
  getAuth, initializeAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut,
  indexedDBLocalPersistence, browserLocalPersistence,
  browserSessionPersistence, inMemoryPersistence
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, getDocs, addDoc, query, where, serverTimestamp, getCountFromServer, arrayUnion
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
.tt-admtabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;border-bottom:2px solid #dbe4f0;padding-bottom:8px}
.tt-admtabs button{padding:8px 13px;border-radius:9px;border:1.5px solid #0b5cad;background:#fff;color:#0b5cad;font-weight:600;cursor:pointer;font-size:14px}
.tt-admtabs button.on{background:#0b5cad;color:#fff}
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
#tt-chip{position:fixed;top:0;left:0;right:0;z-index:999980;background:rgba(8,45,80,.97);color:#fff;padding:6px 10px;display:none;gap:6px;align-items:center;justify-content:center;text-align:center;font-family:system-ui,sans-serif;font-size:13px;box-shadow:0 2px 10px rgba(0,0,0,.3);flex-wrap:wrap}
#tt-chip button{background:#fff;color:#0b4a80;border:none;border-radius:7px;padding:5px 9px;font-weight:600;cursor:pointer;font-size:12.5px}
#tt-chip button.on{background:#ffb300;color:#083d73}
.tt-chipinfo{display:flex;flex-direction:column;align-items:center;text-align:center;line-height:1.25;margin-right:2px;min-width:0}
.tt-chipsub{font-size:12px;color:#cfe3f5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:46vw}
.tabbar{display:none!important}
.mainctl{display:none!important}
.tt-namebtn{cursor:pointer}
#tt-menu{position:absolute;top:calc(100% + 6px);left:50%;transform:translateX(-50%);background:#fff;color:#14273c;border-radius:12px;box-shadow:0 14px 34px rgba(0,0,0,.35);padding:6px;min-width:242px;z-index:999995;text-align:left}
#tt-menu.hidden{display:none}
#tt-chip #tt-menu button{display:flex;width:100%;align-items:center;gap:8px;background:transparent;color:#14273c;border:none;border-radius:8px;padding:10px 12px;font-size:14px;font-weight:600;cursor:pointer;text-align:left;font-family:system-ui,sans-serif}
#tt-chip #tt-menu button:hover{background:#eef4fb}
#tt-menu hr{border:none;border-top:1px solid #e3eaf2;margin:5px 4px}
.tt-icogroup{display:inline-flex;gap:4px;background:rgba(255,255,255,.08);padding:3px;border-radius:10px;align-items:center}
.tt-modbar{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
.tt-modbar button{flex:1;padding:9px;border-radius:9px;border:1.5px solid #0b5cad;background:#fff;color:#0b5cad;font-weight:600;cursor:pointer;min-width:110px}
.tt-modbar button.on{background:#0b5cad;color:#fff}
.tt-opt{display:block;width:100%;text-align:left;padding:11px 13px;margin:7px 0;border:1.5px solid #c3d2e4;border-radius:10px;background:#f8fbff;font-size:15px;cursor:pointer}
.tt-opt:hover{border-color:#0b5cad}
.tt-opt.ok{background:#e2f4e5;border-color:#1d9d55}
.tt-opt.bad{background:#fdecea;border-color:#c0392b}
.tt-opt:disabled{cursor:default;opacity:.92}
.tt-qbox{background:#fbfcfe;border:1.5px solid #dbe4f0;border-radius:12px;padding:14px;margin-bottom:12px}
.tt-cipher{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:19px;font-weight:700;letter-spacing:1px;text-align:center;word-break:break-word;line-height:1.5;color:#083d73}
.tt-docgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.tt-signcard{border:1.5px solid #dbe4f0;border-radius:12px;padding:9px;background:#fff;text-align:center}
.tt-signcard b{display:block;margin-top:6px;font-size:14px}
.tt-signcard span{display:block;font-size:12.5px;color:#555;margin-top:3px;line-height:1.4}
.tt-modinput{width:100%;padding:11px;border:1.5px solid #bbb;border-radius:9px;font-size:16px;box-sizing:border-box;text-transform:uppercase}
#tt-chip .tt-icobtn{width:30px;height:30px;padding:0;display:inline-flex;align-items:center;justify-content:center;border-radius:8px;background:rgba(255,255,255,.14);color:#fff;border:1px solid rgba(255,255,255,.25);cursor:pointer;font-size:15px;line-height:1}
#tt-chip .tt-icobtn.tt-keybtn{background:#1d9d55;border-color:#37c978}
#tt-chip .tt-icobtn svg{width:18px;height:18px;display:block}
#tt-chip .tt-icobtn.on{background:#f4b41a;color:#082d50;border-color:#f4b41a}
.tt-figbtns{display:flex;gap:4px;align-items:center;background:rgba(255,255,255,.12);border-radius:8px;padding:3px 5px}
.tt-figbtns span{font-size:12px;color:#cfe3f5}
#tt-panel{position:fixed;inset:0;z-index:999985;background:rgba(4,25,45,.55);display:none;align-items:flex-start;justify-content:center;overflow-y:auto;padding:18px 10px;font-family:system-ui,sans-serif}
#tt-panel .tt-box{background:#fff;border-radius:14px;max-width:760px;width:100%;padding:18px;margin:auto 0}
#tt-panel h2{margin:0 0 10px;font-size:18px;color:#0b5cad}
.tt-mrow{border:1px solid #dde5ee;border-radius:10px;padding:10px 12px;margin-bottom:8px}
.tt-mrow .tt-mhead{font-size:14.5px;margin-bottom:6px}
.tt-badge{display:inline-block;padding:1px 8px;border-radius:20px;font-size:12px;font-weight:700;margin-left:6px}
.tt-b-pending{background:#fff3cd;color:#7a5b00}.tt-b-active{background:#d9f2d9;color:#205c20}.tt-b-stopped{background:#f8d7da;color:#842029}
#tab-main .segrow{gap:12px}
#tab-main .seg{flex:1 1 200px;background:#f2f6fc;border:1.5px solid #d5dfef;border-radius:12px;padding:10px 12px 12px}
#tab-main .segbtns{gap:5px}
#tab-main .segbtns button{min-height:36px;padding:3px 4px;font-size:.9rem;border-radius:8px;border-width:1.5px}
#ttAiBtn{margin-top:8px}
#ttAiNote{font-size:12.5px;color:#205c20;margin-top:6px;line-height:1.45}
.tt-rainbow{background:linear-gradient(90deg,#ff2d2d,#ff8a00,#e6c300,#00c853,#0091ea,#7c4dff,#ff2d95,#ff2d2d);background-size:220% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:800;animation:ttRainbow 3.2s linear infinite}
@keyframes ttRainbow{to{background-position:220% 0}}
#tt-panel .tt-box.wide{max-width:1180px}
.tt-table{width:100%;border-collapse:collapse;font-size:13.5px}
.tt-table th,.tt-table td{border:1px solid #dfe4ee;padding:6px 7px;text-align:left;vertical-align:middle}
.tt-table th{background:#eef2fa;cursor:pointer;user-select:none;white-space:nowrap}
.tt-table tbody tr:nth-child(even) td{background:#f8fafd}
.tt-table .tt-acts button{padding:4px 8px;font-size:12.5px}
.tt-table select{max-width:140px;padding:4px}
.tt-detailrow td{background:#fbfcfe}
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
  <h1>🚩 Truyền tin</h1>
  <div class="tt-sub">Luyện truyền tin Morse &amp; Semaphore — bản có tài khoản, đăng nhập để luyện tập</div>
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

/* Nhật ký chẩn đoán khởi động — hiện ngay trên màn hình để chụp gửi em */
const bootLog = [];
const bootT0 = Date.now();
function blog(msg) {
  const line = "+" + ((Date.now() - bootT0) / 1000).toFixed(1) + "s " + msg;
  bootLog.push(line);
  const box = $("tt-log");
  if (box) box.textContent = bootLog.join("\n");
}
function logHTML() {
  return `<div id="tt-log" style="text-align:left;white-space:pre-wrap;font-family:monospace;font-size:11px;color:#666;background:#f7f7f7;border-radius:8px;padding:8px;margin-top:10px">${bootLog.join("\n")}</div>`;
}
function showLoading(text) {
  viewHTML(`<div class="tt-center" style="padding:16px 0">
    <div style="font-size:30px">⏳</div><p>${text || "Đang kết nối máy chủ…"}</p></div>` + logHTML());
}
function showError(text) {
  viewHTML(`<div class="tt-err" style="display:block">${text}</div>
    <button class="tt-btn" onclick="location.reload()">Tải lại trang</button>` + logHTML());
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
/* QUAN TRỌNG: ba biến dưới đây PHẢI được khai báo TRƯỚC khối khởi tạo
   gọi boot() ở ngay phía dưới. Khai báo "let" đặt sau điểm gọi sẽ làm
   boot() văng lỗi vùng chết (TDZ) ngay khi gán bootTimer — lỗi bị nuốt
   im lặng, mọi hàm gọi lại sau đó đều chết trên cùng ba biến này và
   trang đứng ở màn hình chờ vĩnh viễn (đã từng xảy ra ở bản v4). */
let bootTimer = null;
let authOutcome = false;   // đã có kết quả trạng thái đăng nhập hay chưa
let accessGranted = false; // đã mở cổng vào ứng dụng hay chưa

if (location.protocol === "file:") {
  viewHTML(`<div class="tt-err" style="display:block">Thầy đang mở file trực tiếp trên máy (file://) nên phần đăng nhập không chạy được.</div>
  <p class="tt-note">Hãy đưa cả thư mục này lên GitHub Pages hoặc Netlify (hướng dẫn Phần E), rồi mở ứng dụng bằng link https được cấp. Mở bằng link đó thì đăng nhập, quản trị và AI mới hoạt động.</p>`);
} else if (!configured) {
  viewHTML(`<div class="tt-err" style="display:block">Ứng dụng chưa được cấu hình máy chủ.</div>
  <p class="tt-note">Thầy mở file <b>app-config.js</b> và dán nội dung <b>firebaseConfig</b> của dự án Firebase vào đó (hướng dẫn Phần D), hoặc gửi nội dung đó cho em qua Muse để em dán giúp. Đây không phải mật khẩu bí mật — xem ghi chú trong file.</p>`);
} else {
  app = initializeApp(cfg);
  // Bộ nhớ đăng nhập nhiều tầng dự phòng: nếu trình duyệt/môi trường mở
  // trang chặn IndexedDB (hay gặp khi mở lồng trong ứng dụng khác) thì
  // tự rơi xuống localStorage -> sessionStorage -> bộ nhớ tạm, tránh
  // việc khởi tạo đăng nhập bị treo im lặng.
  try {
    auth = initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence, inMemoryPersistence]
    });
  } catch (e) {
    auth = getAuth(app);
  }
  db = getFirestore(app);
  // App Check (reCAPTCHA Enterprise): từ 2026, Firebase TỰ BẬT ép
  // buộc App Check cho AI Logic ở các dự án mới — trang web phải
  // gắn App Check bằng site key (khóa CÔNG KHAI đặt trong
  // app-config.js, trường appCheckSiteKey) thì lời gọi AI mới
  // không bị chặn ngay từ cổng. Khởi tạo sớm, trước mọi lời gọi AI.
  if (cfg.appCheckSiteKey) {
    import("https://www.gstatic.com/firebasejs/12.4.0/firebase-app-check.js")
      .then(m => { try { m.initializeAppCheck(app, { provider: new m.ReCaptchaEnterpriseProvider(cfg.appCheckSiteKey), isTokenAutoRefreshEnabled: true }); } catch (e) {} })
      .catch(() => {});
  }
  boot();
}

function displayName(p) { return (p && (p.nickname || p.name || p.username)) || ""; }
function emailFor(username) {
  return username.trim().toLowerCase().replace(/\s+/g, "") + EMAIL_DOMAIN;
}
function usernameOk(u) { return /^[a-z0-9._-]{3,30}$/.test(u.trim().toLowerCase()); }
function emailOk(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || "").trim()); }
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

async function handleAuthUser(user) {
  authOutcome = true;
  clearTimeout(bootTimer);
  try {
    if (!user) { currentUser = null; if (!accessGranted) showAuthForms(); return; }
    currentUser = user;
    if (accessGranted) return;
    showLoading("Đang kiểm tra tài khoản…");
    await resolveAccess(user);
  } catch (e) {
    showError(errText(e && e.code) + "");
  }
}

async function bootSelfTest() {
  // Gọi thẳng vào máy chủ Google (không qua thư viện) để phân biệt:
  // mạng bị chặn/chậm tới Google, hay thư viện đăng nhập gặp trở ngại.
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch("https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig?key=" + encodeURIComponent(cfg.apiKey), { signal: ctl.signal });
    clearTimeout(t);
    return r.ok;
  } catch (e) { return false; }
}
function boot() {
  showLoading();
  blog("Trang đã nạp xong, đang chờ trạng thái đăng nhập…");
  // Tín hiệu 1: hàm theo dõi trạng thái chuẩn của Firebase.
  onAuthStateChanged(auth, (user) => {
    blog("Nhận được trạng thái đăng nhập: " + (user ? "đã có người dùng" : "chưa đăng nhập"));
    handleAuthUser(user).catch((e) => blog("Lỗi khi xử lý trạng thái: " + (e && e.name ? e.name + ": " : "") + (e && e.message ? e.message : "")));
  }, (err) => {
    blog("Lỗi khởi tạo đăng nhập: " + (err && err.code ? err.code : "không rõ"));
    clearTimeout(bootTimer);
    showError("Phần đăng nhập gặp lỗi khi khởi tạo (" + (err && err.code ? err.code : "không rõ") + "). Thầy chụp màn hình này gửi em để em xử lý đúng lỗi.");
  });
  // Tín hiệu 2 (dự phòng): nếu hàm theo dõi bị kẹt, tín hiệu "đã sẵn sàng"
  // của chính Firebase sẽ mở cổng thay — hai tín hiệu, cái nào tới trước dùng cái đó.
  if (typeof auth.authStateReady === "function") {
    auth.authStateReady().then(() => {
      blog("Tín hiệu sẵn sàng (authStateReady): xong");
      if (!authOutcome) handleAuthUser(auth.currentUser);
    }).catch((e) => {
      blog("Tín hiệu sẵn sàng (authStateReady): lỗi " + (e && e.code ? e.code : "") + (e && e.message ? " — " + e.message : ""));
    });
  }
  // Đầu dò khi bị kẹt 10 giây: kiểm tra kênh phụ trợ + thử một lệnh đăng
  // nhập giả để biết phần lõi đăng nhập còn sống hay đã treo hẳn.
  setTimeout(async () => {
    if (authOutcome || overlay.style.display === "none") return;
    blog("10 giây chưa có trạng thái — bắt đầu kiểm tra sâu…");
    try {
      await fetch("https://" + cfg.authDomain + "/__/auth/iframe", { mode: "no-cors" });
      blog("Kênh phụ trợ đăng nhập (auth iframe): gọi được");
    } catch (e) {
      blog("Kênh phụ trợ đăng nhập (auth iframe): KHÔNG gọi được");
    }
    if (authOutcome) return;
    try {
      const probe = signInWithEmailAndPassword(auth, "kiem-tra-he-thong@truyentin.app", "probe-khong-dung-123");
      const res = await Promise.race([
        probe.then(() => "thanh-cong-ngoai-du-kien", (e) => "tra-loi: " + (e && e.code ? e.code : "loi-khac")),
        new Promise((r) => setTimeout(() => r("qua-6-giay-khong-tra-loi"), 6000))
      ]);
      blog("Thử lệnh đăng nhập: " + res);
    } catch (e) {
      blog("Thử lệnh đăng nhập: lỗi " + (e && e.code ? e.code : ""));
    }
  }, 10000);
  bootTimer = setTimeout(async () => {
    if (overlay.style.display === "none" || authOutcome) return;
    showLoading("Kết nối đang chậm hơn bình thường, em đang kiểm tra giúp…");
    const ok = await bootSelfTest();
    blog("Tự kiểm tra máy chủ Google bằng REST: " + (ok ? "phản hồi tốt" : "không gọi được"));
    if (overlay.style.display === "none" || authOutcome) return;
    const embedded = window.self !== window.top;
    if (!ok) {
      showError("Không gọi được máy chủ Google từ mạng này — mạng nơi thầy đang dùng có thể chặn hoặc làm chậm các địa chỉ của Google (mạng trường từng chặn phông chữ Google). Thầy thử chuyển sang 4G hoặc mạng nhà rồi tải lại để đối chiếu.");
    } else if (embedded) {
      showError("Máy chủ Google vẫn phản hồi tốt, nhưng trang đang được mở LỒNG bên trong một ứng dụng khác nên phần đăng nhập bị chặn bộ nhớ. Thầy hãy mở LINK TRỰC TIẾP của trang bằng trình duyệt Chrome (dán link vào Chrome), không mở xem trước trong ứng dụng trung gian.");
    } else {
      showError("Máy chủ Google vẫn phản hồi tốt nhưng phần đăng nhập chưa sẵn sàng. Phía dưới là nhật ký chẩn đoán — thầy chụp màn hình này gửi em, em sẽ xử lý đúng điểm bị kẹt.");
    }
  }, 20000);
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
    myProfile = { username: (user.email || "").split("@")[0], name: "", className: "", email: "", role: "member", status: "pending", expiry: null };
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
/* KHÓA ĐĂNG KÝ: quản trị bật/tắt trong panel (doc config/app,
   đọc được trước cả khi đăng nhập). Khi khóa: cổng KHÔNG hiện
   tab/ form đăng ký nữa và nút đăng ký (nếu còn sót) cũng bị
   chặn; Rules phía máy chủ đồng thời chặn tạo hồ sơ mới. */
let _regLocked = false;
let _regLockPromise = null;
function fetchRegLock() {
  if (!_regLockPromise) {
    _regLockPromise = (async () => {
      try {
        const s = await getDoc(doc(db, "config", "app"));
        _regLocked = !!(s.exists() && s.data().registrationLocked === true);
      } catch (e) { _regLocked = false; /* không đọc được (chưa dán Rules mới / mất mạng): mặc định mở */ }
      return _regLocked;
    })();
  }
  return _regLockPromise;
}
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
    <div class="tt-field"><label>Email (để nhận thông báo khi tài khoản được duyệt)</label><input id="rg-email" type="email" placeholder="vd: an@gmail.com"></div>
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
    if (_regLocked) return;
    $("tab-reg").classList.add("on"); $("tab-login").classList.remove("on");
    $("tt-form-reg").style.display = ""; $("tt-form-login").style.display = "none"; err.style.display = "none";
  });
  /* Áp trạng thái khóa đăng ký ngay khi biết kết quả: ẩn hẳn
     tab và form đăng ký, đưa người dùng về form đăng nhập. */
  fetchRegLock().then((locked) => {
    if (!locked) return;
    const tabReg = $("tab-reg"), formReg = $("tt-form-reg");
    if (tabReg) tabReg.style.display = "none";
    if (formReg) formReg.style.display = "none";
    const tabLogin = $("tab-login"), formLogin = $("tt-form-login");
    if (tabLogin) tabLogin.classList.add("on");
    if (formLogin) formLogin.style.display = "";
    const note = document.querySelector("#tt-form-login .tt-note");
    if (note) note.textContent = "Đăng ký tài khoản mới đang tạm khóa — em liên hệ thầy để được cấp tài khoản.";
  });
  $("btn-login").addEventListener("click", async () => {
    const u = $("li-user").value, p = $("li-pass").value;
    if (!usernameOk(u)) { showErr("Tên đăng nhập không hợp lệ (chữ thường không dấu, số, dấu . _ -, 3–30 ký tự)."); return; }
    const btn = $("btn-login"); btn.disabled = true; btn.textContent = "Đang đăng nhập…";
    try { await signInWithEmailAndPassword(auth, emailFor(u), p); }
    catch (e) { showErr(errText(e.code)); btn.disabled = false; btn.textContent = "Đăng nhập"; }
  });
  $("btn-reg").addEventListener("click", async () => {
    if (_regLocked) { showErr("Đăng ký đang tạm khóa — em liên hệ thầy để được cấp tài khoản."); return; }
    const name = $("rg-name").value.trim(), cls = $("rg-class").value.trim();
    const email = $("rg-email").value.trim();
    const u = $("rg-user").value, p = $("rg-pass").value;
    if (!name || !cls) { showErr("Em điền đủ Họ và tên và Lớp nhé."); return; }
    if (!emailOk(email)) { showErr("Email chưa đúng định dạng — em kiểm tra lại (vd: an@gmail.com)."); return; }
    if (!usernameOk(u)) { showErr("Tên đăng nhập không hợp lệ (chữ thường không dấu, số, dấu . _ -, 3–30 ký tự)."); return; }
    if (p.length < 6) { showErr("Mật khẩu phải có ít nhất 6 ký tự."); return; }
    const btn = $("btn-reg"); btn.disabled = true; btn.textContent = "Đang đăng ký…";
    try {
      const cred = await createUserWithEmailAndPassword(auth, emailFor(u), p);
      await setDoc(doc(db, "profiles", cred.user.uid), {
        username: u.trim().toLowerCase(), name, className: cls, email, nickname: "", aiEnabled: false, useSharedKeys: false, useClaudeBank: false,
        featMorse: true, featSemaphore: true, featTrail: false, featCipher: false,
        role: "member", status: "pending", expiry: null, createdAt: serverTimestamp()
      });
      /* Báo cho thầy qua email (nếu đã cấu hình gửi mail) để thầy duyệt. */
      notifyAdminNewRegistration({ username: u.trim().toLowerCase(), name, className: cls, email });
      notifyUserRegistered({ username: u.trim().toLowerCase(), name, className: cls, email });
    } catch (e) { showErr(errText(e.code)); btn.disabled = false; btn.textContent = "Đăng ký"; }
  });
}

async function doLogout() {
  try { await signOut(auth); } catch (e) { /* bỏ qua */ }
  location.reload();
}

/* ---------------- Vào ứng dụng ---------------- */
function grantAccess() {
  if (accessGranted) return;
  accessGranted = true;
  overlay.style.display = "none";
  // Điền sẵn họ tên + lớp cho phần Kiểm tra
  const sn = $("stuName"), sc = $("stuClass");
  if (sn && myProfile.name) { sn.value = myProfile.name; sn.dispatchEvent(new Event("input", { bubbles: true })); }
  if (sc && myProfile.className) { sc.value = myProfile.className; sc.dispatchEvent(new Event("input", { bubbles: true })); }
  // Tài khoản GV: không hiển thị ô Lớp trong bài kiểm tra (gán sẵn "GV" để qua bước kiểm tra của ứng dụng)
  if (sc && myProfile.role === "GV") {
    sc.value = "GV";
    const f = sc.closest(".field");
    if (f) f.style.display = "none";
  }
  buildChip();
  mountAiButton();
  /* Phân quyền chức năng ở phía ứng dụng chính: ẩn nút chọn
     môn bị khóa trong ngăn Cài đặt; nếu môn đang chọn bị khóa
     thì tự chuyển sang môn được phép còn lại. */
  {
    const km = $("kindMorse"), ks = $("kindSem");
    if (km && !featOn("featMorse")) km.style.display = "none";
    if (ks && !featOn("featSemaphore")) ks.style.display = "none";
    if (!featOn("featMorse") && featOn("featSemaphore") && ks && ks.getAttribute("aria-pressed") !== "true") ks.click();
    else if (!featOn("featSemaphore") && featOn("featMorse") && km && km.getAttribute("aria-pressed") !== "true") km.click();
  }
  maybePromptEmail();
  syncHistory();
  setInterval(syncHistory, 20000);
  startHistWatch();
}

/* Dòng phụ dưới tên người dùng: HS -> "Lớp 6A6, trường X";
   GV -> "Giáo viên trường X"; quản trị -> "Quản trị viên". */
function subLineFor(p, schoolName, isAdmin) {
  if (isAdmin) return "Quản trị viên" + (schoolName ? " · trường " + schoolName : "");
  if (p && p.role === "GV") return "Giáo viên" + (schoolName ? " trường " + schoolName : "");
  const cls = p && p.className ? "Lớp " + p.className : "";
  const sch = schoolName ? "trường " + schoolName : "";
  return [cls, sch].filter(Boolean).join(", ");
}
async function fetchMySchoolName() {
  if (!myProfile || !myProfile.schoolId || !db) return "";
  try {
    const s = await getDoc(doc(db, "schools", myProfile.schoolId));
    return s.exists() ? (s.data().name || "") : "";
  } catch (e) { return ""; }
}
function fitTopBar() {
  const c = $("tt-chip");
  if (c && c.style.display !== "none") document.body.style.paddingTop = (c.offsetHeight + 4) + "px";
}

/* ---------------- Phân quyền CHỨC NĂNG ----------------
   Mỗi tài khoản được quản trị phân quyền từng chức năng
   (Morse / Semaphore / Dấu đi đường / Mật thư). Được quyền
   nào thì THẤY menu của chức năng đó: nút ở thanh ghim và
   mục tài liệu trong menu người dùng; không được quyền thì
   không thấy. Tài khoản cũ chưa có các trường này: Morse và
   Semaphore coi như ĐÃ được cấp (giữ nguyên thói quen dùng
   từ trước), hai chức năng mới coi như chưa cấp. Quản trị
   luôn có mọi quyền. Khi phát triển chức năng mới, thêm một
   trường feat* tương ứng + một mục ở đây và trong form Sửa. */
function featOn(key) {
  if (myIsAdmin) return true;
  const p = myProfile || {};
  if (key === "featTrail" || key === "featCipher") return p[key] === true;
  return p[key] !== false;
}
const FEAT_LIST = [
  { key: "featMorse", label: "Morse" },
  { key: "featSemaphore", label: "Semaphore" },
  { key: "featTrail", label: "Dấu đi đường" },
  { key: "featCipher", label: "Mật thư" }
];

const ICO_WHISTLE = '<svg viewBox="0 0 26 26" fill="currentColor" aria-hidden="true"><path d="M25 7.6c0-.9-.7-1.6-1.6-1.6h-8.1c-.6-1-1.8-1.7-3-1.5C8.8 5 5.8 8.3 5.8 12.3c0 4.5 3.6 8.1 8.1 8.1 4 0 7.3-2.9 8-6.7h1.5c.9 0 1.6-.7 1.6-1.6V7.6z"/><circle cx="12.4" cy="12.2" r="2.2" fill="#082d50" opacity=".9"/></svg>';
const ICO_FLAGS = '<svg viewBox="0 0 26 26" aria-hidden="true"><g stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><line x1="6.5" y1="24" x2="15.5" y2="4.5"/><line x1="19.5" y1="24" x2="10.5" y2="4.5"/></g><path d="M15.5 4.5l7.5 2.3-7 2.9z" fill="#e63946"/><path d="M10.5 4.5L3 6.8l7 2.9z" fill="#f4b41a"/></svg>';
let ttIcoSyncDone = false;
function paintBarIcons() {
  const pairs = [["ttIcoMorse", "kindMorse"], ["ttIcoSem", "kindSem"], ["ttIcoLuyen", "modeLuyen"], ["ttIcoKiem", "modeKiem"]];
  pairs.forEach(([barId, srcId]) => {
    const b = $(barId), s = $(srcId);
    if (b && s) b.classList.toggle("on", s.getAttribute("aria-pressed") === "true");
  });
}
function syncBarIcons() {
  paintBarIcons();
  if (ttIcoSyncDone) return;
  ttIcoSyncDone = true;
  ["kindMorse", "kindSem", "modeLuyen", "modeKiem"].forEach((id) => {
    const el = $(id);
    if (el && window.MutationObserver) new MutationObserver(paintBarIcons).observe(el, { attributes: true, attributeFilter: ["aria-pressed"] });
  });
}
function buildChip() {
  let chip = $("tt-chip");
  if (!chip) {
    chip = document.createElement("div");
    chip.id = "tt-chip";
    document.body.appendChild(chip);
    window.addEventListener("resize", fitTopBar);
  }
  chip.style.display = "flex";
  chip.innerHTML = "";
  /* Tên người dùng: bấm vào mở MENU NGƯỜI DÙNG (toàn bộ mục của
     thanh tab cũ + Lịch sử/Quản trị/Dung lượng/Cài đặt/Đăng xuất). */
  const info = document.createElement("div");
  info.className = "tt-chipinfo tt-namebtn";
  info.title = "Mở menu người dùng";
  const line1 = document.createElement("span");
  line1.textContent = "👤 ";
  const nm = document.createElement("span");
  nm.textContent = displayName(myProfile);
  if (aiAllowed()) nm.className = "tt-rainbow";
  line1.appendChild(nm);
  const caret = document.createElement("span");
  caret.textContent = " ▾";
  caret.style.opacity = ".75";
  line1.appendChild(caret);
  info.appendChild(line1);
  const sub = document.createElement("span");
  sub.className = "tt-chipsub";
  sub.textContent = subLineFor(myProfile, "", myIsAdmin);
  info.appendChild(sub);
  chip.appendChild(info);
  fetchMySchoolName().then((schoolName) => {
    sub.textContent = subLineFor(myProfile, schoolName, myIsAdmin);
    fitTopBar();
  });
  /* Cụm nút ICON nhỏ ngay cạnh tên: chọn Dạng truyền tin (còi =
     Morse, hai cờ = Semaphore) và Chế độ (bút = Luyện tập, bảng
     kiểm = Kiểm tra). Bấm là bấm thay các nút tương ứng của ứng
     dụng (đã ẩn khỏi màn hình chính); trạng thái đang chọn được
     đồng bộ hai chiều qua aria-pressed. */
  const mkIco = (id, html, title, targetId) => {
    const b = document.createElement("button");
    b.id = id;
    b.className = "tt-icobtn";
    b.innerHTML = html;
    b.title = title;
    b.setAttribute("aria-label", title);
    b.addEventListener("click", () => { const t = $(targetId); if (t) t.click(); paintBarIcons(); });
    return b;
  };
  const gKind = document.createElement("span");
  gKind.className = "tt-icogroup";
  /* Chỉ hiện nút của chức năng tài khoản ĐƯỢC phân quyền. */
  if (featOn("featMorse")) gKind.appendChild(mkIco("ttIcoMorse", ICO_WHISTLE, "Morse (tiếng + đèn)", "kindMorse"));
  if (featOn("featSemaphore")) gKind.appendChild(mkIco("ttIcoSem", ICO_FLAGS, "Semaphore (cờ tay)", "kindSem"));
  chip.appendChild(gKind);
  const gMode = document.createElement("span");
  gMode.className = "tt-icogroup";
  gMode.appendChild(mkIco("ttIcoLuyen", "🖊️", "Chế độ Luyện tập", "modeLuyen"));
  gMode.appendChild(mkIco("ttIcoKiem", "📋", "Chế độ Kiểm tra", "modeKiem"));
  chip.appendChild(gMode);
  /* Nhóm chức năng MỚI (Dấu đi đường / Mật thư): nút mở thẳng
     module Luyện tập & Kiểm tra của chức năng — chỉ hiện khi
     tài khoản được phân quyền chức năng đó. */
  const gFeat = document.createElement("span");
  gFeat.className = "tt-icogroup";
  const featBtn = (emoji, title, fn) => {
    const b = document.createElement("button");
    b.className = "tt-icobtn";
    b.textContent = emoji;
    b.title = title;
    b.setAttribute("aria-label", title);
    b.addEventListener("click", fn);
    return b;
  };
  if (featOn("featTrail")) gFeat.appendChild(featBtn("👣", "Dấu đi đường — Luyện tập & Kiểm tra", () => openTrailModule()));
  if (featOn("featCipher")) gFeat.appendChild(featBtn("🔐", "Mật thư — Luyện tập & Kiểm tra", () => openCipherModule()));
  if (gFeat.childNodes.length) chip.appendChild(gFeat);
  /* Nút Cài đặt ngay trên thanh ghim, chỉ hiện hình bánh răng */
  const bSetIco = document.createElement("button");
  bSetIco.className = "tt-icobtn";
  bSetIco.textContent = "⚙️";
  bSetIco.title = "Cài đặt";
  bSetIco.setAttribute("aria-label", "Cài đặt");
  bSetIco.addEventListener("click", () => {
    const d = $("settingsDrawer");
    if (!d) return;
    d.classList.toggle("hidden");
    if (!d.classList.contains("hidden")) d.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  chip.appendChild(bSetIco);
  /* Nút chìa khóa XANH: chỉ tài khoản được dùng AI mới thấy —
     bấm để tự nhập khóa Gemini của riêng mình (lưu trên máy). */
  if (aiAllowed()) {
    const bKey = document.createElement("button");
    bKey.className = "tt-icobtn tt-keybtn";
    bKey.textContent = "🔑";
    bKey.title = "Khóa Gemini của bạn — bấm để nhập khóa AI riêng";
    bKey.setAttribute("aria-label", "Nhập khóa Gemini của bạn");
    bKey.addEventListener("click", openMyKeyPanel);
    chip.appendChild(bKey);
  }
  /* MENU NGƯỜI DÙNG (ẩn mặc định, bấm vào tên thì mở) */
  const menu = document.createElement("div");
  menu.id = "tt-menu";
  menu.className = "hidden";
  const closeMenu = () => menu.classList.add("hidden");
  const item = (label, fn, closeAfter = true) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.addEventListener("click", () => { if (closeAfter) closeMenu(); fn(); });
    menu.appendChild(b);
    return b;
  };
  const nav = (label, tabId) => item(label, () => {
    const t = $(tabId);
    if (t) t.click();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  nav("🏠 Luyện tập & Kiểm tra", "tabbtn-main");
  if (featOn("featMorse")) nav("📟 Bảng Morse", "tabbtn-morse");
  if (featOn("featSemaphore")) nav("🚩 Bảng Semaphore", "tabbtn-sem");
  if (featOn("featTrail")) item("👣 Tài liệu dấu đi đường", () => openTrailDoc());
  if (featOn("featCipher")) item("🔐 Tài liệu mật thư", () => openCipherDoc());
  /* Mục Quy ước & Giáo viên: chỉ tài khoản GIÁO VIÊN và
     quản trị mới thấy (học sinh không thấy mục này). */
  if (myIsAdmin || (myProfile && myProfile.role === "GV")) nav("📜 Quy ước & Giáo viên", "tabbtn-rules");
  menu.appendChild(document.createElement("hr"));
  item("🕘 Lịch sử", openMyHistory);
  if (myProfile && myProfile.role === "GV" && myProfile.schoolId) item("🏫 Học sinh trường", openSchoolPanel);
  if (myIsAdmin) {
    item("🛠 Quản trị", openAdminPanel);
    item("📊 Dung lượng", openUsagePanel);
  }
  item("🚪 Đăng xuất", doLogout);
  chip.appendChild(menu);
  info.addEventListener("click", (e) => { e.stopPropagation(); menu.classList.toggle("hidden"); });
  if (!window.__ttMenuOutside) {
    window.__ttMenuOutside = true;
    document.addEventListener("click", (e) => {
      const m = $("tt-menu"), c = $("tt-chip");
      if (m && c && !m.classList.contains("hidden") && !c.contains(e.target)) m.classList.add("hidden");
    });
  }
  syncBarIcons();
  requestAnimationFrame(fitTopBar);
  setTimeout(fitTopBar, 300);
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
      const meta = metaFor(entry);
      await addDoc(collection(db, "history"), {
        uid: currentUser.uid, username: myProfile.username || "", entry, at: serverTimestamp(),
        kindLabel: meta.kindLabel, speedLabel: meta.speedLabel, dname: displayName(myProfile)
      });
      done.add(key); added++;
    }
    if (added) localStorage.setItem("tt_synced", JSON.stringify([...done].slice(-400)));
  } catch (e) { /* đồng bộ hỏng không được làm gián đoạn luyện tập */ }
  syncing = false;
}

/* ---------------- Lịch sử: nhãn dạng/tốc độ + đồng bộ ngay khi nộp bài ---------------- */
const KIND_NAMES = { "nhan-morse": "Nhận Morse", "nhan-sem": "Nhận Semaphore", "phat-morse": "Phát Morse", "phat-sem": "Phát Semaphore", "kt-dau-duong": "Kiểm tra dấu đi đường", "kt-mat-thu": "Kiểm tra mật thư" };
function metaFor(entry) {
  const k = (entry && entry.kind) || "";
  let speedLabel = "";
  if (k.indexOf("morse") >= 0) { const w = $("wpmRange"); if (w) speedLabel = w.value + " WPM"; }
  else if (k.indexOf("sem") >= 0) { const s = $("semRange"); if (s) speedLabel = String(s.value).replace(".", ",") + " giây/chữ"; }
  return { kindLabel: KIND_NAMES[k] || k, speedLabel };
}
function fmtScore(s) { const n = Number(s); return isNaN(n) ? String(s ?? "") : n.toFixed(1).replace(".", ","); }
function fmtDur(sec) {
  if (sec === null || sec === undefined || isNaN(Number(sec))) return "—";
  const v = Math.max(0, Math.round(Number(sec)));
  const m = Math.floor(v / 60), s = v % 60;
  return m ? m + " phút " + s + " giây" : s + " giây";
}
function loadLocalHist() { try { return JSON.parse(localStorage.getItem("ltmt_history") || "[]"); } catch (e) { return []; } }
let lastHistLen = -1;
function startHistWatch() {
  lastHistLen = loadLocalHist().length;
  setInterval(() => {
    const n = loadLocalHist().length;
    if (n !== lastHistLen) { lastHistLen = n; syncHistory(); }
  }, 2500);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") syncHistory(); });
}
function histTableHTML(rows, firstColLabel, nameOf) {
  if (!rows.length) return "<p>Chưa có bài kiểm tra nào được lưu.</p>";
  return `<div style="overflow-x:auto"><table class="tt-table"><thead><tr><th>${esc(firstColLabel)}</th><th>Thời gian làm bài</th><th>Dạng truyền tin</th><th>Tốc độ</th><th>Thời lượng</th><th>Số điểm</th></tr></thead><tbody>${
    rows.map((r) => {
      const e = r.entry || {};
      return `<tr><td>${esc(nameOf(r))}</td><td>${esc(e.date || "")}</td><td>${esc(r.kindLabel || metaFor(e).kindLabel)}</td><td>${esc(r.speedLabel || "—")}</td><td>${esc(fmtDur(e.dur))}</td><td><b>${esc(fmtScore(e.score))}/10</b> <span style="color:#666">(đúng ${esc(e.correct ?? "")}/${esc(e.total ?? "")})</span></td></tr>`;
    }).join("")
  }</tbody></table></div>`;
}
async function openMyHistory() {
  const body = openPanel("🕘 Lịch sử làm bài", true);
  body.innerHTML = "<p>Đang tải lịch sử…</p>";
  let rows = [];
  try {
    const snap = await getDocs(query(collection(db, "history"), where("uid", "==", currentUser.uid)));
    snap.forEach((d) => { const h = d.data(); rows.push({ entry: h.entry || {}, kindLabel: h.kindLabel || "", speedLabel: h.speedLabel || "", at: (h.at && h.at.seconds) || 0 }); });
  } catch (e) { /* mất mạng thì xem bản lưu trên máy */ }
  if (!rows.length) rows = loadLocalHist().map((e) => ({ entry: e, kindLabel: "", speedLabel: "", at: 0 }));
  rows.sort((a, b) => b.at - a.at);
  body.innerHTML = histTableHTML(rows, "Họ tên", (r) => (r.entry && r.entry.name) || displayName(myProfile))
    + `<p class="tt-note">Lịch sử được lưu theo tài khoản trên máy chủ: nộp bài xong là lưu, đăng nhập máy khác vẫn xem lại được.</p>`;
}
async function openSchoolPanel() {
  const body = openPanel("🏫 Học sinh trường của thầy/cô", true);
  body.innerHTML = "<p>Đang tải…</p>";
  try {
    const ps = await getDocs(query(collection(db, "profiles"), where("schoolId", "==", myProfile.schoolId)));
    const mates = [];
    ps.forEach((d) => { if (d.id !== currentUser.uid) mates.push({ uid: d.id, ...d.data() }); });
    if (!mates.length) { body.innerHTML = "<p>Trường chưa có thành viên nào khác.</p>"; return; }
    const rows = [];
    for (const m of mates.slice(0, 30)) {
      const hs = await getDocs(query(collection(db, "history"), where("uid", "==", m.uid)));
      hs.forEach((d) => { const h = d.data(); rows.push({ who: displayName(m), entry: h.entry || {}, kindLabel: h.kindLabel || "", speedLabel: h.speedLabel || "", at: (h.at && h.at.seconds) || 0 }); });
    }
    rows.sort((a, b) => b.at - a.at);
    body.innerHTML = histTableHTML(rows, "Học sinh", (r) => r.who)
      + `<p class="tt-note">Chỉ gồm các bài đã đồng bộ lên máy chủ của học sinh cùng trường với thầy/cô.</p>`;
  } catch (e) {
    body.innerHTML = `<div class="tt-err" style="display:block">${esc(errText(e.code))}</div><p class="tt-note">Nếu báo lỗi quyền truy cập, thầy/cô báo quản trị dán lại Rules mới nhất trong Firebase Console rồi thử lại.</p>`;
  }
}

/* ---------------- Khung panel dùng chung ---------------- */
function openPanel(title, wide) {
  let panel = $("tt-panel");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "tt-panel";
    panel.innerHTML = `<div class="tt-box"><h2></h2><div class="tt-pbody"></div>
      <button class="tt-btn alt" id="tt-pclose" style="margin-top:12px">Đóng</button></div>`;
    document.body.appendChild(panel);
    panel.querySelector("#tt-pclose").addEventListener("click", () => { panel.style.display = "none"; });
  }
  panel.querySelector(".tt-box").classList.toggle("wide", !!wide);
  panel.querySelector("h2").textContent = title;
  panel.style.display = "flex";
  return panel.querySelector(".tt-pbody");
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------------- Email thông báo (qua Apps Script của thầy) ----------------
   Theo yêu cầu của thầy: KHÔNG dùng dịch vụ bên thứ ba (đã bỏ
   EmailJS). Thư được gửi từ chính GMAIL CỦA THẦY bằng một
   đoạn Google Apps Script chạy dưới tài khoản Google của
   thầy (hạ tầng của Google, miễn phí 100 thư/ngày). Ứng dụng
   gọi script qua địa chỉ Web App của nó; script kiểm tra mã
   bí mật rồi dùng GmailApp gửi thư.
   Cấu hình trong doc config/email: { scriptUrl, secret,
   adminEmail } — thầy điền ở tab "Cài đặt khác" (file mã
   script: script-gui-email-truyen-tin.gs em gửi kèm).
   Trình duyệt không đọc được trả lời của Apps Script (gửi ở
   chế độ no-cors) nên "đã gửi" nghĩa là yêu cầu đã được gửi
   đi — bằng chứng thật là thư đến hộp thư.
   Ba thời điểm gửi:
   - Người dùng bấm nút GỬI ĐĂNG KÝ -> gửi ngay cho THẦY
     (adminEmail) để duyệt, đồng thời gửi thư XÁC NHẬN cho
     chính người đăng ký (đã nhận đăng ký, đang chờ duyệt).
   - Quản trị bấm MỞ / duyệt (tài khoản chuyển sang "Đang
     dùng" từ bất kỳ trạng thái nào trước đó) -> gửi ngay
     cho NGƯỜI DÙNG vào email đã đăng ký, kèm thông tin tài
     khoản (tên đăng nhập, họ tên, lớp, hạn dùng, địa chỉ
     đăng nhập — mật khẩu không ai xem được nên không gửi).
   LƯU Ý HIỂN THỊ: TIÊU ĐỀ thư KHÔNG để biểu tượng thuộc
   nhóm ký tự MỚI (4 byte, vd quả chuông 🔔, phong thư bay
   📨) — đường gửi thư và một số phần mềm thư làm hỏng nhóm
   này thành ký tự lỗi "�" (thầy chụp màn hình 13/11/2026:
   tiêu đề báo đăng ký mới lỗi đúng như vậy, trong khi dấu
   ✅ thuộc nhóm ký tự CŨ thông dụng thì hiển thị tốt).
   Trong nhóm ký tự cũ KHÔNG có hình quả chuông, nên thư
   thông báo dùng hình PHONG THƯ ✉ (cùng nhóm an toàn với
   ✅) làm biểu tượng báo tin mới. Nội dung thư chỉ dùng
   dấu "•" thông thường, an toàn ở mọi phần mềm thư. */
let _emailCfg = null;
async function emailCfg() {
  if (_emailCfg !== null) return _emailCfg;
  try { const s = await getDoc(doc(db, "config", "email")); _emailCfg = s.exists() ? (s.data() || {}) : {}; }
  catch (e) { _emailCfg = {}; }
  return _emailCfg;
}
function emailReady(cfg) { return !!(cfg && cfg.scriptUrl && cfg.secret && cfg.adminEmail); }
async function sendMailViaScript(to, subject, body) {
  try {
    const cfg = await emailCfg();
    if (!emailReady(cfg) || !emailOk(to)) return false;
    await fetch(cfg.scriptUrl, {
      method: "POST", mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ secret: cfg.secret, to, subject, body })
    });
    return true;
  } catch (e) { return false; }
}
function notifyAdminNewRegistration(info) {
  (async () => {
    const cfg = await emailCfg();
    if (!emailReady(cfg)) return;
    sendMailViaScript(cfg.adminEmail,
      "✉ Truyền tin: có đăng ký mới chờ duyệt — " + (info.username || ""),
      "Có một tài khoản mới vừa đăng ký ứng dụng Truyền tin và đang chờ thầy duyệt.\n\n" +
      "• Tên đăng nhập: " + (info.username || "") + "\n" +
      "• Họ và tên: " + (info.name || "") + "\n" +
      "• Lớp: " + (info.className || "") + "\n" +
      "• Email: " + (info.email || "") + "\n\n" +
      "Thầy mở ứng dụng tại " + location.origin + location.pathname + ", vào Quản trị > tab Thành viên để duyệt.");
  })();
}
function notifyUserApproved(m, reopened) {
  (async () => {
    if (!m || !emailOk(m.email)) return;
    const cfg = await emailCfg();
    if (!emailReady(cfg)) return;
    sendMailViaScript(m.email,
      reopened ? "✅ Tài khoản Truyền tin đã được mở lại — " + (m.username || "") : "✅ Tài khoản Truyền tin đã được duyệt — " + (m.username || ""),
      "Chào " + (m.name || "em") + ",\n\n" +
      (reopened
        ? "Tài khoản ứng dụng Truyền tin của em đã được thầy MỞ LẠI và dùng được ngay.\n\n"
        : "Tài khoản ứng dụng Truyền tin của em đã được thầy duyệt và dùng được ngay.\n\n") +
      "• Tên đăng nhập: " + (m.username || "") + "\n" +
      "• Họ và tên: " + (m.name || "") + "\n" +
      "• Lớp: " + (m.className || "—") + "\n" +
      "• Hạn dùng: " + (m.expiry || "Vĩnh viễn") + "\n" +
      "• Địa chỉ đăng nhập: " + location.origin + location.pathname + "\n\n" +
      "Em đăng nhập bằng tên đăng nhập và mật khẩu đã đăng ký. Nếu quên mật khẩu, em báo thầy để được cấp lại tài khoản.\n\n" +
      "Chúc em luyện tập tốt!");
  })();
}
/* Thư xác nhận gửi cho NGƯỜI ĐĂNG KÝ ngay khi họ bấm nút
   gửi đăng ký (cùng lúc với thư báo cho thầy): cho họ biết
   hệ thống đã nhận đăng ký và tài khoản đang chờ duyệt. */
function notifyUserRegistered(info) {
  (async () => {
    if (!info || !emailOk(info.email)) return;
    const cfg = await emailCfg();
    if (!emailReady(cfg)) return;
    sendMailViaScript(info.email,
      "✉ Truyền tin: đã nhận đăng ký — " + (info.username || ""),
      "Chào " + (info.name || "em") + ",\n\n" +
      "Hệ thống đã nhận đăng ký tài khoản ứng dụng Truyền tin của em.\n\n" +
      "• Tên đăng nhập: " + (info.username || "") + "\n" +
      "• Họ và tên: " + (info.name || "") + "\n" +
      "• Lớp: " + (info.className || "—") + "\n\n" +
      "Tài khoản đang CHỜ THẦY DUYỆT. Ngay khi thầy duyệt (bấm Mở), em sẽ nhận thêm một thư nữa báo tài khoản đã dùng được.\n\n" +
      "Em nhớ kỹ mật khẩu đã đăng ký — không ai xem lại được mật khẩu cũ, kể cả thầy.");
  })();
}

/* Tài khoản tạo trước khi có trường email: ở lần đăng nhập
   tiếp theo hiện bảng nhắc bổ sung email (đóng được, lần sau
   vẫn nhắc lại cho đến khi đã nhập). */
let _emailPromptShown = false;
function maybePromptEmail() {
  if (_emailPromptShown || myIsAdmin || !myProfile || myProfile.email) return;
  _emailPromptShown = true;
  const body = openPanel("✉️ Bổ sung email", false);
  body.innerHTML = `
    <p class="tt-note" style="margin-top:0">Tài khoản của em được tạo từ trước khi ứng dụng yêu cầu email nên chưa có email. Em nhập email để nhận thông báo khi tài khoản được duyệt và các thông báo quan trọng từ thầy.</p>
    <div class="tt-field"><label>Email của em</label><input id="eml-in" type="email" placeholder="vd: an@gmail.com"></div>
    <div style="display:flex;gap:8px"><button class="tt-btn" id="eml-save" style="flex:1">💾 Lưu email</button><button class="tt-btn alt" id="eml-later" style="flex:1">Để sau</button></div>
    <div id="eml-msg" style="font-size:13px;margin-top:8px"></div>`;
  const close = () => { const c = document.querySelector("#tt-panel #tt-pclose"); if (c) c.click(); };
  body.querySelector("#eml-later").addEventListener("click", close);
  body.querySelector("#eml-save").addEventListener("click", async () => {
    const v = body.querySelector("#eml-in").value.trim();
    const msg = body.querySelector("#eml-msg");
    if (!emailOk(v)) { msg.textContent = "Email chưa đúng định dạng — em kiểm tra lại."; return; }
    try {
      await updateDoc(doc(db, "profiles", auth.currentUser.uid), { email: v });
      myProfile.email = v;
      msg.innerHTML = "<span style='color:#1d9d55;font-weight:700'>Đã lưu email ✔</span>";
      setTimeout(close, 700);
    } catch (e) { msg.textContent = "Lưu thất bại: " + errText(e.code); }
  });
}

/* ---------------- Quản trị ---------------- */
let admState = { q: "", k: "name", dir: 1 };
function roleOf(m, adminsSet) { return adminsSet.has(m.uid) ? "QT" : (m.role === "GV" ? "GV" : "HS"); }

async function openAdminPanel() {
  const body = openPanel("🛠 Quản trị", true);
  body.innerHTML = `<p>Đang tải danh sách…</p>`;
  try {
    const snap = await getDocs(collection(db, "profiles"));
    const members = [];
    snap.forEach((d) => members.push({ uid: d.id, ...d.data() }));
    members.sort((a, b) => (a.username || "").localeCompare(b.username || ""));
    let schools = [];
    try { const ss = await getDocs(collection(db, "schools")); ss.forEach((d) => schools.push({ id: d.id, name: (d.data() || {}).name || "" })); } catch (e) {}
    schools.sort((a, b) => a.name.localeCompare(b.name, "vi"));
    const adminsSet = new Set();
    try { const as = await getDocs(collection(db, "admins")); as.forEach((d) => adminsSet.add(d.id)); } catch (e) {}
    renderAdminList(body, members, schools, adminsSet);
  } catch (e) {
    body.innerHTML = `<div class="tt-err" style="display:block">${esc(errText(e.code))}</div>`;
  }
}

let admTab = "members";
let poolSort = { k: "at", dir: 1 };
let schoolSort = { k: "name", dir: 1 };
function renderAdminList(body, members, schools, adminsSet) {
  const schoolName = (id) => { const s = schools.find((x) => x.id === id); return s ? s.name : ""; };
  body.innerHTML = `
    <div class="tt-admtabs">
      <button data-tab="api">🔑 API</button>
      <button data-tab="members">👥 Thành viên</button>
      <button data-tab="bank">📚 Kho bản tin</button>
      <button data-tab="schools">🏫 Trường</button>
      <button data-tab="settings">⚙️ Cài đặt khác</button>
    </div>
    <div data-pane="api">
      <p class="tt-note" style="margin:6px 0">Khóa do người dùng nhập ở nút 🔑 xanh tự động vào kho này. Hệ thống tự xoay vòng sang khóa khác khi một khóa hết hạn mức; khóa hỏng hẳn tự bị xoá khỏi kho. Chỉ thành viên được tích cột <b>“Key chung”</b> trong tab Thành viên mới dùng được kho này. Bấm vào tiêu đề cột để sắp xếp.</p>
      <div id="pool-box"><p>Đang tải kho…</p></div>
      <div id="aibank-box" style="margin-top:14px"><p>Đang đọc kho AI…</p></div>
    </div>
    <div data-pane="members">
      <div class="tt-field"><input id="adm-search" placeholder="Tìm theo tên đăng nhập, họ tên, biệt danh, lớp…"></div>
      <div id="adm-add" style="margin-bottom:10px">
        <button class="tt-btn" id="adm-addbtn" style="width:auto;padding:8px 14px">➕ Thêm thành viên</button>
        <div id="adm-addform" style="display:none;margin-top:8px">
          <div class="tt-field"><input id="ad-name" placeholder="Họ và tên"></div>
          <div class="tt-field"><input id="ad-class" placeholder="Lớp (HS cần có; GV để trống)"></div>
          <div class="tt-field"><input id="ad-email" type="email" placeholder="Email (không bắt buộc — để gửi thông báo tài khoản)"></div>
          <div class="tt-field"><input id="ad-user" placeholder="Tên đăng nhập (không dấu)"></div>
          <div class="tt-field"><input id="ad-pass" placeholder="Mật khẩu cấp (≥ 6 ký tự)"></div>
          <div class="tt-field"><select class="tt-sel" id="ad-role"><option value="HS">Học sinh (HS)</option><option value="GV">Giáo viên (GV)</option></select></div>
          <div class="tt-field"><select class="tt-sel" id="ad-school"><option value="">— Chưa gán trường —</option>${schools.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select></div>
          <button class="tt-btn" id="ad-create" style="width:auto;padding:8px 14px">Tạo và kích hoạt ngay</button>
          <span id="ad-msg" style="margin-left:8px;font-size:13px"></span>
        </div>
      </div>
      <div style="overflow-x:auto"><table class="tt-table" id="adm-table">
        <thead><tr>
          <th data-k="name">Họ tên</th><th data-k="nickname">Biệt danh</th><th data-k="className">Lớp</th>
          <th data-k="expiry">Hạn dùng</th><th data-k="role">Vai trò</th><th data-k="schoolId">Trường</th>
          <th data-k="aiEnabled">AI</th><th data-k="useSharedKeys">Key chung</th><th data-k="useClaudeBank">Kho Muse</th><th data-k="status">Thao tác</th>
        </tr></thead><tbody id="adm-tbody"></tbody>
      </table></div>
      <p class="tt-note">Bấm vào tiêu đề cột để sắp xếp (cột Thao tác sắp xếp theo trạng thái tài khoản). GV không hiển thị lớp và xem được lịch sử học sinh cùng trường.</p>
    </div>
    <div data-pane="bank">
      <p class="tt-note" style="margin:6px 0" id="muse-status">Đang đọc số liệu kho…</p>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><input type="file" id="muse-file" accept=".json,application/json"><button class="tt-btn" id="muse-import" style="width:auto;padding:8px 14px">📥 Nạp thêm vào kho</button><span id="muse-import-msg" style="font-size:13px"></span></div>
      <p class="tt-note" style="margin:6px 0">Mỗi lần nạp là <b>nạp THÊM</b> vào kho hiện có, không thay thế. Chỉ nạp mỗi file một lần (nạp lại cùng một file sẽ tạo bản sao). Kho này KHÔNG nằm trong dữ liệu bản tin thông thường — chỉ tài khoản được tích cột <b>“Kho Muse”</b> trong tab Thành viên mới gọi ra được: khi AI không hoạt động, ứng dụng tự lấy bản tin từ kho này cho các tài khoản đó.</p>
    </div>
    <div data-pane="schools">
      <div id="school-box"><p>Đang tải…</p></div>
      <div style="display:flex;gap:6px;margin-top:10px"><input id="adm-school-name" placeholder="Tên trường mới, vd: TH & THCS Bảo Thuận" style="flex:1;padding:8px;border:1.5px solid #ccd;border-radius:8px"><button class="tt-btn" id="adm-school-add" style="width:auto;padding:8px 14px">Thêm trường</button></div>
      <p class="tt-note">Gán trường cho từng thành viên trong tab Thành viên. GV xem được lịch sử học sinh cùng trường.</p>
    </div>
    <div data-pane="settings">
      <div style="margin-bottom:16px"><b>🔒 Khóa đăng ký</b>
        <p class="tt-note" style="margin:6px 0">Khi khóa: người ngoài <b>không thấy giao diện đăng ký</b> ở cổng và cũng không đăng ký được (máy chủ chặn cả khi cố tình gọi thẳng). Tài khoản đã có vẫn đăng nhập bình thường; thầy vẫn thêm thành viên thủ công ở tab Thành viên.</p>
        <label style="display:flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" id="adm-reglock" style="width:19px;height:19px"> <span>Khóa đăng ký tài khoản mới</span> <span id="adm-reglock-state" style="color:#888;font-size:13px">đang đọc trạng thái…</span></label>
      </div>
      <div style="margin-bottom:16px"><b>⏱ Thời gian chờ AI tạo bản tin</b>
        <p class="tt-note" style="margin:6px 0">Khi học sinh bấm “Tạo bản tin AI”, AI vẫn <b>chạy ngầm</b> soạn bản tin và lưu vào kho AI như thường — nhưng người bấm chỉ chờ tối đa số giây này: hết giờ mà AI chưa xong thì hệ thống <b>cấp ngay 1 bản tin từ kho AI</b> (chưa từng cấp cho tài khoản đó); kho AI cũng không có thì dùng kho Muse (nếu tài khoản được tích) hoặc bản tin thường ngay, không để học sinh chờ lâu. AI chạy ngầm xong vẫn lưu kho bình thường cho những lần sau. Áp dụng cho MỌI tài khoản; ứng dụng tự đọc lại cài đặt này mỗi phút.</p>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><input id="ai-wait" type="number" min="2" max="60" step="1" style="width:90px;padding:8px;border:1.5px solid #ccd;border-radius:8px"> <span>giây (2–60, mặc định 8)</span><button class="tt-btn" id="ai-wait-save" style="width:auto;padding:8px 14px">💾 Lưu</button><span id="ai-wait-msg" style="font-size:13px"></span></div>
      </div>
      <div style="margin-bottom:14px"><b>✉️ Cấu hình gửi email (Apps Script — Gmail của thầy)</b>
        <p class="tt-note" style="margin:6px 0">Thư được gửi từ <b>chính Gmail của thầy</b> qua một đoạn Google Apps Script chạy dưới tài khoản Google của thầy — không qua dịch vụ bên thứ ba nào, miễn phí 100 thư/ngày. Cách cài (một lần): (1) mở <b>script.google.com</b> bằng đúng tài khoản Gmail muốn dùng để gửi, tạo dự án mới và dán toàn bộ file mã <b>script-gui-email-truyen-tin.gs</b> em gửi kèm, sửa dòng SECRET trong mã thành mã bí mật thầy tự chọn; (2) bấm <b>Triển khai &gt; Lượt triển khai mới &gt; Ứng dụng web</b>, chọn "Thực thi với tư cách: Me" và "Ai có quyền truy cập: Anyone", bấm Deploy và cấp quyền gửi Gmail; (3) sao chép <b>URL ứng dụng web</b> dán vào ô dưới đây, điền mã bí mật <b>giống hệt</b> trong mã script, rồi bấm Lưu và Gửi thư thử. Khi có người đăng ký mới, hệ thống gửi thư báo về email của thầy để duyệt; khi thầy duyệt tài khoản, hệ thống gửi thư kèm thông tin tài khoản cho người dùng đó. Chưa cấu hình thì bỏ qua việc gửi thư, mọi thứ khác vẫn chạy.</p>
        <div class="tt-field"><label>Email của thầy (nhận thông báo đăng ký mới)</label><input id="em-admin" type="email" placeholder="vd: thaygiao@gmail.com"></div>
        <div class="tt-field"><label>Địa chỉ Web App của Apps Script (URL triển khai)</label><input id="em-url" placeholder="vd: https://script.google.com/macros/s/AKfy.../exec"></div>
        <div class="tt-field"><label>Mã bí mật (phải giống hệt dòng SECRET trong mã script)</label><input id="em-secret" placeholder="vd: truyen-tin-2026"></div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="tt-btn" id="em-save" style="width:auto;padding:8px 14px">💾 Lưu cấu hình email</button><button class="tt-btn" id="em-test" style="width:auto;padding:8px 14px;background:#5b6b7f">📨 Gửi thư thử</button><span id="em-msg" style="font-size:13px"></span></div>
      </div>
    </div>`;
  /* ---------- Chuyển tab ---------- */
  const showTab = (t) => {
    admTab = t;
    body.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("on", b.dataset.tab === t));
    body.querySelectorAll("[data-pane]").forEach((p) => { p.style.display = p.dataset.pane === t ? "" : "none"; });
  };
  body.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
  showTab(admTab);

  /* ---------- Tab API: kho khóa Gemini dùng chung (có sắp xếp) ---------- */
  const poolBox = body.querySelector("#pool-box");
  const poolStatusLabel = (en) => {
    /* Màu tình trạng: Tốt = xanh lá, Hết quota = vàng, Lỗi = đỏ. */
    let main;
    if (en.status === "quota") main = `<span style="color:#d97706;font-weight:700">⏳ Hết quota${en.statusDay && en.statusDay !== todayStr() ? " (" + esc(en.statusDay) + ")" : ""}</span>`;
    else if (en.status === "error") main = `<span style="color:#c0392b;font-weight:700">✖ Lỗi</span>`;
    else main = `<span style="color:#1d9d55;font-weight:700">✔ Tốt</span>`;
    if (en.checkedAt) main += `<br><span style="color:#888;font-size:11px">kiểm tra ${esc(new Date(en.checkedAt).toLocaleTimeString("vi-VN"))}</span>`;
    return main;
  };
  let poolCache = [];
  const poolVal = (en, k) => {
    switch (k) {
      case "key": return (en.key || "").toLowerCase();
      case "addedByName": return (en.addedByName || "").toLowerCase();
      case "status": return en.status === "error" ? 0 : en.status === "quota" ? 1 : 2;
      default: return en.at || 0;
    }
  };
  const drawPool = () => {
    if (!poolBox) return;
    if (!poolCache.length) { poolBox.innerHTML = "<p class='tt-note'>Kho đang trống — người dùng được dùng AI nhập khóa ở nút 🔑 xanh là khóa tự vào kho.</p>"; return; }
    const list = [...poolCache];
    list.sort((a, b) => {
      const va = poolVal(a, poolSort.k), vb = poolVal(b, poolSort.k);
      const c = (typeof va === "number" && typeof vb === "number") ? va - vb : String(va).localeCompare(String(vb), "vi");
      return c * poolSort.dir;
    });
    poolBox.innerHTML = `<div style="overflow-x:auto"><table class="tt-table"><thead><tr><th data-pk="key">Key</th><th data-pk="at">Thời gian nhập</th><th data-pk="addedByName">Người nhập</th><th data-pk="status">Tình trạng</th><th>Xoá</th></tr></thead><tbody>${
      list.map((en) => `<tr>
        <td style="font-family:monospace;white-space:nowrap">${esc(maskKey(en.key))} <button class="tt-btn" data-copy-pool="${en.id}" title="Sao chép khóa đầy đủ" style="width:auto;padding:2px 8px;background:#5b6b7f;font-size:12px">📋 Copy</button></td>
        <td>${en.at ? esc(new Date(en.at).toLocaleString("vi-VN")) : "—"}</td>
        <td>${esc(en.addedByName || "—")}</td>
        <td>${poolStatusLabel(en)}</td>
        <td><button class="tt-btn" data-del-pool="${en.id}" style="width:auto;padding:4px 10px;background:#842029">Xoá</button></td>
      </tr>`).join("")
    }</tbody></table></div>`;
    poolBox.querySelectorAll("th[data-pk]").forEach((th) => {
      const base = th.textContent.replace(/ [▲▼]$/, "");
      th.textContent = base + (th.dataset.pk === poolSort.k ? (poolSort.dir === 1 ? " ▲" : " ▼") : "");
      th.style.cursor = "pointer";
      th.addEventListener("click", () => {
        const k = th.dataset.pk;
        if (poolSort.k === k) poolSort.dir = -poolSort.dir; else { poolSort.k = k; poolSort.dir = 1; }
        drawPool();
      });
    });
    poolBox.querySelectorAll("[data-copy-pool]").forEach((b) => b.addEventListener("click", async () => {
      const en = poolCache.find((x) => x.id === b.dataset.copyPool);
      if (!en) return;
      try { await navigator.clipboard.writeText(en.key); }
      catch (e) {
        const ta = document.createElement("textarea");
        ta.value = en.key; document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy"); } catch (_) {}
        ta.remove();
      }
      const old = b.textContent; b.textContent = "✔ Đã copy";
      setTimeout(() => { b.textContent = old; }, 1500);
    }));
    poolBox.querySelectorAll("[data-del-pool]").forEach((b) => b.addEventListener("click", async () => {
      const en = poolCache.find((x) => x.id === b.dataset.delPool);
      if (!en) return;
      if (!confirm("Xoá khóa " + maskKey(en.key) + " khỏi kho dùng chung?")) return;
      await deletePoolKey(en);
      poolCache = await loadKeyPool(true);
      drawPool();
    }));
  };
  loadKeyPool(true).then(async (pool) => {
    poolCache = pool;
    drawPool();
    /* Tự kiểm tra THẬT từng khóa ngay khi mở panel (gọi thử
       Gemini) để tình trạng hiển thị là đúng lúc này, không
       phải số liệu cũ — vẽ lại bảng sau mỗi khóa kiểm tra xong. */
    for (const en of poolCache) { await verifyPoolKey(en); drawPool(); }
  }).catch(() => { if (poolBox) poolBox.innerHTML = "<p class='tt-note'>Không tải được kho — kiểm tra Rules đã có mục apiKeys chưa.</p>"; });
  /* Số liệu kho bản tin AI dùng chung (tự lớn dần mỗi lần có
     người bấm Tạo bản tin AI). */
  (async () => {
    const box = body.querySelector("#aibank-box");
    if (!box) return;
    try {
      const s = await getDoc(doc(db, "aiBank", "meta"));
      if (!s.exists()) { box.innerHTML = "<b>📚 Kho bản tin AI</b><p class='tt-note' style='margin:6px 0'>Kho đang trống — mỗi lần có tài khoản bấm “Tạo bản tin AI”, các câu AI soạn đạt chuẩn sẽ tự được lọc theo độ khó và lưu vào đây để cấp dần cho mọi người (mỗi tài khoản chỉ nhận mỗi câu một lần).</p>"; return; }
      const c = (s.data() || {}).counts || {};
      const total = ["de", "tb", "kho", "nc"].reduce((a, k) => a + (c[k] || 0), 0);
      box.innerHTML = "<b>📚 Kho bản tin AI</b><p class='tt-note' style='margin:6px 0'>Hiện có <b>" + total.toLocaleString("vi-VN") + " bản tin</b> — Dễ: " + (c.de || 0).toLocaleString("vi-VN") + " · Trung bình: " + (c.tb || 0).toLocaleString("vi-VN") + " · Khó: " + (c.kho || 0).toLocaleString("vi-VN") + " · Nâng cao: " + (c.nc || 0).toLocaleString("vi-VN") + ". Kho tự lớn dần mỗi lần có người bấm Tạo bản tin AI; mỗi câu chỉ cấp cho mỗi tài khoản đúng một lần.</p>";
    } catch (e) { box.innerHTML = "<b>📚 Kho bản tin AI</b><p class='tt-note' style='margin:6px 0'>Không đọc được kho (kiểm tra Rules đã có mục aiBank chưa).</p>"; }
  })();

  /* ---------- Tab Thành viên ---------- */
  const tbody = body.querySelector("#adm-tbody");
  const sortVal = (m, k) => {
    switch (k) {
      case "name": return displayName(m).toLowerCase();
      case "nickname": return (m.nickname || "").toLowerCase();
      case "className": return roleOf(m, adminsSet) === "GV" ? "" : (m.className || "").toLowerCase();
      case "expiry": return m.expiry || "9999-12-31";
      case "role": return adminsSet.has(m.uid) ? 2 : (m.role === "GV" ? 1 : 0);
      case "schoolId": return schoolName(m.schoolId).toLowerCase();
      case "aiEnabled": return m.aiEnabled ? 1 : 0;
      case "useSharedKeys": return m.useSharedKeys ? 1 : 0;
      case "useClaudeBank": return m.useClaudeBank ? 1 : 0;
      default: return m.status || "";
    }
  };
  const draw = () => {
    const f = (admState.q || "").toLowerCase();
    const list = members.filter((m) => !f || (m.username || "").includes(f) || (m.name || "").toLowerCase().includes(f) || (m.nickname || "").toLowerCase().includes(f) || (m.className || "").toLowerCase().includes(f));
    list.sort((a, b) => {
      const va = sortVal(a, admState.k), vb = sortVal(b, admState.k);
      const c = (typeof va === "number" && typeof vb === "number") ? va - vb : String(va).localeCompare(String(vb), "vi");
      return c * admState.dir;
    });
    tbody.innerHTML = "";
    list.forEach((m) => { const r = memberRows(members, schools, adminsSet, m, schoolName); tbody.appendChild(r.tr); tbody.appendChild(r.detail); });
    if (!list.length) tbody.innerHTML = "<tr><td colspan='10'>Không có thành viên nào khớp.</td></tr>";
    body.querySelectorAll("#adm-table th").forEach((th) => {
      const base = th.textContent.replace(/ [▲▼]$/, "");
      th.textContent = base + (th.dataset.k === admState.k ? (admState.dir === 1 ? " ▲" : " ▼") : "");
    });
  };
  draw();
  body.querySelectorAll("#adm-table th").forEach((th) => th.addEventListener("click", () => {
    const k = th.dataset.k;
    if (admState.k === k) admState.dir = -admState.dir; else { admState.k = k; admState.dir = 1; }
    draw();
  }));
  const searchEl = body.querySelector("#adm-search");
  searchEl.value = admState.q;
  searchEl.addEventListener("input", (e) => { admState.q = e.target.value; draw(); });
  body.querySelector("#adm-addbtn").addEventListener("click", () => {
    const f = body.querySelector("#adm-addform");
    f.style.display = f.style.display === "none" ? "" : "none";
  });
  body.querySelector("#ad-create").addEventListener("click", async () => {
    const msg = body.querySelector("#ad-msg");
    const name = body.querySelector("#ad-name").value.trim();
    const cls = body.querySelector("#ad-class").value.trim();
    const email = body.querySelector("#ad-email").value.trim();
    const u = body.querySelector("#ad-user").value;
    const p = body.querySelector("#ad-pass").value;
    const role = body.querySelector("#ad-role").value;
    const schoolId = body.querySelector("#ad-school").value;
    if (!name || !usernameOk(u) || p.length < 6 || (role !== "GV" && !cls)) { msg.textContent = "Kiểm tra lại: cần họ tên, tên đăng nhập hợp lệ, mật khẩu ≥ 6 ký tự; HS cần có lớp."; return; }
    if (email && !emailOk(email)) { msg.textContent = "Email chưa đúng định dạng — kiểm tra lại hoặc để trống."; return; }
    msg.textContent = "Đang tạo…";
    let secondary = null;
    try {
      secondary = initializeApp(cfg, "tt-secondary");
      const sAuth = getAuth(secondary);
      const cred = await createUserWithEmailAndPassword(sAuth, emailFor(u), p);
      await setDoc(doc(db, "profiles", cred.user.uid), {
        username: u.trim().toLowerCase(), name, className: cls, email, nickname: "", aiEnabled: false, useSharedKeys: false, useClaudeBank: false,
        featMorse: true, featSemaphore: true, featTrail: false, featCipher: false,
        role: role === "GV" ? "GV" : "HS", schoolId,
        status: "pending", expiry: null, createdAt: serverTimestamp()
      });
      await updateDoc(doc(db, "profiles", cred.user.uid), { status: "active" });
      await signOut(sAuth);
      msg.textContent = "Đã tạo và kích hoạt: " + u.trim().toLowerCase();
      if (email) notifyUserApproved({ username: u.trim().toLowerCase(), name, className: cls, email, expiry: null });
      openAdminPanel();
    } catch (e) { msg.textContent = errText(e.code); }
    finally { if (secondary) { try { await deleteApp(secondary); } catch (e) {} } }
  });

  /* ---------- Tab Kho bản tin Muse: số liệu + NẠP THÊM ---------- */
  const museStatus = body.querySelector("#muse-status");
  const paintMuseStatus = async () => {
    try {
      const s = await getDoc(doc(db, "museBank", "meta"));
      if (!s.exists()) { museStatus.textContent = "Kho đang TRỐNG — thầy nạp file kho ở ô dưới để bắt đầu dùng."; return; }
      const c = (s.data() || {}).counts || {};
      const total = ["de", "tb", "kho", "nc"].reduce((a, k) => a + (c[k] || 0), 0);
      museStatus.innerHTML = "Kho hiện có <b>" + total.toLocaleString("vi-VN") + " bản tin</b> — Dễ: " + (c.de || 0).toLocaleString("vi-VN") + " · Trung bình: " + (c.tb || 0).toLocaleString("vi-VN") + " · Khó: " + (c.kho || 0).toLocaleString("vi-VN") + " · Nâng cao: " + (c.nc || 0).toLocaleString("vi-VN") + ".";
    } catch (e) { museStatus.textContent = "Không đọc được kho (kiểm tra Rules đã có mục museBank chưa)."; }
  };
  paintMuseStatus();
  body.querySelector("#muse-import").addEventListener("click", async () => {
    const msg = body.querySelector("#muse-import-msg");
    const file = body.querySelector("#muse-file").files[0];
    if (!file) { msg.textContent = "Thầy chọn file kho (.json) trước đã ạ."; return; }
    try {
      msg.textContent = "Đang đọc file…";
      const json = JSON.parse(await file.text());
      const src = json.kept ? json.kept : json;
      const keyMap = { de: "de", tb: "tb", kho: "kho", nc: "nc", easy: "de", mid: "tb", hard: "kho", adv: "nc" };
      const per = { de: [], tb: [], kho: [], nc: [] };
      for (const k of Object.keys(src || {})) {
        const lv = keyMap[k]; if (!lv || !Array.isArray(src[k])) continue;
        const inFile = new Set();
        for (const it of src[k]) {
          const t = typeof it === "string" ? it : (it && it.t);
          const th = typeof it === "object" && it ? (it.th || "") : "";
          const tt = t ? String(t).trim() : "";
          if (tt.length > 2 && !inFile.has(tt)) { inFile.add(tt); per[lv].push({ t: tt, th }); }
        }
      }
      const total = per.de.length + per.tb.length + per.kho.length + per.nc.length;
      if (!total) { msg.textContent = "File không có bản tin hợp lệ nào (cần dạng {de:[...], tb:[...], kho:[...], nc:[...]})."; return; }
      /* NẠP THÊM: đọc số câu hiện có, ghi nối tiếp từ khúc trống
         đầu tiên của mỗi mức; kho cũ giữ nguyên. */
      const cur = { de: 0, tb: 0, kho: 0, nc: 0 };
      try { const ms = await getDoc(doc(db, "museBank", "meta")); if (ms.exists()) Object.assign(cur, (ms.data() || {}).counts || {}); } catch (e) {}
      const curTotal = cur.de + cur.tb + cur.kho + cur.nc;
      if (!confirm("Nạp THÊM " + total.toLocaleString("vi-VN") + " bản tin vào kho Muse (kho hiện đang có " + curTotal.toLocaleString("vi-VN") + ")? Kho cũ được giữ nguyên.")) return;
      const newCounts = await appendChunks("museBank", per, (d, t) => { msg.textContent = "Đang nạp thêm… " + d + "/" + t + " phần"; });
      _museMeta = null; _museChunks = {};
      msg.textContent = "✔ Đã nạp thêm " + total.toLocaleString("vi-VN") + " bản tin — kho hiện có " + (newCounts.de + newCounts.tb + newCounts.kho + newCounts.nc).toLocaleString("vi-VN") + " bản tin.";
      paintMuseStatus();
    } catch (e) { msg.textContent = "Nạp thất bại: " + (e && e.message ? e.message.slice(0, 120) : errText(e && e.code)); }
  });

  /* ---------- Tab Trường: bảng trường học (có sắp xếp) ---------- */
  const schoolBox = body.querySelector("#school-box");
  const drawSchools = () => {
    if (!schools.length) { schoolBox.innerHTML = "<p class='tt-note'>Chưa có trường nào — thêm trường ở ô dưới rồi gán cho từng thành viên trong tab Thành viên.</p>"; return; }
    const val = (s, k) => k === "count" ? members.filter((m) => m.schoolId === s.id).length : (s.name || "").toLowerCase();
    const list = [...schools];
    list.sort((a, b) => {
      const va = val(a, schoolSort.k), vb = val(b, schoolSort.k);
      const c = (typeof va === "number" && typeof vb === "number") ? va - vb : String(va).localeCompare(String(vb), "vi");
      return c * schoolSort.dir;
    });
    schoolBox.innerHTML = `<div style="overflow-x:auto"><table class="tt-table"><thead><tr><th data-sk="name">Tên trường</th><th data-sk="count">Số thành viên</th><th>Xoá</th></tr></thead><tbody>${
      list.map((s) => `<tr><td>${esc(s.name)}</td><td>${members.filter((m) => m.schoolId === s.id).length}</td><td><button class="tt-btn" data-del-school="${s.id}" style="width:auto;padding:4px 10px;background:#842029">Xoá</button></td></tr>`).join("")
    }</tbody></table></div>`;
    schoolBox.querySelectorAll("th[data-sk]").forEach((th) => {
      const base = th.textContent.replace(/ [▲▼]$/, "");
      th.textContent = base + (th.dataset.sk === schoolSort.k ? (schoolSort.dir === 1 ? " ▲" : " ▼") : "");
      th.style.cursor = "pointer";
      th.addEventListener("click", () => {
        const k = th.dataset.sk;
        if (schoolSort.k === k) schoolSort.dir = -schoolSort.dir; else { schoolSort.k = k; schoolSort.dir = 1; }
        drawSchools();
      });
    });
    schoolBox.querySelectorAll("[data-del-school]").forEach((b) => b.addEventListener("click", async () => {
      const s = schools.find((x) => x.id === b.dataset.delSchool);
      if (!confirm("Xoá trường “" + (s ? s.name : "") + "”? Thành viên đã gán trường này sẽ thành chưa gán trường (tài khoản không bị xoá).")) return;
      try { await deleteDoc(doc(db, "schools", b.dataset.delSchool)); openAdminPanel(); } catch (e) { alert(errText(e.code)); }
    }));
  };
  drawSchools();
  body.querySelector("#adm-school-add").addEventListener("click", async () => {
    const name = body.querySelector("#adm-school-name").value.trim();
    if (!name) { alert("Thầy nhập tên trường trước đã ạ."); return; }
    try { await addDoc(collection(db, "schools"), { name, createdAt: serverTimestamp() }); openAdminPanel(); }
    catch (e) { alert(errText(e.code)); }
  });

  /* ---------- Tab Cài đặt khác: khóa đăng ký + cấu hình email ---------- */
  const reglockEl = body.querySelector("#adm-reglock");
  const reglockState = body.querySelector("#adm-reglock-state");
  (async () => {
    try {
      const s = await getDoc(doc(db, "config", "app"));
      const locked = !!(s.exists() && s.data().registrationLocked === true);
      reglockEl.checked = locked;
      reglockState.textContent = locked ? "— đang KHÓA, cổng không hiện đăng ký" : "— đang MỞ, ai cũng đăng ký được";
    } catch (e) { reglockState.textContent = "— không đọc được (kiểm tra Rules có mục config/app chưa)"; }
  })();
  reglockEl.addEventListener("change", async () => {
    const locked = reglockEl.checked;
    reglockState.textContent = "đang lưu…";
    try {
      await setDoc(doc(db, "config", "app"), { registrationLocked: locked }, { merge: true });
      _regLocked = locked; _regLockPromise = Promise.resolve(locked);
      reglockState.textContent = locked ? "— đang KHÓA, cổng không hiện đăng ký" : "— đang MỞ, ai cũng đăng ký được";
    } catch (e) { reglockState.textContent = "— lưu thất bại: " + errText(e.code); reglockEl.checked = !locked; }
  });
  /* Thời gian chờ AI: cấu hình ở doc config/aiSettings, áp
     dụng cho mọi tài khoản (ứng dụng đọc lại mỗi phút). */
  const aiWaitEl = body.querySelector("#ai-wait");
  const aiWaitMsg = body.querySelector("#ai-wait-msg");
  (async () => {
    try {
      const s = await getDoc(doc(db, "config", "aiSettings"));
      const v = s.exists() ? Number((s.data() || {}).responseSeconds) : NaN;
      aiWaitEl.value = (v >= 2 && v <= 60) ? v : 8;
    } catch (e) { aiWaitEl.value = 8; }
  })();
  body.querySelector("#ai-wait-save").addEventListener("click", async () => {
    const v = Math.round(Number(aiWaitEl.value));
    if (!(v >= 2 && v <= 60)) { aiWaitMsg.textContent = "Nhập số giây từ 2 đến 60."; return; }
    aiWaitMsg.textContent = "đang lưu…";
    try {
      await setDoc(doc(db, "config", "aiSettings"), { responseSeconds: v }, { merge: true });
      _aiWaitCfg = { sec: v, at: Date.now() };
      aiWaitMsg.textContent = "Đã lưu ✔ — từ nay mỗi lần bấm AI, người dùng chờ tối đa " + v + " giây.";
    } catch (e) { aiWaitMsg.textContent = "Lưu thất bại: " + errText(e.code); }
  });
  const emMsg = body.querySelector("#em-msg");
  (async () => {
    const cfg = await emailCfg();
    body.querySelector("#em-admin").value = cfg.adminEmail || "";
    body.querySelector("#em-url").value = cfg.scriptUrl || "";
    body.querySelector("#em-secret").value = cfg.secret || "";
  })();
  body.querySelector("#em-save").addEventListener("click", async () => {
    const data = {
      adminEmail: body.querySelector("#em-admin").value.trim(),
      scriptUrl: body.querySelector("#em-url").value.trim(),
      secret: body.querySelector("#em-secret").value.trim()
    };
    if (data.adminEmail && !emailOk(data.adminEmail)) { emMsg.textContent = "Email nhận thông báo chưa đúng định dạng."; return; }
    emMsg.textContent = "Đang lưu…";
    try {
      await setDoc(doc(db, "config", "email"), data, { merge: true });
      _emailCfg = data;
      emMsg.textContent = "Đã lưu cấu hình email ✔";
    } catch (e) { emMsg.textContent = "Lưu thất bại: " + errText(e.code); }
  });
  body.querySelector("#em-test").addEventListener("click", async () => {
    const cfg = await emailCfg();
    if (!emailReady(cfg)) { emMsg.textContent = "Chưa đủ cấu hình — cần Email của thầy, Địa chỉ Web App và Mã bí mật. Thầy điền rồi bấm Lưu trước."; return; }
    emMsg.textContent = "Đang gửi thư thử…";
    const okSend = await sendMailViaScript(cfg.adminEmail,
      "✉ Truyền tin: thư gửi thử",
      "Đây là thư gửi thử từ panel quản trị ứng dụng Truyền tin, gửi qua Apps Script bằng chính Gmail của thầy.\n\nNếu thầy nhận được thư này thì cấu hình gửi email đã đúng.");
    emMsg.textContent = okSend ? "Đã gửi yêu cầu gửi thư ✔ — thầy kiểm tra hộp thư " + cfg.adminEmail + " sau ít phút (kể cả mục Spam). Không thấy thư thì kiểm tra lại URL, mã bí mật và quyền triển khai của script." : "Không gửi được yêu cầu — kiểm tra lại địa chỉ Web App.";
  });
}

function memberRows(members, schools, adminsSet, m, schoolName) {
  const role = roleOf(m, adminsSet);
  const expired = isExpired(m);
  const statusLabel = m.status === "pending" ? "Chờ kích hoạt" : m.status === "stopped" ? "Đã khoá" : expired ? "Hết hạn" : "Đang dùng";
  const badgeCls = m.status === "pending" ? "tt-b-pending" : (m.status === "stopped" || expired) ? "tt-b-stopped" : "tt-b-active";
  const ref = doc(db, "profiles", m.uid);
  const reload = () => openAdminPanel();
  const upd = async (data) => { const prevStatus = m.status; try { await updateDoc(ref, data); Object.assign(m, data); if (data.status === "active" && prevStatus !== "active") notifyUserApproved(m, prevStatus === "stopped"); reload(); } catch (e) { alert(errText(e.code)); } };
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><b>${m.aiEnabled ? `<span class="tt-rainbow">${esc(displayName(m))}</span>` : esc(displayName(m))}</b><br><span style="color:#888">@${esc(m.username || "")}</span><br><span class="tt-badge ${badgeCls}">${statusLabel}</span></td>
    <td>${esc(m.nickname || "—")}</td>
    <td>${role === "GV" ? "—" : esc(m.className || "")}</td>
    <td>${m.expiry ? "đến " + esc(m.expiry) : "Vĩnh viễn"}</td>
    <td>${role === "QT" ? '<span class="tt-badge tt-b-active">Quản trị</span>' : `<select data-f="role"><option value="HS"${role === "HS" ? " selected" : ""}>HS</option><option value="GV"${role === "GV" ? " selected" : ""}>GV</option></select>`}</td>
    <td><select data-f="school"><option value="">— Chưa gán —</option>${schools.map((s) => `<option value="${s.id}"${m.schoolId === s.id ? " selected" : ""}>${esc(s.name)}</option>`).join("")}</select></td>
    <td style="text-align:center"><input type="checkbox" data-f="ai" ${m.aiEnabled ? "checked" : ""} style="width:18px;height:18px"></td>
    <td style="text-align:center"><input type="checkbox" data-f="shared" ${m.useSharedKeys ? "checked" : ""} style="width:18px;height:18px"></td>
    <td style="text-align:center"><input type="checkbox" data-f="claude" ${m.useClaudeBank ? "checked" : ""} style="width:18px;height:18px"></td>
    <td><div class="tt-acts" style="flex-wrap:wrap">
      <button data-a="edit">Sửa</button>
      <button data-a="toggle">${m.status === "active" ? "Khoá" : "Mở"}</button>
      <button data-a="exp">Hạn</button>
      <button data-a="hist">Lịch sử</button>
      <button data-a="delhist" class="danger">Xoá lịch sử</button>
      <button data-a="reset">Đặt lại MK</button>
      <button data-a="del" class="danger">Xoá</button>
    </div></td>`;
  const detail = document.createElement("tr");
  detail.className = "tt-detailrow";
  detail.style.display = "none";
  detail.innerHTML = `<td colspan="10">
    <div data-block="exp"><b>Hạn dùng của ${esc(m.username || "")}:</b>
      <div class="tt-acts" style="margin-top:6px">
        <button data-e="forever">Vĩnh viễn</button>
        <button data-e="d30">+30 ngày</button>
        <button data-e="d90">+90 ngày</button>
        <input type="date" data-e="date" value="${m.expiry || ""}">
        <button data-e="setdate">Đặt hạn</button>
      </div>
    </div>
    <div data-block="edit" style="display:none">
      <b>Sửa thông tin của ${esc(m.username || "")} — tất cả các trường</b>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-top:8px">
        <div class="tt-field" style="margin:0"><label>Họ và tên</label><input data-ed="name" value="${esc(m.name || "")}"></div>
        <div class="tt-field" style="margin:0"><label>Biệt danh (chỉ quản trị đặt — người dùng không tự sửa được)</label><input data-ed="nick" value="${esc(m.nickname || "")}"></div>
        <div class="tt-field" style="margin:0"><label>Email (nhận thư duyệt tài khoản)</label><input data-ed="email" type="email" value="${esc(m.email || "")}"></div>
        ${role === "GV" ? "" : `<div class="tt-field" style="margin:0"><label>Lớp</label><input data-ed="cls" value="${esc(m.className || "")}"></div>`}
        ${role === "QT" ? `<div class="tt-field" style="margin:0"><label>Vai trò</label><input value="Quản trị" disabled></div>` : `<div class="tt-field" style="margin:0"><label>Vai trò</label><select data-ed="role" style="width:100%;padding:8px;border:1.5px solid #ccd;border-radius:8px"><option value="HS"${role === "HS" ? " selected" : ""}>HS</option><option value="GV"${role === "GV" ? " selected" : ""}>GV</option></select></div>`}
        <div class="tt-field" style="margin:0"><label>Trường</label><select data-ed="school" style="width:100%;padding:8px;border:1.5px solid #ccd;border-radius:8px"><option value="">— Chưa gán —</option>${schools.map((s) => `<option value="${s.id}"${m.schoolId === s.id ? " selected" : ""}>${esc(s.name)}</option>`).join("")}</select></div>
        <div class="tt-field" style="margin:0"><label>Hạn dùng đến ngày</label><input data-ed="expdate" type="date" value="${m.expiry || ""}"></div>
        <div class="tt-field" style="margin:0"><label>Quyền và hạn dùng</label><div style="display:flex;gap:10px;flex-wrap:wrap;padding-top:7px">
          <label style="cursor:pointer"><input type="checkbox" data-ed="ai" ${m.aiEnabled ? "checked" : ""}> AI</label>
          <label style="cursor:pointer"><input type="checkbox" data-ed="shared" ${m.useSharedKeys ? "checked" : ""}> Key chung</label>
          <label style="cursor:pointer"><input type="checkbox" data-ed="claude" ${m.useClaudeBank ? "checked" : ""}> Kho Muse</label>
          <label style="cursor:pointer"><input type="checkbox" data-ed="expforever" ${!m.expiry ? "checked" : ""}> Hạn vĩnh viễn</label>
        </div></div>
        <div class="tt-field" style="margin:0"><label>Phân quyền chức năng (được quyền nào thì thấy menu của chức năng đó)</label><div style="display:flex;gap:10px;flex-wrap:wrap;padding-top:7px">
          <label style="cursor:pointer"><input type="checkbox" data-ed="fmorse" ${m.featMorse !== false ? "checked" : ""}> Morse</label>
          <label style="cursor:pointer"><input type="checkbox" data-ed="fsem" ${m.featSemaphore !== false ? "checked" : ""}> Semaphore</label>
          <label style="cursor:pointer"><input type="checkbox" data-ed="ftrail" ${m.featTrail === true ? "checked" : ""}> Dấu đi đường</label>
          <label style="cursor:pointer"><input type="checkbox" data-ed="fcipher" ${m.featCipher === true ? "checked" : ""}> Mật thư</label>
        </div></div>
      </div>
      <p class="tt-note" style="margin:8px 0 0">Bảng này hiện TẤT CẢ các trường cùng lúc — sửa xong bấm Lưu một lần. Trạng thái tài khoản dùng nút <b>Mở/Khoá</b> ở hàng (bấm Mở là thư duyệt gửi ngay cho người dùng). <b>Mật khẩu</b> không sửa trực tiếp tại đây được — Google không cho trang web đổi mật khẩu của tài khoản khác; thầy dùng nút <b>Đặt lại mật khẩu…</b> bên dưới (hướng dẫn 3 bước).</p>
      <div class="tt-acts" style="margin-top:8px">
        <button data-ed="save">💾 Lưu thay đổi</button>
        <button data-ed="reset">Đặt lại mật khẩu…</button>
        <button data-ed="hide">Đóng</button>
        <span data-ed="msg" style="font-size:13px"></span>
      </div>
    </div>
    <div data-block="hist" style="display:none"><div class="tt-histbox"></div></div>
    <div data-block="delhist" style="display:none"><div class="tt-histbox"></div></div>
    <div data-block="reset" style="display:none"><div class="tt-histbox"></div></div>
  </td>`;
  const showBlock = (name) => {
    detail.style.display = "";
    detail.querySelectorAll("[data-block]").forEach((b) => { b.style.display = b.dataset.block === name ? "" : "none"; });
  };
  const roleSel = tr.querySelector('[data-f="role"]');
  if (roleSel) roleSel.addEventListener("change", () => upd({ role: roleSel.value }));
  tr.querySelector('[data-f="school"]').addEventListener("change", (e) => upd({ schoolId: e.target.value }));
  tr.querySelector('[data-f="ai"]').addEventListener("change", (e) => upd({ aiEnabled: e.target.checked }));
  tr.querySelector('[data-f="shared"]').addEventListener("change", (e) => upd({ useSharedKeys: e.target.checked }));
  tr.querySelector('[data-f="claude"]').addEventListener("change", (e) => upd({ useClaudeBank: e.target.checked }));
  tr.querySelector('[data-a="toggle"]').addEventListener("click", () => upd({ status: m.status === "active" ? "stopped" : "active" }));
  tr.querySelector('[data-a="edit"]').addEventListener("click", () => showBlock("edit"));
  detail.querySelector('[data-ed="hide"]').addEventListener("click", () => { detail.style.display = "none"; });
  detail.querySelector('[data-ed="reset"]').addEventListener("click", () => { tr.querySelector('[data-a="reset"]').click(); });
  detail.querySelector('[data-ed="save"]').addEventListener("click", () => {
    const q = (s) => detail.querySelector(s);
    const msg = q('[data-ed="msg"]');
    const email = q('[data-ed="email"]').value.trim();
    if (email && !emailOk(email)) { msg.textContent = "Email chưa đúng định dạng — thầy kiểm tra lại (hoặc để trống)."; return; }
    const data = {
      name: q('[data-ed="name"]').value.trim(),
      nickname: q('[data-ed="nick"]').value.trim(),
      email,
      aiEnabled: q('[data-ed="ai"]').checked,
      useSharedKeys: q('[data-ed="shared"]').checked,
      useClaudeBank: q('[data-ed="claude"]').checked,
      featMorse: q('[data-ed="fmorse"]').checked,
      featSemaphore: q('[data-ed="fsem"]').checked,
      featTrail: q('[data-ed="ftrail"]').checked,
      featCipher: q('[data-ed="fcipher"]').checked,
      schoolId: q('[data-ed="school"]').value
    };
    const clsEl = q('[data-ed="cls"]');
    if (clsEl) data.className = clsEl.value.trim();
    const roleEl = q('[data-ed="role"]');
    if (roleEl) data.role = roleEl.value;
    if (q('[data-ed="expforever"]').checked) data.expiry = null;
    else { const dv = q('[data-ed="expdate"]').value; if (dv) data.expiry = dv; }
    upd(data);
  });
  tr.querySelector('[data-a="del"]').addEventListener("click", async () => {
    if (!confirm("Xoá HỒ SƠ của " + m.username + "? (Tài khoản đăng nhập vẫn còn trên Firebase; muốn xoá hẳn/đặt lại mật khẩu thì dùng nút Đặt lại MK hoặc xoá tài khoản trong Firebase Console.)")) return;
    try { await deleteDoc(ref); reload(); } catch (e) { alert(errText(e.code)); }
  });
  tr.querySelector('[data-a="exp"]').addEventListener("click", () => showBlock("exp"));
  detail.querySelector('[data-e="forever"]').addEventListener("click", () => upd({ expiry: null, status: m.status === "pending" ? "pending" : "active" }));
  detail.querySelector('[data-e="d30"]').addEventListener("click", () => { const base = m.expiry && m.expiry > todayStr() ? m.expiry : todayStr(); upd({ expiry: addDaysStr(base, 30) }); });
  detail.querySelector('[data-e="d90"]').addEventListener("click", () => { const base = m.expiry && m.expiry > todayStr() ? m.expiry : todayStr(); upd({ expiry: addDaysStr(base, 90) }); });
  detail.querySelector('[data-e="setdate"]').addEventListener("click", () => { const v = detail.querySelector('[data-e="date"]').value; if (v) upd({ expiry: v }); else alert("Thầy chọn ngày trước đã ạ."); });
  const loadHistBox = async () => {
    const box = detail.querySelector('[data-block="hist"] .tt-histbox');
    box.innerHTML = "Đang tải lịch sử…";
    try {
      const snap = await getDocs(query(collection(db, "history"), where("uid", "==", m.uid)));
      const items = [];
      snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
      items.sort((a, b) => ((b.at && b.at.seconds) || 0) - ((a.at && a.at.seconds) || 0));
      if (!items.length) { box.innerHTML = "<div class='tt-hist'>Chưa có bài làm nào được đồng bộ từ máy của học sinh này.</div>"; return; }
      box.innerHTML = `<div class="tt-acts" style="margin:4px 0 8px"><button data-hall="1" class="danger">🗑 Xoá tất cả ${items.length} bài của ${esc(m.username || "")}</button></div>` + items.slice(0, 50).map((it) => {
        const e = it.entry || {};
        return `<div class="tt-hist">🗓 ${esc(e.date || "")} · ${esc(it.kindLabel || "")}${it.speedLabel ? " · " + esc(it.speedLabel) : ""} · <b>${esc(fmtScore(e.score))}/10</b> · đúng ${esc(e.correct ?? "")}/${esc(e.total ?? "")}${e.dur != null ? " · ⏱ " + esc(fmtDur(e.dur)) : ""} · “${esc(e.msg || "")}” <button data-hdel="${esc(it.id)}" class="tt-acts" style="background:#fdecea;color:#a12622;border:1px solid #f0c4c0;border-radius:6px;padding:1px 7px;cursor:pointer;font-size:12px;font-weight:600">✕ Xoá bài này</button></div>`;
      }).join("");
      const delAll = box.querySelector("[data-hall]");
      if (delAll) delAll.addEventListener("click", async () => {
        if (!confirm("Xoá TOÀN BỘ " + items.length + " bài làm đã đồng bộ của " + m.username + "? Xoá xong không lấy lại được.")) return;
        delAll.disabled = true; delAll.textContent = "Đang xoá…";
        try {
          for (const it of items) await deleteDoc(doc(db, "history", it.id));
          box.innerHTML = "<div class='tt-hist'>Đã xoá toàn bộ lịch sử làm bài của " + esc(m.username || "") + ".</div>";
        } catch (e) { alert(errText(e.code)); delAll.disabled = false; }
      });
      box.querySelectorAll("[data-hdel]").forEach((b) => b.addEventListener("click", async () => {
        if (!confirm("Xoá bài làm này của " + m.username + "? Xoá xong không lấy lại được.")) return;
        b.disabled = true;
        try { await deleteDoc(doc(db, "history", b.dataset.hdel)); loadHistBox(); }
        catch (e) { alert(errText(e.code)); b.disabled = false; }
      }));
    } catch (e) { box.innerHTML = esc(errText(e.code)); }
  };
  tr.querySelector('[data-a="hist"]').addEventListener("click", () => { showBlock("hist"); loadHistBox(); });
  tr.querySelector('[data-a="delhist"]').addEventListener("click", async () => {
    showBlock("delhist");
    const box = detail.querySelector('[data-block="delhist"] .tt-histbox');
    box.innerHTML = "Đang đếm số bài làm…";
    try {
      const snap = await getDocs(query(collection(db, "history"), where("uid", "==", m.uid)));
      if (snap.empty) { box.innerHTML = "<div class='tt-hist'>" + esc(m.username || "") + " chưa có bài làm nào được đồng bộ — không có gì để xoá.</div>"; return; }
      const ids = [];
      snap.forEach((d) => ids.push(d.id));
      box.innerHTML = `<div class="tt-hist" style="text-align:left;line-height:1.55"><b>Xoá lịch sử làm bài của ${esc(displayName(m))} (@${esc(m.username || "")})</b><br>
        Hiện có <b>${ids.length} bài</b> đã đồng bộ trên máy chủ. Xoá xong không lấy lại được (bài lưu trên máy của học sinh không bị xoá, nhưng sẽ không đồng bộ lại những bài cũ đó).
        <div class="tt-acts" style="margin-top:8px">
          <button data-dh="yes" class="danger">Xoá hết ${ids.length} bài</button>
          <button data-dh="no">Để sau</button>
        </div></div>`;
      box.querySelector('[data-dh="no"]').addEventListener("click", () => { detail.style.display = "none"; });
      box.querySelector('[data-dh="yes"]').addEventListener("click", async (ev) => {
        ev.target.disabled = true; ev.target.textContent = "Đang xoá…";
        try {
          for (const id of ids) await deleteDoc(doc(db, "history", id));
          box.innerHTML = "<div class='tt-hist'>Đã xoá toàn bộ " + ids.length + " bài làm của " + esc(m.username || "") + ".</div>";
        } catch (e) { alert(errText(e.code)); ev.target.disabled = false; ev.target.textContent = "Xoá hết " + ids.length + " bài"; }
      });
    } catch (e) { box.innerHTML = esc(errText(e.code)); }
  });
  tr.querySelector('[data-a="reset"]').addEventListener("click", () => {
    showBlock("reset");
    const box = detail.querySelector('[data-block="reset"] .tt-histbox');
    const email = emailFor(m.username || "");
    const url = "https://console.firebase.google.com/project/" + (cfg.projectId || "") + "/authentication/users";
    box.innerHTML = `<div class="tt-hist" style="text-align:left;line-height:1.55">
      <b>Đặt lại mật khẩu cho ${esc(m.username)}</b><br>
      Google không cho trang web tự đổi mật khẩu của tài khoản khác — việc đổi chỉ làm được trong trang quản trị của Google, thầy làm 3 bước:<br>
      1) Bấm nút “Mở trang tài khoản Google” dưới đây, tìm dòng <b>${esc(email)}</b>, bấm dấu ⋮ ở cuối dòng → <b>Delete account</b> (Xoá tài khoản).<br>
      2) Quay lại đây bấm “Đã xoá — dọn hồ sơ cũ”.<br>
      3) Báo học sinh đăng ký lại bằng đúng tên đăng nhập <b>${esc(m.username)}</b> với mật khẩu mới, rồi thầy kích hoạt lại như thường.
      <div class="tt-acts" style="margin-top:8px">
        <button data-r="open">Mở trang tài khoản Google</button>
        <button data-r="clean" class="danger">Đã xoá — dọn hồ sơ cũ</button>
        <button data-r="hide">Để sau</button>
      </div></div>`;
    box.querySelector('[data-r="open"]').addEventListener("click", () => window.open(url, "_blank"));
    box.querySelector('[data-r="hide"]').addEventListener("click", () => { detail.style.display = "none"; });
    box.querySelector('[data-r="clean"]').addEventListener("click", async () => {
      if (!confirm("Thầy đã xoá tài khoản " + email + " trong trang Google rồi chứ ạ? Bấm OK để em dọn hồ sơ cũ của " + m.username + ".")) return;
      try { await deleteDoc(ref); reload(); } catch (e) { alert(errText(e.code)); }
    });
  });
  return { tr, detail };
}

/* ============================================================
   MODULE DẤU ĐI ĐƯỜNG & MẬT THƯ — hai chức năng MỚI, được
   phân quyền riêng (featTrail / featCipher): nút mở module
   ở thanh ghim + mục tài liệu trong menu người dùng chỉ
   hiện khi tài khoản được cấp quyền (xem featOn).
   Nội dung theo tài liệu nghiên cứu chuyên đề của thầy:
   dấu đi đường dùng BẢNG 32 DẤU ĐƯỜNG THÔNG DỤNG (20 dấu
   cơ bản của Đội + 12 dấu bổ sung); mật thư dùng 5 dạng đã được
   kiểm chứng hai chiều (số thay chữ, chữ thay chữ, tọa độ
   chữ, chuồng bồ câu, đọc ngược) trên bạch văn đã chuyển
   theo QUY ƯỚC CỦA LỚP (cùng bộ chuyển đổi với Morse và
   Semaphore trong ứng dụng này).
   Bài Kiểm tra của hai module lưu vào cùng lịch sử
   ltmt_history nên tự đồng bộ lên máy chủ như các môn khác.
   ============================================================ */
function modSaveHistory(kind, correct, total, msg, durSec) {
  try {
    const arr = loadLocalHist();
    arr.push({
      name: (myProfile && myProfile.name) || "", cls: (myProfile && myProfile.className) || "",
      date: new Date().toLocaleString("vi-VN"), kind,
      score: Math.round((correct / total) * 100) / 10, correct, total, plays: 1, msg, dur: durSec
    });
    localStorage.setItem("ltmt_history", JSON.stringify(arr.slice(-300)));
  } catch (e) { /* lưu lịch sử hỏng không được làm gián đoạn bài làm */ }
}
function modShuffle(a) {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}

/* ---------------- DẤU ĐI ĐƯỜNG: hình vẽ ----------------
   Quy ước vẽ: hướng di chuyển từ TRÁI sang PHẢI; que/cành
   cây màu nâu, nét sóng nước màu xanh, số tham số (n) nằm
   trong vòng tròn nhỏ ở góc dưới phải của dấu. */
const TR_STICK = "#8a5a2b", TR_BLUE = "#1565c0";
function trSVG(inner) {
  return `<svg viewBox="0 0 120 90" style="width:100%;max-width:230px;height:auto;display:block;margin:0 auto" role="img" aria-label="Hình dấu đi đường"><rect x="2" y="2" width="116" height="86" rx="10" fill="#f4ecd9"/>${inner}</svg>`;
}
function trLine(x1, y1, x2, y2, w, c) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c || TR_STICK}" stroke-width="${w || 5}" stroke-linecap="round"/>`;
}
function trHeadAt(x, y, ux, uy) {
  const L = 12, bx = x - ux * L, by = y - uy * L, px = -uy * 6.5, py = ux * 6.5;
  return trLine(x, y, bx + px, by + py, 4.5) + trLine(x, y, bx - px, by - py, 4.5);
}
function trArrow(x1, y, x2, heads) {
  let s = trLine(x1, y, x2, y);
  const n = heads || 1;
  for (let i = 0; i < n; i++) s += trHeadAt(x2 - i * 13, y, 1, 0);
  return s;
}
function trBadge(n) {
  if (n === null || n === undefined) return "";
  return `<circle cx="103" cy="73" r="12" fill="#fff" stroke="${TR_STICK}" stroke-width="2.5"/><text x="103" y="78.5" text-anchor="middle" font-size="14" font-weight="700" fill="#5d3a17" font-family="system-ui,sans-serif">${esc(String(n))}</text>`;
}
function trWave(x, y, humps) {
  let d = `M${x} ${y} q6 -7 12 0`;
  for (let i = 1; i < (humps || 2); i++) d += " t12 0";
  return `<path d="${d}" fill="none" stroke="${TR_BLUE}" stroke-width="4" stroke-linecap="round"/>`;
}
function trTri(cx, top, base, half) {
  return `<path d="M${cx} ${top} L${cx - half} ${base} H${cx + half} Z" fill="none" stroke="${TR_STICK}" stroke-width="5" stroke-linejoin="round"/>`;
}

/* Bảng 32 dấu đường thông dụng (20 dấu cơ bản của Đội +
   12 dấu bổ sung). mean(n): câu nghĩa đầy đủ; make: cách
   tạo dấu bằng vật liệu tại chỗ (từ tài liệu nghiên cứu). */
const TRAIL_SIGNS = [
  { id: "start", name: "Bắt đầu đi", mean: () => "Điểm bắt đầu — đoàn bắt đầu di chuyển từ đây, theo hướng mũi tên", make: "Đá nhỏ xếp thành vòng tròn, một hòn ở tâm, một que dài làm mũi tên chỉ hướng đi", draw: () => trSVG(`<circle cx="34" cy="45" r="15" fill="none" stroke="${TR_STICK}" stroke-width="5"/><circle cx="34" cy="45" r="4" fill="${TR_STICK}"/>` + trArrow(58, 45, 106, 1)) },
  { id: "proceed", name: "Đi theo hướng này", mean: () => "Đi tiếp theo hướng mũi tên chỉ", make: "Một que dài làm thân mũi tên, hai que ngắn chéo ở đầu làm ngạnh", draw: () => trSVG(trArrow(14, 45, 106, 1)) },
  { id: "faster", name: "Đi nhanh hơn", mean: () => "Tăng tốc độ di chuyển theo hướng mũi tên", make: "Mũi tên có hai đầu nhọn nối tiếp nhau trên cùng một trục", draw: () => trSVG(trArrow(14, 45, 106, 2)) },
  { id: "run", name: "Chạy theo hướng này", mean: () => "Chạy (không đi bộ) theo hướng mũi tên — khẩn hơn đi nhanh", make: "Mũi tên có ba đầu nhọn nối tiếp nhau trên cùng một trục", draw: () => trSVG(trArrow(14, 45, 106, 3)) },
  { id: "slower", name: "Đi chậm lại", mean: () => "Giảm tốc độ, đi chậm lại", make: "Mũi tên có một que đặt ngang, chắn ngang thân mũi tên", draw: () => trSVG(trArrow(14, 45, 106, 1) + trLine(52, 27, 52, 63)) },
  { id: "obstacle", name: "Chướng ngại vật phải vượt qua", mean: () => "Phía trước có chướng ngại — đoàn phải vượt qua, không vòng tránh", make: "Mũi tên có hai que song song đặt ngang, chắn ngang thân mũi tên", draw: () => trSVG(trArrow(14, 45, 106, 1) + trLine(45, 27, 45, 63) + trLine(60, 27, 60, 63)) },
  { id: "left", name: "Rẽ trái", mean: () => "Tới điểm này rẽ sang trái", make: "Que thân đi tới rồi gập 90 độ sang trái, đầu mũi tên chỉ về phía trái", draw: () => trSVG(trLine(14, 64, 64, 64) + trLine(64, 64, 64, 28) + trHeadAt(64, 24, 0, -1)) },
  { id: "right", name: "Rẽ phải", mean: () => "Tới điểm này rẽ sang phải", make: "Que thân đi tới rồi gập 90 độ sang phải, đầu mũi tên chỉ về phía phải", draw: () => trSVG(trLine(14, 26, 64, 26) + trLine(64, 26, 64, 62) + trHeadAt(64, 66, 0, 1)) },
  { id: "merge", name: "Hai đoàn nhập 1", mean: () => "Hai đoàn đang đi hai lối hợp lại thành một đoàn và đi tiếp chung", make: "Hai que chéo từ hai phía chụm lại thành một thân, có mũi tên về phía trước", draw: () => trSVG(trLine(18, 18, 56, 45) + trLine(18, 72, 56, 45) + trArrow(56, 45, 106, 1)) },
  { id: "split", name: "Chia 2 đoàn — mỗi đoàn đi n người", param: "người", mean: (n) => `Đoàn chia thành hai nhóm đi hai ngã, mỗi đoàn đi ${n} người`, make: "Một que thân tách thành hai nhánh có đầu mũi tên, kèm thẻ ghi số người mỗi đoàn", draw: (n) => trSVG(trLine(12, 45, 50, 45) + trLine(50, 45, 88, 26) + trHeadAt(93, 24, 0.9, -0.43) + trLine(50, 45, 88, 60) + trHeadAt(93, 62, 0.9, 0.43) + trBadge(n)) },
  { id: "forbidden", name: "Đường cấm", mean: () => "Không đi lối này — đường bị cấm, phải chọn lối khác", make: "Hai que dài bắt chéo nhau thành chữ X, đặt ngay đầu lối cấm", draw: () => trSVG(trLine(36, 20, 84, 68, 6) + trLine(84, 20, 36, 68, 6)) },
  { id: "danger", name: "Chú ý, nguy hiểm", mean: () => "Phía trước có nguy hiểm — chú ý, thận trọng", make: "Ba que xếp thành tam giác, một hòn đá đặt ở giữa", draw: () => trSVG(trTri(60, 16, 70, 34) + `<circle cx="60" cy="50" r="4.5" fill="${TR_STICK}"/>`) },
  { id: "safe", name: "An toàn, bình an", mean: () => "Hướng này an toàn, cứ yên tâm đi tiếp", make: "Ba đầu mũi tên nhỏ (ngạnh chữ V) cùng chiều, xếp nối tiếp theo hướng đi", draw: () => trSVG([22, 50, 78].map((x) => trLine(x, 31, x + 13, 45, 4.5) + trLine(x + 13, 45, x, 59, 4.5)).join("")) },
  { id: "back", name: "Quay lại", mean: () => "Quay đầu, đi ngược trở lại đường vừa đi", make: "Hai mũi tên song song, hướng ngược chiều nhau", draw: () => trSVG(trLine(100, 31, 24, 31) + trHeadAt(20, 31, -1, 0) + trLine(20, 59, 96, 59) + trHeadAt(100, 59, 1, 0)) },
  { id: "waterbad", name: "Nước không uống được", mean: () => "Nguồn nước ở đây không uống được (bẩn, độc)", make: "Ba que xếp thành tam giác, bên trong có nét sóng nước; đặt ngay tại nguồn nước", draw: () => trSVG(trTri(60, 14, 72, 38) + trWave(42, 54, 2)) },
  { id: "watergood", name: "Nước sạch uống được", mean: () => "Nguồn nước ở đây sạch, uống được", make: "Đá xếp thành vòng tròn, bên trong có nét sóng nước; đặt ngay tại nguồn nước", draw: () => trSVG(`<circle cx="60" cy="45" r="27" fill="none" stroke="${TR_STICK}" stroke-width="5"/>` + trWave(42, 48, 2)) },
  { id: "wait", name: "Chờ ở đây n phút", param: "phút", mean: (n) => `Dừng lại và chờ tại điểm này ${n} phút`, make: "Bốn que xếp thành khung chữ nhật, kèm thẻ ghi số phút phải chờ", draw: (n) => trSVG(`<rect x="28" y="24" width="50" height="42" fill="none" stroke="${TR_STICK}" stroke-width="5"/>` + trBadge(n)) },
  { id: "letter", name: "Có mật thư hướng này cách n mét", param: "mét", mean: (n) => `Theo hướng mũi tên, cách đây ${n} mét có giấu một mật thư`, make: "Khung chữ nhật có hai đường chéo như mặt phong bì thư, kèm mũi tên chỉ hướng và thẻ ghi số mét", draw: (n) => trSVG(`<rect x="12" y="27" width="46" height="34" fill="none" stroke="${TR_STICK}" stroke-width="4.5"/>` + trLine(12, 27, 58, 61, 3.5) + trLine(58, 27, 12, 61, 3.5) + trArrow(66, 44, 104, 1) + trBadge(n)) },
  { id: "camp", name: "Trại ở hướng này", mean: () => "Điểm trại nằm theo hướng mũi tên chỉ", make: "Hai que xiên chụm đỉnh thành hình lều, một que làm đáy, kèm mũi tên chỉ hướng trại", draw: () => trSVG(trLine(24, 68, 50, 28) + trLine(50, 28, 76, 68) + trLine(18, 68, 82, 68) + trArrow(86, 45, 112, 1)) },
  { id: "finish", name: "Đích", mean: () => "Đã tới đích — kết thúc hành trình, hết dấu", make: "Đá nhỏ xếp thành vòng tròn, một hòn ở tâm (giống dấu Bắt đầu nhưng không có mũi tên)", draw: () => trSVG(`<circle cx="60" cy="45" r="17" fill="none" stroke="${TR_STICK}" stroke-width="5"/><circle cx="60" cy="45" r="4" fill="${TR_STICK}"/>`) },
  /* --- 12 dấu bổ sung: đủ BẢNG 32 DẤU ĐƯỜNG THÔNG DỤNG --- */
  { id: "bridge", name: "Qua cầu", mean: () => "Đi qua cầu theo hướng mũi tên", make: "Một vòng cung mô phỏng nhịp cầu, mũi tên đi thẳng phía trên cầu từ bờ này sang bờ kia", draw: () => trSVG(`<path d="M20 64 A42 30 0 0 1 100 64" fill="none" stroke="${TR_STICK}" stroke-width="5" stroke-linecap="round"/>` + trArrow(16, 34, 104, 1)) },
  { id: "shortcut", name: "Theo lối tắt", mean: () => "Rẽ theo lối tắt (đường chéo ngắn hơn) thay vì đi tiếp đường chính", make: "Một nét thẳng dài là đường chính, một mũi tên rẽ chéo khoảng 45 độ cắt qua đường chính", draw: () => trSVG(trLine(10, 60, 110, 60, 4) + trLine(26, 76, 92, 28) + trHeadAt(97, 25, 0.81, -0.59)) },
  { id: "riverway", name: "Theo lối sông", mean: () => "Đi dọc theo con sông theo hướng mũi tên", make: "Một nét lượn sóng (con sông) chạy song song ngay bên cạnh mũi tên chỉ hướng đi", draw: () => trSVG(trWave(20, 32, 6) + trArrow(16, 60, 104, 1)) },
  { id: "crossstream", name: "Vượt suối", mean: () => "Băng ngang qua suối tại điểm này, theo hướng mũi tên", make: "Hai nét sóng dọc mô phỏng dòng suối, mũi tên cắt ngang qua dòng suối", draw: () => trSVG(`<path d="M52 14 q7 8 0 16 t0 16 t0 16 t0 14" fill="none" stroke="${TR_BLUE}" stroke-width="4" stroke-linecap="round"/><path d="M68 14 q7 8 0 16 t0 16 t0 16 t0 14" fill="none" stroke="${TR_BLUE}" stroke-width="4" stroke-linecap="round"/>` + trArrow(12, 45, 108, 1)) },
  { id: "streamway", name: "Theo lối suối", mean: () => "Đi dọc theo con suối (hướng đi theo chiều dọc của các nét sóng)", make: "Hai đến ba nét lượn sóng song song xếp chồng nhau mô phỏng dòng suối", draw: () => trSVG(trWave(24, 28, 5) + trWave(24, 46, 5) + trWave(24, 64, 5)) },
  { id: "campok", name: "Cắm trại được", mean: () => "Nơi này thích hợp, được cắm trại", make: "Hình lều đơn giản: hai que xiên chụm đỉnh, một que làm đáy", draw: () => trSVG(trLine(30, 66, 60, 26) + trLine(60, 26, 90, 66) + trLine(22, 66, 98, 66)) },
  { id: "campno", name: "Không cắm trại được", mean: () => "Nơi này không cắm trại được", make: "Hình lều bị hai que bắt chéo phủ lên thành chữ X", draw: () => trSVG(trLine(38, 62, 58, 32) + trLine(58, 32, 78, 62) + trLine(32, 62, 84, 62) + trLine(26, 22, 94, 70, 4.5) + trLine(94, 22, 26, 70, 4.5)) },
  { id: "stretcher", name: "Làm cáng", mean: () => "Cần làm cáng — có người bị thương cần khiêng", make: "Hai que dài song song làm hai cạnh cáng, nhiều que ngắn đặt ngang làm nan", draw: () => trSVG(`<rect x="18" y="30" width="84" height="30" fill="none" stroke="${TR_STICK}" stroke-width="5"/>` + trLine(39, 30, 39, 60, 4) + trLine(60, 30, 60, 60, 4) + trLine(81, 30, 81, 60, 4)) },
  { id: "backcamp", name: "Về trại lúc n giờ", param: "giờ", mean: (n) => `Phải có mặt ở trại lúc ${n} giờ`, make: "Hình lều kèm thẻ ghi giờ phải có mặt ở trại", draw: (n) => trSVG(trLine(24, 64, 46, 30) + trLine(46, 30, 68, 64) + trLine(18, 64, 74, 64) + trBadge(n)) },
  { id: "footprints", name: "Đi theo dấu chân", mean: () => "Đi theo dấu chân (vết chân) để lại trên đường", make: "Khung chữ nhật, bên trong xếp các hòn đá dẹt thành vết chân so le như bước đi", draw: () => trSVG(`<rect x="16" y="14" width="88" height="62" fill="none" stroke="${TR_STICK}" stroke-width="4.5"/>` + [[38, 32], [57, 52], [76, 32], [92, 52]].map(([cx, cy]) => `<ellipse cx="${cx}" cy="${cy}" rx="5" ry="8.5" fill="${TR_STICK}"/>`).join("")) },
  { id: "enemy", name: "Có kẻ nghịch — có địch", mean: () => "Phía trước có người lạ/địch — cảnh giác, có thể phải ẩn nấp hoặc tránh", make: "Hai nhóm đầu mũi tên (ngạnh chữ V) quay ngược đầu vào nhau", draw: () => trSVG([24, 42].map((x) => trLine(x, 31, x + 13, 45, 4.5) + trLine(x + 13, 45, x, 59, 4.5)).join("") + [96, 78].map((x) => trLine(x, 31, x - 13, 45, 4.5) + trLine(x - 13, 45, x, 59, 4.5)).join("")) },
  { id: "beast", name: "Có thú dữ", mean: () => "Khu vực có thú dữ — nguy hiểm, tránh xa và thận trọng", make: "Đá xếp thành vòng tròn, các que ngắn tỏa ra chung quanh như tia nắng", draw: () => trSVG(`<circle cx="60" cy="45" r="15" fill="none" stroke="${TR_STICK}" stroke-width="5"/>` + [0, 45, 90, 135, 180, 225, 270, 315].map((a) => { const r1 = 20, r2 = 28, t = a * Math.PI / 180; return trLine(60 + r1 * Math.cos(t), 45 + r1 * Math.sin(t), 60 + r2 * Math.cos(t), 45 + r2 * Math.sin(t), 4); }).join("")) }
];
function trailParam(s) {
  if (!s.param) return null;
  if (s.param === "người") return 2 + Math.floor(Math.random() * 8);
  if (s.param === "phút") return 5 * (1 + Math.floor(Math.random() * 6));
  if (s.param === "giờ") return 8 + Math.floor(Math.random() * 4);
  return 5 * (2 + Math.floor(Math.random() * 9));
}
function trailQuestion() {
  const s = TRAIL_SIGNS[Math.floor(Math.random() * TRAIL_SIGNS.length)];
  const n = trailParam(s);
  const others = modShuffle(TRAIL_SIGNS.filter((x) => x.id !== s.id)).slice(0, 3);
  const bySign = Math.random() < 0.65;
  if (bySign) {
    const opts = modShuffle([{ t: s.mean(n), ok: true }].concat(others.map((o) => ({ t: o.mean(trailParam(o)), ok: false }))));
    return { sign: s, n, bySign, opts, explain: `<b>${esc(s.name)}</b> — ${esc(s.mean(n))}.<br>Cách tạo: ${esc(s.make)}.` };
  }
  const opts = modShuffle([{ s, n, ok: true }].concat(others.map((o) => ({ s: o, n: trailParam(o), ok: false }))));
  return { sign: s, n, bySign, opts, explain: `<b>${esc(s.name)}</b> — ${esc(s.mean(n))}.<br>Cách tạo: ${esc(s.make)}.` };
}

/* ---------------- Module DẤU ĐI ĐƯỜNG ---------------- */
function openTrailModule() {
  const body = openPanel("👣 Dấu đi đường — Luyện tập & Kiểm tra", true);
  let mode = "luyen";
  let cur = null, answered = false;
  let test = null; // { list, idx, correct, startedAt }
  body.innerHTML = `
    <div class="tt-modbar">
      <button type="button" data-m="luyen" class="on">🖊️ Luyện tập</button>
      <button type="button" data-m="kiem" class="">📋 Kiểm tra (10 câu)</button>
    </div>
    <div data-role="stage"></div>`;
  const stage = body.querySelector('[data-role="stage"]');
  body.querySelectorAll("[data-m]").forEach((b) => b.addEventListener("click", () => {
    mode = b.dataset.m;
    body.querySelectorAll("[data-m]").forEach((x) => x.classList.toggle("on", x === b));
    test = null;
    mode === "luyen" ? nextPractice() : startTest();
  }));
  function optBtn(html, fn) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "tt-opt"; b.innerHTML = html;
    b.addEventListener("click", fn);
    return b;
  }
  function showQuestion(q, onPick) {
    stage.innerHTML = "";
    const box = document.createElement("div");
    box.className = "tt-qbox";
    if (q.bySign) {
      box.innerHTML = `<p style="text-align:center;margin:0 0 4px"><b>Dấu này có nghĩa là gì?</b></p>${q.sign.draw(q.n)}`;
      stage.appendChild(box);
      q.opts.forEach((o) => stage.appendChild(optBtn(esc(o.t), (ev) => onPick(o.ok, ev.currentTarget))));
    } else {
      box.innerHTML = `<p style="text-align:center;margin:0"><b>${esc(q.sign.mean(q.n))}</b><br><span style="color:#555">Dấu nào đúng với nghĩa trên?</span></p>`;
      stage.appendChild(box);
      const grid = document.createElement("div");
      grid.className = "tt-docgrid";
      q.opts.forEach((o) => {
        const b = optBtn(o.s.draw(o.n), (ev) => onPick(o.ok, ev.currentTarget));
        b.style.textAlign = "center";
        grid.appendChild(b);
      });
      stage.appendChild(grid);
    }
  }
  function lockOpts(picked, wasOk) {
    stage.querySelectorAll(".tt-opt").forEach((b) => {
      b.disabled = true;
      if (b === picked) b.classList.add(wasOk ? "ok" : "bad");
    });
  }
  function nextPractice() {
    answered = false;
    cur = trailQuestion();
    showQuestion(cur, (ok, btn) => {
      if (answered) return;
      answered = true;
      lockOpts(btn, ok);
      const note = document.createElement("div");
      note.className = ok ? "tt-msg" : "tt-err";
      note.style.display = "block";
      note.innerHTML = (ok ? "✅ Đúng rồi! " : "❌ Chưa đúng. ") + cur.explain;
      stage.appendChild(note);
      const nb = document.createElement("button");
      nb.type = "button"; nb.className = "tt-btn"; nb.textContent = "Câu tiếp theo →";
      nb.addEventListener("click", nextPractice);
      stage.appendChild(nb);
    });
  }
  function startTest() {
    test = { list: Array.from({ length: 10 }, () => trailQuestion()), idx: 0, correct: 0, startedAt: Date.now() };
    showTestQ();
  }
  function showTestQ() {
    const q = test.list[test.idx];
    showQuestion(q, (ok) => {
      if (ok) test.correct++;
      test.idx++;
      if (test.idx < test.list.length) { showTestQ(); return; }
      const dur = Math.round((Date.now() - test.startedAt) / 1000);
      modSaveHistory("kt-dau-duong", test.correct, test.list.length, "Kiểm tra dấu đi đường — 10 câu", dur);
      const score = (Math.round((test.correct / test.list.length) * 100) / 10).toFixed(1).replace(".", ",");
      stage.innerHTML = `<div class="tt-qbox" style="text-align:center">
        <p style="font-size:19px;margin:4px 0"><b>Hoàn thành bài kiểm tra!</b></p>
        <p>Đúng <b>${test.correct}/${test.list.length}</b> câu — Điểm: <b>${score}/10</b></p>
        <p class="tt-note">Kết quả đã lưu vào Lịch sử của em và sẽ đồng bộ cho thầy khi có mạng.</p></div>`;
      const nb = document.createElement("button");
      nb.type = "button"; nb.className = "tt-btn"; nb.textContent = "Làm bài kiểm tra mới";
      nb.addEventListener("click", startTest);
      stage.appendChild(nb);
    });
    const head = document.createElement("p");
    head.style.cssText = "text-align:center;color:#555;margin:0 0 8px";
    head.textContent = `Câu ${test.idx + 1}/${test.list.length} — chọn một đáp án, bài sẽ chuyển câu ngay`;
    stage.insertBefore(head, stage.firstChild);
  }
  nextPractice();
}

/* ---------------- Tài liệu DẤU ĐI ĐƯỜNG ---------------- */
function openTrailDoc() {
  const body = openPanel("👣 Tài liệu dấu đi đường", true);
  const cards = TRAIL_SIGNS.map((s) => `<div class="tt-signcard">${s.draw(s.param ? "n" : null)}<b>${esc(s.name)}</b><span>${esc(s.mean(s.param ? "n" : null))}</span></div>`).join("");
  body.innerHTML = `
    <p><b>Bảng 32 dấu đường thông dụng.</b> Que/cành cây làm các nét thẳng và thân mũi tên, đá nhỏ xếp thành nét cong và vòng tròn, số trong vòng tròn nhỏ là số đi kèm dấu (số người, số phút, số mét, giờ).</p>
    <div class="tt-docgrid">${cards}</div>
    <p><b>Khi rải dấu:</b> đặt ở bên phải đường đi, ngang tầm mắt, dễ thấy; các dấu cách nhau không quá 50 m; dấu mật thư phải đúng hướng và đúng khoảng cách.</p>
    <p><b>Chú ý:</b> dấu <i>Bắt đầu đi</i> và dấu <i>Đích</i> cùng là vòng tròn có chấm tâm — dấu Bắt đầu có thêm mũi tên. <i>Nước sạch</i> là vòng tròn, <i>nước không uống được</i> là tam giác.</p>`;
}

/* ---------------- MẬT THƯ: các hệ mã hoá ----------------
   Mọi hệ đều làm việc trên bạch văn đã chuyển theo quy ước
   của lớp (convertText): chỉ còn 26 chữ La-tinh không dấu,
   riêng chữ Z không bao giờ xuất hiện trong tiếng Việt đã
   chuyển đổi — đúng điều kiện của bảng tọa độ 5×5 (bỏ Z). */
const CIPHER_MSGS = ["ĐI HỌC", "HỌC TỐT", "ĐOÀN KẾT", "CHĂM NGOAN", "GIÚP BẠN", "YÊU NƯỚC", "GIỮ SẠCH", "ĐI SỚM", "VỀ TRẠI", "ĐỌC SÁCH", "NGỦ SỚM", "UỐNG NƯỚC", "RỬA TAY", "XẾP HÀNG", "ĐI ĐỀU", "HÁT VANG"];
function caesarShift(conv, k) {
  return conv.split("").map((ch) => ch === " " ? " " : String.fromCharCode(65 + ((ch.charCodeAt(0) - 65 + k) % 26))).join("");
}
function coordGrid(kwLetters) {
  /* Bảng tọa độ 5×5 (25 chữ, bỏ Z). Có từ khóa: điền chữ của
     từ khóa trước (bỏ trùng), điền tiếp các chữ còn lại. */
  if (!kwLetters) return "ABCDEFGHIJKLMNOPQRSTUVWXY";
  let seq = "";
  for (const ch of kwLetters + "ABCDEFGHIJKLMNOPQRSTUVWXY") if (!seq.includes(ch)) seq += ch;
  return seq.slice(0, 25);
}
function coordOfK(ch, grid) {
  const i = grid.indexOf(ch);
  return i < 0 ? ch : "ABCDE"[Math.floor(i / 5)] + (i % 5 + 1);
}
/* Chuồng bồ câu: lưới vuông 3×3 mỗi ô 2 chữ (AB|CD|EF / GH|IJ|KL /
   MN|OP|QR) + lưới nhọn 4 ô (trên ST, trái UV, phải WX, dưới YZ).
   Ký hiệu = khung của ô chứa chữ; chữ thứ hai trong ô thêm dấu chấm. */
const PIGPEN_MAP = (() => {
  const m = {};
  [["A", "B"], ["C", "D"], ["E", "F"], ["G", "H"], ["I", "J"], ["K", "L"], ["M", "N"], ["O", "P"], ["Q", "R"]]
    .forEach((pair, i) => {
      const r = Math.floor(i / 3), c = i % 3;
      m[pair[0]] = { g: "sq", r, c, dot: 0 };
      m[pair[1]] = { g: "sq", r, c, dot: 1 };
    });
  [["top", "S", "T"], ["left", "U", "V"], ["right", "W", "X"], ["bottom", "Y", "Z"]]
    .forEach(([w, a, b]) => { m[a] = { g: "x", w, dot: 0 }; m[b] = { g: "x", w, dot: 1 }; });
  return m;
})();
/* Lưới nhọn có thể XOAY theo khóa: 4 cặp chữ nằm trên một
   vòng theo chiều kim đồng hồ (trên → phải → dưới → trái)
   là S·T → W·X → Y·Z → U·V. Khóa cho biết cặp nào ở trên
   cùng, cả vòng xoay theo. pigpenXMap(top) trả về ánh xạ
   chữ → {ô, chấm} cho 8 chữ của lưới nhọn theo khóa đó. */
const PIGPEN_RING = ["ST", "WX", "YZ", "UV"];
function pigpenXMap(top) {
  const pos = ["top", "right", "bottom", "left"];
  const start = Math.max(0, PIGPEN_RING.indexOf(top || "ST"));
  const m = {};
  for (let i = 0; i < 4; i++) {
    const pair = PIGPEN_RING[(start + i) % 4], w = pos[i];
    m[pair[0]] = { g: "x", w, dot: 0 };
    m[pair[1]] = { g: "x", w, dot: 1 };
  }
  return m;
}
function pigpenGlyph(ch, x, y, s, xMap) {
  const p = (xMap && xMap[ch]) || PIGPEN_MAP[ch];
  if (!p) return "";
  const u = s / 30, X = (d) => (x + d * u).toFixed(1), Y = (d) => (y + d * u).toFixed(1);
  const L = 3, R = 27, T = 3, B = 27;
  let lines = [];
  if (p.g === "sq") {
    const seg = { top: [L, T, R, T], right: [R, T, R, B], bottom: [L, B, R, B], left: [L, T, L, B] };
    const need = { top: p.r > 0, bottom: p.r < 2, left: p.c > 0, right: p.c < 2 };
    for (const k in seg) if (need[k]) { const [a, b, c2, d] = seg[k]; lines.push(`<line x1="${X(a)}" y1="${Y(b)}" x2="${X(c2)}" y2="${Y(d)}"/>`); }
  } else if (p.w === "top") lines = [`<line x1="${X(4)}" y1="${Y(4)}" x2="${X(15)}" y2="${Y(19)}"/>`, `<line x1="${X(26)}" y1="${Y(4)}" x2="${X(15)}" y2="${Y(19)}"/>`];
  else if (p.w === "bottom") lines = [`<line x1="${X(4)}" y1="${Y(26)}" x2="${X(15)}" y2="${Y(11)}"/>`, `<line x1="${X(26)}" y1="${Y(26)}" x2="${X(15)}" y2="${Y(11)}"/>`];
  else if (p.w === "left") lines = [`<line x1="${X(4)}" y1="${Y(4)}" x2="${X(19)}" y2="${Y(15)}"/>`, `<line x1="${X(4)}" y1="${Y(26)}" x2="${X(19)}" y2="${Y(15)}"/>`];
  else lines = [`<line x1="${X(26)}" y1="${Y(4)}" x2="${X(11)}" y2="${Y(15)}"/>`, `<line x1="${X(26)}" y1="${Y(26)}" x2="${X(11)}" y2="${Y(15)}"/>`];
  return `<g stroke="#37474f" stroke-width="${(2.6 * u).toFixed(1)}" stroke-linecap="round">${lines.join("")}${p.dot ? `<circle cx="${X(p.g === "x" && p.w === "left" ? 9.5 : p.g === "x" && p.w === "right" ? 20.5 : 15)}" cy="${Y(p.g === "x" && p.w === "top" ? 9.5 : p.g === "x" && p.w === "bottom" ? 20.5 : 15)}" r="${(3 * u).toFixed(1)}" fill="#37474f" stroke="none"/>` : ""}</g>`;
}
function pigpenSVG(conv, xMap) {
  const S = 30, GAP = 4, SPACE = 18, MAXW = 322;
  const items = [];
  let x = 4, y = 4, maxX = 0;
  for (const ch of conv) {
    if (ch === " ") { x += SPACE; continue; }
    if (x + S > MAXW) { x = 4; y += S + 10; }
    items.push([ch, x, y]);
    x += S + GAP;
    maxX = Math.max(maxX, x);
  }
  const H = y + S + 6;
  return `<svg viewBox="0 0 ${Math.min(MAXW, maxX + 2)} ${H}" style="max-width:100%;height:auto;display:block;margin:6px auto" role="img" aria-label="Bản mật thư chuồng"><rect x="0" y="0" width="${Math.min(MAXW, maxX + 2)}" height="${H}" rx="8" fill="#fffdf5"/>${items.map(([ch, ix, iy]) => pigpenGlyph(ch, ix, iy, S, xMap)).join("")}</svg>`;
}
function pigpenRefSVG(xMap) {
  /* Bảng tra chuồng: hai lưới có ghi chữ, để học sinh đối chiếu.
     Chữ thứ hai trong mỗi ô khi viết mật thư phải thêm dấu chấm.
     Lưới nhọn vẽ theo khóa xoay xMap (mặc định: S·T ở trên). */
  let cells = "";
  const pairs = [["A", "B"], ["C", "D"], ["E", "F"], ["G", "H"], ["I", "J"], ["K", "L"], ["M", "N"], ["O", "P"], ["Q", "R"]];
  pairs.forEach((pr, i) => {
    const cx = (i % 3) * 50, cy = Math.floor(i / 3) * 50;
    cells += `<text x="${cx + 25}" y="${cy + 30}" text-anchor="middle" font-size="15" font-weight="700" fill="#37474f" font-family="system-ui,sans-serif">${pr[0]}·${pr[1]}</text>`;
  });
  const grid = [50, 100].map((v) => `<line x1="${v}" y1="0" x2="${v}" y2="150"/><line x1="0" y1="${v}" x2="150" y2="${v}"/>`).join("");
  const xm = xMap || pigpenXMap("ST");
  const pairStr = (w) => { const letters = Object.keys(xm).filter((k) => xm[k].w === w).sort((a, b) => xm[a].dot - xm[b].dot); return letters.join("·"); };
  const xlabels = `<text x="225" y="64" text-anchor="middle" font-size="15" font-weight="700" fill="#37474f" font-family="system-ui,sans-serif">${pairStr("top")}</text>
    <text x="170" y="110" text-anchor="middle" font-size="15" font-weight="700" fill="#37474f" font-family="system-ui,sans-serif">${pairStr("left")}</text>
    <text x="280" y="110" text-anchor="middle" font-size="15" font-weight="700" fill="#37474f" font-family="system-ui,sans-serif">${pairStr("right")}</text>
    <text x="225" y="168" text-anchor="middle" font-size="15" font-weight="700" fill="#37474f" font-family="system-ui,sans-serif">${pairStr("bottom")}</text>`;
  return `<svg viewBox="0 0 300 210" style="max-width:340px;width:100%;height:auto;display:block;margin:6px auto" role="img" aria-label="Bảng tra mật thư chuồng">
    <rect x="0" y="0" width="300" height="210" rx="8" fill="#fffdf5"/>
    <g stroke="#37474f" stroke-width="2.5"><rect x="1" y="1" width="148" height="148" fill="none"/>${grid}
    <line x1="150" y1="30" x2="300" y2="180"/><line x1="300" y1="30" x2="150" y2="180"/></g>${cells}${xlabels}</svg>`;
}
function coordTableHTML(grid) {
  const letters = grid || "ABCDEFGHIJKLMNOPQRSTUVWXY";
  let rows = "";
  for (let r = 0; r < 5; r++) {
    let tds = "";
    for (let c = 0; c < 5; c++) tds += `<td style="text-align:center;font-weight:700">${letters[r * 5 + c]}</td>`;
    rows += `<tr><td style="font-weight:700;color:#0b5cad">${"ABCDE"[r]}</td>${tds}</tr>`;
  }
  return `<table class="tt-table" style="max-width:320px;margin:6px auto"><thead><tr><th></th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th></tr></thead><tbody>${rows}</tbody></table>`;
}
function caesarStripHTML(k) {
  const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const b = caesarShift(a, k);
  return `<div style="overflow-x:auto"><table class="tt-table" style="margin:6px auto"><tbody>
    <tr><td style="color:#666">Chữ thật</td>${[...a].map((c) => `<td style="text-align:center">${c}</td>`).join("")}</tr>
    <tr><td style="color:#666">Chữ mật</td>${[...b].map((c) => `<td style="text-align:center;font-weight:700">${c}</td>`).join("")}</tr></tbody></table></div>`;
}
/* ============ KHÓA và CÂU DẤU HIỆU (OTT) ============
   Mỗi đề mật thư có hai dạng khóa:
   - "given" (cho sẵn): khóa ghi thẳng trong đề — để làm quen.
   - "find" (tự tìm khóa): đề chỉ cho một CÂU DẤU HIỆU, học
     sinh phải suy ra khóa từ câu đó. Đây là dạng chính trong
     Kiểm tra, đúng cách ra đề mật thư trong hoạt động Đội:
     khóa giấu trong câu nói gợi ý (tài liệu huấn luyện gọi
     là chìa khóa OTT cho bằng câu gợi ý). */
const SO_CLUES = [
  { start: "S", text: "“Nước Việt Nam là một”", derive: "Đất nước Việt Nam hình chữ S và là MỘT nước thống nhất → chữ S nhận số 1; bảng số đếm vòng tròn bắt đầu từ S (S=1, T=2, …, hết Z quay về A)." },
  { start: "H", text: "“Thủ đô Hà Nội là trái tim của cả nước” — chữ đầu của tên thủ đô đứng đầu bảng số", derive: "Thủ đô là Hà Nội → chữ H nhận số 1, đếm vòng tròn từ H." },
  { start: "M", text: "“Mèo con kêu meo meo” — tên con vật trong câu đứng đầu bảng số", derive: "Con vật trong câu là mèo → chữ M nhận số 1, đếm vòng tròn từ M." },
  { start: "B", text: "“Biển xanh sóng vỗ rì rào” — chữ đầu câu đứng đầu bảng số", derive: "Chữ đầu câu là B → chữ B nhận số 1, đếm vòng tròn từ B." },
  { start: "D", text: "“Đội ta là Đội Thiếu niên Tiền phong” — chữ đầu câu đứng đầu bảng số", derive: "Chữ đầu câu là Đ, đã chuyển thành D → chữ D nhận số 1, đếm vòng tròn từ D." },
  { start: "T", text: "“Trường em xanh, sạch, đẹp” — chữ đầu câu đứng đầu bảng số", derive: "Chữ đầu câu là T → chữ T nhận số 1, đếm vòng tròn từ T." },
  { start: "V", text: "“Việt Nam quê hương em” — chữ đầu câu đứng đầu bảng số", derive: "Chữ đầu câu là V → chữ V nhận số 1, đếm vòng tròn từ V." },
  { start: "L", text: "“Lớp em đoàn kết, thân ái” — chữ đầu câu đứng đầu bảng số", derive: "Chữ đầu câu là L → chữ L nhận số 1, đếm vòng tròn từ L." }
];
const CAESAR_CLUES = [
  { name: "An", animal: "dê" }, { name: "Bình", animal: "dê" }, { name: "Cường", animal: "gà" },
  { name: "Dũng", animal: "trâu" }, { name: "Hà", animal: "mèo" }, { name: "Khoa", animal: "vịt" },
  { name: "Lan", animal: "bò" }, { name: "Minh", animal: "gà" }, { name: "Nam", animal: "cá" },
  { name: "Phúc", animal: "heo" }, { name: "Sơn", animal: "khỉ" }, { name: "Tuấn", animal: "ngựa" }, { name: "Vinh", animal: "dê" }
];
function caesarClueMade() {
  const c = CAESAR_CLUES[Math.floor(Math.random() * CAESAR_CLUES.length)];
  const plain = convertText(c.name).toUpperCase()[0];
  const cipherL = convertText(c.animal).toUpperCase()[0];
  const k = (cipherL.charCodeAt(0) - plain.charCodeAt(0) + 26) % 26;
  return { key: { k }, clue: { text: `Dấu hiệu: “${c.name} đi chăn ${c.animal}”`, derive: `Tên “${c.name}” bắt đầu bằng chữ thật ${plain}; con vật “${c.animal}” bắt đầu bằng chữ ${cipherL}. Vậy ${plain} viết thành ${cipherL} — đếm khoảng cách trong bảng chữ cái, cả bảng dịch ${k} vị trí.` } };
}
const TOADO_KEYS = [
  { kw: "HOA", sent: "HOA nở rộ khắp sân trường" }, { kw: "SÁCH", sent: "SÁCH là người bạn lớn của em" },
  { kw: "BẠN", sent: "BẠN bè giúp nhau cùng tiến bộ" }, { kw: "LỚP", sent: "LỚP em đoàn kết, thân ái" },
  { kw: "XANH", sent: "XANH tươi hàng cây sân trường" }, { kw: "VÀNG", sent: "VÀNG óng cánh đồng lúa chín" },
  { kw: "BIỂN", sent: "BIỂN quê em sóng vỗ rì rào" }, { kw: "ĐỘI", sent: "ĐỘI ta tiến bước theo cờ" }
];
function toadoClueMade() {
  const c = TOADO_KEYS[Math.floor(Math.random() * TOADO_KEYS.length)];
  let letters = "";
  for (const ch of convertText(c.kw).toUpperCase()) if (!letters.includes(ch)) letters += ch;
  return { key: { kw: c.kw, grid: coordGrid(letters) }, clue: { text: `Dấu hiệu: “${c.sent}”`, derive: `Từ đầu tiên của câu là “${c.kw}” — đó là TỪ KHÓA. Chuyển theo quy ước lớp được ${letters} (đã bỏ chữ trùng), điền vào bảng theo từng hàng, rồi điền tiếp các chữ còn lại theo thứ tự bảng chữ cái (bỏ Z).` } };
}
const CHUONG_CLUES = [
  { top: "ST", word: "SÔNG" }, { top: "UV", word: "UỐNG" }, { top: "WX", word: "XANH" }, { top: "YZ", word: "YÊU" }
];
function chuongClueMade() {
  const c = CHUONG_CLUES[Math.floor(Math.random() * CHUONG_CLUES.length)];
  const xm = pigpenXMap(c.top);
  const pairStr = (w) => Object.keys(xm).filter((k) => xm[k].w === w).sort((a, b) => xm[a].dot - xm[b].dot).join("·");
  return { key: { top: c.top, xMap: xm }, clue: { text: `Dấu hiệu: cặp chữ đầu của từ “${c.word}” nằm ở trên cùng của lưới nhọn`, derive: `Từ “${c.word}” bắt đầu bằng cặp ${c.top.split("").join("·")} → cặp này lên TRÊN CÙNG. Cả vòng xoay theo chiều kim đồng hồ: trên ${pairStr("top")}, phải ${pairStr("right")}, dưới ${pairStr("bottom")}, trái ${pairStr("left")}.` } };
}
const CIPHER_SYSTEMS = [
  { id: "so", name: "Số thay chữ",
    makeGiven: () => ({ key: { start: "A" }, clue: null }),
    makeFind: () => { const c = SO_CLUES[Math.floor(Math.random() * SO_CLUES.length)]; return { key: { start: c.start }, clue: { text: "🕵️ " + c.text, derive: c.derive } }; },
    enc: (conv, key) => { const off = key.start.charCodeAt(0) - 65; return conv.split(" ").map((w) => [...w].map((ch) => ((ch.charCodeAt(0) - 65 - off + 26) % 26) + 1).join("-")).join(" – "); },
    keyInfo: (key) => key.start === "A" ? "🔑 Khóa: <b>A = 1</b> — mỗi chữ thay bằng số thứ tự của nó (A=1, B=2, …, Z=26)" : `🔑 Khóa: <b>${key.start} = 1</b> — bảng số đếm vòng tròn bắt đầu từ chữ ${key.start}`,
    help: (key) => `<p>Mỗi chữ thay bằng số thứ tự của nó trong bảng chữ cái, đếm vòng tròn bắt đầu từ <b>${key.start} = 1</b> (sau Z quay lại A). Số trong một tiếng nối bằng dấu -, các tiếng cách nhau bằng dấu –.</p>`,
    findHelp: `<p><b>Cách tìm khóa:</b> câu dấu hiệu chỉ mặt chữ cái nhận số 1 — chữ đầu câu, hoặc chữ mà câu đố nhắc tới (ví dụ: đất nước hình chữ S). Từ chữ đó đếm vòng tròn: nó là 1, chữ tiếp theo là 2, … hết Z quay về A.</p>` },
  { id: "caesar", name: "Chữ thay chữ (dịch chuyển)",
    makeGiven: () => ({ key: { k: 2 + Math.floor(Math.random() * 23) }, clue: null }),
    makeFind: () => caesarClueMade(),
    enc: (conv, key) => caesarShift(conv, key.k),
    keyInfo: (key) => `🔑 Khóa: <b>A = ${String.fromCharCode(65 + key.k)}</b> — bạch văn A viết thành ${String.fromCharCode(65 + key.k)}, mọi chữ đều dịch ${key.k} vị trí`,
    help: (key) => `<p>Bảng chữ cái dịch vòng tròn ${key.k} vị trí. Khi giải, tra hàng chữ mật rồi đọc xuống hàng chữ thật:</p>${caesarStripHTML(key.k)}`,
    findHelp: `<p><b>Cách tìm khóa:</b> câu dấu hiệu có dạng “một bạn đi chăn một con vật”: chữ đầu của TÊN là một chữ THẬT, chữ đầu của CON VẬT là chữ MẬT viết thay nó. Đếm khoảng cách giữa hai chữ đó trong bảng chữ cái — đó là độ dịch của cả bảng.</p>` },
  { id: "toado", name: "Tọa độ chữ",
    makeGiven: () => ({ key: { kw: null, grid: coordGrid(null) }, clue: null }),
    makeFind: () => toadoClueMade(),
    enc: (conv, key) => conv.split(" ").map((w) => [...w].map((ch) => coordOfK(ch, key.grid)).join("-")).join(" / "),
    keyInfo: (key) => key.kw ? `🔑 Bảng tọa độ dựng bằng từ khóa <b>${esc(key.kw)}</b> (điền từ khóa trước, bỏ chữ trùng)` : "🔑 Bảng tọa độ 5×5 (bỏ chữ Z): mỗi chữ ghi bằng (chữ hàng)(số cột), ví dụ D = A4",
    help: (key) => `<p>25 chữ cái (bỏ Z) xếp vào bảng 5×5${key.kw ? ` dựng bằng từ khóa <b>${esc(key.kw)}</b>` : ""}. Hàng đánh bằng chữ A–E, cột bằng số 1–5; mỗi chữ ghi bằng chữ hàng rồi số cột:</p>${coordTableHTML(key.grid)}`,
    findHelp: `<p><b>Cách tìm khóa:</b> TỪ ĐẦU TIÊN của câu dấu hiệu là từ khóa. Chuyển từ khóa theo quy ước lớp, bỏ chữ trùng, điền vào bảng theo từng hàng, rồi điền tiếp các chữ còn lại theo thứ tự bảng chữ cái (bỏ Z).</p>` },
  { id: "chuong", name: "Mật thư chuồng (chuồng bồ câu)",
    makeGiven: () => ({ key: { top: "ST", xMap: pigpenXMap("ST") }, clue: null }),
    makeFind: () => chuongClueMade(),
    enc: (conv) => conv,
    keyInfo: (key) => key.top === "ST" ? "🔑 Bảng chuồng chuẩn — cặp S·T ở trên cùng của lưới nhọn" : `🔑 Lưới nhọn đã xoay theo khóa — cặp <b>${key.top.split("").join("·")}</b> ở trên cùng`,
    help: (key) => `<p>Mỗi chữ vẽ bằng <b>khung của ô chứa nó</b>; chữ thứ hai trong ô thêm <b>dấu chấm</b>. Lưới nhọn theo khóa của đề này:</p>${pigpenRefSVG(key.xMap)}`,
    findHelp: `<p><b>Cách tìm khóa:</b> câu dấu hiệu cho biết cặp chữ nào của lưới nhọn nằm ở TRÊN CÙNG. Bốn cặp chữ nằm trên một vòng theo chiều kim đồng hồ: S·T → W·X → Y·Z → U·V — một cặp lên trên thì cả vòng xoay theo, suy ra vị trí ba cặp còn lại.</p>${pigpenRefSVG()}` },
  { id: "docnguoc", name: "Đọc ngược",
    makeGiven: () => ({ key: { whole: false }, clue: null }),
    makeFind: (conv) => {
      const words = conv.split(" ");
      if (Math.random() < 0.5) {
        const last = words[words.length - 1];
        return { key: { whole: true }, clue: { text: `🕵️ Dấu hiệu: tiếng “${last}” vốn ở cuối bản tin thật, trong mật thư lại đứng ở ĐẦU và viết ngược thành “${[...last].reverse().join("")}”`, derive: "Tiếng cuối chạy lên đầu và bị viết ngược → cả bản tin bị đảo ngược TOÀN BỘ (cả thứ tự các tiếng). Khi giải, đảo ngược lại toàn bộ dãy chữ." } };
      }
      const first = words[0];
      return { key: { whole: false }, clue: { text: `🕵️ Dấu hiệu: tiếng đầu tiên “${first}” trong mật thư viết thành “${[...first].reverse().join("")}”`, derive: "Tiếng đầu vẫn đứng đầu, chỉ bị viết ngược một mình → mỗi tiếng bị đảo ngược RIÊNG, thứ tự các tiếng giữ nguyên. Khi giải, đảo ngược lại từng tiếng." } };
    },
    enc: (conv, key) => key.whole ? [...conv].reverse().join("") : conv.split(" ").map((w) => [...w].reverse().join("")).join(" "),
    keyInfo: (key) => key.whole ? "🔑 Khóa: cả bản tin bị viết đảo ngược toàn bộ (cả thứ tự các tiếng)" : "🔑 Khóa: mỗi tiếng trong bản tin bị viết ngược thứ tự các chữ",
    help: (key) => key.whole ? `<p>Toàn bộ bản tin — cả thứ tự các tiếng lẫn thứ tự chữ trong tiếng — bị đảo ngược từ cuối lên đầu. Khi giải, viết lại cả dãy theo chiều ngược lại.</p>` : `<p>Mỗi tiếng bị đảo ngược thứ tự chữ cái (ví dụ DDI viết thành IDD), thứ tự các tiếng giữ nguyên. Khi giải, đảo ngược lại từng tiếng.</p>`,
    findHelp: `<p><b>Cách tìm khóa:</b> hệ này không có khóa số — phải nhận ra DẠNG đảo ngược qua tiếng mẫu trong dấu hiệu: tiếng mẫu còn đứng đúng vị trí của nó thì là đảo ngược từng tiếng; tiếng cuối của bản tin thật chạy lên đầu thì là đảo ngược toàn bộ.</p>` }
];
function cipherItem(mode, sysId) {
  const sys = sysId ? CIPHER_SYSTEMS.find((s) => s.id === sysId) : CIPHER_SYSTEMS[Math.floor(Math.random() * CIPHER_SYSTEMS.length)];
  const phrase = CIPHER_MSGS[Math.floor(Math.random() * CIPHER_MSGS.length)];
  const conv = convertText(phrase).toUpperCase();
  const made = (mode === "find" ? sys.makeFind(conv) : sys.makeGiven(conv)) || {};
  return { sys, phrase, conv, key: made.key, clue: made.clue || null, cipher: sys.enc(conv, made.key), xMap: made.key && made.key.xMap };
}
function cipherAnswerOk(input, item) {
  const norm = (s) => String(s || "").toUpperCase().replace(/\s+/g, " ").trim();
  return norm(input) === item.conv || norm(input) === norm(item.phrase);
}

/* ---------------- Module MẬT THƯ ---------------- */
function openCipherModule() {
  const body = openPanel("🔐 Mật thư — Luyện tập & Kiểm tra", true);
  let mode = "luyen";
  let test = null;
  body.innerHTML = `
    <div class="tt-modbar">
      <button type="button" data-m="luyen" class="on">🖊️ Luyện tập</button>
      <button type="button" data-m="kiem">📋 Kiểm tra (10 câu)</button>
    </div>
    <div data-role="stage"></div>`;
  const stage = body.querySelector('[data-role="stage"]');
  body.querySelectorAll("[data-m]").forEach((b) => b.addEventListener("click", () => {
    mode = b.dataset.m;
    body.querySelectorAll("[data-m]").forEach((x) => x.classList.toggle("on", x === b));
    test = null;
    mode === "luyen" ? practice() : startTest();
  }));
  function itemHTML(item, withHelp) {
    const disp = item.sys.id === "chuong" ? pigpenSVG(item.conv, item.xMap) : `<div class="tt-cipher">${esc(item.cipher)}</div>`;
    const keyLine = item.clue
      ? `<p style="margin:0 0 8px">${esc(item.clue.text)}<br><span style="color:#666">Khóa không cho sẵn — em hãy suy ra khóa từ dấu hiệu trên.</span></p>`
      : `<p style="margin:0 0 8px">${item.sys.keyInfo(item.key)}</p>`;
    const helpBody = withHelp ? (item.clue ? item.sys.findHelp : item.sys.help(item.key)) : "";
    return `<div class="tt-qbox">
      <p style="margin:0 0 2px"><b>Hệ mật thư: ${esc(item.sys.name)}</b></p>
      ${keyLine}
      ${disp}
      ${withHelp ? `<details style="margin-top:8px"><summary style="cursor:pointer;font-weight:600;color:#0b5cad">${item.clue ? "📖 Cách tìm khóa của hệ này" : "📖 Bảng tra của hệ này"}</summary>${helpBody}</details>` : ""}
    </div>
    <div class="tt-field"><label>Giải mật thư — viết bản tin giải được (theo quy ước lớp như khi nhận Morse, hoặc viết tiếng Việt có dấu):</label>
    <input type="text" class="tt-modinput" data-role="ans" autocomplete="off" placeholder="Ví dụ: DDI HOJC"></div>`;
  }
  function practice() {
    const bar = document.createElement("div");
    bar.className = "tt-modbar";
    bar.innerHTML = `<select data-role="sys" style="flex:1;padding:9px;border-radius:9px;border:1.5px solid #bbb;font-size:14.5px;min-width:170px">
      <option value="">🎲 Ngẫu nhiên hệ mật thư</option>
      ${CIPHER_SYSTEMS.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}
    </select>
    <select data-role="kmode" style="flex:1;padding:9px;border-radius:9px;border:1.5px solid #bbb;font-size:14.5px;min-width:170px">
      <option value="find">🕵️ Tự tìm khóa qua dấu hiệu</option>
      <option value="given">🔑 Cho sẵn khóa (làm quen)</option>
    </select>
    <button type="button" data-role="newq" style="flex:0 1 auto">Câu mới</button>`;
    stage.innerHTML = "";
    stage.appendChild(bar);
    const host = document.createElement("div");
    stage.appendChild(host);
    let item = null, done = false;
    function draw() {
      done = false;
      item = cipherItem(bar.querySelector('[data-role="kmode"]').value, bar.querySelector('[data-role="sys"]').value || null);
      host.innerHTML = itemHTML(item, true);
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "tt-btn"; btn.textContent = "Kiểm tra đáp án";
      btn.addEventListener("click", () => {
        if (done) return;
        done = true;
        const inp = host.querySelector('[data-role="ans"]');
        const ok = cipherAnswerOk(inp.value, item);
        const note = document.createElement("div");
        note.className = ok ? "tt-msg" : "tt-err";
        note.style.display = "block";
        note.style.marginTop = "10px";
        note.innerHTML = (ok
          ? `✅ Đúng rồi! Bản tin là <b>${esc(item.conv)}</b> (${esc(item.phrase)}).`
          : `❌ Chưa đúng. Đáp án đúng: <b>${esc(item.conv)}</b> (${esc(item.phrase)}).`)
          + (item.clue ? `<br>🕵️ Cách tìm khóa: ${esc(item.clue.derive)}` : "");
        host.appendChild(note);
        btn.disabled = true;
      });
      host.appendChild(btn);
    }
    bar.querySelector('[data-role="newq"]').addEventListener("click", draw);
    bar.querySelector('[data-role="sys"]').addEventListener("change", draw);
    bar.querySelector('[data-role="kmode"]').addEventListener("change", draw);
    draw();
  }
  function startTest() {
    const pool = CIPHER_MSGS.filter((m) => convertText(m).replace(/ /g, "").length <= 11);
    const mk = () => {
      const it = cipherItem("find", null);
      if (convertText(it.phrase).replace(/ /g, "").length > 11) { it.phrase = pool[Math.floor(Math.random() * pool.length)]; it.conv = convertText(it.phrase).toUpperCase(); it.cipher = it.sys.enc(it.conv, it.key); if (it.sys.id === "docnguoc") { const made = it.sys.makeFind(it.conv); it.key = made.key; it.clue = made.clue; it.cipher = it.sys.enc(it.conv, it.key); } }
      return it;
    };
    test = { list: Array.from({ length: 10 }, mk), idx: 0, correct: 0, startedAt: Date.now() };
    showTestQ();
  }
  function showTestQ() {
    const item = test.list[test.idx];
    stage.innerHTML = `<p style="text-align:center;color:#555;margin:0 0 8px">Câu ${test.idx + 1}/${test.list.length} — giải mật thư rồi bấm Nộp câu</p>` + itemHTML(item, false);
    const inp = stage.querySelector('[data-role="ans"]');
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "tt-btn"; btn.textContent = test.idx === test.list.length - 1 ? "Nộp câu cuối và xem điểm" : "Nộp câu →";
    btn.addEventListener("click", () => {
      if (cipherAnswerOk(inp.value, item)) test.correct++;
      test.idx++;
      if (test.idx < test.list.length) { showTestQ(); return; }
      const dur = Math.round((Date.now() - test.startedAt) / 1000);
      modSaveHistory("kt-mat-thu", test.correct, test.list.length, "Kiểm tra mật thư — 10 câu", dur);
      const score = (Math.round((test.correct / test.list.length) * 100) / 10).toFixed(1).replace(".", ",");
      stage.innerHTML = `<div class="tt-qbox" style="text-align:center">
        <p style="font-size:19px;margin:4px 0"><b>Hoàn thành bài kiểm tra!</b></p>
        <p>Đúng <b>${test.correct}/${test.list.length}</b> câu — Điểm: <b>${score}/10</b></p>
        <p class="tt-note">Kết quả đã lưu vào Lịch sử của em và sẽ đồng bộ cho thầy khi có mạng.</p></div>`;
      const nb = document.createElement("button");
      nb.type = "button"; nb.className = "tt-btn"; nb.textContent = "Làm bài kiểm tra mới";
      nb.addEventListener("click", startTest);
      stage.appendChild(nb);
    });
    stage.appendChild(btn);
    if (inp) inp.focus();
  }
  practice();
}

/* ---------------- Tài liệu MẬT THƯ ---------------- */
function openCipherDoc() {
  const body = openPanel("🔐 Tài liệu mật thư", true);
  body.innerHTML = `
    <p><b>Mật thư</b> có 3 hệ: <b>thay thế</b> (đổi mỗi chữ thành ký hiệu khác), <b>dời chỗ</b> (giữ nguyên chữ, đổi vị trí), <b>ẩn giấu</b> (giấu tin trong văn bản thường). Bạch văn phải chuyển sang thể thức điện tín theo <b>quy ước của lớp</b> trước khi mã hoá. Bản mật thư mở đầu <b>NW/</b>, kết thúc <b>/AR</b>, khóa ghi sau ký hiệu <b>OTT:</b>.</p>
    <h3 style="margin:14px 0 4px">1. Số thay chữ — thay thế</h3>
    <p>Mỗi chữ thay bằng số thứ tự của nó, đếm vòng tròn từ chữ nhận số 1 của khóa. Khóa thường: A = 1.<br>
    Ví dụ (A = 1): ĐI HỌC → DDI HOJC → <span class="tt-cipher" style="font-size:16px">4-4-9 – 8-15-10-3</span></p>
    <h3 style="margin:14px 0 4px">2. Chữ thay chữ — thay thế</h3>
    <p>Cả bảng chữ cái dịch vòng tròn cùng một số vị trí. Khóa ghi bằng một cặp chữ, ví dụ A = D (dịch 3).</p>
    ${caesarStripHTML(3)}
    <p>Ví dụ (A = D): ĐI HỌC → <span class="tt-cipher" style="font-size:16px">GGL KRMF</span></p>
    <h3 style="margin:14px 0 4px">3. Tọa độ chữ — thay thế</h3>
    <p>25 chữ (bỏ Z) xếp vào bảng 5×5; mỗi chữ ghi bằng (chữ hàng)(số cột). Bảng có thể dựng bằng một từ khóa: điền chữ của từ khóa trước (bỏ trùng) rồi điền tiếp các chữ còn lại.</p>
    ${coordTableHTML()}
    <p>Ví dụ: ĐI THEO DẤU → <span class="tt-cipher" style="font-size:16px">A4-A4-B4 / D5-B3-A5-C5 / A4-A1-A1-D4-E1</span></p>
    <h3 style="margin:14px 0 4px">4. Mật thư chuồng — thay thế bằng hình</h3>
    <p>Mỗi chữ vẽ bằng khung của ô chứa nó; chữ thứ hai trong ô thêm dấu chấm. Lưới nhọn (S·T, W·X, Y·Z, U·V) có thể xoay theo khóa.</p>
    ${pigpenRefSVG()}
    <p>Ví dụ — VỀ TRẠI (VEEF TRAJI):</p>
    ${pigpenSVG("VEEF TRAJI")}
    <h3 style="margin:14px 0 4px">5. Đọc ngược — dời chỗ</h3>
    <p>Đảo ngược từng tiếng (HOJC → CJOH) hoặc đảo ngược toàn bộ bản tin. Ví dụ: HỌC TỐT → <span class="tt-cipher" style="font-size:16px">CJOH TSOOT</span></p>
    <h3 style="margin:14px 0 4px">🕵️ Tìm khóa qua câu dấu hiệu</h3>
    <p>Trong đề thật, khóa <b>không ghi thẳng</b> mà giấu trong một câu dấu hiệu (OTT). Cách nhận ra:</p>
    <p>• <b>Số thay chữ:</b> câu chỉ mặt chữ nhận số 1. Ví dụ: “Nước Việt Nam là một” → đất nước hình chữ <b>S</b> và là <b>một</b> → <b>S = 1</b>, đếm vòng tròn từ S.<br>
    • <b>Chữ thay chữ:</b> câu dạng “tên một bạn đi chăn một con vật”: chữ đầu của tên là chữ thật, chữ đầu của con vật là chữ mật. Ví dụ: “An đi chăn dê” → A viết thành D → dịch 3.<br>
    • <b>Tọa độ chữ:</b> từ đầu tiên của câu dấu hiệu là từ khóa dựng bảng. Ví dụ: “HOA nở rộ…” → từ khóa HOA.<br>
    • <b>Chuồng:</b> câu cho biết cặp chữ nào của lưới nhọn ở trên cùng; bốn cặp S·T → W·X → Y·Z → U·V nằm trên một vòng theo chiều kim đồng hồ, một cặp lên trên thì cả vòng xoay theo.<br>
    • <b>Đọc ngược:</b> nhìn tiếng mẫu trong dấu hiệu — tiếng mẫu còn đúng vị trí là đảo ngược từng tiếng; tiếng cuối của bản tin thật chạy lên đầu là đảo ngược toàn bộ.</p>
    <p class="tt-note">Dạng nâng cao (đọc thêm): CAM RANH — viết bản tin thành hàng dưới một từ khóa rồi đọc cột theo thứ tự bảng chữ cái của khóa; tọa độ số có từ khóa — như tọa độ chữ nhưng ghi bằng cặp số; ẩn giấu — đọc cách dòng, nhảy cóc, bỏ chữ giả… theo quy tắc đi kèm.</p>`;
}

/* ---------------- Dung lượng Firebase (chỉ quản trị) ----------------
   Số lần Đọc/Ghi/Xoá và % hạn mức gói Spark CHỈ có trên trang chính
   thức của Google — Google không cấp các số này cho trang web đọc
   trực tiếp, nên nút này mở đúng trang Usage của dự án (số liệu thật,
   cập nhật trực tiếp từ Firebase, cần đăng nhập tài khoản Google của
   thầy). Trong panel hiển thị thêm số bản ghi thật đang lưu trong
   ứng dụng, đếm trực tiếp từ Firestore ngay lúc mở. */
async function openUsagePanel() {
  const body = openPanel("📊 Dung lượng Firebase", true);
  const pid = (cfg && cfg.projectId) || "";
  const usageUrl = "https://console.firebase.google.com/project/" + pid + "/usage";
  const fsUsageUrl = "https://console.firebase.google.com/project/" + pid + "/firestore/usage";
  body.innerHTML = `
    <p style="line-height:1.55"><b>Số liệu hạn mức thật (Đọc / Ghi / Xoá / % gói Spark)</b> chỉ xem được trên trang chính thức của Firebase — trang web không đọc trực tiếp được các số này. Thầy bấm nút dưới đây là mở đúng trang đó của dự án <b>${esc(pid)}</b> (đăng nhập sẵn tài khoản Google của thầy thì vào thẳng):</p>
    <div class="tt-acts" style="margin:10px 0 14px">
      <button id="tt-use-open">📈 Mở trang Dung lượng Firebase (trang như ảnh thầy gửi)</button>
      <button id="tt-use-fs">🔥 Mở biểu đồ Firestore</button>
    </div>
    <p style="line-height:1.55"><b>Dữ liệu thật đang lưu trong ứng dụng</b> (em đếm trực tiếp từ Firestore ngay lúc này):</p>
    <div id="tt-use-counts"><p>Đang đếm…</p></div>
    <p class="tt-note">Hạn mức gói Spark để đối chiếu trên trang chính thức: Đọc 50.000 lần/ngày · Ghi 20.000 lần/ngày · Xoá 20.000 lần/ngày · Dữ liệu lưu tối đa 1 GB. Với quy mô một lớp học, mức dùng hiện tại còn rất xa hạn mức.</p>`;
  body.querySelector("#tt-use-open").addEventListener("click", () => window.open(usageUrl, "_blank"));
  body.querySelector("#tt-use-fs").addEventListener("click", () => window.open(fsUsageUrl, "_blank"));
  const box = body.querySelector("#tt-use-counts");
  try {
    const [p, h, s, a] = await Promise.all([
      getCountFromServer(collection(db, "profiles")),
      getCountFromServer(collection(db, "history")),
      getCountFromServer(collection(db, "schools")),
      getCountFromServer(collection(db, "admins"))
    ]);
    const rows = [
      ["👤 Thành viên (hồ sơ tài khoản)", p.data().count],
      ["🕘 Bài làm đã đồng bộ (lịch sử)", h.data().count],
      ["🏫 Trường học", s.data().count],
      ["🛠 Quản trị viên", a.data().count]
    ];
    box.innerHTML = `<div style="overflow-x:auto"><table class="tt-table"><thead><tr><th>Dữ liệu</th><th>Số bản ghi</th></tr></thead><tbody>${
      rows.map((r) => `<tr><td>${r[0]}</td><td><b>${r[1]}</b></td></tr>`).join("")
    }</tbody></table></div>`;
  } catch (e) {
    box.innerHTML = `<div class="tt-err" style="display:block">${esc(errText(e.code))}</div>`;
  }
}

/* ---------------- AI tạo bản tin ---------------- */
function seenSet() {
  try { return new Set(JSON.parse(localStorage.getItem("tt_ai_seen") || "[]")); } catch (e) { return new Set(); }
}
function rememberSeen(conv) {
  const s = seenSet(); s.add(conv);
  try { localStorage.setItem("tt_ai_seen", JSON.stringify([...s].slice(-400))); } catch (e) {}
}
/* Các bản tin AI gần nhất (nguyên văn) — đưa vào prompt để AI
   tránh lặp lại, đồng thời là một lớp chống trùng nữa. */
function recentRaws() {
  try { return JSON.parse(localStorage.getItem("tt_ai_raws") || "[]"); } catch (e) { return []; }
}
function rememberRaw(t) {
  const a = recentRaws(); a.push(t);
  try { localStorage.setItem("tt_ai_raws", JSON.stringify(a.slice(-14))); } catch (e) {}
}
/* Vũ trụ "đã dùng" để chống trùng TUYỆT ĐỐI trên máy này: mọi câu
   AI đã tạo + toàn bộ ngân hàng câu hệ thống + mọi bản tin đã
   nộp trong lịch sử làm bài. */
function allSeenSet() {
  const s = seenSet();
  try { if (typeof BANK !== "undefined" && Array.isArray(BANK)) BANK.forEach(b => s.add(convertText(b.s))); } catch (e) {}
  try { loadLocalHist().forEach(e => { if (e && e.msg) s.add(convertText(e.msg)); }); } catch (e) {}
  recentRaws().forEach(t => s.add(convertText(t)));
  return s;
}

const AI_ASPECTS = [
  "buổi chào cờ đầu tuần", "giờ ra chơi", "buổi sinh hoạt Đội", "trên đường đến trường",
  "trong thư viện trường", "giờ thể dục", "buổi lao động vệ sinh", "ngày hội đọc sách",
  "lớp học xanh sạch đẹp", "đội sao đỏ trực tuần", "tiết học ngoài trời", "buổi tập nghi thức Đội",
  "giờ ăn bán trú", "buổi tập văn nghệ", "ngày hội thể thao", "góc học tập ở nhà"
];
/* ============================================================
   KHÓA GEMINI — RIÊNG, DÙNG CHUNG VÀ XOAY VÒNG
   - Khóa riêng: người dùng tự nhập (nút 🔑 xanh), lưu trên máy.
   - Khi lưu, khóa cũng vào KHO DÙNG CHUNG (Firestore "apiKeys")
     để hệ thống tự xoay vòng: khóa đang dùng hết hạn mức (429)
     thì chuyển khóa khác; khóa hỏng hẳn (401 / khóa không hợp lệ)
     thì TỰ XOÁ khỏi kho.
   - Chỉ tài khoản được quản trị tích "Key chung" (useSharedKeys)
     hoặc quản trị mới đọc/dùng được kho. Khóa cũ ở config/ai
     (quản trị đặt) vẫn được dùng như một khóa dự phòng cuối.
   ============================================================ */
function keyHash(k) { let h = 5381; for (let i = 0; i < k.length; i++) h = ((h << 5) + h + k.charCodeAt(i)) >>> 0; return "k" + h.toString(36) + "_" + k.length; }
function maskKey(k) { return k ? k.slice(0, 6) + "…" + k.slice(-4) : ""; }
function poolEntitled() { return myIsAdmin || (myProfile && myProfile.useSharedKeys === true); }

let _pool = null; // [{id, key, addedByName, at, status, statusDay}]
async function loadKeyPool(force) {
  if (_pool && !force) return _pool;
  _pool = [];
  try {
    const snap = await getDocs(collection(db, "apiKeys"));
    snap.forEach((d) => {
      const v = d.data() || {};
      if (v.key) _pool.push({ id: d.id, key: v.key, addedByName: v.addedByName || "", at: v.addedAt && v.addedAt.toDate ? v.addedAt.toDate().getTime() : 0, status: v.status || "ok", statusDay: v.statusDay || "", checkedAt: v.checkedAt || 0 });
    });
    _pool.sort((a, b) => a.at - b.at);
  } catch (e) {}
  return _pool;
}
async function contributeKeyToPool(k) {
  try {
    const id = keyHash(k);
    const ref = doc(db, "apiKeys", id);
    const s = await getDoc(ref);
    if (s.exists()) return true;
    const who = displayName(myProfile) || (myProfile && myProfile.username) || "";
    await setDoc(ref, {
      key: k,
      addedBy: auth && auth.currentUser ? auth.currentUser.uid : "",
      addedByName: who,
      addedAt: serverTimestamp(),
      status: "ok", statusDay: ""
    });
    if (_pool) _pool.push({ id, key: k, addedByName: who, at: Date.now(), status: "ok", statusDay: "" });
    return true;
  } catch (e) { return false; }
}
async function markPoolKey(entry, status) {
  entry.status = status; entry.statusDay = todayStr();
  try { await updateDoc(doc(db, "apiKeys", entry.id), { status, statusDay: entry.statusDay }); } catch (e) {}
}
async function deletePoolKey(entry) {
  if (_pool) _pool = _pool.filter((x) => x.id !== entry.id);
  try { await deleteDoc(doc(db, "apiKeys", entry.id)); }
  catch (e) { try { await updateDoc(doc(db, "apiKeys", entry.id), { status: "error", statusDay: todayStr() }); } catch (_) {} }
}
/* KIỂM TRA THẬT một khóa trong kho: gọi thử Gemini một câu cực
   ngắn để biết tình trạng ĐÚNG LÚC NÀY (trước đây tình trạng chỉ
   đổi khi chính ứng dụng vấp lỗi, nên khóa hết hạn mức ở nơi
   khác vẫn báo "Tốt"). Kết quả: 200 → tốt, 429 → hết quota,
   401/khóa sai → lỗi; mạng treo thì giữ nguyên (chưa kết luận
   được). Ghi kèm thời điểm kiểm tra để quản trị biết độ tươi. */
async function verifyPoolKey(entry) {
  let verdict = null;
  try {
    /* Dò model của chính khóa này trước (mỗi tài khoản một tập
       model khác nhau — gọi cứng một model sẽ oan cho khóa tốt
       bằng lỗi 404), rồi gọi thử bằng model đầu tiên dùng được. */
    const models = await modelsForKey(entry.key).catch((e) => { if (e && e.status === 401) verdict = "error"; return []; });
    for (const name of models.slice(0, 3)) {
      if (verdict) break;
      try {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 6000);
        let resp;
        try {
          resp = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + name + ":generateContent", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": entry.key },
            body: JSON.stringify({
              contents: [{ parts: [{ text: "Chào" }] }],
              generationConfig: { maxOutputTokens: 5, thinkingConfig: { thinkingBudget: 0 } }
            }),
            signal: ctl.signal
          });
        } finally { clearTimeout(timer); }
        if (resp.ok) verdict = "ok";
        else if (resp.status === 429) verdict = "quota";
        else if (resp.status === 401) verdict = "error";
        else if (resp.status === 400) {
          const t = await resp.text().catch(() => "");
          if (/API key not valid/i.test(t)) verdict = "error";
        }
        /* 404: model này tài khoản không có — thử model kế tiếp */
      } catch (e) { /* treo/mất mạng ở model này: thử model kế */ }
    }
  } catch (e) { /* chưa kết luận được */ }
  entry.checkedAt = Date.now();
  if (verdict && verdict !== entry.status) {
    entry.status = verdict;
    if (verdict === "quota") entry.statusDay = todayStr();
    try { await updateDoc(doc(db, "apiKeys", entry.id), { status: verdict, statusDay: entry.statusDay || "", checkedAt: entry.checkedAt }); } catch (e) {}
  } else {
    try { await updateDoc(doc(db, "apiKeys", entry.id), { checkedAt: entry.checkedAt }); } catch (e) {}
  }
  return verdict;
}

/* Khóa chung kiểu cũ ở config/ai (quản trị dán ở các bản trước). */
let _gemKey = null, _gemKeyTried = false;
async function sharedCfgKey() {
  if (_gemKeyTried) return _gemKey;
  _gemKeyTried = true;
  try {
    const s = await getDoc(doc(db, "config", "ai"));
    if (s.exists()) _gemKey = (s.data().geminiApiKey || "").trim() || null;
  } catch (e) {}
  return _gemKey;
}
/* Khóa Gemini RIÊNG của người dùng, tự nhập qua nút 🔑 xanh —
   chỉ lưu trên máy này (localStorage), không đồng bộ đi đâu. */
let _myKey = "";
try { _myKey = (localStorage.getItem("tt_my_gemini_key") || "").trim(); } catch (e) {}

/* Danh sách khóa ứng viên theo thứ tự ưu tiên: khóa trong file
   cấu hình (nếu có) → khóa riêng → kho dùng chung (nếu được
   phép) → khóa chung kiểu cũ. Khóa hết quota trong NGÀY bị bỏ
   qua (quota Gemini tính theo ngày, mai dùng lại được). */
async function geminiKeyCandidates() {
  const cand = [];
  const push = (key, srcName, entry) => { if (key && !cand.some((c) => c.key === key)) cand.push({ key, src: srcName, entry: entry || null }); };
  if (cfg && cfg.geminiApiKey) push(cfg.geminiApiKey, "cfg");
  if (_myKey) push(_myKey, "own");
  if (poolEntitled()) {
    const pool = await loadKeyPool();
    for (const en of pool) {
      if (en.status === "quota" && en.statusDay === todayStr()) continue;
      push(en.key, "pool", en);
    }
  }
  const legacy = await sharedCfgKey();
  if (legacy) push(legacy, "shared");
  return cand;
}
async function runtimeGeminiKey() {
  const c = await geminiKeyCandidates();
  return c.length ? c[0].key : null;
}

/* Panel nhập khóa Gemini riêng (nút 🔑 xanh trên thanh ghim,
   chỉ tài khoản được dùng AI mới có nút này). */
function openMyKeyPanel() {
  const body = openPanel("🔑 Khóa Gemini của bạn");
  const paint = () => {
    body.innerHTML = `
      <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" style="display:block;text-align:center;background:#1d9d55;color:#fff;font-weight:700;padding:11px;border-radius:9px;text-decoration:none;margin-bottom:10px">🔗 Mở trang lấy khóa Gemini miễn phí (AI Studio)</a>
      <p>Trạng thái: <b>${_myKey ? "đã lưu khóa riêng (…" + _myKey.slice(-4) + ")" : "chưa có khóa riêng"}</b></p>
      <div class="tt-field"><input id="mykey-inp" type="password" placeholder="Dán khóa Gemini của bạn vào đây…"></div>
      <div style="display:flex;gap:8px">
        <button class="tt-btn" id="mykey-save" style="flex:1">💾 Lưu khóa</button>
        ${_myKey ? '<button class="tt-btn" id="mykey-clear" style="flex:1;background:#842029">🗑 Xoá khóa riêng</button>' : ""}
      </div>
      <p id="mykey-msg" style="font-size:13px;margin-top:8px"></p>`;
    const msg = body.querySelector("#mykey-msg");
    body.querySelector("#mykey-save").addEventListener("click", async () => {
      const v = (body.querySelector("#mykey-inp").value || "").trim();
      if (v.length < 20) { msg.textContent = "Khóa có vẻ chưa đúng (quá ngắn)."; return; }
      _myKey = v;
      try { localStorage.setItem("tt_my_gemini_key", v); } catch (e) {}
      contributeKeyToPool(v); // âm thầm thêm vào kho dùng chung
      setAiBroken(false); // có khóa mới: nút AI hoạt động trở lại
      msg.textContent = "Đã lưu thành công ✔";
      paint();
      const m2 = body.querySelector("#mykey-msg");
      if (m2) m2.textContent = "Đã lưu thành công ✔";
    });
    const clr = body.querySelector("#mykey-clear");
    if (clr) clr.addEventListener("click", () => {
      _myKey = "";
      try { localStorage.removeItem("tt_my_gemini_key"); } catch (e) {}
      paint();
    });
  };
  paint();
}

/* ============================================================
   DÒ MODEL THEO TỪNG KHÓA — biện pháp triệt để cho lỗi 404.
   Mỗi tài khoản Google được cấp MỘT TẬP MODEL KHÁC NHAU (tài
   khoản này có gemini-3.5-flash, tài khoản khác lại không có —
   gọi nhầm model là Google trả 404 dù khóa hoàn toàn tốt).
   Vì vậy ứng dụng KHÔNG chốt cứng tên model nữa: với mỗi khóa,
   nó hỏi Google "khóa này dùng được những model nào" (API
   listModels), sắp xếp theo ưu tiên rồi thử lần lượt; model
   nào gọi thành công được ghi nhớ (trên máy + bộ nhớ phiên) để
   lần sau đi thẳng. Model bị 404 thì tự rớt khỏi danh sách của
   khóa đó. Hạn mức miễn phí của Google tính RIÊNG TỪNG MODEL:
   model này hết lượt ngày thì model khác của cùng khóa vẫn còn
   — cơ chế dưới đây ghi nhớ (khóa, model) nào đã hết lượt hôm
   nay / đang chờ hồi theo phút để không gọi phí lượt. */
const _modelCache = {};   /* keyHash -> [tên model theo thứ tự ưu tiên] */
const _modelCooldown = {}; /* keyHash|model -> mốc ms hết chờ (429 theo phút) */
function orderModels(list) {
  const score = (n) => {
    let s = 100;
    if (/flash-lite/i.test(n)) s = 0;        /* lite: hạn mức miễn phí/ngày cao nhất, trả lời nhanh */
    else if (/flash/i.test(n)) s = 10;
    else if (/pro/i.test(n)) s = 40;         /* pro: hạn mức miễn phí rất thấp, để sau cùng */
    if (/preview|exp/i.test(n)) s += 25;     /* bản thử nghiệm: kém ổn định */
    const ver = parseFloat((n.match(/(\d+\.\d+)/) || [0, 0])[1]) || 0;
    return s - ver;                          /* cùng hạng: bản mới hơn xếp trước */
  };
  return [...list].sort((a, b) => score(a) - score(b));
}
async function modelsForKey(key, dl) {
  const h = keyHash(key);
  if (_modelCache[h]) return _modelCache[h];
  let stored = null;
  try { const s = localStorage.getItem("tt_models_" + h); if (s) stored = JSON.parse(s); } catch (e) {}
  let list = null;
  try {
    const ctl = new AbortController();
    const remain = dl ? dl - Date.now() : 6000;
    const timer = setTimeout(() => ctl.abort(), Math.max(800, Math.min(6000, remain)));
    let resp;
    try {
      resp = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
        headers: { "x-goog-api-key": key }, signal: ctl.signal
      });
    } finally { clearTimeout(timer); }
    if (resp.status === 401) { const e = new Error("gemini-http-401"); e.status = 401; throw e; }
    if (resp.ok) {
      const data = await resp.json();
      list = (data.models || [])
        .filter((m) => ((m.supportedGenerationMethods || []).includes("generateContent")))
        .map((m) => String(m.name || "").replace(/^models\//, ""))
        .filter((n) => n && !/embedding|tts|image|audio|robotics|computer-use|aqa/i.test(n));
    }
  } catch (e) { if (e && e.status === 401) throw e; /* lỗi mạng khi dò: dùng danh sách dự phòng bên dưới */ }
  let ordered;
  if (list && list.length) ordered = orderModels(list);
  else ordered = ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"];
  if (stored && stored.length) ordered = [...stored.filter((m) => ordered.includes(m)), ...ordered.filter((m) => !stored.includes(m))];
  _modelCache[h] = ordered;
  return ordered;
}
function noteModelWorks(key, name) {
  const h = keyHash(key);
  const cur = _modelCache[h] || [];
  _modelCache[h] = [name, ...cur.filter((m) => m !== name)];
  try { localStorage.setItem("tt_models_" + h, JSON.stringify(_modelCache[h].slice(0, 6))); } catch (e) {}
}
function removeModelForKey(key, name) {
  const h = keyHash(key);
  if (_modelCache[h]) _modelCache[h] = _modelCache[h].filter((m) => m !== name);
  try { const s = localStorage.getItem("tt_models_" + h); if (s) localStorage.setItem("tt_models_" + h, JSON.stringify(JSON.parse(s).filter((m) => m !== name))); } catch (e) {}
}
function modelExhaustedToday(key, name) {
  try { return localStorage.getItem("tt_q_" + keyHash(key) + "_" + name) === todayStr(); } catch (e) { return false; }
}
function markModelExhaustedToday(key, name) {
  try { localStorage.setItem("tt_q_" + keyHash(key) + "_" + name, todayStr()); } catch (e) {}
}
function modelCooling(key, name) {
  const until = _modelCooldown[keyHash(key) + "|" + name] || 0;
  return Date.now() < until;
}
function markModelCooldown(key, name, ms) {
  _modelCooldown[keyHash(key) + "|" + name] = Date.now() + ms;
}

/* Gọi Gemini trực tiếp bằng MỘT khóa: thử lần lượt các model
   MÀ KHÓA ĐÓ THẬT SỰ CÓ (xem modelsForKey). Phân loại lỗi:
   404 = tài khoản không có model này → bỏ model, thử model kế;
   429 theo NGÀY = model này hết lượt hôm nay → ghi nhớ, thử
   model kế của CÙNG khóa; 429 theo PHÚT = model này chờ ~60
   giây → ghi nhớ ngắn hạn, thử tiếp; 503 = model quá tải → thử
   model kế; 401/400-khóa-sai = khóa hỏng hẳn → ném lên ngay để
   nơi gọi xử lý khóa (xoay khóa khác / tự xoá khỏi kho). */
async function callGeminiDirect(gk, prompt, splitLines, dl) {
  const models = await modelsForKey(gk, dl); /* ném 401 nếu khóa chết — nơi gọi xử lý */
  let lastErr = null;
  let tried = 0;
  let skippedExhausted = 0;
  for (const name of models) {
    if (tried >= 4) break;
    if (modelExhaustedToday(gk, name) || modelCooling(gk, name)) { skippedExhausted++; continue; }
    if (dl && Date.now() > dl) throw new Error("ai-timeout");
    tried++;
    const remain = dl ? dl - Date.now() : 8000;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), Math.max(800, Math.min(8000, remain)));
    let resp;
    try {
      resp = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + name + ":generateContent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": gk },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          /* thinkingBudget 0: TẮT phần "suy nghĩ" của model —
             việc soạn câu ngắn không cần suy luận; tắt đi thì
             trả lời nhanh (~2–3 giây), đủ câu và sạch, bật thì
             model ăn hết ngân sách token vào suy nghĩ khiến câu
             bị cắt cụt, lẫn chú thích lạ. */
          generationConfig: { temperature: 1.15, topP: 0.95, maxOutputTokens: 500, thinkingConfig: { thinkingBudget: 0 } }
        }),
        signal: ctl.signal
      });
    } catch (e) { lastErr = e; continue; /* treo/mất mạng ở model này: thử model kế */ }
    finally { clearTimeout(timer); }
    if (!resp.ok) {
      const e = new Error("gemini-http-" + resp.status);
      e.status = resp.status;
      try { e.bodyHint = (await resp.text()).slice(0, 300); } catch (_) {}
      if (resp.status === 401 || (resp.status === 400 && /API key not valid/i.test(e.bodyHint || ""))) throw e; /* khóa hỏng hẳn */
      if (resp.status === 404) { removeModelForKey(gk, name); lastErr = e; continue; } /* tài khoản không có model này */
      if (resp.status === 429) {
        if (/per ?day|PerDay|DAILY/i.test(e.bodyHint || "")) markModelExhaustedToday(gk, name);
        else markModelCooldown(gk, name, 60000);
        lastErr = e; continue;
      }
      if (resp.status === 503) { lastErr = e; await new Promise(r => setTimeout(r, 600)); continue; }
      lastErr = e; continue;
    }
    const data = await resp.json();
    const parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
    const lines = splitLines(parts.filter(p => !p.thought).map(p => p.text || "").join("\n"));
    if (lines.length) { noteModelWorks(gk, name); return lines; }
    lastErr = new Error("gemini-empty");
  }
  /* Không thử được model nào vì tất cả đã hết lượt hôm nay /
     đang chờ hồi: báo 429 để nơi gọi xoay sang khóa khác. */
  if (!tried && skippedExhausted && !lastErr) { const e = new Error("gemini-http-429"); e.status = 429; throw e; }
  throw lastErr || new Error("gemini-direct-failed");
}

/* Gợi ý mở rộng cho 6 chủ đề chuẩn của thầy (Đội, Nhi đồng,
   Bác Hồ, Lịch sử, Địa danh, Trường lớp) để AI viết đúng chất
   thiếu nhi, đúng phạm vi từng chủ đề. */
const THEME_HINTS = {
  "Đội": "sinh hoạt Đội Thiếu niên Tiền phong Hồ Chí Minh: khăn quàng đỏ, chào cờ, sinh hoạt chi đội, đội viên gương mẫu",
  "Nhi đồng": "các em nhi đồng, sao nhi đồng, hoạt động vui chơi và học tập của trẻ nhỏ",
  "Bác Hồ": "Bác Hồ kính yêu, tình cảm của thiếu nhi đối với Bác, Năm điều Bác Hồ dạy",
  "Lịch sử": "lịch sử Việt Nam, truyền thống yêu nước, các anh hùng dân tộc",
  "Địa danh": "địa danh nổi tiếng, cảnh đẹp quê hương đất nước Việt Nam",
  "Trường lớp": "trường học, lớp học, thầy cô giáo và bạn bè"
};

async function aiCandidates(theme, level, exclude, deadlineTs, wordsAdj) {
  const dl = deadlineTs || (Date.now() + 20000);
  /* Số từ gợi ý theo mức, có thể dịch ngắn/dài theo phản hồi độ
     lệch của vòng trước (wordsAdj): câu lệch dải bị BỎ và viết
     lại câu khác đúng cỡ — không bao giờ cắt câu cho vừa dải. */
  const WORDS = { de: [3, 5], tb: [5, 7], kho: [7, 10], nc: [9, 12] };
  const wb = WORDS[level] || WORDS.tb;
  const adj = wordsAdj || 0;
  const wLo = Math.max(2, wb[0] + adj);
  const wHi = Math.max(wLo + 1, wb[1] + adj);
  const words = wLo + " đến " + wHi + " từ";
  const lenHint = adj < 0
    ? " LƯU Ý: lần thử trước các câu đều QUÁ DÀI so với yêu cầu — lần này viết câu NGẮN HƠN hẳn, súc tích."
    : adj > 0
      ? " LƯU Ý: lần thử trước các câu đều QUÁ NGẮN so với yêu cầu — lần này viết câu DÀI HƠN, đầy đủ ý hơn."
      : "";
  const numReq = level === "nc"
    ? "Mỗi câu kèm đúng MỘT nhóm số viết bằng chữ số (ví dụ 25 hoặc 150), viết liền trong câu, tuyệt đối không đặt số trong dấu ngoặc."
    : "Câu không chứa bất kỳ chữ số nào.";
  const aspect = AI_ASPECTS[Math.floor(Math.random() * AI_ASPECTS.length)];
  const avoid = (exclude && exclude.length)
    ? " Tuyệt đối KHÔNG lặp lại, không viết gần giống các câu sau đây: " + exclude.map(x => "“" + x + "”").join("; ") + "."
    : "";
  const hint = THEME_HINTS[theme] || theme;
  const prompt = `Bạn là giáo viên tiểu học Việt Nam. Viết 10 câu TIẾNG VIỆT THUẦN, có dấu tiếng Việt đầy đủ, mỗi câu đúng một dòng. Chủ đề: ${theme} — cụ thể về ${hint}. Bối cảnh gợi ý cho một vài câu: ${aspect}. Nội dung tích cực, trong sáng, phù hợp học sinh tiểu học. Mỗi câu khoảng ${words}. ${numReq}
QUY TẮC BẮT BUỘC về hình thức: mỗi câu CHỈ gồm chữ cái tiếng Việt và khoảng trắng${level === "nc" ? " cùng nhóm chữ số theo yêu cầu trên" : ""}. TUYỆT ĐỐI KHÔNG dùng: tiếng Anh hay bất kỳ ngoại ngữ nào, dấu ngoặc ( ), dấu hai chấm, dấu chấm hoặc dấu phẩy, dấu nháy đơn hay nháy kép, dấu gạch nối, mọi ký tự đặc biệt khác. Mười câu khác nhau hoàn toàn về nội dung và cách diễn đạt.${avoid}${lenHint} Chỉ in ra đúng 10 câu, không giải thích, không thêm bất kỳ ký tự nào khác.`;
  const splitLines = (text) => String(text || "").split(/\n+/).map((x) => x.replace(/^[\d\-.)\s"“”]+/, "").replace(/["“”.]+\s*$/, "").trim()).filter((x) => x.length > 2);
  /* ĐƯỜNG 1 — Gemini trực tiếp, XOAY VÒNG các khóa: riêng →
     kho dùng chung → khóa chung cũ. Hết quota (429): ghi nhận
     rồi chuyển khóa. Khóa hỏng hẳn (401 / "API key not valid"):
     tự xoá khỏi kho (và bỏ khóa riêng trên máy nếu là khóa đó)
     rồi chuyển khóa. Model quá tải (503): không xoay khóa —
     báo lên để người dùng thử lại sau. */
  const cand = await geminiKeyCandidates();
  if (cand.length) {
    let lastErr = null;
    for (const c of cand) {
      /* Hạn chót 20 giây cho TOÀN BỘ quá trình tạo bằng AI:
         quá hạn thì dừng ngay (ai-timeout) để kịp tạo bản tin
         thường cho lần bấm này, không chờ thêm. */
      if (Date.now() > dl) throw new Error("ai-timeout");
      try {
        const lines = await callGeminiDirect(c.key, prompt, splitLines, dl);
        /* Khóa trong kho gọi thành công mà tình trạng đang ghi
           khác "tốt" → tự chữa về "tốt" cho đúng thực tế. */
        if (c.src === "pool" && c.entry && c.entry.status !== "ok") { try { await markPoolKey(c.entry, "ok"); } catch (_) {} }
        return lines;
      } catch (e) {
        lastErr = e;
        if (e.status === 503) throw e;
        if (e.status === 429) {
          if (c.src === "pool" && c.entry) await markPoolKey(c.entry, "quota");
          continue;
        }
        if (e.status === 401 || (e.status === 400 && /API key not valid/i.test(e.bodyHint || ""))) {
          if (c.src === "pool" && c.entry) await deletePoolKey(c.entry);
          if (c.src === "own") { _myKey = ""; try { localStorage.removeItem("tt_my_gemini_key"); } catch (_) {} }
          if (c.src === "shared") {
            _gemKey = null;
            /* Gỡ luôn khóa chết khỏi config/ai để các lần sau
               không vấp lại (chỉ quản trị ghi được — tài khoản
               thường thì lệnh này tự bị Rules chặn, bỏ qua). */
            try { await setDoc(doc(db, "config", "ai"), { geminiApiKey: "" }, { merge: true }); } catch (_) {}
          }
          continue;
        }
      }
    }
    throw lastErr || new Error("all-keys-failed");
  }
  /* ĐƯỜNG 2 — Firebase AI Logic (khi không có khóa nào). */
  const mod = await import("https://www.gstatic.com/firebasejs/12.4.0/firebase-ai.js");
  const ai = mod.getAI(app, { backend: new mod.GoogleAIBackend() });
  const models = ["gemini-3.5-flash", "gemini-3.8-flash"];
  let lastErr = null;
  for (const name of models) {
    if (Date.now() > dl) throw new Error("ai-timeout");
    try {
      const model = mod.getGenerativeModel(ai, { model: name, generationConfig: { temperature: 1.15, topP: 0.95 } });
      const res = await model.generateContent(prompt);
      return splitLines(res.response.text());
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("AI unavailable");
}

/* NGUYÊN TẮC ĐỘ DÀI (theo yêu cầu của thầy): bản tin phải đúng
   dải ký tự của mức độ NHƯNG câu phải trọn vẹn ngữ pháp và đủ
   nghĩa — TUYỆT ĐỐI không cắt bớt từ của câu, không chắp thêm
   từ cho đủ dài. Cách làm: chỉ CHỌN câu vốn đã nằm trong dải
   (câu AI viết tự nhiên đạt dải, câu ngân hàng trọn vẹn); câu
   lệch dải thì bỏ và soạn/chọn câu khác. Hàm ép dải cũ
   (fitToBand) đã bị xoá hẳn theo nguyên tắc này. */

/* Chống trùng dạng "biến thể": một câu đã dùng cộng thêm vài từ
   (hoặc bản rút gọn của một câu đã dùng dài hơn) cũng coi là
   trùng — so khớp tiền tố theo từ trên dạng đã chuyển đổi. */
function variantOfSeen(text, seen) {
  const w = convertText(text).split(" ").filter(Boolean);
  if (w.length < 3) return false;
  for (const s of seen) {
    const sw = s.split(" ").filter(Boolean);
    if (sw.length >= 3 && sw.length <= w.length && sw.every((x, i) => x === w[i])) return true;
    if (w.length >= 3 && w.length < sw.length && w.every((x, i) => x === sw[i])) return true;
  }
  return false;
}

/* Tạo bản tin bằng AI THẬT (Gemini qua Firebase AI Logic):
   - Mỗi lần gọi AI viết 10 câu mới xoay quanh chủ đề (chủ đề đổi
     ngẫu nhiên từng vòng) + một bối cảnh gợi ý ngẫu nhiên, nhiệt
     độ sáng tạo cao — nội dung đa dạng, không theo khuôn mẫu.
   - KHÔNG BAO GIỜ TRÙNG: câu được chọn phải chưa từng xuất hiện
     trong "vũ trụ đã dùng" (câu AI đã tạo trên máy này + ngân
     hàng hệ thống + bản tin đã nộp); các câu gần nhất còn được
     ghi vào prompt để AI tránh lặp. Câu AI bị trùng hoặc là bản
     rút gọn của câu đã dùng đều bị loại.
   - Độ dài: chỉ nhận câu AI viết TỰ NHIÊN đã nằm trong dải của
     mức đã cài — câu lệch dải thì bỏ, vòng sau nhắc AI viết
     ngắn/dài lại. Không cắt, không chắp từ vào câu của AI.
   - Không còn bộ tạo dự phòng lặng lẽ thay thế: AI không dùng
     được (chưa bật AI Logic / lỗi mạng / hết lượt) thì báo rõ
     để người dùng biết, tuyệt đối không đưa câu ghép sẵn. */
/* BỘ LỌC CỨNG cho câu AI viết — chỉ nhận câu TIẾNG VIỆT THUẦN:
   - không chứa ký tự lạ: dấu ngoặc, hai chấm, nháy, gạch nối,
     chấm/phẩy và mọi ký tự đặc biệt (loại hẳn kiểu lỗi như
     "LET'S COUNT: CHÚNG (1) EM");
   - bắt buộc có dấu tiếng Việt (câu toàn chữ không dấu kiểu
     tiếng Anh bị loại);
   - số: dưới Nâng cao không được có chữ số; Nâng cao tối đa
     đúng một nhóm số. */
const VN_MARKED = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i;
function isCleanVn(text, level) {
  const t = String(text || "").trim();
  if (t.length < 3) return false;
  if (/[():'".,!?;\/\\@#$%^&*_=+<>\[\]{}|~`-]/.test(t)) return false;
  if (!VN_MARKED.test(t)) return false;
  const groups = t.match(/\d+/g) || [];
  if (level === "nc") return groups.length <= 1;
  return groups.length === 0;
}

/* ============================================================
   KHO ĐỆM BẢN TIN AI — để MỘT khóa tạo được THẬT NHIỀU bản tin.
   Mỗi lần gọi Gemini, model viết 10 câu nhưng trước đây chỉ
   dùng 1, bỏ 9 — phí phạm lớn nhất của hệ thống. Nay mọi câu
   đạt chuẩn còn dư đều được CẤT vào kho đệm trên máy (theo mức
   độ, kèm chủ đề); những lần bấm sau lấy thẳng trong kho ra
   dùng, KHÔNG tốn thêm lượt gọi nào — một lần gọi nuôi được
   tới ~10 bản tin, một khóa vì thế tạo được gấp nhiều lần,
   mà các lần lấy trong kho còn ra kết quả NGAY LẬP TỨC.
   Câu lấy từ kho vẫn được kiểm lại đầy đủ tại lúc lấy (sạch,
   đúng dải, chưa từng dùng, không phải biến thể của câu đã
   dùng) vì "vũ trụ đã dùng" thay đổi liên tục. */
function aiBufferAll() { try { return JSON.parse(localStorage.getItem("tt_ai_buffer") || "{}"); } catch (e) { return {}; } }
function aiBufferSave(all) { try { localStorage.setItem("tt_ai_buffer", JSON.stringify(all)); } catch (e) {} }
function aiBufferStash(level, items) {
  if (!items || !items.length) return;
  const all = aiBufferAll();
  const buf = all[level] || [];
  const have = new Set(buf.map((x) => x.t.toUpperCase()));
  for (const it of items) if (!have.has(it.t.toUpperCase())) { buf.push(it); have.add(it.t.toUpperCase()); }
  all[level] = buf.slice(-40);
  aiBufferSave(all);
}
function aiBufferTake(level, seen) {
  const all = aiBufferAll();
  const buf = all[level] || [];
  if (!buf.length) return null;
  const band = LEVEL_BANDS[level];
  const keep = [];
  let picked = null;
  for (const it of buf) {
    if (picked) { keep.push(it); continue; }
    const c = it.t;
    const conv = convertText(c);
    const len = convertedLength(c);
    if (isCleanVn(c, level) && len >= band.min && len <= band.max && !seen.has(conv) && !variantOfSeen(c, seen)) picked = it;
    /* câu không còn đạt (đã bị dùng ở nơi khác) thì bỏ hẳn */
  }
  all[level] = keep;
  aiBufferSave(all);
  return picked;
}

/* ============================================================
   KHO BẢN TIN CLAUDE (collection museBank trên Firestore) —
   nguồn bản tin dự phòng CHỈ dành cho tài khoản được quản trị
   tích "Kho Muse" (hoặc chính quản trị). Dữ liệu kho KHÔNG
   nằm trong dữ liệu bản tin thông thường của ứng dụng và Rules
   cũng chỉ cho các tài khoản đó đọc. Khi AI không hoạt động,
   ứng dụng tự lấy một bản tin trong kho này (theo đúng mức độ
   đã cài, vẫn kiểm sạch / đúng dải / chưa từng dùng / không
   phải biến thể) thay cho bản tin thường. */
function claudeBankEntitled() { return myIsAdmin || (myProfile && myProfile.useClaudeBank === true); }
let _museMeta = null;
let _museChunks = {}; /* mức -> { idx, items, used } khúc đang dùng trên máy này */
async function museMeta() {
  if (_museMeta) return _museMeta;
  const s = await getDoc(doc(db, "museBank", "meta"));
  _museMeta = s.exists() ? (s.data() || {}) : null;
  return _museMeta;
}
async function museBankTake(level) {
  if (!claudeBankEntitled()) return null;
  try {
    const meta = await museMeta();
    const total = meta && meta.counts ? (meta.counts[level] || 0) : 0;
    if (!total) return null;
    const CH = 500;
    const nChunks = Math.max(1, Math.ceil(total / CH));
    const seen = allSeenSet();
    const band = LEVEL_BANDS[level];
    for (let attempt = 0; attempt < 3; attempt++) {
      let st = _museChunks[level];
      if (!st || st.items.every((_, i) => st.used[i])) {
        const s = await getDoc(doc(db, "museBank", level + "_" + Math.floor(Math.random() * nChunks)));
        if (!s.exists()) return null;
        const items = (s.data() || {}).items || [];
        if (!items.length) return null;
        st = _museChunks[level] = { items, used: {} };
      }
      const freeIdx = st.items.map((_, i) => i).filter((i) => !st.used[i]);
      for (let k = 0; k < Math.min(40, freeIdx.length); k++) {
        const j = Math.floor(Math.random() * freeIdx.length);
        const i = freeIdx.splice(j, 1)[0];
        st.used[i] = true; /* đánh dấu đã xét để không xét lại câu hỏng/trùng */
        const it = st.items[i];
        const t = typeof it === "string" ? it : (it && it.t);
        if (!t || !isCleanVn(t, level)) continue;
        const len = convertedLength(t);
        if (len < band.min || len > band.max) continue;
        const conv = convertText(t);
        if (seen.has(conv) || variantOfSeen(t, seen)) continue;
        rememberSeen(conv); rememberRaw(t.toUpperCase());
        return { t, th: (it && it.th) || "" };
      }
      st.items.forEach((_, i) => { st.used[i] = true; }); /* khúc này không còn câu dùng được: đổi khúc khác */
    }
    return null;
  } catch (e) { return null; }
}

/* ============================================================
   KHO BẢN TIN AI DÙNG CHUNG (collection aiBank trên Firestore)
   — theo yêu cầu của thầy: mỗi lần bấm "Tạo bản tin AI", AI
   soạn một loạt câu; TẤT CẢ câu đạt chuẩn được LỌC THEO ĐỘ
   KHÓ ĐO ĐƯỢC (câu rơi vào dải của mức nào thì lưu vào mức
   đó) và lưu vào kho chung này. Khi cần cấp bản tin, hệ
   thống lấy 1 câu đúng mức yêu cầu TỪ KHO AI, và mỗi câu
   chỉ cấp cho MỘT tài khoản ĐÚNG MỘT LẦN (đánh dấu đã cấp
   trong collection aiServed + bản sao trên máy) — tài khoản
   khác vẫn nhận được câu đó. Nhờ vậy không người dùng nào
   gặp lại bản tin AI đã từng nhận.
   Cấu trúc kho giống kho Muse: doc "meta" {counts} + các
   khúc "{mức}_{i}" tối đa 500 câu {t, th}. */
function bandOfLen(len) { for (const k of ["de", "tb", "kho", "nc"]) { const b = LEVEL_BANDS[k]; if (len >= b.min && len <= b.max) return k; } return null; }

/* Ghi NỐI TIẾP vào một kho dạng meta + khúc 500 (dùng chung
   cho kho AI và thao tác nạp kho Muse ở panel): chắp đầy
   khúc cuối đang dở trước, giữ bất biến "mọi khúc trừ khúc
   cuối đều đủ 500 câu". Trả về counts mới. */
async function appendChunks(collName, per, onProgress) {
  const CH = 500;
  const metaRef = doc(db, collName, "meta");
  const cur = { de: 0, tb: 0, kho: 0, nc: 0 };
  const ms = await getDoc(metaRef);
  if (ms.exists()) Object.assign(cur, (ms.data() || {}).counts || {});
  let totalDocs = 0;
  const plan = {};
  for (const lv of ["de", "tb", "kho", "nc"]) {
    const off = (cur[lv] || 0) % CH;
    const fill = off > 0 && per[lv].length ? 1 : 0;
    const rest = per[lv].length - (fill ? Math.min(per[lv].length, CH - off) : 0);
    plan[lv] = { off, fill };
    totalDocs += fill + Math.ceil(Math.max(0, rest) / CH);
  }
  let doneDocs = 0;
  for (const lv of ["de", "tb", "kho", "nc"]) {
    let items = [...per[lv]];
    let idx = Math.floor((cur[lv] || 0) / CH);
    if (plan[lv].fill) {
      const cs = await getDoc(doc(db, collName, lv + "_" + idx));
      const existing = cs.exists() ? ((cs.data() || {}).items || []) : null;
      if (!existing || existing.length !== plan[lv].off) throw new Error("Không đọc được khúc cuối đang dở của kho — dừng ghi để tránh ghi đè dữ liệu cũ.");
      const add = items.splice(0, CH - plan[lv].off);
      await setDoc(doc(db, collName, lv + "_" + idx), { items: existing.concat(add) });
      idx++; doneDocs++;
      if (onProgress) onProgress(doneDocs, totalDocs);
    }
    for (let n = 0; n * CH < items.length; n++) {
      await setDoc(doc(db, collName, lv + "_" + (idx + n)), { items: items.slice(n * CH, (n + 1) * CH) });
      doneDocs++;
      if (onProgress) onProgress(doneDocs, totalDocs);
    }
  }
  const newCounts = { de: cur.de + per.de.length, tb: cur.tb + per.tb.length, kho: cur.kho + per.kho.length, nc: cur.nc + per.nc.length };
  await setDoc(metaRef, { counts: newCounts, updatedAt: serverTimestamp() });
  return newCounts;
}

let _aiMeta = null;
let _aiChunks = {}; /* mức -> { items, used } khúc đang dùng trên máy này */
async function aiBankMeta() {
  if (_aiMeta) return _aiMeta;
  const s = await getDoc(doc(db, "aiBank", "meta"));
  _aiMeta = s.exists() ? (s.data() || {}) : null;
  return _aiMeta;
}
async function aiBankAdd(per) {
  const counts = await appendChunks("aiBank", per);
  _aiMeta = { counts };
  _aiChunks = {};
  return counts;
}

/* Đánh dấu bản tin AI đã cấp cho TÀI KHOẢN này: doc
   aiServed/{uid} {ids: [mã băm câu]} trên máy chủ + bản sao
   localStorage trên máy. Câu đã đánh dấu không bao giờ được
   cấp lại cho tài khoản này; tài khoản khác vẫn nhận được. */
let _aiServed = null;
async function aiServedSet() {
  if (_aiServed) return _aiServed;
  _aiServed = new Set();
  try { (JSON.parse(localStorage.getItem("tt_ai_served") || "[]")).forEach((x) => _aiServed.add(x)); } catch (e) {}
  try {
    if (auth.currentUser) {
      const s = await getDoc(doc(db, "aiServed", auth.currentUser.uid));
      if (s.exists()) ((s.data() || {}).ids || []).forEach((x) => _aiServed.add(x));
    }
  } catch (e) {}
  return _aiServed;
}
function aiMarkServed(hash) {
  if (!hash) return;
  if (_aiServed) _aiServed.add(hash);
  try {
    const arr = JSON.parse(localStorage.getItem("tt_ai_served") || "[]");
    if (!arr.includes(hash)) { arr.push(hash); localStorage.setItem("tt_ai_served", JSON.stringify(arr.slice(-4000))); }
  } catch (e) {}
  (async () => {
    try {
      if (!auth.currentUser) return;
      await setDoc(doc(db, "aiServed", auth.currentUser.uid), { ids: arrayUnion(hash), updatedAt: serverTimestamp() }, { merge: true });
    } catch (e) {}
  })();
}

/* Lấy 1 bản tin từ kho AI: đúng mức, sạch, chưa từng dùng ở
   máy này, và QUAN TRỌNG — chưa từng được cấp cho tài khoản
   này trước đây. Lấy xong là đánh dấu đã cấp ngay. */
async function aiBankTake(level) {
  try {
    const meta = await aiBankMeta();
    const total = meta && meta.counts ? (meta.counts[level] || 0) : 0;
    if (!total) return null;
    const served = await aiServedSet();
    const seen = allSeenSet();
    const band = LEVEL_BANDS[level];
    const nChunks = Math.max(1, Math.ceil(total / 500));
    for (let attempt = 0; attempt < 3; attempt++) {
      let st = _aiChunks[level];
      if (!st || st.items.every((_, i) => st.used[i])) {
        const s = await getDoc(doc(db, "aiBank", level + "_" + Math.floor(Math.random() * nChunks)));
        if (!s.exists()) return null;
        const items = (s.data() || {}).items || [];
        if (!items.length) return null;
        st = _aiChunks[level] = { items, used: {} };
      }
      const freeIdx = st.items.map((_, i) => i).filter((i) => !st.used[i]);
      for (let k = 0; k < Math.min(40, freeIdx.length); k++) {
        const j = Math.floor(Math.random() * freeIdx.length);
        const i = freeIdx.splice(j, 1)[0];
        st.used[i] = true;
        const it = st.items[i];
        const t = typeof it === "string" ? it : (it && it.t);
        if (!t || !isCleanVn(t, level)) continue;
        const len = convertedLength(t);
        if (len < band.min || len > band.max) continue;
        const conv = convertText(t);
        if (served.has(keyHash(conv))) continue; /* câu này ĐÃ cấp cho tài khoản này rồi */
        if (seen.has(conv) || variantOfSeen(t, seen)) continue;
        aiMarkServed(keyHash(conv));
        rememberSeen(conv); rememberRaw(t.toUpperCase());
        return { t, th: (it && it.th) || "" };
      }
      st.items.forEach((_, i) => { st.used[i] = true; });
    }
    return null;
  } catch (e) { return null; }
}

/* Thời gian chờ AI tối đa (giây) do QUẢN TRỊ đặt ở panel
   (doc config/aiSettings, mục "Cài đặt khác"). Khi bấm nút
   AI, quá thời gian này mà AI chưa soạn xong thì người dùng
   được cấp ngay bản tin từ kho AI / kho dự phòng — AI vẫn
   chạy ngầm để lưu kho. Mặc định 8 giây, giới hạn 2–60;
   ứng dụng tự đọc lại cài đặt mỗi phút. */
let _aiWaitCfg = null;
async function aiWaitSeconds() {
  if (_aiWaitCfg && Date.now() - _aiWaitCfg.at < 60000) return _aiWaitCfg.sec;
  let sec = 8;
  try {
    const s = await getDoc(doc(db, "config", "aiSettings"));
    if (s.exists()) {
      const v = Number((s.data() || {}).responseSeconds);
      if (v >= 2 && v <= 60) sec = v;
    }
  } catch (e) {}
  _aiWaitCfg = { sec, at: Date.now() };
  return sec;
}

async function generateMessageSmart(firstTheme, level) {
  const band = LEVEL_BANDS[level];
  const seen = allSeenSet();
  const raws = recentRaws();
  /* Hạn chót 20 giây cho cả quá trình (mọi vòng, mọi khóa). */
  const deadline = Date.now() + 20000;
  let lastErr = null;
  let adj = 0; // phản hồi độ lệch cho vòng sau: <0 viết ngắn lại, >0 viết dài ra
  const fresh = []; // mọi câu sạch + chưa dùng của các vòng — sẽ LƯU KHO AI
  let pick = null, pickTheme = null;
  for (let round = 0; round < 3; round++) {
    const theme = round === 0 ? firstTheme : THEMES[Math.floor(Math.random() * THEMES.length)];
    let cands = [];
    try {
      cands = await aiCandidates(theme, level, raws.slice(-10), deadline, adj);
    } catch (e) { lastErr = e; break; }
    const cleanLens = [];
    for (const c of cands) {
      const conv = convertText(c);
      const len = convertedLength(c);
      /* LỌC THEO ĐỘ KHÓ ĐO ĐƯỢC: câu rơi vào dải của mức nào
         thì tính cho mức đó (kể cả khác mức đang yêu cầu) —
         không cắt, không sửa câu. */
      const cBand = bandOfLen(len);
      if (!cBand || !isCleanVn(c, cBand)) continue;
      cleanLens.push(len);
      if (seen.has(conv) || variantOfSeen(c, seen)) continue;
      if (fresh.some((x) => x.conv === conv)) continue;
      fresh.push({ t: c, th: theme, band: cBand, conv });
      if (!pick && cBand === level) { pick = c; pickTheme = theme; }
    }
    if (pick) break;
    /* Chưa có câu đúng mức yêu cầu: ghi nhận lệch về phía nào
       để vòng sau nhắc AI chỉnh độ dài. */
    if (cleanLens.length) {
      if (cleanLens.every((L) => L > band.max)) adj -= 2;
      else if (cleanLens.every((L) => L < band.min)) adj += 2;
    }
    cands.forEach((c) => { if (!raws.includes(c)) raws.push(c); });
  }
  /* LƯU KHO AI DÙNG CHUNG: mọi câu đạt chuẩn của lần soạn này
     (gồm cả câu khác mức yêu cầu) đều vào kho theo đúng mức
     của chúng, để cấp dần cho mọi tài khoản — mỗi tài khoản
     chỉ nhận mỗi câu đúng một lần. Lỗi lưu kho không làm
     hỏng lần bấm này. */
  let banked = 0;
  if (fresh.length) {
    const per = { de: [], tb: [], kho: [], nc: [] };
    for (const it of fresh) per[it.band].push({ t: it.t, th: it.th });
    banked = fresh.length;
    try { await aiBankAdd(per); } catch (e) { banked = 0; }
  }
  if (pick) {
    rememberSeen(convertText(pick)); rememberRaw(pick.toUpperCase());
    aiMarkServed(keyHash(convertText(pick)));
    return { text: pick.toUpperCase(), ai: true, theme: pickTheme, banked };
  }
  if (lastErr) throw lastErr;
  return { error: "nodup", theme: firstTheme, banked };
}

function fillCustomText(text) {
  const radio = document.querySelector('input[name="src"][value="custom"]');
  if (radio && !radio.checked) { radio.checked = true; radio.dispatchEvent(new Event("change", { bubbles: true })); }
  const ta = $("customText");
  if (ta) {
    ta.value = text;
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    ta.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function aiAllowed() { return myIsAdmin || (myProfile && (myProfile.aiEnabled === true || myProfile.useClaudeBank === true)); }

/* Nút "Tạo bản tin AI" đặt ngay dưới nút "Tạo bản tin mới" trong mục
   Hệ thống tự tạo — chỉ hiện với quản trị hoặc tài khoản được tích AI.
   Chủ đề chọn NGẪU NHIÊN, mức độ lấy theo ô "Mức độ" ngay phía trên. */
/* CHÍNH SÁCH NÚT AI (theo yêu cầu mới nhất của thầy): nút
   "Tạo bản tin AI" KHÔNG BAO GIỜ tự đổi chức năng. Mỗi lần bấm
   đều thử AI trước; nếu AI lỗi (không khóa / khóa chết / hết
   lượt / quá tải / quá 20 giây) thì tự động tạo ngay một bản
   tin THƯỜNG cho lần bấm đó, nút giữ nguyên là nút AI để lần
   sau thử lại. Các hàm dưới đây chỉ còn lo việc khôi phục nhãn
   nút sau mỗi lần bấm. */
let aiBroken = false;
function runSystemGen() {
  const auto = document.querySelector('input[name="src"][value="auto"]');
  if (auto && !auto.checked) { auto.checked = true; auto.dispatchEvent(new Event("change", { bubbles: true })); }
  const gb = $("genBtn");
  if (gb) gb.click();
}
function refreshAiButtons() {
  const fab = $("fabGen");
  const b = $("ttAiBtn");
  if (b) b.disabled = false;
  if (aiBroken) {
    if (fab && fab.dataset.ai === "1") { fab.textContent = "🎲 Tạo bản tin"; delete fab.dataset.ai; }
    if (b) b.textContent = "🎲 Tạo bản tin mới";
  } else if (aiAllowed()) {
    if (fab) { fab.textContent = "✨ Tạo bản tin AI"; fab.dataset.ai = "1"; }
    if (b) b.textContent = "✨ Tạo bản tin AI";
  }
}
function setAiBroken(v) { aiBroken = !!v; refreshAiButtons(); }

function mountAiButton() {
  const gen = $("genBtn");
  if (!gen || !aiAllowed() || $("ttAiBtn")) return;
  const host = gen.parentElement;
  if (!host) return;
  const btn = document.createElement("button");
  btn.className = "btn";
  btn.id = "ttAiBtn";
  btn.style.width = "100%";
  btn.textContent = "✨ Tạo bản tin AI";
  const note = document.createElement("div");
  note.id = "ttAiNote";
  host.appendChild(btn);
  host.appendChild(note);
  /* Tài khoản được bật AI: nút nổi Tạo bản tin trên giao diện chính
     mặc định cũng là tạo bằng AI (máy chính xử lý qua data-ai). */
  const fab = $("fabGen");
  if (fab) { fab.textContent = "✨ Tạo bản tin AI"; fab.dataset.ai = "1"; }
  btn.addEventListener("click", async () => {
    /* Tôn trọng MỌI cài đặt của người dùng, không chỉ mức độ:
       Kiểu bản tin = "Ngẫu nhiên" là việc của bộ tạo hệ thống (AI
       chỉ soạn câu có nghĩa) — chuyển thẳng cho bộ tạo hệ thống. */
    const tsEl = $("typeSel");
    const typeVal = tsEl ? tsEl.value : "sentence";
    if (typeVal === "random") {
      runSystemGen();
      note.textContent = "Kiểu “Ngẫu nhiên” — đã dùng bộ tạo hệ thống, đúng mức độ đã cài.";
      return;
    }
    /* KHO CLAUDE (chỉ tài khoản được tích): khi AI không hoạt
       động hoặc không soạn được câu mới, lấy một bản tin trong
       kho Muse thay cho bản tin thường. Trả về true nếu đã
       lấy được và trình bày xong. */
    const bankFallback = async (why) => {
      if (!claudeBankEntitled()) return false;
      const ds2 = $("diffSel");
      const lv = ds2 && ds2.value === "easy" ? "de" : ds2 && ds2.value === "hard" ? "kho" : ds2 && ds2.value === "adv" ? "nc" : "tb";
      const item = await museBankTake(lv);
      if (!item) return false;
      let outText = item.t.toUpperCase();
      if (typeVal === "mixed" && lv === "nc" && !/\d/.test(outText)) {
        const band = LEVEL_BANDS[lv];
        const extra = " " + String(100 + Math.floor(Math.random() * 900));
        if (convertedLength(outText + extra) <= band.max) outText += extra;
      }
      fillCustomText(outText);
      if (window.ttShowDone) window.ttShowDone();
      note.textContent = why + " — đã lấy bản tin từ KHO CLAUDE · Chủ đề: " + (item.th || "—") + " · " + convertedLength(outText) + " ký tự, đưa vào ô “Tự nhập bản tin”.";
      refreshAiButtons();
      return true;
    };
    /* KHO AI DÙNG CHUNG: lấy 1 bản tin đúng mức từ kho AI —
       câu được lấy chưa từng cấp cho tài khoản này trước đây
       (hệ thống tự đánh dấu khi cấp). Trả về true nếu đã lấy
       được và trình bày xong. */
    const presentFromAiBank = async (why) => {
      const ds2 = $("diffSel");
      const lv = ds2 && ds2.value === "easy" ? "de" : ds2 && ds2.value === "hard" ? "kho" : ds2 && ds2.value === "adv" ? "nc" : "tb";
      const item = await aiBankTake(lv);
      if (!item) return false;
      let outText = item.t.toUpperCase();
      if (typeVal === "mixed" && lv === "nc" && !/\d/.test(outText)) {
        const band = LEVEL_BANDS[lv];
        const extra = " " + String(100 + Math.floor(Math.random() * 900));
        if (convertedLength(outText + extra) <= band.max) outText += extra;
      }
      fillCustomText(outText);
      if (window.ttShowDone) window.ttShowDone();
      note.textContent = why + " — đã lấy 1 bản tin từ KHO AI · Chủ đề: " + (item.th || "—") + " · " + convertedLength(outText) + " ký tự (bản tin này sẽ không được cấp lại cho tài khoản này).";
      refreshAiButtons();
      return true;
    };
    /* Báo rõ đang tạo trên CẢ hai nút (nút trong ngăn Cài đặt và
       nút nổi) để người dùng biết đã bấm thành công. */
    btn.disabled = true;
    btn.textContent = "⏳ Đang tạo...";
    const fab = $("fabGen");
    if (fab && fab.dataset.ai === "1") fab.textContent = "⏳ Đang tạo...";
    note.textContent = "Đang soạn câu mới (chủ đề ngẫu nhiên)…";
    try {
      const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
      const ds = $("diffSel");
      const level = ds && ds.value === "easy" ? "de" : ds && ds.value === "hard" ? "kho" : ds && ds.value === "adv" ? "nc" : "tb";
      /* AI chạy NGẦM ngay từ lúc bấm: dù người dùng được cấp
         bản tin theo đường nào, quá trình soạn vẫn tiếp tục
         và tự lưu mọi câu đạt chuẩn vào kho AI. Người dùng
         chỉ chờ tối đa số giây quản trị đã đặt trong panel —
         hết giờ là cấp ngay từ kho AI / kho dự phòng. */
      const waitSec = await aiWaitSeconds();
      note.textContent = "Đang soạn câu mới (chủ đề ngẫu nhiên)… tối đa " + waitSec + " giây sẽ có bản tin.";
      let settled = false, gRes = null, gErr = null;
      generateMessageSmart(theme, level)
        .then((r) => { settled = true; gRes = r; })
        .catch((e) => { settled = true; gErr = e; });
      const t0 = Date.now();
      while (!settled && Date.now() - t0 < waitSec * 1000) await new Promise((res) => setTimeout(res, 150));
      if (!settled) {
        /* Hết giờ chờ: cấp ngay từ kho dự phòng; AI vẫn chạy
           ngầm để lưu kho cho những lần bấm sau. */
        if (await presentFromAiBank("AI chưa soạn kịp trong " + waitSec + " giây (vẫn đang soạn ngầm để lưu kho AI)")) return;
        if (await bankFallback("AI chưa soạn kịp trong " + waitSec + " giây")) return;
        runSystemGen();
        refreshAiButtons();
        note.textContent = "AI chưa soạn kịp trong " + waitSec + " giây — đã tạo bản tin thường cho lần này. AI vẫn chạy ngầm, các câu soạn được sẽ tự lưu vào kho AI cho những lần sau.";
        return;
      }
      if (gErr) throw gErr;
      const r = gRes;
      if (r.error) {
        if (await presentFromAiBank("AI chưa soạn được câu mới ở mức này")) return;
        if (await bankFallback("AI chưa soạn được câu mới không trùng")) return;
        note.textContent = "AI chưa soạn được câu mới không trùng với các bản tin trước. Thầy bấm thử lại — mỗi lần bấm AI sẽ soạn theo chủ đề và bối cảnh khác.";
        refreshAiButtons();
        return;
      }
      let outText = r.text;
      /* Độ dài đã được đảm bảo ngay trong generateMessageSmart
         bằng cách chỉ chọn câu tự nhiên đạt dải — tại đây KHÔNG
         chỉnh sửa gì thêm vào câu (không cắt, không thêm từ). */
      /* Kiểu "Hỗn hợp" + mức Nâng cao: bản tin AI kèm một nhóm số
         (dưới Nâng cao thì không kết hợp số — đúng quy tắc mức độ) */
      if (typeVal === "mixed" && level === "nc" && !/\d/.test(outText)) {
        const band = LEVEL_BANDS[level];
        const extra = " " + String(100 + Math.floor(Math.random() * 900));
        if (convertedLength(outText + extra) <= band.max) outText += extra;
      }
      fillCustomText(outText);
      if (window.ttShowDone) window.ttShowDone();
      note.textContent = "AI soạn mới · Chủ đề: " + (r.theme || theme) + " · " + convertedLength(outText) + " ký tự · không trùng các bản tin trước — đã đưa vào ô “Tự nhập bản tin”, chọn mục đó rồi Phát/Luyện như thường."
        + (r.banked ? " Vừa lưu " + r.banked + " câu AI đạt chuẩn vào kho AI dùng chung (đã lọc theo độ khó)." : "");
    } catch (e) {
      /* AI lỗi vì bất kỳ lý do gì: TỰ ĐỘNG tạo ngay một bản tin
         thường cho lần bấm này và KHÔNG thay đổi chức năng của
         nút (theo yêu cầu mới nhất của thầy) — lần bấm sau vẫn
         thử AI như thường. Dòng thông báo nói đúng nguyên nhân
         để thầy biết cách xử lý nếu muốn dùng lại AI ngay. */
      const det = e ? [e.code, e.message].filter(Boolean).join(" · ").slice(0, 160) : "";
      /* AI lỗi: thử cấp 1 bản tin từ KHO AI trước (câu trong
         kho chưa từng cấp cho tài khoản này); kho AI cũng
         không có thì mới tới kho Muse (nếu được tích) và
         cuối cùng là bản tin thường. */
      if (await presentFromAiBank("AI đang không hoạt động" + (det ? " (" + det + ")" : ""))) return;
      if (await bankFallback("AI đang không hoạt động" + (det ? " (" + det + ")" : ""))) return;
      runSystemGen();
      refreshAiButtons();
      if (/gemini-http-401|API key not valid/i.test(det)) {
        note.textContent = "Khóa Gemini đã hết hiệu lực — đã tạo sẵn bản tin thường cho lần này. Muốn dùng lại AI: bấm nút 🔑 xanh, dán khóa mới.";
      } else if (/gemini-http-429/.test(det)) {
        note.textContent = "Khóa Gemini đã hết lượt miễn phí lúc này (lỗi 429) — đã tạo sẵn bản tin thường cho lần này. Đợi ít phút cho lượt miễn phí hồi lại, hoặc thêm khóa khác vào kho dùng chung.";
      } else if (/gemini-http-404/.test(det)) {
        note.textContent = "Tài khoản của khóa này không được Google cấp model AI nào dùng được — đã tạo sẵn bản tin thường cho lần này. Thầy thử khóa của một tài khoản Google khác.";
      } else if (/ai-timeout/.test(det)) {
        note.textContent = "Google AI quá 20 giây chưa trả lời (máy chủ quá tải hoặc mạng chậm) — đã tạo sẵn bản tin thường cho lần này. Thầy bấm lại nút AI sau ít phút.";
      } else {
        let noKey = false;
        try { noKey = (await geminiKeyCandidates()).length === 0; } catch (_) {}
        note.textContent = noKey
          ? "Chưa có khóa Gemini nào — đã tạo sẵn bản tin thường cho lần này. Nhập khóa ở nút 🔑 xanh để bật AI."
          : "AI đang không dùng được" + (det ? " (" + det + ")" : "") + " — đã tạo sẵn bản tin thường cho lần này.";
      }
      return;
    }
    refreshAiButtons();
  });
  /* (Theo yêu cầu mới nhất của thầy: nút AI KHÔNG tự chuyển
     thành nút thường nữa — kể cả khi chưa có khóa. Mọi lần bấm
     đều thử AI trước; lỗi thì tạo thường cho lần đó.) */
}
