// Bộ chuyển đổi tiếng Việt sang ký hiệu truyền tin theo QUY ƯỚC CỦA LỚP:
// dấu đặt NGAY SAU nguyên âm mang dấu (không đặt cuối âm tiết).
//   Â=AA, Ă=AW, Ê=EE, Ô=OO, Ơ=OW, Ư=UW, Đ=DD
//   Dấu thanh: huyền=F, sắc=S, hỏi=R, ngã=X, nặng=J (chèn ngay sau nguyên âm đó)
// Ví dụ: học -> HOJC, bưởi -> BUWOWRI, "ĐỘI EM HỌC TẬP TỐT" -> "DDOOJI EM HOJC TAAJP TOOST"

const TONES = ["F", "S", "R", "X", "J"]; // huyền, sắc, hỏi, ngã, nặng
const GROUPS = {
  a: "àáảãạ", â: "ầấẩẫậ", ă: "ằắẳẵặ",
  e: "èéẻẽẹ", ê: "ềếểễệ",
  i: "ìíỉĩị",
  o: "òóỏõọ", ô: "ồốổỗộ", ơ: "ờớởỡợ",
  u: "ùúủũụ", ư: "ừứửữự",
  y: "ỳýỷỹỵ"
};
const QUALITY = {
  a: "A", â: "AA", ă: "AW", e: "E", ê: "EE", i: "I",
  o: "O", ô: "OO", ơ: "OW", u: "U", ư: "UW", y: "Y"
};

const MAP = {};
for (const [base, chars] of Object.entries(GROUPS)) {
  const q = QUALITY[base];
  MAP[base] = q;
  MAP[base.toUpperCase()] = q;
  [...chars].forEach((ch, i) => {
    MAP[ch] = q + TONES[i];
    MAP[ch.toUpperCase()] = q + TONES[i];
  });
}
MAP["đ"] = "DD";
MAP["Đ"] = "DD";

// Chuyển một chuỗi tiếng Việt sang dạng ký hiệu (chữ hoa).
export function convertText(s) {
  return [...String(s ?? "")].map((ch) => {
    if (MAP[ch] !== undefined) return MAP[ch];
    if (/[a-z]/.test(ch)) return ch.toUpperCase();
    return ch;
  }).join("");
}

// Độ dài bản tin SAU chuyển đổi, chỉ tính chữ cái và chữ số (không tính khoảng trắng/dấu câu).
export function convertedLength(s) {
  const c = convertText(s);
  let n = 0;
  for (const ch of c) if (/[A-Z0-9]/.test(ch)) n++;
  return n;
}

// Dải độ dài theo mức độ (ký tự sau chuyển đổi, theo chuẩn của ứng dụng).
export const LEVEL_BANDS = {
  de: { label: "Dễ", min: 10, max: 15 },
  tb: { label: "Trung bình", min: 16, max: 22 },
  kho: { label: "Khó", min: 25, max: 30 },
  nc: { label: "Nâng cao", min: 31, max: 40 }
};

export const THEMES = [
  "Đội",
  "Nhi đồng",
  "Bác Hồ",
  "Lịch sử",
  "Địa danh",
  "Trường lớp"
];
