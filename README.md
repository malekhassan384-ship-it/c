<div dir="rtl">

# ♞ Chess Vanguard — طليعة الشطرنج

**تطبيق شطرنج متكامل يعمل دون اتصال بالكامل**: أكاديمية تفاعلية، ألغاز مُثبتة رياضيًا، ومباريات ضد محرك **Stockfish** الشهير — بواجهة عربية داكنة سينمائية (RTL) مع دعم الإنجليزية.

`© 2026 Malek Hassan Ashour — All Rights Reserved.`

---

## نظرة عامة

| | |
|---|---|
| **المنتج** | Chess Vanguard |
| **ملف ويندوز التنفيذي** | `ChessVanguard.exe` |
| **المُثبِّت** | `ChessVanguard-Setup.exe` |
| **App ID** | `com.malekashour.chessvanguard` |
| **المالك والمطوّر** | Malek Hassan Ashour |

الميزات:

- **محرك قواعد شطرنج خاص** (TypeScript خالص، تمثيل 0x88) مُثبت بالكامل باختبارات **Perft** الرقمية (22/22 مطابقة دقيقة حتى العمق 5 — راجع `PHASE_STATUS.md`).
- **اللعب ضد Stockfish** عبر 8 مستويات (من مبتدئ إلى أستاذ كبير) مع تلميحات وتراجع واستسلام.
- **أكاديمية تفاعلية**: 16 درسًا عبر 3 مسارات (الأساسيات، التكتيكات، أنماط الكش مات) — كل نقلة مقبولة في كل درس مُتحقق من قانونيتها آليًا في CI.
- **24 لغز شطرنج** (كش مات في نقلة/نقلتين) — كل لغز **مُثبت رياضيًا** بحلّال كش مات داخلي؛ الحل الوحيد مضمون لكل لغز.
- **سجل مباريات** مع إعادة مشاهدة خطوة بخطوة، **إحصائيات** ورسوم، و**14 إنجازًا**.
- 3 ثيمات داكنة، مؤثرات صوتية مُولّدة برمجيًا (WebAudio — دون أي ملفات صوت)، لغتان (العربية RTL افتراضيًا / الإنجليزية).
- **Offline-first**: بعد التثبيت لا يحتاج التطبيق أي اتصال بالإنترنت إطلاقًا.

## التثبيت (المستخدم النهائي)

1. حمّل `ChessVanguard-Setup.exe` من صفحة Releases (أو من Artifacts ناتج workflow البناء).
2. شغّل المثبّت واتبع الخطوات (NSIS — يسمح بتغيير مجلد التثبيت).
3. اختياري: تحقق من سلامة الملف بمقارنة SHA-256 من ملف `.sha256` المرفق:
   ```powershell
   Get-FileHash .\ChessVanguard-Setup.exe -Algorithm SHA256
   ```

### Installation Notes — تنبيه SmartScreen (مهم)

بدون شهادة **Code Signing** تجارية، سيُظهر Windows SmartScreen عند أول تشغيل تحذيرًا:
`Windows protected your PC` — **هذا سلوك معروف لكل تطبيق غير موقّع وليس خللًا في البناء.**

للتشغيل: اضغط **More info** ثم **Run anyway**. (الحل الجذري مستقبلًا: شراء شهادة توقيع — راجع Known Limitations في `FINAL_REPORT.md`).

## التطوير

المتطلبات: Node.js 20+ و Git.

```bash
npm ci            # تثبيت الاعتماديات (لا اعتماديات تشغيلية إطلاقًا — كل شيء devDependencies)
node scripts/fetch-engine.mjs --os linux   # جلب Stockfish الرسمي للتجربة المحلية (لينكس/ماك)
npm run start     # تشغيل نسخة التطوير
```

## الاختبارات (Quality Gates الرقمية)

```bash
npm run lint              # ESLint — يجب أن يخرج 0
npm run typecheck         # tsc --noEmit — يجب أن يخرج 0
npm run test:unit         # اختبارات الوحدة + التحقق من صحة كل الألغاز والدروس
npm run test:perft        # الدليل الرقمي على صحة قواعد الشطرنج (Perft)
npm run test:integration  # تكامل حقيقي ضد binary فعلي من Stockfish
npm run test:smoke        # إقلاع فعلي للتطبيق under Xvfb (لينكس)
```

## البناء

