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
  collection, getDocs, addDoc, query, where, serverTimestamp, getCountFromServer
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
#tt-chip{position:fixed;top:0;left:0;right:0;z-index:999980;background:rgba(8,45,80,.97);color:#fff;padding:6px 10px;display:none;gap:6px;align-items:center;justify-content:center;text-align:center;font-family:system-ui,sans-serif;font-size:13px;box-shadow:0 2px 10px rgba(0,0,0,.3);flex-wrap:wrap}
#tt-chip button{background:#fff;color:#0b4a80;border:none;border-radius:7px;padding:5px 9px;font-weight:600;cursor:pointer;font-size:12.5px}
#tt-chip button.on{background:#ffb300;color:#083d73}
.tt-chipinfo{display:flex;flex-direction:column;align-items:center;text-align:center;line-height:1.25;margin-right:2px;min-width:0}
.tt-chipsub{font-size:12px;color:#cfe3f5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:46vw}
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
  boot();
}

function displayName(p) { return (p && (p.nickname || p.name || p.username)) || ""; }
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
        username: u.trim().toLowerCase(), name, className: cls, nickname: "", aiEnabled: false,
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
  // Tên người dùng + dòng Lớp/Giáo viên · trường ở ngay dưới tên
  const info = document.createElement("div");
  info.className = "tt-chipinfo";
  const line1 = document.createElement("span");
  line1.textContent = "👤 ";
  const nm = document.createElement("span");
  nm.textContent = displayName(myProfile);
  if (aiAllowed()) nm.className = "tt-rainbow";
  line1.appendChild(nm);
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
  const bHist = document.createElement("button");
  bHist.textContent = "🕘 Lịch sử";
  bHist.addEventListener("click", openMyHistory);
  chip.appendChild(bHist);
  if (myProfile && myProfile.role === "GV" && myProfile.schoolId) {
    const bSch = document.createElement("button");
    bSch.textContent = "🏫 Học sinh trường";
    bSch.addEventListener("click", openSchoolPanel);
    chip.appendChild(bSch);
  }
  if (myIsAdmin) {
    const bAd = document.createElement("button");
    bAd.textContent = "🛠 Quản trị";
    bAd.addEventListener("click", openAdminPanel);
    chip.appendChild(bAd);
    const bUse = document.createElement("button");
    bUse.textContent = "📊 Dung lượng";
    bUse.addEventListener("click", openUsagePanel);
    chip.appendChild(bUse);
  }
  // Nút Cài đặt trên thanh ghim: mở/đóng ngăn cài đặt của ứng dụng
  // (Hoạt động, Bản tin, họ tên/lớp, các công tắc) — chọn kiểu hình
  // người que/3D KHÔNG đặt ở đây nữa, đã có ngay trên khung cờ.
  const bSet = document.createElement("button");
  bSet.textContent = "⚙️ Cài đặt";
  bSet.addEventListener("click", () => {
    const d = $("settingsDrawer");
    if (!d) return;
    d.classList.toggle("hidden");
    if (!d.classList.contains("hidden")) d.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  chip.appendChild(bSet);
  const bOut = document.createElement("button");
  bOut.textContent = "Đăng xuất";
  bOut.addEventListener("click", doLogout);
  chip.appendChild(bOut);
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
const KIND_NAMES = { "nhan-morse": "Nhận Morse", "nhan-sem": "Nhận Semaphore", "phat-morse": "Phát Morse", "phat-sem": "Phát Semaphore" };
function metaFor(entry) {
  const k = (entry && entry.kind) || "";
  let speedLabel = "";
  if (k.indexOf("morse") >= 0) { const w = $("wpmRange"); if (w) speedLabel = w.value + " WPM"; }
  else if (k.indexOf("sem") >= 0) { const s = $("semRange"); if (s) speedLabel = String(s.value).replace(".", ",") + " giây/chữ"; }
  return { kindLabel: KIND_NAMES[k] || k, speedLabel };
}
function fmtScore(s) { const n = Number(s); return isNaN(n) ? String(s ?? "") : n.toFixed(1).replace(".", ","); }
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
  return `<div style="overflow-x:auto"><table class="tt-table"><thead><tr><th>${esc(firstColLabel)}</th><th>Thời gian làm bài</th><th>Dạng truyền tin</th><th>Tốc độ</th><th>Số điểm</th></tr></thead><tbody>${
    rows.map((r) => {
      const e = r.entry || {};
      return `<tr><td>${esc(nameOf(r))}</td><td>${esc(e.date || "")}</td><td>${esc(r.kindLabel || metaFor(e).kindLabel)}</td><td>${esc(r.speedLabel || "—")}</td><td><b>${esc(fmtScore(e.score))}/10</b> <span style="color:#666">(đúng ${esc(e.correct ?? "")}/${esc(e.total ?? "")})</span></td></tr>`;
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

/* ---------------- Quản trị ---------------- */
let admState = { q: "", k: "name", dir: 1 };
function roleOf(m, adminsSet) { return adminsSet.has(m.uid) ? "QT" : (m.role === "GV" ? "GV" : "HS"); }

async function openAdminPanel() {
  const body = openPanel("🛠 Quản trị thành viên", true);
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

function renderAdminList(body, members, schools, adminsSet) {
  const schoolName = (id) => { const s = schools.find((x) => x.id === id); return s ? s.name : ""; };
  body.innerHTML = `
    <div style="margin-bottom:12px"><b>🏫 Trường học</b>
      <div style="margin:6px 0">${schools.length ? schools.map((s) => `<span class="tt-badge tt-b-active" style="margin-right:6px">${esc(s.name)} (${members.filter((m) => m.schoolId === s.id).length}) <a href="#" data-del-school="${s.id}" style="color:#842029;text-decoration:none;font-weight:700">✕</a></span>`).join("") : "<span style='color:#666'>Chưa có trường nào — thêm trường ở ô dưới rồi gán cho từng thành viên trong bảng.</span>"}</div>
      <div style="display:flex;gap:6px"><input id="adm-school-name" placeholder="Tên trường mới, vd: TH & THCS Bảo Thuận" style="flex:1;padding:8px;border:1.5px solid #ccd;border-radius:8px"><button class="tt-btn" id="adm-school-add" style="width:auto;padding:8px 14px">Thêm trường</button></div>
    </div>
    <div class="tt-field"><input id="adm-search" placeholder="Tìm theo tên đăng nhập, họ tên, biệt danh, lớp…"></div>
    <div id="adm-add" style="margin-bottom:10px">
      <button class="tt-btn" id="adm-addbtn" style="width:auto;padding:8px 14px">➕ Thêm thành viên</button>
      <div id="adm-addform" style="display:none;margin-top:8px">
        <div class="tt-field"><input id="ad-name" placeholder="Họ và tên"></div>
        <div class="tt-field"><input id="ad-class" placeholder="Lớp (HS cần có; GV để trống)"></div>
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
        <th data-k="aiEnabled">AI</th><th data-k="status">Thao tác</th>
      </tr></thead><tbody id="adm-tbody"></tbody>
    </table></div>
    <p class="tt-note">Bấm vào tiêu đề cột để sắp xếp (cột Thao tác sắp xếp theo trạng thái tài khoản). GV không hiển thị lớp và xem được lịch sử học sinh cùng trường.</p>`;
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
    if (!list.length) tbody.innerHTML = "<tr><td colspan='8'>Không có thành viên nào khớp.</td></tr>";
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
  body.querySelector("#adm-school-add").addEventListener("click", async () => {
    const name = body.querySelector("#adm-school-name").value.trim();
    if (!name) { alert("Thầy nhập tên trường trước đã ạ."); return; }
    try { await addDoc(collection(db, "schools"), { name, createdAt: serverTimestamp() }); openAdminPanel(); }
    catch (e) { alert(errText(e.code)); }
  });
  body.querySelectorAll("[data-del-school]").forEach((a) => a.addEventListener("click", async (ev) => {
    ev.preventDefault();
    const s = schools.find((x) => x.id === a.dataset.delSchool);
    if (!confirm("Xoá trường “" + (s ? s.name : "") + "”? Thành viên đã gán trường này sẽ thành chưa gán trường (tài khoản không bị xoá).")) return;
    try { await deleteDoc(doc(db, "schools", a.dataset.delSchool)); openAdminPanel(); } catch (e) { alert(errText(e.code)); }
  }));
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
    const role = body.querySelector("#ad-role").value;
    const schoolId = body.querySelector("#ad-school").value;
    if (!name || !usernameOk(u) || p.length < 6 || (role !== "GV" && !cls)) { msg.textContent = "Kiểm tra lại: cần họ tên, tên đăng nhập hợp lệ, mật khẩu ≥ 6 ký tự; HS cần có lớp."; return; }
    msg.textContent = "Đang tạo…";
    let secondary = null;
    try {
      secondary = initializeApp(cfg, "tt-secondary");
      const sAuth = getAuth(secondary);
      const cred = await createUserWithEmailAndPassword(sAuth, emailFor(u), p);
      await setDoc(doc(db, "profiles", cred.user.uid), {
        username: u.trim().toLowerCase(), name, className: cls, nickname: "", aiEnabled: false,
        role: role === "GV" ? "GV" : "HS", schoolId,
        status: "pending", expiry: null, createdAt: serverTimestamp()
      });
      await updateDoc(doc(db, "profiles", cred.user.uid), { status: "active" });
      await signOut(sAuth);
      msg.textContent = "Đã tạo và kích hoạt: " + u.trim().toLowerCase();
      openAdminPanel();
    } catch (e) {
      msg.textContent = errText(e.code);
    } finally {
      if (secondary) { try { await deleteApp(secondary); } catch (e) {} }
    }
  });
}

function memberRows(members, schools, adminsSet, m, schoolName) {
  const role = roleOf(m, adminsSet);
  const expired = isExpired(m);
  const statusLabel = m.status === "pending" ? "Chờ kích hoạt" : m.status === "stopped" ? "Đã khoá" : expired ? "Hết hạn" : "Đang dùng";
  const badgeCls = m.status === "pending" ? "tt-b-pending" : (m.status === "stopped" || expired) ? "tt-b-stopped" : "tt-b-active";
  const ref = doc(db, "profiles", m.uid);
  const reload = () => openAdminPanel();
  const upd = async (data) => { try { await updateDoc(ref, data); Object.assign(m, data); reload(); } catch (e) { alert(errText(e.code)); } };
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><b>${m.aiEnabled ? `<span class="tt-rainbow">${esc(displayName(m))}</span>` : esc(displayName(m))}</b><br><span style="color:#888">@${esc(m.username || "")}</span><br><span class="tt-badge ${badgeCls}">${statusLabel}</span></td>
    <td>${esc(m.nickname || "—")}</td>
    <td>${role === "GV" ? "—" : esc(m.className || "")}</td>
    <td>${m.expiry ? "đến " + esc(m.expiry) : "Vĩnh viễn"}</td>
    <td>${role === "QT" ? '<span class="tt-badge tt-b-active">Quản trị</span>' : `<select data-f="role"><option value="HS"${role === "HS" ? " selected" : ""}>HS</option><option value="GV"${role === "GV" ? " selected" : ""}>GV</option></select>`}</td>
    <td><select data-f="school"><option value="">— Chưa gán —</option>${schools.map((s) => `<option value="${s.id}"${m.schoolId === s.id ? " selected" : ""}>${esc(s.name)}</option>`).join("")}</select></td>
    <td style="text-align:center"><input type="checkbox" data-f="ai" ${m.aiEnabled ? "checked" : ""} style="width:18px;height:18px"></td>
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
  detail.innerHTML = `<td colspan="8">
    <div data-block="exp"><b>Hạn dùng của ${esc(m.username || "")}:</b>
      <div class="tt-acts" style="margin-top:6px">
        <button data-e="forever">Vĩnh viễn</button>
        <button data-e="d30">+30 ngày</button>
        <button data-e="d90">+90 ngày</button>
        <input type="date" data-e="date" value="${m.expiry || ""}">
        <button data-e="setdate">Đặt hạn</button>
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
  tr.querySelector('[data-a="toggle"]').addEventListener("click", () => upd({ status: m.status === "active" ? "stopped" : "active" }));
  tr.querySelector('[data-a="edit"]').addEventListener("click", async () => {
    const name = prompt("Họ và tên:", m.name || ""); if (name === null) return;
    let cls = m.className || "";
    if (role !== "GV") { cls = prompt("Lớp:", cls); if (cls === null) return; }
    const nick = prompt("Biệt danh (để trống nếu không có — chỉ quản trị đặt):", m.nickname || ""); if (nick === null) return;
    upd({ name: name.trim(), className: (cls || "").trim(), nickname: nick.trim() });
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
        return `<div class="tt-hist">🗓 ${esc(e.date || "")} · ${esc(it.kindLabel || "")}${it.speedLabel ? " · " + esc(it.speedLabel) : ""} · <b>${esc(fmtScore(e.score))}/10</b> · đúng ${esc(e.correct ?? "")}/${esc(e.total ?? "")} · “${esc(e.msg || "")}” <button data-hdel="${esc(it.id)}" class="tt-acts" style="background:#fdecea;color:#a12622;border:1px solid #f0c4c0;border-radius:6px;padding:1px 7px;cursor:pointer;font-size:12px;font-weight:600">✕ Xoá bài này</button></div>`;
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
  const words = level === "de" ? "3 đến 5 từ" : level === "tb" ? "5 đến 7 từ" : level === "kho" ? "7 đến 10 từ" : "9 đến 12 từ";
  const numReq = level === "nc" ? " Mỗi câu phải kèm đúng một nhóm số viết bằng chữ số (ví dụ: 25, 150, 2026)." : "";
  const prompt = `Bạn là giáo viên tiểu học Việt Nam. Viết 4 câu tiếng Việt, mỗi câu đúng một dòng, không đánh số, không dấu ngoặc kép, không dấu chấm cuối câu, viết hoa chữ cái đầu câu. Nội dung tích cực, phù hợp học sinh tiểu học, chủ đề: ${theme}. Mỗi câu khoảng ${words}.${numReq} Bốn câu phải khác nhau hoàn toàn về nội dung. Chỉ in ra 4 câu, không giải thích.`;
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
  const mkCand = () => level === "nc" ? fallbackSentence() + " " + String(100 + Math.floor(Math.random() * 9900)) : fallbackSentence();
  for (let i = 0; i < 80; i++) {
    const c = mkCand();
    const conv = convertText(c);
    const len = convertedLength(c);
    if (len >= band.min && len <= band.max && !seen.has(conv)) {
      rememberSeen(conv);
      return { text: c, ai: usedAi };
    }
  }
  const c = mkCand();
  rememberSeen(convertText(c));
  return { text: c, ai: usedAi };
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

function aiAllowed() { return myIsAdmin || (myProfile && myProfile.aiEnabled === true); }

/* Nút "Tạo bản tin AI" đặt ngay dưới nút "Tạo bản tin mới" trong mục
   Hệ thống tự tạo — chỉ hiện với quản trị hoặc tài khoản được tích AI.
   Chủ đề chọn NGẪU NHIÊN, mức độ lấy theo ô "Mức độ" ngay phía trên. */
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
    btn.disabled = true;
    btn.textContent = "✨ Đang tạo…";
    note.textContent = "Đang soạn câu mới (chủ đề ngẫu nhiên)…";
    try {
      const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
      const ds = $("diffSel");
      const level = ds && ds.value === "easy" ? "de" : ds && ds.value === "hard" ? "kho" : ds && ds.value === "adv" ? "nc" : "tb";
      const r = await generateMessageSmart(theme, level);
      fillCustomText(r.text);
      if (window.ttShowDone) window.ttShowDone();
      note.textContent = (r.ai ? "AI soạn" : "Bộ tạo dự phòng") + " · Chủ đề: " + theme + " · " + convertedLength(r.text) + " ký tự — đã đưa vào ô “Tự nhập bản tin”, chọn mục đó rồi Phát/Luyện như thường.";
    } catch (e) {
      note.textContent = "Chưa tạo được câu. Kiểm tra mạng rồi thử lại.";
    }
    btn.disabled = false;
    btn.textContent = "✨ Tạo bản tin AI";
  });
}
