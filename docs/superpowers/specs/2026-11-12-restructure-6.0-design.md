# 6.0.0 — Katmanlı yapı ve kod kalitesi

- **Tarih:** 2026-11-12
- **Branch:** `restructure-6.0` (`design-without-defaults`'tan)
- **Sürüm:** 5.0.0 → 6.0.0 (public API kırılır)

## 1. Amaç

Paketin davranışı korunurken iç düzeni ve kodun okunabilirliği profesyonel seviyeye çıkarılır:

- Dosya yapısı, dokümanda tarif edilen katman hiyerarşisini birebir yansıtır ve bu hiyerarşi otomatik olarak denetlenir.
- Büyük dosyalar (dock `overlay.tsx` 2273, `types.ts` 1634, `cards.tsx` 1159 satır) tek sorumluluklu küçük dosyalara bölünür.
- Kod React 19.3'ün güncel kalıplarıyla, React Compiler'a dayanarak ve elle memoization yapmadan yazılır.
- Lint ve format altyapısı eklenir; dokümanlar kodla uyumlu hale getirilir.

### Başarı ölçütleri

1. `npm run verify` (format:check, lint, type-check, check:architecture, test, build, test:dist) sıfırla çıkar.
2. Mevcut 712 testin tamamı (yeni yollarında) geçer; test sayısı azalmaz.
3. Hiçbir katman yukarı import yapmaz; hiçbir modül başka bir modülü import etmez. İkisi de `check:architecture` tarafından zorlanır.
4. `src/` altında 400 satırı geçen dosya kalmaz; hedef ~300 satır. İstisnalar gerekçeleriyle bu dosyada listelenir.
5. Her public API değişikliği `MIGRATION.md`'de yer alır.
6. Bundle boyutu öncesi/sonrası raporlanır.

### Kapsam dışı

- Yeni özellik veya davranış değişikliği. Hata bulunursa ayrı commit'te düzeltilir ve not edilir.
- Monorepo / workspace paketlerine bölme.
- Build aracının (tsup) değiştirilmesi.

## 2. Mevcut durum (başlangıç)

- React 19.3.0, Next 16.3.8, TypeScript 5.8, tsup 8.5.
- type-check ✔, check:architecture ✔ (213 dosya, döngü yok), 712/712 test ✔.
- **Katman ihlali:** `design/provider.tsx` (katman 1) ve `theme.tsx` (dokümana göre katman 2), `@/kernel`'den `getOrCreateGlobalContext` import ediyor; `design/provider.tsx` ayrıca `@/theme`'yi import ediyor.
- **Dokümanla kod arasındaki uyumsuzluklar:** dokümanda zorunlu denen `utils.ts` hiçbir modülde yok; `npm run lint` ve ESLint anlatılıyor ama projede yok; dokümanda "520+ test" yazıyor, gerçekte 712 test var.
- **Elle memoization:** 159 `useCallback`, 105 `useMemo`, 22 `memo()`.
- **Eski kalıplar:** 21 `useContext`, 3 `createElement(X.Provider)`, 43 `useIsomorphicLayoutEffect`, 13 `as unknown as`, 8 `any`.
- **Tekrarlanan entry listesi:** subpath'ler `package.json` exports'unda, tsup'ın iki entry listesinde ve `"use client"` dosya listesinde ayrı ayrı tutuluyor.

## 3. Dizin yapısı ve katmanlar

```
src/
├── foundation/                  0 · React yok, server/edge-safe
│   ├── result/                  ok/err, Result<T,E>         (src/result.ts)
│   ├── events/                  globalEvents, EVENT_TYPES   (src/events.ts)
│   ├── utils/                   (src/utils/*)
│   └── recipes/                 recipe, define, anatomy, split, cn, types   (src/design/{recipe,recipes,define,anatomy,split,cn,types}.ts)
│
├── react/                       1 · React primitifleri
│   ├── context/                 getOrCreateGlobalContext    (src/kernel/context-registry.ts)
│   ├── hooks/                   (src/hooks/*)
│   ├── theme/                   (src/theme.tsx)
│   └── ui/                      components/, provider, utils   (src/design/{components,provider,utils})
│
├── core/                        2 · Orkestrasyon
│   ├── kernel/                  (src/kernel/* — context-registry hariç)
│   ├── error/                   (src/error/*)
│   └── provider/                (src/provider.tsx)
│
├── modules/                     3 · Modüller
│   ├── index.ts                 defaultModules
│   └── <name>/
│
└── index.ts
```

### 3.1 Katman kuralları (zorunlu)

| Katman | İmport edebileceği yerler |
|---|---|
| `foundation/*` | yalnızca `foundation/*` ve React/DOM içermeyen dış bağımlılıklar (`clsx`, `tailwind-merge`) |
| `react/*` | `foundation/*`, `react/*` |
| `core/*` | `foundation/*`, `react/*`, `core/*` |
| `modules/<a>/*` | alt katmanların hepsi ve `modules/<a>/*`; **başka bir `modules/<b>` yasak** |
| `modules/index.ts`, `src/index.ts` | her şey (birleştirici barrel'lar) |

- `foundation/*` dosyaları modül düzeyinde `react`, `react-dom`, `next/*`, `motion/*` import etmez ve `window`/`document`'a modül düzeyinde dokunmaz.
- `check-architecture.mjs` dosyanın yolundan katmanını çıkarır ve yukarı doğru her import'u hata olarak raporlar. Döngü kontrolü ve `uses` kontrolü korunur.
- Katman içinde import'lar `@/<katman>/<alan>/<dosya>` şeklinde doğrudan dosyaya yapılır. Alan barrel'ı (`index.ts`) yalnızca public entry'dir; döngü riskini önlemek için iç kod barrel üzerinden import etmez.

### 3.2 Modüllerin iç düzeni

**Düz düzen** (varsayılan): loading, media, controls, notification, navigation, context-menu, ambient.

| Dosya | Sorumluluk | Zorunlu |
|---|---|:-:|
| `index.ts` | Public barrel | ✅ |
| `module.tsx` | `defineModule()` ve `declare module` genişletmeleri | ✅ |
| `types.ts` | Tip sözleşmeleri, runtime kodu yok | ✅ |
| `constants.ts` | Modül kimliği, `defineThemeSpec`, sabitler | ✅ |
| `context.tsx` | Context ve provider; en fazla bir context | — |
| `state.ts` | Başlangıç state'i, saf reducer'lar | — |
| `hooks.ts` | View-model hook'ları | — |
| `overlay.tsx` | Saf görsel JSX | — |
| `motion.ts` | `use*Motion()` | — |
| `utils.ts` | Saf yardımcılar | — |

Ambient'in `server/` ve `worker/` alt entry'leri yerinde kalır.

**Klasörlü düzen:** düz düzende 12 dosyayı veya tek dosyada ~400 satırı geçen modüller (dock, background, modal) şu düzene geçer:

```
modules/<name>/
├── index.ts  module.tsx  constants.ts  context.tsx  motion.ts
├── components/        tek dosya = tek public bileşen (+ yalnız onun kullandığı küçük alt bileşenler)
├── hooks/             view-model hook'ları, bileşen başına bir dosya
├── model/             saf state ve makine mantığı (React yok)
├── lib/               saf yardımcılar (React yok)
└── types/             alana göre bölünmüş tipler + index.ts
```

Bir alt özelliği zaten kendi klasöründe toplanmış modüller (dock: `routing/`, `runtime/`, `status/`, `surface/`) bu klasörleri korur. Bu klasörlerin içi de aynı `components/`, `hooks/`, `model/` ayrımına uyar.

**Dock hedef düzeni:**

```
modules/dock/
├── index.ts  module.tsx  constants.ts  context.tsx  provider.tsx  motion.ts
├── components/
│   ├── dock.tsx                 Dock (portal kökü)
│   ├── card-item.tsx            DockCardItem
│   ├── card-header.tsx          DockCardHeader
│   ├── card-banner.tsx          DockCardBanner
│   ├── command-bar.tsx          DockCommandBar, DockCommand
│   ├── icon.tsx                 DockIcon, DockIconOverlay
│   ├── title.tsx  description.tsx  badge.tsx
│   ├── item-content.tsx         StandardItemContent, LoadingItemContent
│   ├── media-controls.tsx  media-scrubber.tsx
│   ├── hud-view.tsx  breadcrumbs-card.tsx
│   ├── status-actions.tsx       ErrorActions, GuardActions, NotFoundActions
│   └── surface/
│       ├── shell.tsx  controls.tsx  header-button.tsx
│       ├── extensions-bar.tsx  item-content.tsx  action.tsx
├── hooks/                       (cards.tsx view-model'leri, hooks.ts, hud.ts)
├── model/                       state.ts, layout.ts, paths.ts
├── lib/                         dom.ts, styles.ts, helpers.ts
├── types/                       card.ts, surface.ts, hud.ts, media.ts, routing.ts, theme.ts, index.ts
├── routing/  runtime/  status/  surface/
```

Background ve modal da aynı kurala göre bölünür; tam dosya listeleri uygulama planında verilir.

### 3.3 İsimlendirme

- Dosya ve klasör adları kebab-case olur.
- `components/` altındaki dosya adları modül önekini tekrar etmez (`dock-card-item.tsx` değil `card-item.tsx`). Export isimleri ise önekli kalır (`DockCardItem`).
- Hook dosyaları `use-` ile başlar (`hooks/use-card-item-model.ts`).
- Testler kaynak ağacını yansıtır: `tests/{foundation,react,core,modules}/…`.

## 4. Public subpath'ler (6.0.0)

| 5.x | 6.0 | Kaynak |
|---|---|---|
| `.` | `.` | `src/index.ts` |
| `./result` | `./result` | `foundation/result` |
| `./events` | `./events` | `foundation/events` |
| `./utils` | `./utils` | `foundation/utils` |
| `./design/recipes` | **`./recipes`** | `foundation/recipes` |
| `./hooks` | `./hooks` | `react/hooks` |
| `./theme` | `./theme` | `react/theme` |
| `./design` | **`./ui`** | `react/ui` |
| `./kernel` | `./kernel` | `core/kernel` |
| `./error` | `./error` | `core/error` |
| `./provider` | `./provider` | `core/provider` |
| `./modules` | `./modules` | `modules/index.ts` |
| `./dock` … `./navigation` (10 modül) | aynı | `modules/<name>` |
| `./ambient/server`, `./ambient/worker` | aynı | `modules/ambient/{server,worker}` |
| `./modules/*` | **kaldırılır** | — |

- `./ui` yalnızca ui bileşenlerini ve `UiProvider`'ı export eder. Tarifler (`recipes`) artık `./recipes`'tan alınır. 5.x'te `./design` her ikisini de export ediyordu; `./ui` geçiş kolaylığı için `./recipes`'ı da yeniden export eder.
- `getOrCreateGlobalContext`, `./kernel`'den yeniden export edilmeye devam eder; tüketiciler için değişiklik olmaz.
- **Tek kaynak:** `scripts/entries.mjs`, her entry için `{ subpath, source, client: boolean }` tanımını tutar. `tsup.config.ts` entry'leri ve `"use client"` banner listesini bu dosyadan üretir. `scripts/sync-exports.mjs`, `package.json#exports`'u bu dosyadan yazar; `check:architecture` ikisinin uyumlu olduğunu doğrular. Server-safe entry'lerin (`client: false`) gerçekten katman 0'da olduğunu da aynı kontrol denetler.
- **Export isimleri:** isimler aynı kalır. Gereksiz takma adlar (`useModuleTheme` = `useTheme`) 6.0'da kaldırılır. Kaldırılan her isim `MIGRATION.md`'de eşleniğiyle listelenir.

## 5. Kod standartları

### 5.1 React Compiler

- `babel-plugin-react-compiler` (`target: "19"`, `compilationMode: "infer"`) build'e eklenir. Derlenen kod React 19'un içindeki `react/compiler-runtime`'ı kullanır; yeni bir runtime bağımlılığı eklenmez.
- **Entegrasyon:** tsup'a bir esbuild eklentisi (`scripts/esbuild-react-compiler.mjs`) eklenir. Eklenti `src/react/**`, `src/core/**` ve `src/modules/**` altındaki `.ts`/`.tsx` dosyalarını `@babel/core` + `@babel/preset-typescript` (JSX korunur) + compiler eklentisi ile dönüştürür, sonra esbuild'e devreder. `foundation/**` dosyaları eklentiden geçmez.
- Build, compiler'ın atladığı bileşen ve hook'ları `logger` ile raporlar. Rapor build çıktısına yazılır ve atlanan her öğe ya düzeltilir ya da gerekçesiyle `docs/architecture-and-rules.md`'ye not edilir.
- **Testler:** `node --test` kaynak dosyalar üzerinde compiler olmadan çalışır; bu, davranışın memoization'a bağlı olmadığını doğrular. `test:dist` derlenmiş çıktıyı smoke test eder.
- **Memoization temizliği:** `useMemo`, `useCallback` ve `memo()` kaldırılır. Kalabilecek olanlar:
  - kimliği anlamsal olan tekil nesneler: `useState(() => create…())` ve `useRef` ile tutulanlar;
  - `useSyncExternalStore` için stabil `subscribe`/`getSnapshot`; bunlar hook dışına alınarak stabilleştirilir;
  - compiler'ın atladığı ve düzeltilemeyen durumlar; bunlar yorumla gerekçelendirilir.

### 5.2 React 19 kalıpları

| Önce | Sonra |
|---|---|
| `useContext(X)` | `use(X)` |
| `createElement(X.Provider, { value }, children)` | `<X value={value}>{children}</X>` |
| Effect'te "latest ref" (`ref.current = fn` + effect'te `ref.current()`) | `useEffectEvent` |
| `useIsomorphicLayoutEffect` | `useLayoutEffect`. Ön koşul: React 19'un SSR'da `useLayoutEffect` uyarısını kaldırdığı uygulama öncesinde doğrulanır. Doğrulanamazsa mevcut hook kalır. |
| Ref callback + ayrı temizlik effect'i | Cleanup döndüren ref callback |

`hooks` public entry'si `useIsomorphicLayoutEffect`'i export ediyorsa, 6.0'da kaldırılır ve `MIGRATION.md`'ye eklenir.

### 5.3 Okunabilirlik

- Bileşenler `function` bildirimiyle yazılır; props `interface XProps` ile tanımlanır ve aynı dosyada ya da modülün `types/` klasöründe durur.
- Erken `return` tercih edilir; iç içe ternary kullanılmaz. JSX içindeki koşullu hesaplamalar isimli değişkenlere çıkarılır.
- Bir fonksiyon tek bir iş yapar; ~40 satırı geçen fonksiyonlar bölünür.
- Sihirli sayılar ve string'ler isimli sabitlere taşınır.
- `as unknown as` ve `any` doğru tiplerle değiştirilir. Kalanlar tek satırlık gerekçe yorumu taşır.
- Import sırası: dış paketler, sonra `@/` katman import'ları, sonra göreli import'lar; tip import'ları `import type` ile yazılır. Sıralamayı Prettier değil, ESLint uygular.
- **Yorumlar:** public API (her entry'den export edilen öğeler) kısa JSDoc taşır. İç koda yorum yalnızca "neden" sorusunu yanıtlıyorsa eklenir.

### 5.4 TypeScript

`tsconfig.json`'a eklenecekler: `verbatimModuleSyntax`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitOverride`, `noFallthroughCasesInSwitch`. `paths` yeni klasörlere göre güncellenir.

## 6. Tooling

- **ESLint 9 flat config** (`eslint.config.js`):
  - `typescript-eslint` `recommendedTypeChecked` + `stylisticTypeChecked`;
  - `eslint-plugin-react-hooks` güncel `recommended` preset'i (compiler tabanlı kurallar dahil);
  - `no-restricted-imports`: deep import (`@omerdlw/base-framework/dist/*`) ve `foundation/**` içinde `react*`/`next*`/`motion*` yasak;
  - `@typescript-eslint/consistent-type-imports`.
- **Prettier:** `.prettierrc.json` mevcut stile göre yazılır (varsayılanlar, çift tırnak, sondaki virgüller); `.prettierignore` eklenir.
- **Script'ler:**
  - `lint`, `lint:fix`, `format`, `format:check`;
  - `verify` = `format:check && lint && type-check && check:architecture && test && build && test:dist`.
- **CI:** tek bir `npm run verify` adımı çalıştırır. Node matrisi `22.x` ve `24.x` olur. `package.json`'a `"engines": { "node": ">=22" }` eklenir.
- **Paket içeriği:** `package.json#files` içindeki `docs` girdisine `!docs/superpowers` eklenir. Spec ve plan dosyaları npm paketine girmez; bu `npm pack --dry-run` ile doğrulanır.
- **Repo temizliği:** kökteki `omerdlw-base-framework-1.0.5.tgz` ve `.DS_Store` yerel olarak silinir (ikisi de zaten git'e eklenmemiş). `.remember/` kök `.gitignore`'a eklenir.

## 7. Dokümantasyon

- `docs/architecture-and-rules.md`: yeni katman tablosu, iki modül düzeni, "kod nereye gider" karar ağacı, doğru `verify` komutu ve gerçek test sayısı.
- `docs/` altındaki tüm import örnekleri yeni subpath'lere göre güncellenir (`./design` → `./ui`, `./design/recipes` → `./recipes`).
- `templates/AGENTS.md` aynı şekilde güncellenir.
- Kökte `MIGRATION.md` (5.x → 6.0) oluşturulur: subpath tablosu, kaldırılan isimler ve eşlenikleri, gerekirse `useIsomorphicLayoutEffect` notu.
- `README.md`: kurulum, peer'lar, `engines`.

## 8. Uygulama sırası

Her adım ayrı commit'tir ve her commit'te `verify`'ın o ana kadar mevcut olan kısmı yeşildir.

1. **Tooling:** ESLint, Prettier, tsconfig bayrakları, `verify` script'i, lint temizliği (davranış değişmez).
2. **Taşıma:** `git mv` ile katmanlı yapıya geçiş; import'lar bir codemod script'iyle güncellenir; `context-registry` `react/context`'e taşınır; `check-architecture` katman kuralıyla genişletilir.
3. **Subpath'ler:** `entries.mjs`, tsup üretimi, `sync-exports`, `package.json` exports, `dist.smoke` güncellemesi.
4. **Bölme:** dock, background, modal klasörlü düzene geçer; büyük dosyalar bölünür.
5. **Modernleştirme:** bölüm 5.2 ve 5.3, modül modül (her modül bir commit).
6. **Compiler:** esbuild eklentisi, compiler raporu, memoization temizliği.
7. **Kapanış:** dokümanlar, `MIGRATION.md`, sürüm 6.0.0, bundle boyutu raporu, `npm pack --dry-run` kontrolü.

## 9. Riskler

| Risk | Önlem |
|---|---|
| Compiler bir bileşenin davranışını değiştirir (render içi mutasyon vb.) | `react-hooks` compiler kuralları lint'te yakalar; `test:dist` derlenmiş çıktıyı test eder; atlanan bileşenler raporlanır |
| Memo kaldırınca bir referans eşitliği bağımlılığı kırılır (ör. effect dependency, context value) | Testler compiler'sız kaynağa karşı koşar; bu tür durumlar orada başarısız olur ve ilgili yer 5.1'deki istisnalara göre ele alınır |
| Büyük taşıma git geçmişini koparır | `git mv` ve yalnızca taşıma içeren ayrı commit; içerik değişiklikleri sonraki commit'lerde |
| Tüketicilerin import'ları kırılır | Major sürüm, `MIGRATION.md`, `./ui`'nin recipes'ı yeniden export etmesi |
| Bundle boyutu artar | Öncesi/sonrası ölçülür ve raporlanır; artış %10'u geçerse compiler kapsamı yeniden değerlendirilir |
