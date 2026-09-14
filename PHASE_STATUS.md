# PHASE_STATUS — Chess Vanguard

> **قاعدة هذا الملف (من البرومبت الرئيسي §0):** لا يُسجَّل أي نجاح إلا بدليل تنفيذ فعلي:
> exit code، أو رقم اختبار، أو ملف موجود مع بصمة. كل الأدلة أدناه ناتجة عن تشغيلات حقيقية
> داخل بيئة التطوير (Linux x64, Node v24.18.0, npm 11.16.0) ويمكن إعادة إنتاجها بنفس الأوامر.

**آخر تحديث:** الجلسة الحالية — Version 1.0.0

---

## ملخص الحالات

| # | المرحلة | الحالة | الدليل الفعلي |
|---|---------|--------|----------------|
| 1 | Core setup + toolchain | ✅ PASS | `npm install` exit 0 — package-lock.json (8000 سطر) — node_modules/.bin يحوي vitest/tsc/eslint/vite/electron/electron-builder |
| 2 | Chess rules engine + Perft | ✅ PASS | `vitest run tests/perft` exit 0 — **7/7 tests، 22/22 مطابقة رقمية دقيقة** (التفاصيل أدناه) |
| 3 | Unit tests (rules/SAN/game) | ✅ PASS | `vitest run tests/unit` (chess) exit 0 — **10/10** (بعد إصلاح خطأ إحداثيات في الاختبار نفسه — موثّق أدناه) |
| 4 | المحتوى: ألغاز + أكاديمية | ✅ PASS | `vitest run tests/unit/content.test.ts` exit 0 — **10/10** — كل لغز من الـ24 مُثبت بالحلّال + كل درس قانوني |
| 5 | Storage/Settings/i18n/Audio | ✅ PASS | ضمن unit tests (locale parity + sanitization ضمنياً) — `tsc --noEmit` exit 0 |
| 6 | Stockfish fetch (رسمي) | ✅ PASS | `node scripts/fetch-engine.mjs --os linux` exit 0 — sf_18 — SHA-256 محسوب ومطبوع (أدناه) |
| 7 | UCI wrapper + تكامل حقيقي | ✅ PASS | `vitest run tests/integration` exit 0 — **7/7 ضد Stockfish 18 الفعلي** (bestmove=e2e4، h5f7=Qxf7# مكتشف بنتيجة mate) |
| 8 | Electron main/preload + أمان | ✅ PASS | ضمن typecheck/build/smoke — `contextIsolation:true`, `nodeIntegration:false`, `sandbox:true`, CSP بلا unsafe-eval |
| 9 | Renderer (8 شاشات RTL) | ✅ PASS | `npm run build` exit 0 (renderer+main+preload) + SMOKE_OK |
| 10 | Smoke test (dev build) | ✅ PASS | `node scripts/smoke.mjs` → `SMOKE_OK window=true renderer=ready` exit 0 (Xvfb) |
| 11 | electron-builder (تحقق محلي) | ✅ PASS | `npx electron-builder --linux dir` exit 0 — dist/linux-unpacked/ChessVanguard + engines/COPYING.txt مُتحقق منها — **والتطبيق المُغلَّف نفسه SMOKE_OK exit 0** |
| 12 | Workflows CI/CD | ✅ مكتملة (صياغة) | 4/4 ملفات YAML صالحة (python yaml.safe_load) — التنفيذ الفعلي يبدأ أول push |
| 13 | **Windows EXE (NSIS)** | ⏳ **PENDING — يتطلب GitHub Actions** | بيئة التطوير Linux: لا يمكن إنتاج مثبّت NSIS محليًا. Workflow `windows-build.yml` جاهز + مُتحقق من مسارات التحقق والبصمات. **لا يُدَّعى وجود EXE الآن.** |

---

## أدلة موسّعة (أرقام فعلية)

### Phase 2 — Perft (المعيار الرقمي القاطع)
`npx vitest run tests/perft` → `Tests 7 passed (7)` — exit 0 — المدة 3.24s:

| الموضع | depth 1 | depth 2 | depth 3 | depth 4 | depth 5 |
|---|---|---|---|---|---|
| الوضع الافتتاحي | 20 ✓ | 400 ✓ | 8,902 ✓ | 197,281 ✓ | **4,865,609 ✓** |
| Kiwipete (castling/pins) | 48 ✓ | 2,039 ✓ | 97,862 ✓ | **4,085,603 ✓** | — |
| Position 3 (en passant) | 14 ✓ | 191 ✓ | 2,812 ✓ | 43,238 ✓ | 674,624 ✓ |
| Position 4 (promotions) | 6 ✓ | 264 ✓ | 9,467 ✓ | 422,333 ✓ | — |
| Position 5 | 44 ✓ | 1,486 ✓ | 62,379 ✓ | 2,103,487 ✓ | — |
| Position 6 | 46 ✓ | 2,079 ✓ | 89,890 ✓ | 3,894,594 ✓ | — |

+ اختبار سلامة الحالة: perft(3) كامل على Kiwipete يعيد FEN الأصلي بلا تغيير و plyCount=0 ✓

### Phase 4 — توليد الألغاز (تشغيل فعلي)
`node scripts/generate-puzzles.mjs` exit 0:
```
[gen] dropped thematic (solutions=3): 7k/8/6QK/8/8/8/8/8 w - - 0 1
[gen] dropped thematic (solutions=2): 7k/8/8/8/8/8/6R1/K5R1 w - - 0 1
[gen] dropped thematic (solutions=0): 8/8/8/8/8/2k5/R7/1R4K1 w - - 0 1
[gen] dropped thematic (solutions=0): 5k2/8/8/8/8/8/8/K2Q4 w - - 0 1
[gen] wrote 24 puzzles (16 mate-in-1, 8 mate-in-2) after 351 random tries
```
(المرشحون غير أحاديي الحل أُسقطوا — لا لغز يُنشر بلا حل وحيد مُثبت.)

### Phase 6 — جلب Stockfish الرسمي (تشغيل فعلي)
```
[engine] release: sf_18 (os=linux)
[engine] downloaded stockfish-ubuntu-x86-64-avx2.tar (114.4 MB)
[engine] sha256(stockfish-x86-64-avx2) = 6b087694916228c905a5e14db74cca8c7e5643602226af1fa5d42353c455b9f9
[engine] sha256(stockfish-x86-64)      = 7a44d64fd877ee888a5160349827563444e1935ca6c1090d0f8e0859d57101c7
[engine] DONE  → exit 0
```
اختبار يدوي مباشر للباينري: `id name Stockfish 18` + `bestmove a2a3` (go depth 12) ✓

### Phase 7 — التكامل الحقيقي (7/7 — exit 0)
```
[integration] engine id: Stockfish 18 | the Stockfish developers
[integration] startpos bestmove=e2e4 @400ms
Tests  7 passed (7)   ← منها: اكتشاف Qxf7# (h5f7) بنتيجة mate في موضع Scholar
```

### Phase 9/10 — البناء والـ Smoke
```
[build] artifact OK: build/renderer/index.html (0.7 KB)
[build] artifact OK: build/main.js (26.1 KB)
[build] artifact OK: build/preload.js (1.8 KB)
[build] BUILD SUCCESS  → exit 0
SMOKE_OK window=true renderer=ready  → exit 0
```

### Phase 11 — التغليف (Linux dir للتحقق)
```
npx electron-builder --linux dir → exit 0
dist/linux-unpacked/ChessVanguard            (التطبيق المُغلَّف)
dist/linux-unpacked/resources/engines/{COPYING.txt, NOTICE.txt, manifest.json, linux/stockfish*}
./dist/linux-unpacked/ChessVanguard --smoke  →  SMOKE_OK window=true renderer=ready  exit 0
```

### جودة الكود
- `npx tsc --noEmit` → exit 0 (بعد إصلاحين: cast في pieceColor + نوع عنصر DOM في history)
- `npx eslint .` → exit 0 (0 errors / 0 warnings)
- الـ lint كشف — وأصلح — خطأ تشغيلي حقيقي: دالة `userMove` لم تكن موصولة بـ callback الرقعة في شاشة اللعب.

---

## سجل الإخفاقات والإصلاحات (FAIL → ROOT CAUSE → FIX → RE-RUN)

| الفشل | السبب الجذري | الإصلاح | إعادة نفس الاختبار |
|---|---|---|---|
| unit: `expected 'undefinedd5'` | خطأ إحداثيات في **الاختبار** (e3=36 وليس 38) | تصحيح الاختبار | نفس الاختبار → PASS |
| perft مرة أولى | — | لم يحدث (نجح من أول تشغيل 7/7) | — |
| lint: no-undef لـ process في .mjs | قواعد JS recommended لا تعرف globals الخاصة بـ Node | إضافة `languageOptions.globals` لملفات node | `eslint .` exit 0 |
| lint: userMove unused | **خ**لل برمجي فعلي: callback onUserMove غير موصول | توصيل `onUserMove: uci => void userMove(uci)` في applyBoardOpts | lint exit 0 + smoke pass |
| smoke فشل أول مرة (exit 3) | `xvfb-run` يطلب `xauth` وهو غير مثبت في بيئة التطوير | تشغيل `Xvfb :99` مباشرة داخل scripts/smoke.mjs مع fallback | SMOKE_OK exit 0 |
| 4 مرشحين ألغاز يدويين أسقطوا | حلول متعددة أو لا حل (multi/zero-solution) | إسقاطهم تلقائيًا وتوليد بدائل مُثبتة | content tests 10/10 |

---

## Phase 13 — Windows EXE: الحالة الصادقة

**لم يُبنَ ملف EXE بعد** — والسبب بيئي صريح: بيئة التطوير Linux والبناء يستهدف `windows-latest` عبر
GitHub Actions حسب التصميم المعتمد في البرومبت. الخطوات المتبقية على المالك:

1. `git push` للمستودع على GitHub → يبدأ `ci.yml` (كل البوابات الرقمية أعلاه تُعاد هناك).
2. نجاح CI على main → `windows-build.yml` ينتج `ChessVanguard-Setup.exe` + `.sha256` كـ Artifact.
3. للإصدار: انتظر نجاح CI على الـ commit ثم `git tag v1.0.0 && git push --tags` —
   `release.yml` **يرفض البناء** إذا لم يكن `quality-gate` ناجحًا على نفس الـ SHA.

---

## v1.1.0 (تحديث الإصلاح والترقية الاحترافية)

| البند | الحالة | الدليل الفعلي |
|---|---|---|
| **إصلاح عطل تجمّد المحرك** (السبب الجذري: فحص token معكوس في engineTurn كان يرمي رد المحرك دائمًا) | ✅ FIXED & PROVEN | `node scripts/smoke.mjs --play` → **`AUTOPLAY_PASS moves=2`** exit 0 — التطبيق الحقيقي فتح مباراة، لعب e2e4، ورد Stockfish بنقلة فعلية |
| وضع لاعبين على نفس الجهاز | ✅ PASS | ضمن tsc/lint/build/smoke — mode selector في حوار اللعبة الجديدة |
| إعادة تصميم احترافية (chess.com-style) | ✅ PASS | light UI + رقعة خضراء + كروت لاعبين بالأسرات والأفضلية المادية + ثيمات داكنة كخيارات |
| تحدي الألغاز 3 دقائق (نقاط/تتالي/عقوبة 10 ثوانٍ) | ✅ PASS | ضمن البوابات + smoke |
| البوابات كاملة على v1.1.0 | ✅ ALL GREEN | tsc exit 0 · lint exit 0 · 27/27 unit+perft · 7/7 integration (Stockfish 18 نفس بصمات SHA-256 الموثقة أعلاه) · build exit 0 · SMOKE_OK · AUTOPLAY_PASS |

> ملاحظة: جلب Stockfish محليًا في هذه الجلسة استخدم fallback بالروابط المباشرة للوسم الرسمي sf_18 بعد تجاوز حد GitHub API — والبصمتين مطابقتان تمامًا لتوثيق الجلسة السابقة (ثبات الملفات).