```bash
npm run build             # بناء renderer (Vite) + main/preload (esbuild)
npm run fetch:engine      # == node scripts/fetch-engine.mjs (نفس السكربت)
npm run dist -- --win     # مثبّت NSIS لويندوز (يتطلب windows or CI)
npm run dist -- --linux dir   # حزمة لينكس غير مضغوطة للتحقق المحلي
```

## ملف EXE وGitHub Actions

| Workflow | المُشغِّل | الوظيفة |
|---|---|---|
| `ci.yml` | كل push/PR | lint + typecheck + unit + **perft** + build + **smoke test** under Xvfb + تكامل حقيقي مع Stockfish على ubuntu |
| `windows-build.yml` | push على main / يدوي | بناء `ChessVanguard-Setup.exe` على `windows-latest` + التحقق من وجود الملف + بصمات SHA-256 + رفع Artifact |
| `release.yml` | وسم `v*.*.*` | **بوابة صارمة أولًا**: يرفض البناء ما لم يكن CI قد نجح على نفس الـ commit حرفيًا، ثم Release مع EXE + SHA-256 |

> **الترتيب الصحيح للإصدار**: ارفع الكود → انتظر نجاح CI على الـ commit → ارفع الوسم `v1.0.0` → سيتحقق `release.yml` تلقائيًا من نجاح CI قبل البناء.

## Architecture — البنية

```
src/
├── main/          # عملية Electron الرئيسية (أمان صارم + IPC + تخزين)
├── preload/       # جسر contextBridge فقط — لا Node في الـ renderer
├── renderer/      # الواجهة (8 شاشات، TypeScript خالص، RTL داكن)
├── chess/         # محرك القواعد (0x88) + SAN + حلّال الكش مات — مستقل تمامًا عن Stockfish
├── engine/        # UCI wrapper + EngineManager (subprocess عبر stdin/stdout فقط)
├── academy/       # 16 درسًا تفاعليًا (بيانات + أنواع)
├── puzzles/       # 24 لغزًا مُثبتًا + الحلّال المستخدم عند التشغيل
├── storage/       # حفظ JSON ذري (write tmp + rename)
├── localization/  # ar.json / en.json (اختبار تكافؤ مفاتيح في CI)
├── settings/      # إعدادات مع تعقيم (sanitization)
├── statistics/    # إحصائيات مشتقة (دوال نقية مُختبرة)
├── achievements/  # 14 إنجازًا (منطق تقييم نقي)
└── audio/         # مؤثرات WebAudio مُولّدة — صفر ملفات صوت
tests/{unit,integration,perft}/
.github/workflows/ # ci / windows-build / release
scripts/           # build / start / smoke / fetch-engine / generate-puzzles
resources/engines/ # باينريات Stockfish (تُجلب وقت البناء — لا تُرفع للمستودع)
```

### العزل القانوني لـ Stockfish (GPLv3)

- **لا يوجد أي linking** — لا ساكن ولا ديناميكي — بين كود التطبيق وStockfish.
- Stockfish يُشغَّل **subprocess مستقل** يتواصل عبر بروتوكول UCI (stdin/stdout) فقط.
- يُوزَّع الباينري الرسمي **غير المعدّل** داخل `resources/engines/` **خارج حزمة asar**، ومعه `COPYING.txt` (نص GPLv3 كامل) و`NOTICE.txt` (رابط الكود المصدري الرسمي).
- التفاصيل الكاملة: `THIRD_PARTY_LICENSES.md`.

## Third-Party Licenses

هذا المشروع يضم مكوّنات طرف ثالث تحتفظ برخصها الأصلية كاملة — راجع **`THIRD_PARTY_LICENSES.md`**. أبرزها:

- **Stockfish** (GPLv3) — كعملية خارجية مستقلة. المصدر: <https://github.com/official-stockfish/Stockfish>
- **Electron / Chromium / Node.js** (MIT / BSD وأزواجها) — إشعارات الترخيص تُضمَّن تلقائيًا في الحزمة (`LICENSES.chromium.html`).

## Development Tools (معلومة تقنية فقط — لا تنسب ملكية)

Electron · TypeScript · Vite · esbuild · electron-builder · Vitest · ESLint

## Developer — المالك والمطوّر

**Malek Hassan Ashour** — `© 2026 Malek Hassan Ashour — All Rights Reserved.`

</div>
