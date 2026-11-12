// =====================================================================
//  CẤU HÌNH MÁY CHỦ FIREBASE  —  FILE DUY NHẤT THẦY CẦN SỬA
// =====================================================================
//  Cách lấy các giá trị này: xem "Hướng dẫn đưa ứng dụng lên mạng",
//  Phần D. Tóm tắt: Firebase Console -> (bánh răng) Project settings
//  -> mục "Your apps" -> chọn ứng dụng web (</>) -> SDK setup and
//  configuration -> chọn "Config" -> sao chép toàn bộ firebaseConfig
//  rồi dán đè lên các dòng dưới đây.
//
//  LƯU Ý: các giá trị này KHÔNG phải mật khẩu bí mật. Chúng chỉ là
//  "địa chỉ" của dự án Firebase của thầy và vốn sẽ hiện công khai
//  trong mã trang khi đưa lên mạng. An toàn nằm ở Firestore Rules
//  (file firestore.rules), không nằm ở việc giấu các giá trị này.
//  Thầy có thể gửi nội dung này cho em qua Muse để em dán giúp.
// =====================================================================

window.TT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyB7niChz8TdT9j4jboo1Kb89ZAy2GdrbAU",
  authDomain: "luyentruyentin.firebaseapp.com",
  projectId: "luyentruyentin",
  storageBucket: "luyentruyentin.firebasestorage.app",
  messagingSenderId: "438987737278",
  appId: "1:438987737278:web:f678bbe5fbfb0eedfdf6ef",
  // Khóa App Check (reCAPTCHA Enterprise site key) — khóa CÔNG KHAI,
  // dán dãy ký tự bắt đầu bằng "6L..." vào giữa hai dấu ngoặc kép.
  // Thiếu khóa này thì lời gọi AI bị Firebase chặn (App Check).
  appCheckSiteKey: "6LfAxxwuAAAAAP1t5iF3LJqq5CJNiN5jrXttk12x",
  // Khóa Gemini API lấy từ Google AI Studio (aistudio.google.com/apikey)
  // — đường gọi AI trực tiếp, không qua App Check. Dán khóa "AIza..."
  // vào giữa hai dấu ngoặc kép. Sau khi chạy được, nên giới hạn khóa
  // chỉ dùng cho tên miền trang này + API Generative Language.
  geminiApiKey: "AQ.Ab8RN6INb81H2tKVWYKl_FqbaAE70Z8MQ-Yp9kKTO5HHR22atQ"
};
